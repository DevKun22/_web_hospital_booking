param(
    [string]$EnvFile = "backend/.env",
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 4000,
    [switch]$SkipPreflight,
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ResolvedEnvFile = (Resolve-Path (Join-Path $ProjectRoot $EnvFile)).Path

function Get-DotEnvValue {
    param([string]$Name)
    $line = Get-Content -LiteralPath $ResolvedEnvFile |
        Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
        Select-Object -Last 1
    if (-not $line) { return $null }
    $value = ($line -split "=", 2)[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    return $value
}

function Invoke-DockerCompose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & docker compose @ComposeArgs @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed with exit code $LASTEXITCODE"
    }
}

function Wait-HttpOk {
    param([string]$Url, [int]$TimeoutSeconds = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return }
        } catch {
            Start-Sleep -Milliseconds 750
        }
    } while ((Get-Date) -lt $deadline)
    throw "Timed out waiting for $Url"
}

function Assert-FrontendLanding {
    param([string]$Url)
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
    if ($response.StatusCode -ne 200) {
        throw "Frontend landing page returned HTTP $($response.StatusCode)."
    }
    if ($response.Content -notmatch "Hospital Booking") {
        throw "Frontend landing page did not contain the expected hospital content."
    }
}

$DatabaseUrl = Get-DotEnvValue -Name "DATABASE_URL"
$TestDatabaseUrl = Get-DotEnvValue -Name "TEST_DATABASE_URL"
if (-not $DatabaseUrl) { throw "DATABASE_URL is missing from $ResolvedEnvFile" }
try { $DatabaseUri = [Uri]$DatabaseUrl } catch { throw "DATABASE_URL is not a valid URL" }
if ($DatabaseUri.Scheme -notin @("postgres", "postgresql")) {
    throw "DATABASE_URL must use postgres:// or postgresql://"
}
$DatabaseMarker = "$($DatabaseUri.AbsolutePath) $($DatabaseUri.Query)".ToLowerInvariant()
if ($DatabaseMarker.Contains("test")) {
    throw "Remote acceptance refuses a DATABASE_URL whose database/schema contains 'test'."
}
if ($TestDatabaseUrl -and $DatabaseUrl -eq $TestDatabaseUrl) {
    throw "DATABASE_URL and TEST_DATABASE_URL must not be identical."
}

$FirebaseKey = Join-Path $ProjectRoot "backend/secrets/firebase-admin.local.json"
if (-not (Test-Path -LiteralPath $FirebaseKey)) {
    throw "Missing backend/secrets/firebase-admin.local.json required by notification-worker."
}

$LanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
    } |
    Select-Object -ExpandProperty IPAddress -First 1
if (-not $LanIp) { $LanIp = "127.0.0.1" }

$SanitizedEnvFile = Join-Path ([System.IO.Path]::GetTempPath()) "hospital-booking-remote-$([guid]::NewGuid().ToString('N')).env"
$NormalizedEnvLines = Get-Content -LiteralPath $ResolvedEnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or $line.StartsWith('//')) { return }
    if ($line -match '^[A-Za-z_][A-Za-z0-9_]*=') { $line }
}
[System.IO.File]::WriteAllLines($SanitizedEnvFile, $NormalizedEnvLines, [System.Text.UTF8Encoding]::new($false))

$env:HOSPITAL_FRONTEND_PORT = [string]$FrontendPort
$env:HOSPITAL_BACKEND_PORT = [string]$BackendPort
$env:HOSPITAL_REMOTE_FRONTEND_URLS = "http://localhost:$FrontendPort,http://localhost:3001,http://$LanIp`:$FrontendPort"
$env:HOSPITAL_REMOTE_ENV_FILE = $SanitizedEnvFile
$ComposeArgs = @(
    "--env-file", $SanitizedEnvFile,
    "-f", (Join-Path $ProjectRoot "compose.yaml"),
    "-f", (Join-Path $ProjectRoot "compose.backend.yaml"),
    "-f", (Join-Path $ProjectRoot "compose.remote-db.yaml")
)

Push-Location $ProjectRoot
try {
    if (-not $SkipPreflight) {
        Write-Host "[remote-acceptance] Running backend build and smoke tests..."
        & npm.cmd --prefix backend run build
        if ($LASTEXITCODE -ne 0) { throw "Backend build failed with exit code $LASTEXITCODE" }
        & npm.cmd --prefix backend test
        if ($LASTEXITCODE -ne 0) { throw "Backend smoke tests failed with exit code $LASTEXITCODE" }
    }

    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        & docker desktop start | Out-Host
        $dockerDeadline = (Get-Date).AddSeconds(90)
        do {
            Start-Sleep -Seconds 2
            & docker info *> $null
        } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $dockerDeadline)
        if ($LASTEXITCODE -ne 0) { throw "Docker Desktop did not become ready." }
    }

    Write-Host "[remote-acceptance] Validating merged Compose configuration..."
    Invoke-DockerCompose "--profile" "notifications" "config" "--quiet"

    Write-Host "[remote-acceptance] Starting API, Redis and workers against the configured remote demo database..."
    Invoke-DockerCompose "--profile" "notifications" "up" "-d" "--build" "--force-recreate" `
        "backend-api" "otp-worker" "appointment-worker" "notification-worker"

    Wait-HttpOk -Url "http://127.0.0.1:$BackendPort/health"

    if (-not $SkipFrontend) {
        $frontendUrl = "http://127.0.0.1:$FrontendPort"
        try {
            Wait-HttpOk -Url $frontendUrl -TimeoutSeconds 3
            Write-Host "[remote-acceptance] Reusing the frontend already running at $frontendUrl"
        } catch {
            Write-Host "[remote-acceptance] Starting Next.js development server in the background..."
            $frontendProcess = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev") `
                -WorkingDirectory (Join-Path $ProjectRoot "frontend") -WindowStyle Hidden -PassThru
            Set-Content -LiteralPath (Join-Path $ProjectRoot ".frontend-dev.pid") -Value $frontendProcess.Id
            Wait-HttpOk -Url $frontendUrl -TimeoutSeconds 120
        }
        Assert-FrontendLanding -Url $frontendUrl
        Write-Host "[remote-acceptance] Frontend landing page returned the expected hospital content."
    }

    Write-Host "[remote-acceptance] Running controlled booking, OTP, dashboard and notification journey..."
    Invoke-DockerCompose "--profile" "notifications" "run" "--rm" "--no-deps" `
        "-e" "ACCEPTANCE_ALLOW_WRITE=true" `
        "-e" "ACCEPTANCE_API_URL=http://backend-api:4000/api" `
        "backend-api" "node" "dist/src/scripts/remoteDockerAcceptance.js"

    Write-Host "[remote-acceptance] Final container state:"
    Invoke-DockerCompose "--profile" "notifications" "ps" "--all"
    Write-Host "[remote-acceptance] PASS - temporary acceptance data was removed. Services remain running for inspection."
} finally {
    Pop-Location
    Remove-Item -LiteralPath $SanitizedEnvFile -Force -ErrorAction SilentlyContinue
}
