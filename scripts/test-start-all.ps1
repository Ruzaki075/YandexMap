# Автотест START_ALL.bat: установка зависимостей + запуск + health-check
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$logDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$report = Join-Path $logDir "test-start-all.log"

function Write-Step([string]$msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path $report -Value $line
}

function Stop-Port([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

function Wait-Http([string]$Url, [int]$TimeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        } catch {}
        Start-Sleep -Seconds 2
    }
    return $false
}

$python = if (Get-Command python -ErrorAction SilentlyContinue) { "python" }
          elseif (Get-Command py -ErrorAction SilentlyContinue) { "py -3" }
          else { throw "Python not found" }

Write-Step "=== TEST START_ALL.bat (automated) ==="
Write-Step "Root: $Root"

# Step 0: prerequisites
Write-Step "[0] Checking prerequisites..."
foreach ($cmd in @("node", "npm", "go")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd not found" }
}
$pg = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]$_.Directory.Parent.Name } -Descending | Select-Object -First 1
if (-not $pg) { throw "PostgreSQL not found" }
Write-Step "  OK: node $(node -v), go $(go version), python $($python)"

# Step 1: free ports
Write-Step "[1] Freeing ports..."
Stop-Port 8080; Stop-Port 5055; Stop-Port 5173
Start-Sleep -Seconds 1

# Step 2: postgres
Write-Step "[2] PostgreSQL setup..."
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\setup-postgres.ps1")
if ($LASTEXITCODE -ne 0) { throw "setup-postgres.ps1 failed" }

# Step 3: dependencies
Write-Step "[3] Installing dependencies..."
if (Test-Path (Join-Path $Root "package.json")) {
    cmd /c "npm install --legacy-peer-deps" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "root npm install failed" }
}
Set-Location (Join-Path $Root "yandexMap")
cmd /c "npm install --legacy-peer-deps" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "yandexMap npm install failed" }
Set-Location (Join-Path $Root "backend")
go mod download
if ($LASTEXITCODE -ne 0) { throw "go mod download failed" }
Set-Location (Join-Path $Root "classifier")
cmd /c "$python -m pip install -r requirements.txt" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
Set-Location $Root
Write-Step "  OK: npm, go, pip"

# Step 4: train
Write-Step "[4] train.py..."
Set-Location (Join-Path $Root "classifier")
cmd /c "$python train.py"
if ($LASTEXITCODE -ne 0) { Write-Step "  WARN: train.py exit $LASTEXITCODE (fallback ok)" }
Set-Location $Root

# Step 5: start services in background
Write-Step "[5] Starting services..."
$classifierLog = Join-Path $logDir "test-classifier.log"
$backendLog = Join-Path $logDir "test-backend.log"
$frontendLog = Join-Path $logDir "test-frontend.log"

$classifierProc = Start-Process -FilePath "cmd.exe" -ArgumentList @(
    "/c", "cd /d `"$Root\classifier`" && $python serve.py > `"$classifierLog`" 2>&1"
) -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 2

$backendProc = Start-Process -FilePath "cmd.exe" -ArgumentList @(
    "/c", "cd /d `"$Root\backend`" && go run . > `"$backendLog`" 2>&1"
) -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 2

$frontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList @(
    "/c", "cd /d `"$Root\yandexMap`" && npm run dev -- --host 127.0.0.1 --port 5173 > `"$frontendLog`" 2>&1"
) -PassThru -WindowStyle Hidden

# Step 6: health checks
Write-Step "[6] Health checks..."
$results = @{}

$results["classifier :5055/health"] = Wait-Http "http://127.0.0.1:5055/health" 60
$results["backend :8080"] = Wait-Http "http://127.0.0.1:8080/api/taxonomy" 90
$results["frontend :5173"] = Wait-Http "http://127.0.0.1:5173" 90

$allOk = $true
foreach ($k in $results.Keys) {
    $status = if ($results[$k]) { "PASS" } else { "FAIL"; $allOk = $false }
    Write-Step "  $status  $k"
    if (-not $results[$k]) {
        if ($k -like "*classifier*") { Get-Content $classifierLog -Tail 20 -ErrorAction SilentlyContinue | ForEach-Object { Write-Step "    $($_)" } }
        if ($k -like "*backend*") { Get-Content $backendLog -Tail 20 -ErrorAction SilentlyContinue | ForEach-Object { Write-Step "    $($_)" } }
        if ($k -like "*frontend*") { Get-Content $frontendLog -Tail 20 -ErrorAction SilentlyContinue | ForEach-Object { Write-Step "    $($_)" } }
    }
}

# Cleanup
Write-Step "[7] Stopping test processes..."
Stop-Port 8080; Stop-Port 5055; Stop-Port 5173
try { Stop-Process -Id $classifierProc.Id -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue } catch {}

if ($allOk) {
    Write-Step "=== ALL TESTS PASSED ==="
    exit 0
} else {
    Write-Step "=== SOME TESTS FAILED ==="
    exit 1
}
