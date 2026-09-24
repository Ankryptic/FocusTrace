using System.Text.RegularExpressions;
using System.Windows.Automation;

namespace FocusTrace.Agent;

public sealed class BrowserUrlTracker
{
    private static readonly HashSet<string> SupportedBrowsers =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "chrome",
            "msedge"
        };

    public BrowserUrlInfo? GetCurrentUrl(ActiveWindowInfo activeWindow)
    {
        if (!SupportedBrowsers.Contains(activeWindow.ProcessName))
        {
            return null;
        }

        try
        {
            var root = AutomationElement.RootElement;

            var condition = new PropertyCondition(
                AutomationElement.ProcessIdProperty,
                (int)activeWindow.ProcessId
            );

            var browserWindow = root.FindFirst(
                TreeScope.Children,
                condition
            );

            if (browserWindow is null)
            {
                return null;
            }

            var addressBar = FindAddressBar(browserWindow);

            if (addressBar is null)
            {
                return null;
            }

            var url = GetElementValue(addressBar);

            if (string.IsNullOrWhiteSpace(url))
            {
                return null;
            }

            var domain = ExtractDomain(url);

            if (string.IsNullOrWhiteSpace(domain))
            {
                return null;
            }

            return new BrowserUrlInfo
            {
                Url = url,
                Domain = domain
            };
        }
        catch
        {
            return null;
        }
    }

    private static AutomationElement? FindAddressBar(
        AutomationElement browserWindow)
    {
        var editCondition = new PropertyCondition(
            AutomationElement.ControlTypeProperty,
            ControlType.Edit
        );

        var editElements = browserWindow.FindAll(
            TreeScope.Descendants,
            editCondition
        );

        foreach (AutomationElement element in editElements)
        {
            var name = element.Current.Name;

            if (
                name.Contains("address", StringComparison.OrdinalIgnoreCase) ||
                name.Contains("search", StringComparison.OrdinalIgnoreCase) ||
                name.Contains("omnibox", StringComparison.OrdinalIgnoreCase) ||
                name.Contains("URL", StringComparison.OrdinalIgnoreCase)
            )
            {
                return element;
            }
        }

        return editElements.Count > 0
            ? editElements[0]
            : null;
    }

    private static string? GetElementValue(
        AutomationElement element)
    {
        if (element.TryGetCurrentPattern(
                ValuePattern.Pattern,
                out var pattern))
        {
            var valuePattern = (ValuePattern)pattern;

            return valuePattern.Current.Value;
        }

        return null;
    }

    private static string? ExtractDomain(string url)
    {
        url = url.Trim();

        if (!url.Contains("://"))
        {
            url = "https://" + url;
        }

        if (!Uri.TryCreate(
                url,
                UriKind.Absolute,
                out var uri))
        {
            return null;
        }

        if (
            uri.Scheme != Uri.UriSchemeHttp &&
            uri.Scheme != Uri.UriSchemeHttps
        )
        {
            return null;
        }

        return uri.Host;
    }
}

public sealed class BrowserUrlInfo
{
    public string Url { get; set; } = "";

    public string Domain { get; set; } = "";
}