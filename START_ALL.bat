@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/4] Останавливаю старые процессы на портах 8080, 5055, 5173 (если есть)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5055 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [2/4] Классификатор: зависимости и обучение...
echo      (requirements-full: CLIP + EasyOCR — первый раз качает много, 5-15 мин)
cd classifier
python -m pip install -r requirements-full.txt
if errorlevel 1 (
  echo Не удалось pip install. Пробуем только базу без фото...
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Ошибка pip. Проверьте Python и сеть/прокси.
    cd ..
    pause
    exit /b 1
  )
)
python train.py
if errorlevel 1 (
  echo Предупреждение: train.py завершился с ошибкой. serve.py всё равно поднимется с простым fallback по словам.
)
cd ..

echo [3/4] Запуск API, классификатора и фронта в отдельных окнах...
start "YandexMap classifier :5055" cmd /k "cd /d "%~dp0classifier" && python serve.py"
timeout /t 2 /nobreak >nul
start "YandexMap API :8080" cmd /k "cd /d "%~dp0backend" && go run ."
timeout /t 2 /nobreak >nul
start "YandexMap Vite :5173" cmd /k "cd /d "%~dp0yandexMap" && npm run dev --legacy-peer-deps"

echo [4/4] Готово.
echo   Сайт:     http://localhost:5173
echo   API:      http://localhost:8080
echo   ИИ-сервис: http://localhost:5055/health
echo.
echo Закройте окна cmd с сервисами чтобы остановить их.
pause
