# stop_siren.ps1 - Immediately stops any running alert siren
$flagPath = Join-Path $PSScriptRoot "stop_siren.flag"
$pidPath = Join-Path $PSScriptRoot "siren.pid"

# Set stop flag
Set-Content -Path $flagPath -Value "STOP" -Force

# Kill process by saved PID if present
if (Test-Path $pidPath) {
    try {
        $savedPid = Get-Content $pidPath -ErrorAction SilentlyContinue
        if ($savedPid -and ($savedPid.Trim() -as [int])) {
            Stop-Process -Id ([int]$savedPid.Trim()) -Force -ErrorAction SilentlyContinue
        }
    } catch {}
    Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Alert siren stopped successfully." -ForegroundColor Green
