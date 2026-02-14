# Деплой ZERTZ Online

## ⚡ ВАРИАНТ 1: Railway.app (самый простой)

**Время:** 5 минут | **Цена:** Бесплатно

### Шаги:

1. **Залей код на GitHub** (уже сделано)

2. **Зайди на [railway.app](https://railway.app)** и войди через GitHub

3. **New Project → Deploy from GitHub repo** → выбери `zertz`

4. **Добавь PostgreSQL:**
   - В проекте нажми "Add Service" → "Database" → "PostgreSQL"
   - Railway сам создаст переменные окружения

5. **Готово!** Railway даст ссылку типа `https://zertz-xxx.up.railway.app`

> ⚠️ Проект использует **Dockerfile** — билд происходит в контейнере, без ошибок с tsc.

---

## 🐳 ВАРИАНТ 2: VPS с Docker (полный контроль)

**Время:** 15-30 минут | **Цена:** от $5/мес (DigitalOcean, Vultr, Selectel)

### Требования:
- VPS с Ubuntu 22.04+
- Docker и Docker Compose
- Домен (опционально)

### Шаг 1: Установка Docker на VPS

```bash
# Подключись к серверу
ssh root@YOUR_SERVER_IP

# Установи Docker
curl -fsSL https://get.docker.com | sh
```

### Шаг 2: Клонирование проекта

```bash
git clone https://github.com/Kartoved/zertz.git /opt/zertz
cd /opt/zertz
```

### Шаг 3: Настройка переменных

```bash
cat > .env << EOF
PGHOST=db
PGPORT=5432
PGDATABASE=zertz
PGUSER=zertz
PGPASSWORD=zertz_secret_password
PORT=5050
EOF
```

### Шаг 4: Запуск

```bash
docker compose up -d
```

### Шаг 5: Проверка

```bash
# Проверь что контейнеры работают
docker compose ps

# Открой в браузере
curl http://localhost:5050/api/health
```

Игра доступна на `http://YOUR_SERVER_IP:5050`

### Шаг 6: SSL с Nginx (опционально)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Создай конфиг nginx
sudo nano /etc/nginx/sites-available/zertz
```

Содержимое файла:
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
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

## Структура проекта

```
zertz/
├── dist/           # Собранный фронтенд
├── server/
│   └── server.js   # Express API сервер
├── src/            # Исходники React
├── .env            # Переменные окружения
└── package.json
```

## API эндпоинты

- `GET /api/health` — проверка здоровья
- `POST /api/rooms` — создать комнату
- `GET /api/rooms/:id` — получить комнату
- `PUT /api/rooms/:id/state` — обновить состояние
- `GET /api/rooms/:id/messages` — получить чат
- `POST /api/rooms/:id/messages` — отправить сообщение

## Мобильный UX (обновлено)

- Локальная игра:
  - Карточки игроков в мобильной версии отображаются горизонтально (2 колонки).
  - Кнопки `Undo` и `Сдаться` находятся в карточке выбора шарика.
  - Кнопка `Сдаться` открывает подтверждающую модалку.

- Онлайн игра:
  - Нижние вкладки: `Игра` и `Чат`.
  - Во вкладке `Игра` отображаются и карточки игроков, и доска (как в локальном режиме).
  - Кнопки `Undo` и `Сдаться` находятся в карточке выбора шарика.
  - Вкладка `Чат`: поле ввода закреплено над нижним таббаром.

- Undo в онлайн:
  - Разрешен только откат **собственного последнего хода**.
  - Подтверждение оппонентом сейчас не реализовано серверно (нет отдельного протокола undo-request/undo-approve).

## Мониторинг

```bash
# Логи PM2
pm2 logs zertz

# Статус
pm2 status

# Перезапуск
pm2 restart zertz
```

## Обновление

```bash
cd /var/www/zertz
git pull
npm install
npm run build
pm2 restart zertz
```
