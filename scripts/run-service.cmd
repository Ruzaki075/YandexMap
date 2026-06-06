@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "SERVICE=%~1"
set "RUNNER=%~2"
set "ROOT=%~3"
set "LOG=%ROOT%logs\%SERVICE%.log"

cd /d "%ROOT%"

if /I "%SERVICE%"=="classifier" (
  title YandexMap classifier :5055
  echo ============================================================
  echo   КЛАССИФИКАТОР — порт 5055
  echo   Health: http://localhost:5055/health
  echo   Лог:    %LOG%
  echo ============================================================
  echo.
  cd /d "%ROOT%classifier"
  echo [%time%] Запуск: %RUNNER% serve.py
  echo.
  powershell -NoProfile -Command "& { %RUNNER% serve.py 2>&1 | Tee-Object -FilePath '%LOG%' }"
  echo.
  echo [%time%] Классификатор остановлен. Код: %ERRORLEVEL%
  pause
  exit /b %ERRORLEVEL%
)

if /I "%SERVICE%"=="backend" (
  title YandexMap API :8080
  echo ============================================================
  echo   BACKEND API — порт 8080
  echo   URL: http://localhost:8080
  echo   Лог: %LOG%
  echo ============================================================
  echo.
  cd /d "%ROOT%backend"
  echo [%time%] Запуск: go run .
  echo.
  powershell -NoProfile -Command "& { go run . 2>&1 | Tee-Object -FilePath '%LOG%' }"
  echo.
  echo [%time%] Backend остановлен. Код: %ERRORLEVEL%
  pause
  exit /b %ERRORLEVEL%
)

if /I "%SERVICE%"=="frontend" (
  title YandexMap Vite :5173
  echo ============================================================
  echo   FRONTEND (Vite) — порт 5173
  echo   Сайт: http://localhost:5173
  echo   Лог:  %LOG%
  echo ============================================================
  echo.
  cd /d "%ROOT%yandexMap"
  echo [%time%] Запуск: npm run dev -- --host 127.0.0.1 --port 5173
  echo.
  powershell -NoProfile -Command "& { npm run dev -- --host 127.0.0.1 --port 5173 2>&1 | Tee-Object -FilePath '%LOG%' }"
  echo.
  echo [%time%] Frontend остановлен. Код: %ERRORLEVEL%
  pause
  exit /b %ERRORLEVEL%
)

echo Неизвестный сервис: %SERVICE%
pause
exit /b 1
