# Деплой ZERTZ Online

Продакшн работает через **Docker Compose на самостоятельном VDS** (`docker compose up -d` поднимает `web` + `db`). Railway больше не используется — `railway:*` скрипты в package.json оставлены как legacy.

## Локальная разработка

Postgres — в Docker, фронт и бэк — в двух терминалах:

```bash
docker compose up -d db          # postgres на 5432 (ТОЛЬКО db, не весь стек)
cp .env.example .env             # затем впиши JWT_SECRET
npm install
npm run dev                      # Vite на 5173, проксирует /api → 127.0.0.1:5050
npm run dev:server               # Express на 5050 (нет hot-reload — рестарть после правок server/)
```

> ⚠️ `docker-compose.yml` описывает **два** сервиса: `db` (postgres) и `web` (полный образ приложения). Локально поднимай только `db`. Если оставить запущенным `web`, он займёт порт 5050 (возможно, устаревшей сборкой) и будет конфликтовать с `npm run dev:server`.

**Переменные окружения** (`.env`): `JWT_SECRET` (обязательно), плюс `DATABASE_URL` **или** отдельные `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`. VAPID-ключи для web-push — опционально.

---

## Продакшн: Docker Compose на VDS

**Требования:** VDS с Ubuntu 22.04+, Docker + Docker Compose, домен (для SSL).

### 1. Docker

```bash
ssh root@YOUR_SERVER_IP
curl -fsSL https://get.docker.com | sh
```

### 2. Проект

```bash
git clone https://github.com/Kartoved/zertz.git /opt/zertz
cd /opt/zertz
```

### 3. `.env`

```bash
cat > .env << 'EOF'
PGHOST=db
PGPORT=5432
PGDATABASE=zertz
PGUSER=zertz
PGPASSWORD=change_me_to_a_strong_secret
PORT=5050
JWT_SECRET=change_me_to_a_long_random_string
EOF
```

### 4. Запуск (весь стек)

```bash
docker compose up -d          # поднимает web + db
docker compose ps             # оба контейнера должны быть healthy
docker compose logs -f web    # логи приложения
```

Сервер сам создаёт все таблицы на старте (идемпотентные `CREATE TABLE` + `ALTER … ADD COLUMN IF NOT EXISTS` в `server/db.js`), так что миграции руками не нужны.

> ⏰ **Таймзона.** Контейнеры работают в **UTC** (переменная `TZ` не задаётся). На это завязана логика часов: все `TIMESTAMP`-колонки — UTC, `server/db.js` форсит node-postgres читать их как UTC (`types.setTypeParser(1114, …)`). Не меняй таймзону контейнеров — иначе таймеры блиц-партий «сгорят» из-за смещения.

Игра доступна на `http://YOUR_SERVER_IP:5050`.

### 5. Обновление

```bash
cd /opt/zertz
git pull
docker compose up -d --build      # пересобирает web-образ и перезапускает
```

### 6. SSL через Nginx (опционально)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/zertz
```

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/zertz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

---

## Архитектура (кратко)

```
zertz/
├── Dockerfile           # билд фронта (tsc + vite) + рантайм node server/
├── docker-compose.yml   # web (образ приложения) + db (postgres)
├── dist/                # собранный фронт (создаётся при билде, отдаётся статикой из server/)
├── server/              # Express API (routes/, utils/, db.js) + server.js
├── shared/              # ESM-модули для клиента И сервера (explorer/ — байт-идентичный replay)
├── src/                 # React + TypeScript (game/, store/, components/, …)
└── .env                 # секреты
```

- **Транспорт онлайн-игр:** HTTP polling (не WebSockets). Оптимизировано `HEAD /:id/head` — тяжёлый fetch только при реальном изменении.
- **Клиент — источник состояния для локальных игр** (IndexedDB), сервер — для онлайн (`state_json`/`tree_json` в таблице `rooms`).
- **Античит:** серверная верификация каждого хода реплеем (`server/utils/verifyState.js`, движок `shared/explorer/replay.js`); кастомные стартовые позиции реплеятся от `rooms.setup_json`.

Полное описание подсистем — в [CLAUDE.md](CLAUDE.md).

## Основные API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/api/auth/register`, `/api/auth/login`, magic-link | Аутентификация (JWT) |
| `POST/GET/PUT` | `/api/rooms`, `/api/rooms/:id`, `/api/rooms/:id/state` | Комнаты, синк состояния (с верификацией) |
| `GET` | `/api/rooms/tv` | ZERTZ TV (живые + последняя завершённая) |
| `GET/PUT` | `/api/rooms/:id/premoves` | Условные пре-мувы (correspondence) |
| `POST` | `/api/matchmake` | Матчмейкинг по рейтингу |
| `GET/POST` | `/api/challenges`, `/api/lobby` | Вызовы, публичное лобби |
| `GET` | `/api/players`, `/api/games`, `/api/explorer` | Профили/лидерборд, история, дебют-эксплорер |
| `CRUD` | `/api/studies` | Студии (Lichess-style уроки) |
| `POST` | `/api/push/*`, `/api/global-chat` | Web-push, глобальный чат |

## Мониторинг

```bash
docker compose ps
docker compose logs -f web
docker compose restart web
```
