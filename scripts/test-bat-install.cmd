@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0.."

echo === TEST START_ALL.bat steps 0-4 (install only) ===

set "PATH=C:\Program Files\Go\bin;%PATH%"
for /d %%D in ("C:\Program Files\PostgreSQL\*") do set "PATH=%%D\bin;%PATH%"
set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
set "PATH=%LOCALAPPDATA%\Programs\Python\Python313;%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%PATH%"
set "PATH=%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"
set "PATH=C:\Program Files\nodejs;%PATH%"

where node >nul 2>&1 || (echo FAIL: node & exit /b 1)
where npm >nul 2>&1 || (echo FAIL: npm & exit /b 1)
where go >nul 2>&1 || (echo FAIL: go & exit /b 1)
set "PYTHON_CMD="
where python >nul 2>&1 && set "PYTHON_CMD=python"
if not defined PYTHON_CMD where py >nul 2>&1 && set "PYTHON_CMD=py -3"
if not defined PYTHON_CMD (echo FAIL: python & exit /b 1)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-postgres.ps1"
if errorlevel 1 (echo FAIL: postgres & exit /b 1)

if exist package.json (
  call npm install --legacy-peer-deps
  if errorlevel 1 (echo FAIL: root npm & exit /b 1)
)

cd /d "%~dp0..\yandexMap"
call npm install --legacy-peer-deps
if errorlevel 1 (echo FAIL: frontend npm & exit /b 1)

cd /d "%~dp0..\backend"
go mod download
if errorlevel 1 (echo FAIL: go mod & exit /b 1)

cd /d "%~dp0..\classifier"
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 (echo FAIL: pip & exit /b 1)

%PYTHON_CMD% train.py
if errorlevel 1 (echo WARN: train.py failed, continuing)

echo === BAT INSTALL STEPS OK ===
exit /b 0
