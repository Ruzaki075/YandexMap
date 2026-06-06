# Native run (no Docker): PostgreSQL + Go API + Python classifier + Vite frontend
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

$env:Path = @(
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\Go\bin",
    "$env:LOCALAPPDATA\Programs\Python\Python312",
    "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts",
    "C:\Program Files\nodejs",
    [System.Environment]::GetEnvironmentVariable("Path", "Machine"),
    [System.Environment]::GetEnvironmentVariable("Path", "User")
) -join ";"

function Stop-PortListener([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Write-Host "[1/5] Freeing ports 8080, 5055, 5173..."
Stop-PortListener 8080
Stop-PortListener 5055
Stop-PortListener 5173
Start-Sleep -Seconds 1

Write-Host "[2/5] PostgreSQL: ensure DB exists..."
$hba = "C:\Program Files\PostgreSQL\16\data\pg_hba.conf"
$hbaBackup = "$hba.native-run.bak"
if (-not (Test-Path $hbaBackup)) { Copy-Item $hba $hbaBackup -Force }
$lines = Get-Content $hba
if ($lines -notmatch "127\.0\.0\.1/32\s+trust\s+# yandexmap-native") {
    $insert = @(
        "",
        "# yandexmap-native (added by run-native.ps1)",
        "host    all             all             127.0.0.1/32            trust"
    )
    $newLines = @()
    $done = $false
    foreach ($line in $lines) {
        $newLines += $line
        if (-not $done -and $line -match "^# TYPE\s+DATABASE") {
            $newLines += $insert
            $done = $true
        }
    }
    if (-not $done) { $newLines = $lines + $insert }
    [System.IO.File]::WriteAllLines($hba, $newLines)
    try { Restart-Service postgresql-x64-16 -Force -ErrorAction Stop } catch { Start-Sleep -Seconds 5 }
    Start-Sleep -Seconds 3
}

$sql = Join-Path $Root "scripts\local-db-init.sql"
psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -v ON_ERROR_STOP=0 -f $sql | Out-Null

Write-Host "[3/5] Classifier: pip + train (light)..."
Set-Location (Join-Path $Root "classifier")
python -m pip install -q -r requirements.txt
python train.py
if ($LASTEXITCODE -ne 0) { Write-Warning "train.py failed; classifier will use fallback." }

Write-Host "[4/5] Starting classifier, API, frontend..."
Set-Location $Root
$logs = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

Start-Process powershell -WindowStyle Minimized -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root\classifier'; python serve.py *>> '$logs\classifier.log'"
)
Start-Sleep -Seconds 2

Start-Process powershell -WindowStyle Minimized -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root\backend'; go run . *>> '$logs\backend.log'"
)
Start-Sleep -Seconds 2

Start-Process powershell -WindowStyle Minimized -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root\yandexMap'; npm run dev -- --host 0.0.0.0 --port 5173 *>> '$logs\frontend.log'"
)

Write-Host "[5/5] Done."
Write-Host "  Site:        http://localhost:5173"
Write-Host "  API:         http://localhost:8080"
Write-Host "  Classifier:  http://localhost:5055/health"
Write-Host "  Logs:        $logs"
