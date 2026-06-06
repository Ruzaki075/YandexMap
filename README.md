# YandexMap

Веб-приложение для отображения проблем на карте (Яндекс.Карты), с API, модерацией, уведомлениями и ИИ-классификатором обращений.

## Что входит в проект

| Компонент | Папка | Технологии | Порт |
|-----------|-------|------------|------|
| Фронтенд | `yandexMap/` | React + Vite | 5173 |
| Backend API | `backend/` | Go + PostgreSQL | 8080 |
| Классификатор | `classifier/` | Python Flask + scikit-learn | 5055 |
| База данных | PostgreSQL (локально) | PostgreSQL 16+ | 5432 |

## Быстрый старт (Windows)

### 1. Установите программы (один раз)

- [Node.js](https://nodejs.org/) (LTS)
- [Go](https://go.dev/dl/)
- [Python 3.10+](https://www.python.org/) — при установке включите **Add to PATH**
- [PostgreSQL 16+](https://www.postgresql.org/download/windows/)

### 2. Запустите проект

**Рекомендуется:** двойной клик по **`LAUNCH.bat`**

Альтернатива: двойной клик по **`START_ALL.bat`**

Откроются **4 окна**:
1. Главное — установка зависимостей и мониторинг
2. Классификатор (`:5055`)
3. Backend API (`:8080`)
4. Фронтенд Vite (`:5173`)

Если окна не видно — проверьте **панель задач** Windows.

### 3. Откройте в браузере

- Сайт: http://localhost:5173
- API: http://localhost:8080
- Health классификатора: http://localhost:5055/health

**Тестовый администратор:** `admin@test.com` / `admin123`

## Что делает START_ALL.bat

1. Проверяет Node.js, Go, Python, PostgreSQL
2. Освобождает порты 8080, 5055, 5173
3. Настраивает PostgreSQL (база `yandexmap`, пароль `Chernig007or`)
4. Устанавливает зависимости: `npm`, `go mod`, `pip`
5. Обучает модель классификатора (`train.py`)
6. Запускает все сервисы
7. Показывает статус в главном окне (обновление каждые 8 сек)

**Управление в главном окне:**
- `R` — обновить статус сервисов
- `Q` — остановить все сервисы и выйти

## Полный ИИ (распознавание фото + OCR)

По умолчанию ставится базовый классификатор (только текст). Для CLIP + EasyOCR (~2 ГБ, первый запуск 5–15 мин):

```bat
set YANDEXMAP_FULL_AI=1
LAUNCH.bat
```

## Запуск через Docker

Если не хотите ставить Go/Python/PostgreSQL локально:

```bash
docker compose up --build
```

Подробнее: [DOCKER.md](DOCKER.md)

## Деплой на Railway

Пошаговая инструкция: [RAILWAY.md](RAILWAY.md)

Остановка Docker:

```bash
docker compose down
```

## Структура проекта

```
YandexMap-main/
├── LAUNCH.bat          # Запуск (рекомендуется)
├── START_ALL.bat       # Установка + запуск + мониторинг
├── yandexMap/          # React-фронтенд
├── backend/            # Go API
├── classifier/         # Python-классификатор
├── scripts/            # Вспомогательные скрипты (PostgreSQL и др.)
├── logs/               # Логи (создаётся при запуске)
├── docker-compose.yml  # Docker-конфигурация
└── issue-taxonomy.json # Таксономия типов проблем
```

## Ручной запуск (без батника)

```bat
# PostgreSQL должен быть запущен, база yandexmap создана

# Терминал 1 — классификатор
cd classifier
pip install -r requirements.txt
python train.py
python serve.py

# Терминал 2 — backend
cd backend
go mod download
go run .

# Терминал 3 — фронтенд
cd yandexMap
npm install --legacy-peer-deps
npm run dev
```

## Частые проблемы

### Окно не открывается или сразу закрывается

- Запускайте через **`LAUNCH.bat`**, не через ярлык с неправильной рабочей папкой
- Запустите от имени администратора (правый клик → «Запуск от имени администратора»)
- Вручную из cmd:
  ```bat
  cd /d "C:\путь\к\YandexMap-main"
  LAUNCH.bat
  ```

### «Go / Node / Python не найден»

Установите недостающую программу и **перезапустите** терминал (или компьютер). Батник сам добавляет стандартные пути в PATH.

### «PostgreSQL не найден»

Установите PostgreSQL и убедитесь, что служба запущена (Диспетчер задач → Службы → `postgresql-*`).

### Порт занят

Закройте старые окна cmd с сервисами или нажмите `Q` в главном окне START_ALL.bat.

### Сайт не открывается, но окна есть

Подождите 10–20 секунд — Vite и Go компилируются при первом запуске. В главном окне статус должен стать `[OK]`.

## Логи

- `logs/start-all.log` — общий лог (если включён)
- Окна сервисов показывают вывод в реальном времени

## Полезные ссылки

- Docker-запуск: [DOCKER.md](DOCKER.md)
- Нативный PowerShell-скрипт: `run-native.ps1`
- Автотест запуска: `scripts/test-start-all.ps1`
