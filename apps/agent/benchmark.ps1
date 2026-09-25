$processName = "FocusTrace.Agent"

Write-Host "Waiting for FocusTrace Agent..."

while (-not (Get-Process $processName -ErrorAction SilentlyContinue)) {
    Start-Sleep -Seconds 1
}

Write-Host "Agent detected."
Write-Host "Sampling for 60 seconds..."
Write-Host ""

$process = Get-Process $processName

$startCpu = $process.CPU
$startTime = Get-Date

$samples = @()

for ($i = 0; $i -lt 60; $i++) {

    $process = Get-Process $processName -ErrorAction SilentlyContinue

    if (-not $process) {
        Write-Host "Agent exited."
        break
    }

    $samples += [PSCustomObject]@{
        Time = Get-Date
        RAM_MB = [math]::Round(
            $process.WorkingSet64 / 1MB,
            2
        )
        Private_MB = [math]::Round(
            $process.PrivateMemorySize64 / 1MB,
            2
        )
        CPU_TotalSeconds = [math]::Round(
            $process.CPU,
            2
        )
    }

    Start-Sleep -Seconds 1
}

if ($samples.Count -gt 0) {

    $avgRam = ($samples | Measure-Object RAM_MB -Average).Average
    $maxRam = ($samples | Measure-Object RAM_MB -Maximum).Maximum

    $avgPrivate = ($samples | Measure-Object Private_MB -Average).Average
    $maxPrivate = ($samples | Measure-Object Private_MB -Maximum).Maximum

    $cpuSeconds = $samples[-1].CPU_TotalSeconds - $startCpu
    $elapsedSeconds = ((Get-Date) - $startTime).TotalSeconds

    $cpuPercentApprox =
        ($cpuSeconds / $elapsedSeconds) * 100

    Write-Host ""
    Write-Host "========== FocusTrace Benchmark =========="
    Write-Host ""
    Write-Host "Average RAM:       $([math]::Round($avgRam, 2)) MB"
    Write-Host "Peak RAM:          $([math]::Round($maxRam, 2)) MB"
    Write-Host "Average Private:   $([math]::Round($avgPrivate, 2)) MB"
    Write-Host "Peak Private:      $([math]::Round($maxPrivate, 2)) MB"
    Write-Host "Approx CPU usage:  $([math]::Round($cpuPercentApprox, 2))%"
    Write-Host ""
    Write-Host "=========================================="
}