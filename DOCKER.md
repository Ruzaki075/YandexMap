# Docker запуск проекта YandexMap

## Что поднимается

- `db` - PostgreSQL 16 (`localhost:5432`)
- `backend` - Go API (`localhost:8080`)
- `classifier` - Python классификатор (`localhost:5055`)
- `frontend` - React/Vite (`localhost:5173`)

## Требования

- Docker Desktop (Windows)
- Включенный Docker Compose v2

## Быстрый старт

```bash
docker compose up --build
```

После запуска:

- Сайт: `http://localhost:5173`
- API: `http://localhost:8080`
- Health классификатора: `http://localhost:5055/health`

## Остановка

```bash
docker compose down
```

С удалением томов (БД и uploads):

```bash
docker compose down -v
```

## Важно

- При старте backend в текущей реализации пересоздает таблицы (`createTables`), поэтому данные в БД сбрасываются.
- CORS в backend сейчас настроен на `http://localhost:5173`, что соответствует конфигурации compose.
