[CmdletBinding()]
param(
  [ValidateSet('debug', 'profile')]
  [string]$Mode = 'debug',
  [string]$DeviceId,
  [int]$BackendPort = 4000,
  [string]$ConfigPath = 'config/dev.json',
  [switch]$PrepareOnly
)

$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path -Parent $PSScriptRoot
$resolvedConfig = Join-Path $mobileRoot $ConfigPath

if (-not (Test-Path -LiteralPath $resolvedConfig -PathType Leaf)) {
  throw "Config file not found: $resolvedConfig"
}

$configuration = Get-Content -LiteralPath $resolvedConfig -Raw | ConvertFrom-Json
$apiUri = [Uri]$configuration.API_BASE_URL
if ($apiUri.Host -notin @('127.0.0.1', 'localhost')) {
  throw 'USB mode requires API_BASE_URL to use 127.0.0.1 or localhost. Use the LAN URL only for Wi-Fi mode.'
}
if ($apiUri.Port -ne $BackendPort) {
  throw "The API port in $ConfigPath ($($apiUri.Port)) does not match -BackendPort ($BackendPort)."
}

$backendClient = [Net.Sockets.TcpClient]::new()
try {
  $backendConnection = $backendClient.ConnectAsync('127.0.0.1', $BackendPort)
  if (-not $backendConnection.Wait(2000) -or -not $backendClient.Connected) {
    throw 'Backend is not ready.'
  }
} catch {
  throw "Backend is not running at http://127.0.0.1:$BackendPort. Run 'npm run dev' in the backend directory first."
} finally {
  $backendClient.Dispose()
}

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
if ($null -eq $adbCommand) {
  $sdkAdb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
  if (-not (Test-Path -LiteralPath $sdkAdb -PathType Leaf)) {
    throw 'adb was not found. Install Android platform-tools or add adb to PATH.'
  }
  $adb = $sdkAdb
} else {
  $adb = $adbCommand.Source
}

$connectedDevices = @(
  & $adb devices |
    Select-Object -Skip 1 |
    ForEach-Object {
      if ($_ -match '^(\S+)\s+device$') { $Matches[1] }
    }
)

if ([string]::IsNullOrWhiteSpace($DeviceId)) {
  if ($connectedDevices.Count -eq 0) {
    throw 'No authorized Android USB device was found.'
  }
  if ($connectedDevices.Count -gt 1) {
    throw "Multiple devices are connected: $($connectedDevices -join ', '). Pass -DeviceId."
  }
  $DeviceId = $connectedDevices[0]
} elseif ($DeviceId -notin $connectedDevices) {
  throw "Device $DeviceId is not connected or USB debugging is not authorized."
}

$null = & $adb -s $DeviceId reverse "tcp:$BackendPort" "tcp:$BackendPort"
if ($LASTEXITCODE -ne 0) {
  throw "Could not reverse port $BackendPort for device $DeviceId."
}
$reverseRules = @(& $adb -s $DeviceId reverse --list)
if (-not ($reverseRules -match "tcp:$BackendPort\s+tcp:$BackendPort")) {
  throw "ADB did not confirm the tcp:$BackendPort reverse tunnel for device $DeviceId."
}

Write-Host "Device: $DeviceId"
Write-Host "API USB: http://127.0.0.1:$BackendPort/api/v1"
if ($PrepareOnly) {
  Write-Host 'USB connection is ready. Flutter can now start.'
  return
}

$flutterCommand = Get-Command flutter.bat -ErrorAction SilentlyContinue
if ($null -eq $flutterCommand) {
  $flutterCommand = Get-Command flutter -ErrorAction Stop
}
$flutter = $flutterCommand.Source
$modeArgument = "--$Mode"

Write-Host "Mode: $Mode"

Push-Location $mobileRoot
try {
  & $flutter run `
    -d $DeviceId `
    -t lib/main_dev.dart `
    $modeArgument `
    "--dart-define-from-file=$ConfigPath"
  if ($LASTEXITCODE -ne 0) {
    throw "Flutter exited with code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}
