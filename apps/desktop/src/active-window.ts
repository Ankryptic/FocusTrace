import { execFile } from "node:child_process";

export type ActiveWindow = {
    application: string;
    windowTitle: string;
    processId: number;
}

export function getActiveWindow(): Promise<ActiveWindow | null >{
    return new Promise((res, rej) => {
        const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class FocusTraceWindow {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(
        IntPtr hWnd,
        StringBuilder text,
        int count
    );

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(
        IntPtr hWnd,
        out uint processId
    );
}
'@

$hwnd = [FocusTraceWindow]::GetForegroundWindow()

if ($hwnd -eq [IntPtr]::Zero) {
    exit 0
}

$title = New-Object System.Text.StringBuilder 512

[FocusTraceWindow]::GetWindowText(
    $hwnd,
    $title,
    $title.Capacity
) | Out-Null

$processId = 0

[FocusTraceWindow]::GetWindowThreadProcessId(
    $hwnd,
    [ref]$processId
) | Out-Null

$process = Get-Process -Id $processId -ErrorAction SilentlyContinue

if ($null -eq $process) {
    exit 0
}

[PSCustomObject]@{
    application = $process.ProcessName
    windowTitle = $title.ToString()
    processId = $processId
} | ConvertTo-Json -Compress
        `;

        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
            ],
            (error, stdout, stderr) => {
                if(error){
                    rej(new Error(stderr || error.message));
                    return;
                }

                const output = stdout.trim();

                if(!output){
                    res(null)
                    return
                };

                try {
                    res(JSON.parse(output))
                } catch {
                    rej(new Error("could not parse active window information"));
                }
            }
        )
    })
}