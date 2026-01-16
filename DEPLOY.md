# Деплой ZERTZ Online

## Требования

- **Node.js** 18+ 
- **PostgreSQL** 14+
- Домен с HTTPS (для продакшена)

## Быстрый старт (локально)

```bash
# 1. Установить зависимости
npm install

# 2. Создать базу данных PostgreSQL
createdb zertz

# 3. Настроить переменные окружения
cp .env.example .env
# Отредактируй .env с твоими данными Postgres

# 4. Собрать фронтенд
npm run build

# 5. Запустить сервер
npm start
# Открыть http://localhost:5050
```

## Деплой на VPS (Ubuntu/Debian)

### 1. Установка зависимостей

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# PM2 для управления процессами
sudo npm install -g pm2
```

### 2. Настройка PostgreSQL

```bash
sudo -u postgres createuser zertz_user
sudo -u postgres createdb zertz -O zertz_user
sudo -u postgres psql -c "ALTER USER zertz_user PASSWORD 'your_password';"
```

### 3. Клонирование и настройка

```bash
git clone <your-repo-url> /var/www/zertz
cd /var/www/zertz
npm install
npm run build
```

### 4. Переменные окружения

```bash
cat > .env << EOF
PGHOST=localhost
PGPORT=5432
PGDATABASE=zertz
PGUSER=zertz_user
PGPASSWORD=your_password
PORT=5050
EOF
```

### 5. Запуск через PM2

```bash
pm2 start server/server.js --name zertz
pm2 save
pm2 startup
```

### 6. Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name zertz.example.com;

    location / {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/zertz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d zertz.example.com
```

## Деплой на Railway.app (бесплатно)

1. Создать аккаунт на [railway.app](https://railway.app)
2. Создать новый проект
3. Добавить PostgreSQL из маркетплейса
4. Подключить GitHub репозиторий
5. Railway автоматически задеплоит

Переменные окружения будут настроены автоматически.

## Деплой на Render.com

1. Создать Web Service из репозитория
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Добавить PostgreSQL из маркетплейса
5. Переменные окружения подхватятся автоматически

## Деплой на Fly.io

```bash
# Установить flyctl
curl -L https://fly.io/install.sh | sh

# Авторизация
flyctl auth login

# Создать приложение
flyctl launch

# Создать Postgres
flyctl postgres create

# Привязать к приложению
flyctl postgres attach <db-name>

# Деплой
flyctl deploy
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
