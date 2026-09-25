using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text;
using System.Net.Http;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FocusTrace.Agent;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly HttpClient _httpClient = new();

    private readonly string _webAppUrl;

    private CancellationTokenSource? _trackingCancellation;

    private readonly object _stateLock = new();

    public bool IsConnected { get; private set; }

    public bool IsTrackingEnabled { get; private set; }

    public string ConnectionMessage { get; private set; }
        = "Not connected";

    public event EventHandler<AgentStatusChangedEventArgs>? StatusChanged;

    public Worker(
        ILogger<Worker> logger,
        IConfiguration configuration)
    {
        _logger = logger;

        _webAppUrl =
            configuration["WebAppUrl"]
            ?? "http://localhost:3000";

        _logger.LogInformation(
            "FocusTrace server URL: {WebAppUrl}",
            _webAppUrl
        );
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "FocusTrace Agent started."
        );

        try
        {
            await Task.Delay(
                Timeout.Infinite,
                stoppingToken
            );
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown.
        }

        _logger.LogInformation(
            "FocusTrace Agent stopped."
        );
    }

    public async Task ConnectAsync()
    {
        if (IsConnected)
            return;

        _logger.LogInformation(
            "Connect requested."
        );

        UpdateStatus(
            false,
            false,
            "Connecting..."
        );

        var storedToken = CredentialStore.LoadToken();

        if (!string.IsNullOrWhiteSpace(storedToken))
        {
            _logger.LogInformation(
                "Existing desktop credential found."
            );

            var status = await ValidateStoredCredential(
                storedToken,
                CancellationToken.None
            );

            if (status is not null)
            {
                _logger.LogInformation(
                    "Desktop credential verified successfully."
                );

                await StartTracking(
                    storedToken,
                    status
                );

                return;
            }

            _logger.LogWarning(
                "Stored desktop credential is no longer valid."
            );

            CredentialStore.DeleteToken();
        }

        await AuthorizeDesktopAsync();
    }

    public async Task DisconnectAsync()
    {
        if (!IsConnected)
            return;

        _logger.LogInformation(
            "Disconnect requested."
        );

        try
        {
            _trackingCancellation?.Cancel();
        }
        catch
        {
            // Ignore cancellation errors.
        }

        _trackingCancellation?.Dispose();
        _trackingCancellation = null;

        IsConnected = false;
        IsTrackingEnabled = false;

        UpdateStatus(
            false,
            false,
            "Disconnected"
        );

        _logger.LogInformation(
            "FocusTrace tracking disconnected."
        );

        await Task.CompletedTask;
    }

    private async Task AuthorizeDesktopAsync()
    {
        var port = GetFreePort();

        _logger.LogInformation(
            "Desktop authorization callback listening on port {Port}",
            port
        );

        using var listener = new HttpListener();

        listener.Prefixes.Add(
            $"http://127.0.0.1:{port}/callback/"
        );

        listener.Start();

        var callbackUrl =
            $"http://127.0.0.1:{port}/callback/";

        var authorizeUrl =
            $"{_webAppUrl}/desktop/authorize" +
            $"?callback={Uri.EscapeDataString(callbackUrl)}";

        _logger.LogInformation(
            "Opening FocusTrace authorization in browser."
        );

        OpenBrowser(authorizeUrl);

        UpdateStatus(
            false,
            false,
            "Waiting for browser authorization..."
        );

        try
        {
            while (true)
            {
                var contextTask =
                    listener.GetContextAsync();

                var completedTask =
                    await Task.WhenAny(
                        contextTask,
                        Task.Delay(
                            Timeout.Infinite
                        )
                    );

                if (completedTask != contextTask)
                    return;

                var context =
                    await contextTask;

                var code =
                    context.Request.QueryString["code"];

                if (string.IsNullOrWhiteSpace(code))
                {
                    await SendResponse(
                        context,
                        "Authorization code is missing."
                    );

                    continue;
                }

                _logger.LogInformation(
                    "Desktop authorization code received."
                );

                await SendResponse(
                    context,
                    "FocusTrace authorization received. You can close this browser window."
                );

                var exchangeResult =
                    await ExchangeAuthorizationCode(
                        code,
                        CancellationToken.None
                    );

                if (!exchangeResult.Success)
                {
                    _logger.LogError(
                        "Desktop token exchange failed: {Error}",
                        exchangeResult.Error
                    );

                    UpdateStatus(
                        false,
                        false,
                        "Authorization failed"
                    );

                    return;
                }

                if (string.IsNullOrWhiteSpace(
                        exchangeResult.Token))
                {
                    UpdateStatus(
                        false,
                        false,
                        "Authorization failed"
                    );

                    return;
                }

                CredentialStore.SaveToken(
                    exchangeResult.Token
                );

                _logger.LogInformation(
                    "Desktop credential securely stored."
                );

                var status =
                    await ValidateStoredCredential(
                        exchangeResult.Token,
                        CancellationToken.None
                    );

                if (status is null)
                {
                    _logger.LogError(
                        "Newly authorized desktop credential could not be verified."
                    );

                    CredentialStore.DeleteToken();

                    UpdateStatus(
                        false,
                        false,
                        "Unable to verify connection"
                    );

                    return;
                }

                await StartTracking(
                    exchangeResult.Token,
                    status
                );

                return;
            }
        }
        finally
        {
            listener.Stop();
        }
    }

    private async Task StartTracking(
        string token,
        StatusResponse status)
    {
        _trackingCancellation?.Cancel();
        _trackingCancellation?.Dispose();

        _trackingCancellation =
            new CancellationTokenSource();

        IsConnected = true;
        IsTrackingEnabled =
            status.TrackingEnabled;

        var message =
            status.TrackingEnabled
                ? "Connected"
                : "Connected — tracking disabled by HR";

        UpdateStatus(
            true,
            status.TrackingEnabled,
            message
        );

        _logger.LogInformation(
            "Tracking enabled: {TrackingEnabled}, inactivity timeout: {Timeout} minutes",
            status.TrackingEnabled,
            status.InactivityTimeoutMinutes
        );

        _ = RunTrackingSafely(
            token,
            status,
            _trackingCancellation.Token
        );

        await Task.CompletedTask;
    }

    private async Task RunTrackingSafely(
        string token,
        StatusResponse status,
        CancellationToken cancellationToken)
    {
        try
        {
            using var activityMonitor =
                new ActivityMonitor();

            activityMonitor.Start();

            _logger.LogInformation(
                "Activity monitoring started."
            );

            await RunActivityLoop(
                activityMonitor,
                token,
                status,
                cancellationToken
            );
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Tracking stopped."
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Tracking loop stopped unexpectedly."
            );

            IsConnected = false;
            IsTrackingEnabled = false;

            UpdateStatus(
                false,
                false,
                "Tracking stopped unexpectedly"
            );
        }
    }

    private void UpdateStatus(
        bool connected,
        bool trackingEnabled,
        string message)
    {
        lock (_stateLock)
        {
            IsConnected = connected;
            IsTrackingEnabled = trackingEnabled;
            ConnectionMessage = message;
        }

        StatusChanged?.Invoke(
            this,
            new AgentStatusChangedEventArgs(
                connected,
                trackingEnabled,
                message
            )
        );
    }

    private async Task<StatusResponse?> ValidateStoredCredential(
    string token,
    CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"{_webAppUrl}/api/desktop/status"
            );

            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue(
                    "Bearer",
                    token
                );

            var response = await _httpClient.SendAsync(
                request,
                cancellationToken
            );

            var result =
                await response.Content.ReadFromJsonAsync<StatusResponse>(
                    cancellationToken: cancellationToken
                );

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Stored desktop credential was rejected by the server."
                );

                return null;
            }

            if (result is null ||
                !result.Success ||
                !result.Authenticated)
            {
                _logger.LogWarning(
                    "Server returned an invalid desktop status response."
                );

                return null;
            }

            return result;
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            // Normal application shutdown.
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Unable to validate desktop credential."
            );

            return null;
        }
    }

    private async Task<ExchangeResult> ExchangeAuthorizationCode(
        string code,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                $"{_webAppUrl}/api/desktop/exchange",
                new
                {
                    code
                },
                cancellationToken
            );

            var result =
                await response.Content.ReadFromJsonAsync<ExchangeResponse>(
                    cancellationToken: cancellationToken
                );

            if (!response.IsSuccessStatusCode)
            {
                return new ExchangeResult
                {
                    Success = false,
                    Error = result?.Error ?? "Token exchange failed."
                };
            }

            if (result is null ||
                !result.Success ||
                string.IsNullOrWhiteSpace(result.Token) ||
                string.IsNullOrWhiteSpace(result.DeviceId))
            {
                return new ExchangeResult
                {
                    Success = false,
                    Error = "Invalid token exchange response."
                };
            }

            return new ExchangeResult
            {
                Success = true,
                DeviceId = result.DeviceId,
                Token = result.Token
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error while exchanging desktop authorization code."
            );

            return new ExchangeResult
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    private static int GetFreePort()
    {
        using var listener =
            new TcpListener(IPAddress.Loopback, 0);

        listener.Start();

        return ((IPEndPoint)listener.LocalEndpoint).Port;
    }

    private static void OpenBrowser(string url)
    {
        Process.Start(
            new ProcessStartInfo
            {
                FileName = "chrome.exe",
                Arguments = url,
                UseShellExecute = true
            }
        );
    }

    private static async Task SendResponse(
        HttpListenerContext context,
        string message)
    {
        var html = $"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>FocusTrace</title>
            </head>
            <body>
                <h2>FocusTrace Desktop</h2>
                <p>{message}</p>
            </body>
            </html>
            """;

        var bytes = Encoding.UTF8.GetBytes(html);

        context.Response.ContentType = "text/html";
        context.Response.ContentLength64 = bytes.Length;

        await context.Response.OutputStream.WriteAsync(bytes);

        context.Response.Close();
    }

    private class StatusResponse
    {
        public bool Success { get; set; }
        public bool Authenticated { get; set; }
        public string? DeviceId { get; set; }
        public bool TrackingEnabled { get; set; }
        public int InactivityTimeoutMinutes { get; set; }
        public int ScreenshotIntervalMinutes { get; set; }
        public string? Error { get; set; }
    }

    private class ExchangeResponse
    {
        public bool Success { get; set; }
        public string? DeviceId { get; set; }
        public string? Token { get; set; }
        public string? Error { get; set; }
    }

    private class ExchangeResult
    {
        public bool Success { get; set; }
        public string? DeviceId { get; set; }
        public string? Token { get; set; }
        public string? Error { get; set; }
    }

    private async Task RunActivityLoop(
    ActivityMonitor activityMonitor,
    string token,
    StatusResponse initialStatus,
    CancellationToken stoppingToken)
    {
        var trackingEnabled = initialStatus.TrackingEnabled;
        var inactivityTimeoutMinutes = initialStatus.InactivityTimeoutMinutes;
        var screenshotIntervalMinutes = initialStatus.ScreenshotIntervalMinutes;

        var activeWindowTracker = new ActiveWindowTracker();
        var browserUrlTracker = new BrowserUrlTracker();

        string? lastProcessName = null;
        string? lastWindowTitle = null;
        string? lastBrowserDomain = null;

        var nextSettingsRefresh = DateTimeOffset.UtcNow;
        var nextActivityUpload = DateTimeOffset.UtcNow.AddSeconds(30);

        var lastScreenshotAt = DateTimeOffset.MinValue;

        var screenshotInterval = TimeSpan.FromMinutes(
            screenshotIntervalMinutes
        );

        var lastUploadedKeyPresses = 0L;
        var lastUploadedMouseClicks = 0L;
        var lastUploadedMouseDistance = 0.0;

        while (!stoppingToken.IsCancellationRequested)
        {
            // Refresh HR settings every 30 seconds.
            if (DateTimeOffset.UtcNow >= nextSettingsRefresh)
            {
                var latestStatus = await ValidateStoredCredential(
                    token,
                    stoppingToken
                );

                if (latestStatus is not null)
                {
                    if (latestStatus.TrackingEnabled != trackingEnabled)
                    {
                        trackingEnabled = latestStatus.TrackingEnabled;

                        IsTrackingEnabled = trackingEnabled;

                        UpdateStatus(
                            true,
                            trackingEnabled,
                            trackingEnabled
                                ? "Connected"
                                : "Connected — tracking disabled by HR"
                        );

                        _logger.LogInformation(
                            "Tracking setting changed by HR: {TrackingEnabled}",
                            trackingEnabled
                        );
                    }

                    if (latestStatus.InactivityTimeoutMinutes !=
                        inactivityTimeoutMinutes)
                    {
                        inactivityTimeoutMinutes =
                            latestStatus.InactivityTimeoutMinutes;

                        _logger.LogInformation(
                            "Inactivity timeout changed by HR: {Timeout} minutes",
                            inactivityTimeoutMinutes
                        );
                    }

                    if (latestStatus.ScreenshotIntervalMinutes != screenshotIntervalMinutes)
                    {
                        screenshotIntervalMinutes =
                            latestStatus.ScreenshotIntervalMinutes;

                        screenshotInterval = TimeSpan.FromMinutes(
                            screenshotIntervalMinutes
                        );

                        _logger.LogInformation(
                            "Screenshot interval changed by HR: {Interval} minutes",
                            screenshotIntervalMinutes
                        );
                    }
                }
                else
                {
                    _logger.LogWarning(
                        "Could not refresh HR settings. Keeping current settings."
                    );
                }

                nextSettingsRefresh =
                    DateTimeOffset.UtcNow.AddSeconds(30);
            }

            if (trackingEnabled)
            {
                activityMonitor.Update();

                var activeWindow = activeWindowTracker.GetActiveWindow();

                if (activeWindow is not null)
                {
                    var windowChanged =
                        activeWindow.ProcessName != lastProcessName ||
                        activeWindow.WindowTitle != lastWindowTitle;

                    if (windowChanged)
                    {
                        lastProcessName = activeWindow.ProcessName;
                        lastWindowTitle = activeWindow.WindowTitle;

                        _logger.LogInformation(
                            "Active window changed: {Application} | {WindowTitle}",
                            activeWindow.ProcessName,
                            activeWindow.WindowTitle
                        );

                        await SendActiveWindowEvent(
                            token,
                            activeWindow,
                            stoppingToken
                        );
                    }
                }

                if (activeWindow is not null)
                {
                    var browserUrl = browserUrlTracker.GetCurrentUrl(activeWindow);

                    if (browserUrl is not null &&
                        browserUrl.Domain != lastBrowserDomain)
                    {
                        lastBrowserDomain = browserUrl.Domain;

                        _logger.LogInformation(
                            "Browser website changed: {Domain}",
                            browserUrl.Domain
                        );

                        await SendBrowserEvent(
                            token,
                            activeWindow,
                            browserUrl,
                            stoppingToken
                        );
                    }

                    if (browserUrl is null &&
                        !string.Equals(
                            activeWindow.ProcessName,
                            "chrome",
                            StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(
                            activeWindow.ProcessName,
                            "msedge",
                            StringComparison.OrdinalIgnoreCase))
                    {
                        lastBrowserDomain = null;
                    }
                }

                var timeout = TimeSpan.FromMinutes(
                    inactivityTimeoutMinutes
                );

                var inactive = activityMonitor.IsInactive(timeout);

                if (
                    !inactive &&
                    DateTimeOffset.UtcNow - lastScreenshotAt >= screenshotInterval
                )
                {
                    _logger.LogInformation(
                        "Screenshot capture triggered. Inactive: {Inactive} | Interval: {Interval} minutes",
                        inactive,
                        screenshotIntervalMinutes
                    );

                    var uploaded = await CaptureAndUploadScreenshot(
                        token,
                        activeWindow,
                        stoppingToken
                    );

                    if (uploaded)
                    {
                        lastScreenshotAt = DateTimeOffset.UtcNow;
                    }
                }

                var activityStatus = inactive
                    ? "INACTIVE"
                    : "ACTIVE";

                _logger.LogInformation(
                    "Activity status: {Status} | Keys: {KeyPresses} | Clicks: {MouseClicks} | Mouse distance: {MouseDistance:F0}px | Last activity: {LastActivity}",
                    activityStatus,
                    activityMonitor.KeyPresses,
                    activityMonitor.MouseClicks,
                    activityMonitor.MouseDistance,
                    activityMonitor.LastActivityAt
                );
            }
            else
            {
                _logger.LogInformation(
                    "Tracking is disabled by HR."
                );
            }

            // Upload aggregated activity every 30 seconds.
            // We send only the delta since the previous upload so cumulative
            // ActivityMonitor counters are not stored repeatedly.
            if (trackingEnabled && DateTimeOffset.UtcNow >= nextActivityUpload)
            {
                var currentKeyPresses = activityMonitor.KeyPresses;
                var currentMouseClicks = activityMonitor.MouseClicks;
                var currentMouseDistance = activityMonitor.MouseDistance;

                var keyPresses = Math.Max(0L, currentKeyPresses - lastUploadedKeyPresses);
                var mouseClicks = Math.Max(0L, currentMouseClicks - lastUploadedMouseClicks);
                var mouseDistance = Math.Max(0.0, currentMouseDistance - lastUploadedMouseDistance);

                var uploaded = await SendActivityBatch(
                    token,
                    keyPresses,
                    mouseClicks,
                    mouseDistance,
                    stoppingToken
                );

                if (uploaded)
                {
                    lastUploadedKeyPresses = currentKeyPresses;
                    lastUploadedMouseClicks = currentMouseClicks;
                    lastUploadedMouseDistance = currentMouseDistance;
                }

                nextActivityUpload = DateTimeOffset.UtcNow.AddSeconds(30);
            }

            await Task.Delay(
                TimeSpan.FromSeconds(1),
                stoppingToken
            );
        }
    }

    private async Task<bool> CaptureAndUploadScreenshot(
    string token,
    ActiveWindowInfo? activeWindow,
    CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogInformation(
                "Starting screenshot capture..."
            );

            var screenshotCapture = new ScreenshotCapture();

            var screenshotBytes =
                screenshotCapture.CapturePrimaryScreenAsJpeg(70);

            _logger.LogInformation(
                "Screenshot captured successfully. Size: {Size} bytes",
                screenshotBytes.Length
            );

            using var content = new MultipartFormDataContent();

            var screenshotContent =
                new ByteArrayContent(screenshotBytes);

            screenshotContent.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue(
                    "image/jpeg"
                );

            content.Add(
                screenshotContent,
                "file",
                "screenshot.jpg"
            );

            string? website = null;

            if (activeWindow is not null)
            {
                var browserUrlTracker = new BrowserUrlTracker();

                var browserUrl =
                    browserUrlTracker.GetCurrentUrl(activeWindow);

                website = browserUrl?.Domain;
            }

            content.Add(
                new StringContent(
                    activeWindow?.ProcessName ?? "Unknown"
                ),
                "application"
            );

            content.Add(
                new StringContent(
                    website ?? ""
                ),
                "website"
            );

            content.Add(
                new StringContent(
                    DateTimeOffset.UtcNow.ToString("O")
                ),
                "capturedAt"
            );

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_webAppUrl}/api/desktop/screenshots/upload"
            );

            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue(
                    "Bearer",
                    token
                );

            request.Content = content;

            using var response = await SendWithRetry(
                () => _httpClient.SendAsync(request, cancellationToken),
                cancellationToken
            );

            if (response is null)
            {
                _logger.LogWarning(
                    "Screenshot upload unavailable. Will retry on the next screenshot cycle."
                );

                return false;
            }

            if (!response.IsSuccessStatusCode)
            {
                var responseBody =
                    await response.Content.ReadAsStringAsync(
                        cancellationToken
                    );

                _logger.LogWarning(
                    "Screenshot upload failed. Status: {StatusCode} | Response: {Response}",
                    response.StatusCode,
                    responseBody
                );

                return false;
            }

            _logger.LogInformation(
                "Screenshot uploaded successfully. Application: {Application} | Website: {Website}",
                activeWindow?.ProcessName ?? "Unknown",
                website ?? "N/A"
            );

            return true;
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            // Expected during application shutdown.
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error capturing or uploading screenshot."
            );

            return false;
        }
    }

    private async Task<HttpResponseMessage?> SendWithRetry(
    Func<Task<HttpResponseMessage>> send,
    CancellationToken cancellationToken)
    {
        const int maxAttempts = 3;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var response = await send();

                // Server responded — don't retry HTTP errors here.
                return response;
            }
            catch (HttpRequestException ex)
                when (attempt < maxAttempts &&
                      !cancellationToken.IsCancellationRequested)
            {
                var delaySeconds = attempt * 2;

                _logger.LogWarning(
                    ex,
                    "Network error. Retrying in {Delay}s ({Attempt}/{MaxAttempts})",
                    delaySeconds,
                    attempt,
                    maxAttempts
                );

                await Task.Delay(
                    TimeSpan.FromSeconds(delaySeconds),
                    cancellationToken
                );
            }
            catch (TaskCanceledException)
                when (!cancellationToken.IsCancellationRequested &&
                      attempt < maxAttempts)
            {
                var delaySeconds = attempt * 2;

                _logger.LogWarning(
                    "Request timed out. Retrying in {Delay}s ({Attempt}/{MaxAttempts})",
                    delaySeconds,
                    attempt,
                    maxAttempts
                );

                await Task.Delay(
                    TimeSpan.FromSeconds(delaySeconds),
                    cancellationToken
                );
            }
        }

        return null;
    }

    private async Task<bool> SendActivityBatch(
        string token,
        long keyPresses,
        long mouseClicks,
        double mouseDistance,
        CancellationToken cancellationToken)
    {
        // Don't create database rows when there was no new input activity.
        if (keyPresses == 0 && mouseClicks == 0 && mouseDistance <= 0)
            return true;

        try
        {
            var events = new List<object>();

            if (mouseClicks > 0 || mouseDistance > 0)
            {
                events.Add(new
                {
                    type = "MOUSE",
                    timestamp = DateTimeOffset.UtcNow,
                    mouseDistance = (int)Math.Min(mouseDistance, int.MaxValue),
                    mouseClicks = (int)Math.Min(mouseClicks, int.MaxValue)
                });
            }

            if (keyPresses > 0)
            {
                events.Add(new
                {
                    type = "KEYBOARD",
                    timestamp = DateTimeOffset.UtcNow,
                    keyPresses = (int)Math.Min(keyPresses, int.MaxValue)
                });
            }

            if (events.Count == 0)
                return true;

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_webAppUrl}/api/desktop/activity"
            );

            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue(
                    "Bearer",
                    token
                );

            request.Content = JsonContent.Create(new
            {
                events
            });

            using var response = await SendWithRetry(
                () => _httpClient.SendAsync(request, cancellationToken),
                cancellationToken
            );

            if (response is null)
            {
                _logger.LogWarning(
                    "Activity upload unavailable. Counters will be retried on the next cycle."
                );

                return false;
            }

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(
                    cancellationToken
                );

                _logger.LogWarning(
                    "Activity upload failed with status {StatusCode}: {Error}",
                    (int)response.StatusCode,
                    error
                );

                return false;
            }

            _logger.LogInformation(
                "Activity uploaded successfully. Keys: {KeyPresses}, Clicks: {MouseClicks}, Mouse distance: {MouseDistance:F0}px",
                keyPresses,
                mouseClicks,
                mouseDistance
            );

            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Could not upload activity. The current counters will be retried."
            );

            return false;
        }
    }

    private async Task SendActiveWindowEvent(
    string token,
    ActiveWindowInfo activeWindow,
    CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_webAppUrl}/api/desktop/activity"
            );

            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue(
                    "Bearer",
                    token
                );

            var payload = new
            {
                events = new[]
                {
                new
                {
                    type = "ACTIVE_WINDOW",
                    timestamp = DateTimeOffset.UtcNow,
                    metadata = new
                    {
                        application = activeWindow.ProcessName,
                        windowTitle = activeWindow.WindowTitle
                    }
                }
            }
            };

            request.Content = JsonContent.Create(payload);

            var response = await _httpClient.SendAsync(
                request,
                cancellationToken
            );

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Failed to upload active window event. Status: {StatusCode}",
                    response.StatusCode
                );

                return;
            }

            _logger.LogInformation(
                "Active window event uploaded: {Application} | {WindowTitle}",
                activeWindow.ProcessName,
                activeWindow.WindowTitle
            );
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal shutdown. Do not log as an error.
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error uploading active window event."
            );
        }
    }

    private async Task SendBrowserEvent(
    string token,
    ActiveWindowInfo activeWindow,
    BrowserUrlInfo browserUrl,
    CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_webAppUrl}/api/desktop/activity"
            );

            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue(
                    "Bearer",
                    token
                );

            var payload = new
            {
                events = new[]
                {
                new
                {
                    type = "ACTIVE_WINDOW",
                    timestamp = DateTimeOffset.UtcNow,
                    metadata = new
                    {
                        application = activeWindow.ProcessName,
                        website = browserUrl.Domain
                    }
                }
            }
            };

            request.Content = JsonContent.Create(payload);

            var response = await _httpClient.SendAsync(
                request,
                cancellationToken
            );

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Failed to upload browser event. Status: {StatusCode}",
                    response.StatusCode
                );

                return;
            }

            _logger.LogInformation(
                "Browser website event uploaded: {Application} | {Website}",
                activeWindow.ProcessName,
                browserUrl.Domain
            );
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal shutdown. Do not log as an error.
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error uploading active window event."
            );
        }
    }

    private async Task RunHeartbeat(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Agent heartbeat: {Time}",
                DateTimeOffset.Now
            );

            await Task.Delay(
                TimeSpan.FromSeconds(30),
                stoppingToken
            );
        }

        _logger.LogInformation(
            "FocusTrace Agent stopped."
        );
    }

    public sealed class AgentStatusChangedEventArgs : EventArgs
    {
        public bool IsConnected { get; }

        public bool IsTrackingEnabled { get; }

        public string Message { get; }

        public AgentStatusChangedEventArgs(
            bool isConnected,
            bool isTrackingEnabled,
            string message)
        {
            IsConnected = isConnected;
            IsTrackingEnabled = isTrackingEnabled;
            Message = message;
        }
    }
}