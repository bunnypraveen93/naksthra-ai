param(
    [string]$Type = "siren", # siren, urgent, or alert
    [int]$DurationSeconds = 60, # 1 minute default
    [string]$Message = "Agent requires your attention! (Ringing for up to 60s or until stopped)"
)

$flagPath = Join-Path $PSScriptRoot "stop_siren.flag"
$pidPath = Join-Path $PSScriptRoot "siren.pid"

# Remove any previous stop flag
if (Test-Path $flagPath) {
    Remove-Item $flagPath -Force -ErrorAction SilentlyContinue
}

# Save current PID so stop_siren.ps1 can kill immediately
$PID | Out-File -FilePath $pidPath -Force -Encoding ASCII

Write-Host "==========================================================" -ForegroundColor Red
Write-Host " [SIREN ALERT] $Message" -ForegroundColor Yellow
Write-Host " Running for $DurationSeconds seconds (or until stopped/responded)..." -ForegroundColor Cyan
Write-Host " Press any key or run '.\stop_siren.ps1' to stop." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Red

# Function to generate a 1.5-second WAV sound chunk
function Get-WavChunkBytes {
    param(
        [double]$ChunkSeconds = 1.5,
        [string]$Pattern = "siren"
    )

    $sampleRate = 22050
    $numSamples = [int]($sampleRate * $ChunkSeconds)
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter $ms

    # RIFF header
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'))
    $bw.Write([int](36 + $numSamples * 2))
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('WAVE'))
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('fmt '))
    $bw.Write([int]16)
    $bw.Write([int16]1) # PCM
    $bw.Write([int16]1) # Mono
    $bw.Write([int]$sampleRate)
    $bw.Write([int]($sampleRate * 2))
    $bw.Write([int16]2) # Block align
    $bw.Write([int16]16) # Bits per sample
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('data'))
    $bw.Write([int]($numSamples * 2))

    $phase = 0.0
    for ($i = 0; $i -lt $numSamples; $i++) {
        $t = $i / $sampleRate

        if ($Pattern -eq "urgent") {
            # Two-tone Hi-Lo emergency siren (Euro ambulance)
            $f = if ([Math]::Sin(2 * [Math]::PI * 2.5 * $t) -gt 0) { 1250 } else { 850 }
        } elseif ($Pattern -eq "alert") {
            # Pulsed chime
            $pulse = [Math]::Sin(2 * [Math]::PI * 4 * $t)
            $f = if ($pulse -gt 0) { 1400 } else { 0 }
        } else {
            # High-intensity oscillating emergency wail siren (750Hz - 1500Hz)
            $f = 1125 + 375 * [Math]::Sin(2 * [Math]::PI * 1.2 * $t)
        }

        $phase += 2 * [Math]::PI * $f / $sampleRate
        $amplitude = if ($f -eq 0) { 0 } else { 29000 }
        $sample = [int16]($amplitude * [Math]::Sin($phase))
        $bw.Write($sample)
    }

    $bytes = $ms.ToArray()
    $bw.Dispose()
    $ms.Dispose()
    return $bytes
}

# Pre-generate 1.5s audio chunk for efficiency
$chunkBytes = Get-WavChunkBytes -ChunkSeconds 1.5 -Pattern $Type.ToLower()
$startTime = Get-Date

try {
    while ($true) {
        # Check 1: Has total duration expired?
        $elapsed = ((Get-Date) - $startTime).TotalSeconds
        if ($elapsed -ge $DurationSeconds) {
            Write-Host "Siren completed full duration ($DurationSeconds s)." -ForegroundColor Green
            break
        }

        # Check 2: Has stop flag been placed?
        if (Test-Path $flagPath) {
            Write-Host "Stop flag detected! Siren stopping immediately." -ForegroundColor Green
            break
        }

        # Check 3: Has user pressed a key in console?
        try {
            if ([Console]::KeyAvailable) {
                $null = [Console]::ReadKey($true)
                Write-Host "Keypress detected! Siren stopping." -ForegroundColor Green
                break
            }
        } catch {}

        # Play 1.5s chunk synchronously
        $ms = New-Object System.IO.MemoryStream(,$chunkBytes)
        $player = New-Object System.Media.SoundPlayer $ms
        $player.PlaySync()
        $player.Dispose()
        $ms.Dispose()
    }
} finally {
    # Cleanup files
    if (Test-Path $flagPath) {
        Remove-Item $flagPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $pidPath) {
        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
    }
}
