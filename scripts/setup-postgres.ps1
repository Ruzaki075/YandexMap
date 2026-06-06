# Подготовка локальной PostgreSQL для нативного запуска YandexMap.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

$psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name) } -Descending |
    Select-Object -First 1

if (-not $psql) {
    Write-Host "[ОШИБКА] PostgreSQL не установлен."
    exit 1
}

$pgBin = $psql.Directory.FullName
$pgVer = $psql.Directory.Parent.Name
$env:Path = "$pgBin;$env:Path"

$service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match $pgVer -or $_.DisplayName -match "PostgreSQL" } |
    Select-Object -First 1

if ($service -and $service.Status -ne "Running") {
    Write-Host "      Запуск службы $($service.Name)..."
    Start-Service $service.Name
    Start-Sleep -Seconds 3
}

$dataDir = "C:\Program Files\PostgreSQL\$pgVer\data"
$hba = Join-Path $dataDir "pg_hba.conf"
$marker = "# yandexmap-native"

if (Test-Path $hba) {
    $content = Get-Content $hba -Raw
    if ($content -notmatch [regex]::Escape($marker)) {
        $backup = "$hba.yandexmap.bak"
        if (-not (Test-Path $backup)) {
            Copy-Item $hba $backup -Force
            Write-Host "      Резервная копия pg_hba.conf: $backup"
        }

        $trustRule = @"

$marker
host    all             all             127.0.0.1/32            trust
"@

        Add-Content -Path $hba -Value $trustRule -Encoding ASCII

        if ($service) {
            try {
                Restart-Service $service.Name -Force
                Start-Sleep -Seconds 3
            } catch {
                Write-Host "      Предупреждение: перезапустите PostgreSQL вручную."
            }
        }
    }
}

$sql = Join-Path $Root "scripts\local-db-init.sql"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
cmd /c "psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -v ON_ERROR_STOP=0 -f `"$sql`" >nul 2>&1"
$ErrorActionPreference = $prevEap

$ready = cmd /c "psql -U postgres -h 127.0.0.1 -p 5432 -d yandexmap -tAc `"SELECT 1`" 2>nul"
if ($ready -ne "1") {
    Write-Host "[ОШИБКА] База yandexmap недоступна на localhost:5432"
    exit 1
}

Write-Host "      PostgreSQL готов (база yandexmap, пароль postgres: Chernig007or)"
exit 0
