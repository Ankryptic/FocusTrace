using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace FocusTrace.Agent;

public sealed class ActiveWindowTracker
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(
        IntPtr hWnd,
        StringBuilder lpString,
        int nMaxCount
    );

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(
        IntPtr hWnd,
        out uint processId
    );

    public ActiveWindowInfo? GetActiveWindow()
    {
        var handle = GetForegroundWindow();

        if (handle == IntPtr.Zero)
            return null;

        var titleBuilder = new StringBuilder(512);

        GetWindowText(
            handle,
            titleBuilder,
            titleBuilder.Capacity
        );

        var windowTitle = titleBuilder.ToString().Trim();

        GetWindowThreadProcessId(
            handle,
            out var processId
        );

        if (processId == 0)
            return null;

        try
        {
            using var process = Process.GetProcessById(
                (int)processId
            );

            return new ActiveWindowInfo
            {
                ProcessName = process.ProcessName,
                WindowTitle = windowTitle,
                ProcessId = processId
            };
        }
        catch
        {
            return new ActiveWindowInfo
            {
                ProcessName = "Unknown",
                WindowTitle = windowTitle,
                ProcessId = processId
            };
        }
    }
}

public sealed class ActiveWindowInfo
{
    public string ProcessName { get; set; } = "";
    public string WindowTitle { get; set; } = "";
    public uint ProcessId { get; set; }
}