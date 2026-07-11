param(
  [switch]$EnableAuth
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $projectRoot 'outputs\demo-access.env'

if ($EnableAuth -and !(Test-Path $envFile)) {
  throw "Missing access file: $envFile"
}

if ($EnableAuth) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
  }
} else {
  [Environment]::SetEnvironmentVariable('DEMO_USER', $null, 'Process')
  [Environment]::SetEnvironmentVariable('DEMO_PASSWORD', $null, 'Process')
}

$node = 'C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$cloudflared = Join-Path $projectRoot 'tools\cloudflared.exe'

if (!(Test-Path $cloudflared)) {
  throw "Missing cloudflared.exe. Download it to $cloudflared first."
}

Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

Get-Process cloudflared -ErrorAction SilentlyContinue |
  Stop-Process -Force

Start-Sleep -Milliseconds 400

Start-Process `
  -FilePath $node `
  -ArgumentList 'src/server.js' `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden

Start-Sleep -Seconds 1

$outLog = Join-Path $projectRoot 'outputs\cloudflared-out.log'
$errLog = Join-Path $projectRoot 'outputs\cloudflared-err.log'
Remove-Item $outLog, $errLog -ErrorAction SilentlyContinue

Start-Process `
  -FilePath $cloudflared `
  -ArgumentList 'tunnel --protocol http2 --url http://127.0.0.1:8080' `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

Start-Sleep -Seconds 10

$log = ''
if (Test-Path $errLog) {
  $log += Get-Content $errLog -Raw
}
if (Test-Path $outLog) {
  $log += Get-Content $outLog -Raw
}

$url = [regex]::Match($log, 'https://[a-z0-9-]+\.trycloudflare\.com').Value

if (!$url) {
  throw "Tunnel started, but URL was not found in logs. Check outputs\cloudflared-err.log"
}

Write-Host "TENG Smart Parking public demo:"
Write-Host $url
if ($EnableAuth) {
  Write-Host "Username: $env:DEMO_USER"
  Write-Host "Password: $env:DEMO_PASSWORD"
} else {
  Write-Host "Password: disabled"
}
