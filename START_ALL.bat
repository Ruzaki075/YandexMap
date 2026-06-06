@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

title YandexMap

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "PATH=C:\Program Files\Go\bin;%PATH%"
for /d %%D in ("C:\Program Files\PostgreSQL\*") do set "PATH=%%D\bin;%PATH%"
set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
set "PATH=%LOCALAPPDATA%\Programs\Python\Python313;%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%PATH%"
set "PATH=%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"
set "PATH=C:\Program Files\nodejs;%PATH%"

if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"

echo.
echo ============================================================
echo   YandexMap - ustanovka i zapusk
echo ============================================================
echo   Papka: %ROOT%
echo.
echo   Sait:          http://localhost:5173
echo   API:           http://localhost:8080
echo   Klassifikator: http://localhost:5055/health
echo   Admin:         admin@test.com / admin123
echo ============================================================
echo.

echo [%time%] [0/6] Proverka Node.js, Go, Python, PostgreSQL...

where node >nul 2>&1 || (echo [OSHIBKA] Node.js ne naiden: https://nodejs.org/ & goto fail)
where npm  >nul 2>&1 || (echo [OSHIBKA] npm ne naiden & goto fail)
where go   >nul 2>&1 || (echo [OSHIBKA] Go ne naiden: https://go.dev/dl/ & goto fail)

set "PYTHON_CMD="
where python >nul 2>&1 && set "PYTHON_CMD=python"
if not defined PYTHON_CMD where py >nul 2>&1 && set "PYTHON_CMD=py -3"
if not defined PYTHON_CMD (echo [OSHIBKA] Python ne naiden & goto fail)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$pg = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -EA SilentlyContinue | Sort-Object { [int]$_.Directory.Parent.Name } -Descending | Select-Object -First 1; if (-not $pg) { Write-Host '[OSHIBKA] PostgreSQL ne naiden'; exit 1 }; Write-Host ('      psql: ' + $pg.FullName); $svc = Get-Service postgresql* -EA SilentlyContinue | ? Status -eq Stopped | Select -First 1; if ($svc) { Write-Host ('      Zapusk sluzhby ' + $svc.Name); Start-Service $svc.Name }; exit 0"
if errorlevel 1 goto fail

for /f "delims=" %%V in ('node -v 2^>^&1') do echo       Node:   %%V
for /f "delims=" %%V in ('call npm -v 2^>^&1') do echo       npm:    %%V
for /f "delims=" %%V in ('go version 2^>^&1') do echo       Go:     %%V
for /f "delims=" %%V in ('%PYTHON_CMD% --version 2^>^&1') do echo       Python: %%V
echo.

echo [%time%] [1/6] Osvobozhdayu porty 8080, 5055, 5173...
powershell -NoProfile -Command "8080,5055,5173 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue } }"
timeout /t 1 /nobreak >nul

echo [%time%] [2/6] PostgreSQL...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\setup-postgres.ps1"
if errorlevel 1 (echo [OSHIBKA] PostgreSQL & goto fail)
echo.

echo [%time%] [3/6] Ustanovka zavisimostey...
echo.

if exist "%ROOT%\package.json" (
  echo ------ npm install koren ------
  pushd "%ROOT%"
  call npm install --legacy-peer-deps
  if errorlevel 1 popd & goto fail
  popd
  echo.
)

echo ------ npm install yandexMap ------
pushd "%ROOT%\yandexMap"
call npm install --legacy-peer-deps
if errorlevel 1 popd & goto fail
popd
echo.

echo ------ go mod download backend ------
pushd "%ROOT%\backend"
go mod download
if errorlevel 1 popd & goto fail
popd
echo.

echo ------ pip install classifier ------
pushd "%ROOT%\classifier"
if /I "%YANDEXMAP_FULL_AI%"=="1" goto pip_full
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 goto pip_fail_block
goto pip_done

:pip_full
echo       Rezhim FULL AI: CLIP + EasyOCR
%PYTHON_CMD% -m pip install -r requirements-full.txt
if not errorlevel 1 goto pip_done
echo       Probuyu bazovyj nabor...
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 goto pip_fail_block
goto pip_done

:pip_fail_block
popd
goto pip_fail

:pip_done
popd
echo.

echo [%time%] [4/6] train.py...
pushd "%ROOT%\classifier"
%PYTHON_CMD% train.py
if errorlevel 1 echo       WARNING: train.py zavershilsya s oshibkoj
popd
echo.

echo [%time%] [5/6] Zapusk 3 okon s servisami...
echo       Esli okna ne vidny - proverite panel zadach Windows
echo.

start "classifier-5055" cmd /k "title YandexMap classifier :5055 && cd /d "%ROOT%\classifier" && echo === CLASSIFIER :5055 === && %PYTHON_CMD% serve.py"
timeout /t 2 /nobreak >nul

start "backend-8080" cmd /k "title YandexMap API :8080 && cd /d "%ROOT%\backend" && echo === BACKEND :8080 === && go run ."
timeout /t 2 /nobreak >nul

start "frontend-5173" cmd /k "title YandexMap Vite :5173 && cd /d "%ROOT%\yandexMap" && echo === FRONTEND :5173 === && npm run dev -- --host 127.0.0.1 --port 5173"

echo.
echo [%time%] [6/6] Gotovo! Eto okno ostaetsya otkrytym.
echo.
echo   Sait:          http://localhost:5173
echo   API:           http://localhost:8080
echo   Klassifikator: http://localhost:5055/health
echo.
echo   Q - ostanovit servisy i zakryt
echo   R - obnovit status (avto kazhdye 8 sek)
echo.
goto monitor

:monitor
echo.
echo ------ status %date% %time% ------
powershell -NoProfile -ExecutionPolicy Bypass -Command "function Tp([int]$p){[bool](Get-NetTCPConnection -LocalPort $p -State Listen -EA SilentlyContinue)}; function Tu([string]$u){try{(Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 3).StatusCode -lt 500}catch{$false}}; $a=@(@('Klassifikator :5055',5055,'http://127.0.0.1:5055/health'),@('API :8080',8080,'http://127.0.0.1:8080/api/taxonomy'),@('Frontend :5173',5173,'http://127.0.0.1:5173')); foreach($i in $a){$po=Tp $i[1];$hu=Tu $i[2]; if($po -and $hu){Write-Host ('  [OK]   '+$i[0])}elseif($po){Write-Host ('  [....] '+$i[0]+' (zhdem)')}else{Write-Host ('  [----] '+$i[0]+' (ne zapuschen)')}}"
choice /c QR /n /t 8 /d R >nul
if errorlevel 2 goto monitor
if errorlevel 1 goto stop_all
goto monitor

:stop_all
echo.
echo [%time%] Ostanavlivayu servisy...
powershell -NoProfile -Command "8080,5055,5173 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue } }"
echo Vse servisy ostanovleny.
echo Nazhmite lyubuyu klavishu...
pause >nul
exit /b 0

:pip_fail
popd 2>nul
echo [OSHIBKA] pip install ne udalos
goto fail

:fail
echo.
echo [OSHIBKA] Zapusk prervan. Okno ostaetsya otkrytym.
echo Nazhmite lyubuyu klavishu...
pause >nul
exit /b 1
