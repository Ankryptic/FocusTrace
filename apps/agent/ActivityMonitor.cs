using System.Runtime.InteropServices;

namespace FocusTrace.Agent;

public sealed class ActivityMonitor : IDisposable
{
    private const int VK_LBUTTON = 0x01;
    private const int VK_RBUTTON = 0x02;
    private const int VK_MBUTTON = 0x04;

    private bool _disposed;

    private int _mouseClicks;
    private int _keyPresses;
    private double _mouseDistance;

    private POINT _lastCursorPosition;
    private bool _hasCursorPosition;

    private DateTimeOffset _lastActivityAt = DateTimeOffset.Now;

    public DateTimeOffset LastActivityAt => _lastActivityAt;

    public int MouseClicks => _mouseClicks;

    public int KeyPresses => _keyPresses;

    public double MouseDistance => _mouseDistance;

    public bool IsInactive(TimeSpan timeout)
    {
        return DateTimeOffset.UtcNow - _lastActivityAt >= timeout;
    }

    public void Start()
    {
        _lastActivityAt = DateTimeOffset.UtcNow;

        if (GetCursorPos(out var position))
        {
            _lastCursorPosition = position;
            _hasCursorPosition = true;
        }
    }

    public void Update()
    {
        if (_disposed)
            return;

        UpdateMouseMovement();
        UpdateInputActivity();
    }

    private void UpdateMouseMovement()
    {
        if (!GetCursorPos(out var currentPosition))
            return;

        if (_hasCursorPosition)
        {
            var dx = currentPosition.X - _lastCursorPosition.X;
            var dy = currentPosition.Y - _lastCursorPosition.Y;

            var distance = Math.Sqrt(
                (double)(dx * dx) +
                (double)(dy * dy)
            );

            if (distance > 0)
            {
                _mouseDistance += distance;
                _lastActivityAt = DateTimeOffset.UtcNow;
            }
        }

        _lastCursorPosition = currentPosition;
        _hasCursorPosition = true;
    }

    private void UpdateInputActivity()
    {
        bool activityDetected = false;

        if (IsKeyPressed(VK_LBUTTON))
            activityDetected = true;

        if (IsKeyPressed(VK_RBUTTON))
            activityDetected = true;

        if (IsKeyPressed(VK_MBUTTON))
            activityDetected = true;

        if (activityDetected)
        {
            _mouseClicks++;
            _lastActivityAt = DateTimeOffset.UtcNow;
        }

        if (DetectKeyboardActivity())
        {
            _keyPresses++;
            _lastActivityAt = DateTimeOffset.UtcNow;
        }
    }

    private static bool IsKeyPressed(int virtualKey)
    {
        return (GetAsyncKeyState(virtualKey) & 0x8000) != 0;
    }

    private static bool DetectKeyboardActivity()
    {
        // We intentionally do not read or store the actual character.
        // We only detect whether a key transitioned to the pressed state.
        for (int key = 0x08; key <= 0xFE; key++)
        {
            if ((GetAsyncKeyState(key) & 0x0001) != 0)
            {
                return true;
            }
        }

        return false;
    }

    public ActivitySnapshot GetSnapshot()
    {
        return new ActivitySnapshot
        {
            LastActivityAt = _lastActivityAt,
            MouseClicks = _mouseClicks,
            KeyPresses = _keyPresses,
            MouseDistance = _mouseDistance
        };
    }

    public void ResetCounters()
    {
        _mouseClicks = 0;
        _keyPresses = 0;
        _mouseDistance = 0;
    }

    public void Dispose()
    {
        _disposed = true;
    }

    [DllImport(
        "user32.dll",
        SetLastError = true
    )]
    private static extern short GetAsyncKeyState(int virtualKey);

    [DllImport(
        "user32.dll",
        SetLastError = true
    )]
    private static extern bool GetCursorPos(
        out POINT lpPoint
    );

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int X;
        public int Y;
    }
}

public sealed class ActivitySnapshot
{
    public DateTimeOffset LastActivityAt { get; init; }

    public int MouseClicks { get; init; }

    public int KeyPresses { get; init; }

    public double MouseDistance { get; init; }
}