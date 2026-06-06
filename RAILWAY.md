# Деплой на Railway

Проект состоит из **PostgreSQL**, **backend** (Go), **frontend** (React/Vite + nginx) и опционально **classifier** (Python). На Railway каждый компонент — отдельный сервис из одного репозитория.

## 1. Подготовка

1. Зарегистрируйтесь на [railway.app](https://railway.app) и подключите GitHub-репозиторий.
2. Получите [API-ключ Яндекс.Карт](https://developer.tech.yandex.ru/) (для карты и геокодера).

## 2. PostgreSQL

1. В проекте Railway: **New → Database → PostgreSQL**.
2. Откройте сервис БД → **Variables** → скопируйте `DATABASE_URL`.
3. **PostGIS (рекомендуется):** в **Data → Query** выполните:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
   Без PostGIS приложение работает, но поиск «рядом» и bbox-фильтры на карте будут ограничены.

## 3. Backend

1. **New → GitHub Repo** → тот же репозиторий.
2. **Settings → Root Directory:** `backend`
3. **Settings → Build:** Dockerfile (`backend/Dockerfile`, задаётся в `backend/railway.toml`).
4. **Variables:**
   | Переменная | Значение |
   |------------|----------|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference из сервиса БД) |
   | `JWT_SECRET` | длинная случайная строка |
   | `CORS_ORIGINS` | публичный URL фронтенда (после шага 4), например `https://yandexmap-front.up.railway.app` |
5. **Settings → Networking → Generate Domain** — сохраните URL, он понадобится для фронта.
6. Healthcheck: `GET /health` → `ok`

## 4. Frontend

1. **New → GitHub Repo** → тот же репозиторий.
2. **Settings → Root Directory:** `.` (корень репозитория, не `yandexMap`!)
3. **Settings → Dockerfile Path:** `yandexMap/Dockerfile.prod`
4. **Variables** (важно: для Vite они нужны на этапе **сборки**):
   | Переменная | Значение |
   |------------|----------|
   | `VITE_API_URL` | URL backend из шага 3, **без** `/api` на конце |
   | `VITE_YANDEX_MAPS_API_KEY` | ключ Яндекс.Карт |
   | `VITE_AI_CLASSIFIER_URL` | URL classifier (шаг 5) или оставьте пустым |
5. **Generate Domain** для фронтенда.
6. Вернитесь в backend и обновите `CORS_ORIGINS` на URL фронтенда → **Redeploy** backend.

## 5. Classifier (опционально)

Классификатор нужен для автоподбора категории по тексту/фото. Без него карта и модерация работают, AI-подсказки — нет.

1. **New → GitHub Repo** → тот же репозиторий.
2. **Root Directory:** `.` (корень)
3. **Dockerfile Path:** `classifier/Dockerfile`
4. **Variables:** `PORT` задаёт Railway автоматически.
5. Первый деплой может занять 5–10 мин (pip + `train.py`).
6. URL сервиса укажите в `VITE_AI_CLASSIFIER_URL` и **пересоберите** frontend.

## 6. Проверка после деплоя

- Frontend открывается, карта загружается.
- Регистрация / вход работают.
- Создание метки сохраняется (backend + БД).
- `https://<backend>/health` → `ok`

**Тестовый админ** (создаётся при первом старте backend): `admin@test.com` / `admin123` — смените пароль после деплоя.

## 7. Локальная проверка production-сборки

```bash
# Backend
cd backend
go build -o backend .
./backend

# Frontend (из корня репозитория)
docker build -f yandexMap/Dockerfile.prod \
  --build-arg VITE_API_URL=http://localhost:8080 \
  -t yandexmap-front .
docker run -p 8081:8080 -e PORT=8080 yandexmap-front
```

## 8. Частые проблемы

| Симптом | Решение |
|---------|---------|
| `Failed to fetch` в браузере | Проверьте `VITE_API_URL` и `CORS_ORIGINS` (точное совпадение URL, с `https://`) |
| Карта пустая / ошибка API карт | Задайте `VITE_YANDEX_MAPS_API_KEY`, пересоберите frontend |
| Backend падает при старте | Проверьте `DATABASE_URL`, доступность PostgreSQL |
| PostGIS migration failed | Выполните `CREATE EXTENSION postgis;` вручную в Railway Query |
| Загрузки фото пропадают после redeploy | Railway ephemeral disk — для продакшена подключите [Volume](https://docs.railway.app/reference/volumes) к `/app/uploads` на backend |

## Схема сервисов

```
[Browser] → Frontend (nginx, static)
              ↓ VITE_API_URL
           Backend (Go :PORT)
              ↓ DATABASE_URL
           PostgreSQL (+ PostGIS)

Frontend ──→ Classifier (optional, :PORT)
```
