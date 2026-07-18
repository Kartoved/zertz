# 📝 Промпт для реализации онлайн-версии Zertz

> 🏛 **Исторический документ.** Это исходный план онлайн-версии — **полностью реализован и давно превзойдён**
> (лобби, матчмейкинг, рейтинг, correspondence-пре-мувы, эксплорер, студии и т.д.).
> Актуальное состояние — в [CLAUDE.md](CLAUDE.md), [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md), [IDEAS.md](IDEAS.md).
> Оставлен для истории.

**Задача:** Реализовать асинхронную онлайн-версию игры Zertz с возможностью играть по ссылке, сохранением состояния в Postgres, чатом и выбором размера доски.

---

## 🎯 Функциональные требования

### 1. Система комнат:
- Создание комнаты с выбором размера доски (37/48/61)
- Уникальная ссылка вида `/room/:roomId`
- Присоединение по ссылке
- Игроки могут заходить/выходить в любой момент

### 2. Игровой процесс:
- Асинхронные ходы (сохранение после каждого действия)
- Автоматическое отображение ходов оппонента при обновлении/входе
- Индикатор "чей ход" (светящийся бордюр/текст)
- История ходов с возможностью просмотра

### 3. Игроки:
- По умолчанию "Игрок 1" / "Игрок 2"
- Возможность редактирования имён (двойной клик)
- Имена сохраняются в базе для комнаты

### 4. Чат:
- Простое текстовое поле + кнопка "Отправить"
- Сообщения с датой/временем и именем отправителя
- История чата сохраняется в базе
- Автоматическая прокрутка к новым сообщениям

### 5. Бэкенд:
- Текущий Node.js + Express + Postgres
- WebSocket (Socket.io) для реального времени (опционально, можно polling)
- REST API для CRUD комнат, игроков, ходов, сообщений

---

## 🛠️ Техническая архитектура

### База данных (Postgres):
```sql
-- Таблица комнат
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_size INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Игроки в комнатах
CREATE TABLE room_players (
  room_id UUID REFERENCES rooms(id),
  player_index INTEGER NOT NULL, -- 1 или 2
  name TEXT NOT NULL DEFAULT 'Игрок X',
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (room_id, player_index)
);

-- Игровое состояние (JSON)
CREATE TABLE room_state (
  room_id UUID REFERENCES rooms(id) PRIMARY KEY,
  state_json JSONB NOT NULL,
  tree_json JSONB NOT NULL,
  current_player INTEGER NOT NULL,
  winner INTEGER,
  win_type TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Сообщения чата
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  player_index INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API эндпоинты:
- `POST /api/rooms` — создать комнату
- `GET /api/rooms/:id` — получить комнату
- `PUT /api/rooms/:id/state` — обновить состояние
- `GET /api/rooms/:id/messages` — история чата
- `POST /api/rooms/:id/messages` — отправить сообщение
- `PUT /api/rooms/:id/players/:index` — обновить имя

### Фронтенд:
- Новый роут `/room/:id`
- Компоненты: `RoomScreen`, `ChatPanel`, `PlayerInfo`
- Zustand store для онлайн-состояния
- Автообновление состояния (polling каждые 2-3 сек)

---

## 📦 План реализации

### 1. Бэкенд:
- Добавить таблицы в Postgres
- Реализовать API эндпоинты
- Добавить миграции схем

### 2. Фронтенд:
- Создать роут `/room/:id`
- Реализовать создание комнаты (модалка в MainMenu)
- Компонент чата
- Интеграция с текущим игровым движком

### 3. UI/UX:
- Кнопка "Создать онлайн-игру" в главном меню
- Модалка выбора размера доски
- Копирование ссылки в буфер обмена
- Индикатор хода и статуса оппонента

### 4. Тестирование:
- Проверка сохранения/загрузки состояния
- Работа чата
- Обновление при входе/выходе

---

## 🎨 UI компоненты для добавления

- **RoomScreen:** основной экран онлайн-игры
- **ChatPanel:** панель чата справа/снизу
- **CreateRoomModal:** модалка создания комнаты
- **RoomStatus:** индикатор состояния комнаты и игроков
- **ShareLink:** компонент для копирования ссылки

---

## 🔄 Интеграция с текущим кодом

- Использовать существующий `GameState` и `GameNode`
- Адаптировать `gameStore` для онлайн-режима
- Reuse `HexBoard`, `HexRing`, `MoveHistory`
- Добавить `isOnline` флаг в store

---

**Готов начать реализацию по этому плану?**
