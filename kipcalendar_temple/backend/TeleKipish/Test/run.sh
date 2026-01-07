# ============================================================================
# run.sh - Скрипт запуска для Linux/Mac
# ============================================================================
#!/bin/bash

echo "🤖 Starting TeleKipish Bot..."

# Проверка .NET
if ! command -v dotnet &> /dev/null; then
    echo "❌ .NET 8.0 SDK not found!"
    echo "Please install from: https://dotnet.microsoft.com/download"
    exit 1
fi

# Проверка токена
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "⚠️  TELEGRAM_BOT_TOKEN not set!"
    echo "Please set it with: export TELEGRAM_BOT_TOKEN='your_token_here'"
    exit 1
fi

# Проверка API
echo "Checking API connection..."
if ! curl -s http://localhost:5000/health > /dev/null; then
    echo "❌ API not responding on http://localhost:5000"
    echo "Please start the Python API first:"
    echo "  cd kipcalendar_temple/backend"
    echo "  python app_test.py"
    exit 1
fi

echo "✅ API is running"

# Сборка и запуск
echo "Building project..."
dotnet build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "Starting bot..."
dotnet run

# ============================================================================
# .gitignore
# ============================================================================
## .NET
bin/
obj/
*.user
*.suo
*.userprefs
.vs/
.vscode/

## SQLite
*.db
*.db-shm
*.db-wal

## Logs
*.log

## Config
appsettings.Development.json

## OS
.DS_Store
Thumbs.db

# ============================================================================
# docker-compose.yml - Docker конфигурация
# ============================================================================
version: '3.8'

services:
  telekipish-bot:
    build: .
    container_name: telekipish-bot
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - API_BASE_URL=http://api:5000/api
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - kipcalendar-network

  api:
    build: ./kipcalendar_temple/backend
    container_name: kipcalendar-api
    ports:
      - "5000:5000"
    volumes:
      - ./kipcalendar_temple/backend:/app
    networks:
      - kipcalendar-network

networks:
  kipcalendar-network:
    driver: bridge

# ============================================================================
# Dockerfile
# ============================================================================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY *.csproj .
RUN dotnet restore

COPY . .
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/runtime:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "TeleKipish.dll"]

# ============================================================================
# SETUP_GUIDE.md - Подробное руководство по настройке
# ============================================================================
# TeleKipish Bot - Руководство по настройке

## Шаг 1: Создание Telegram бота

1. Откройте Telegram и найдите @BotFather
2. Отправьте команду `/newbot`
3. Введите имя бота (например: "KipCalendar Bot")
4. Введите username бота (например: "kipcalendar_bot")
5. Сохраните полученный **Bot Token**

## Шаг 2: Установка зависимостей

### Windows:
```powershell
# Установите .NET 8.0 SDK
# Скачайте с https://dotnet.microsoft.com/download

# Проверьте установку
dotnet --version
```

### Linux/Mac:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y dotnet-sdk-8.0

# macOS
brew install dotnet-sdk

# Проверьте установку
dotnet --version
```

## Шаг 3: Настройка проекта

1. Клонируйте или скопируйте файлы проекта
2. Перейдите в директорию TeleKipish:
```bash
cd kipcalendar_temple/backend/TeleKipish
```

3. Установите пакеты:
```bash
dotnet restore
```

## Шаг 4: Конфигурация

### Вариант 1: Переменные окружения (рекомендуется)

**Windows:**
```powershell
$env:TELEGRAM_BOT_TOKEN = "your_token_here"
```

**Linux/Mac:**
```bash
export TELEGRAM_BOT_TOKEN="your_token_here"
```

### Вариант 2: Изменение кода
Откройте `Bot/BotConfig.cs` и замените:
```csharp
public string BotToken { get; set; } = "YOUR_BOT_TOKEN_HERE";
```

## Шаг 5: Запуск API

Сначала запустите Python API:

```bash
cd kipcalendar_temple/backend
python app_test.py
```

API должен запуститься на `http://localhost:5000`

## Шаг 6: Запуск бота

### Вариант 1: Через Visual Studio
1. Откройте `TeleKipish.sln` в Visual Studio
2. Нажмите F5 или кнопку "Start"

### Вариант 2: Через командную строку
```bash
cd TeleKipish
dotnet run
```

### Вариант 3: Через скрипты
```bash
# Linux/Mac
chmod +x run.sh
./run.sh

# Windows
run.bat
```

## Шаг 7: Тестирование

1. Откройте Telegram
2. Найдите вашего бота по username
3. Отправьте `/start`
4. Следуйте инструкциям для связывания аккаунта

## Шаг 8: Связывание аккаунта

1. Откройте веб-интерфейс KipCalendar (http://localhost:3000)
2. Войдите в свой аккаунт
3. Перейдите в Настройки → Telegram
4. Нажмите "Связать Telegram"
5. Скопируйте 6-значный код
6. В Telegram отправьте боту: `/link XXXXXX`

## Проблемы и решения

### Бот не запускается

**Проблема:** "Bot Token is invalid"
**Решение:** Проверьте правильность токена, получите новый у @BotFather

**Проблема:** "API not responding"
**Решение:** Убедитесь, что Python API запущен на порту 5000

### Не работает связывание

**Проблема:** "Invalid code"
**Решение:** 
- Убедитесь, что код правильный
- Код действителен только 10 минут
- Используйте свежий код из веб-интерфейса

### Не приходят уведомления

**Проблема:** Уведомления не доходят
**Решение:**
1. Проверьте настройки бота: `/settings`
2. Убедитесь, что нужные типы уведомлений включены
3. Проверьте логи API

## Production Deployment

### Использование Docker

1. Создайте `.env` файл:
```env
TELEGRAM_BOT_TOKEN=your_token_here
```

2. Запустите через docker-compose:
```bash
docker-compose up -d
```

### Использование systemd (Linux)

Создайте файл `/etc/systemd/system/telekipish.service`:
```ini
[Unit]
Description=TeleKipish Telegram Bot
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/TeleKipish
Environment="TELEGRAM_BOT_TOKEN=your_token"
ExecStart=/usr/bin/dotnet TeleKipish.dll
Restart=always

[Install]
WantedBy=multi-user.target
```

Запустите:
```bash
sudo systemctl enable telekipish
sudo systemctl start telekipish
```

## Мониторинг

### Просмотр логов

```bash
# Консольные логи
dotnet run

# Через systemd
sudo journalctl -u telekipish -f

# Через Docker
docker logs -f telekipish-bot
```

### Метрики

Бот логирует:
- Все команды пользователей
- Отправленные уведомления
- Ошибки при обработке

## Обновление

1. Остановите бота
2. Обновите код
3. Соберите проект: `dotnet build`
4. Запустите снова

## Бэкап

Важные данные для бэкапа:
- `telekipish.db` - локальная БД (если используется)
- Конфигурация бота
- Логи

## Безопасность

⚠️ **Важно:**
- Никогда не коммитьте Bot Token в git
- Используйте переменные окружения
- Ограничьте доступ к серверу
- Регулярно обновляйте зависимости

## Поддержка

При возникновении проблем:
1. Проверьте логи бота и API
2. Убедитесь, что все зависимости установлены
3. Проверьте версии (.NET 8.0, Python 3.x)
4. Проверьте сетевое подключение

## Полезные команды

```bash
# Проверка версии .NET
dotnet --version

# Обновление пакетов
dotnet restore

# Очистка проекта
dotnet clean

# Сборка Release версии
dotnet build -c Release

# Публикация
dotnet publish -c Release -o ./publish

# Запуск в фоне (Linux)
nohup dotnet run &

# Остановка (Linux)
pkill -f "dotnet.*TeleKipish"
```

## Что дальше?

После успешной настройки вы можете:
1. Настроить уведомления (/settings)
2. Протестировать все команды
3. Настроить автозапуск
4. Настроить мониторинг
5. Развернуть в production

Удачи! 🚀

# ============================================================================
# TESTING.md - Руководство по тестированию
# ============================================================================
# Руководство по тестированию TeleKipish Bot

## Тестирование связывания аккаунта

### Тест 1: Успешное связывание
1. Пользователь: отправить `/start` боту
2. Ожидаемый результат: Инструкции по связыванию
3. Веб: Получить код связывания
4. Пользователь: `/link 123456`
5. Ожидаемый результат: ✅ Аккаунт успешно связан

### Тест 2: Неверный код
1. Пользователь: `/link 000000`
2. Ожидаемый результат: ❌ Ошибка - неверный код

### Тест 3: Истекший код
1. Веб: Получить код
2. Подождать 11 минут
3. Пользователь: `/link [код]`
4. Ожидаемый результат: ❌ Код истек

## Тестирование команд

### Расписание
```
/schedule         -> Расписание на сегодня
/schedule today   -> Расписание на сегодня
/schedule tomorrow -> Расписание на завтра
/schedule week    -> Расписание на неделю
```

### Домашние задания
```
/homework -> Список активных домашних заданий
```

### Оценки
```
/grades -> Последние 10 оценок
```

### Посещаемость
```
/attendance -> Статистика посещаемости
```

## Тестирование QR-кодов (преподаватель)

### Тест 1: Генерация QR
1. Преподаватель: `/qr_attendance`
2. Ожидаемый результат: QR-код и токен
3. Проверить: Токен действителен 15 минут

### Тест 2: Сканирование QR (студент)
1. Студент: `/scan [токен из QR]`
2. Ожидаемый результат: ✅ Посещаемость отмечена

### Тест 3: Повторное сканирование
1. Студент: `/scan [тот же токен]`
2. Ожидаемый результат: ❌ Уже использован

### Тест 4: Истекший токен
1. Подождать 16 минут
2. Студент: `/scan [токен]`
3. Ожидаемый результат: ❌ Токен истек

## Тестирование уведомлений

### Тест 1: Получение уведомления об оценке
1. Веб: Преподаватель выставляет оценку
2. Проверить: Студент получает уведомление в течение 30 секунд
3. Формат: "📊 Новая оценка - [предмет]: [оценка]"

### Тест 2: Уведомление о домашнем задании
1. Веб: Преподаватель добавляет ДЗ
2. Проверить: Студенты группы получают уведомление

### Тест 3: Настройки уведомлений
1. Пользователь: `/settings`
2. Отключить уведомления об оценках
3. Веб: Выставить оценку
4. Проверить: Уведомление НЕ пришло

## Чек-лист перед релизом

- [ ] Все команды работают корректно
- [ ] Связывание аккаунта работает
- [ ] QR-коды генерируются и проверяются
- [ ] Уведомления приходят вовремя
- [ ] Ошибки обрабатываются корректно
- [ ] Логирование работает
- [ ] Бот отвечает быстро (< 3 сек)
- [ ] Нет утечек памяти при долгой работе
- [ ] Документация актуальна
- [ ] Токен бота не в коде

## Нагрузочное тестирование

### Тест 1: Множество пользователей
1. Создать 100 связанных аккаунтов
2. Одновременно отправить `/schedule` от всех
3. Проверить: Все получили ответ

### Тест 2: Массовая рассылка
1. Отправить уведомление 1000 пользователям
2. Проверить: Все доставлены
3. Измерить: Время доставки

### Тест 3: Непрерывная работа
1. Запустить бота
2. Подождать 24 часа
3. Проверить: Нет ошибок памяти
4. Проверить: Все функции работают

## Отчет о тестировании

После тестирования заполните:

| Тест | Статус | Время | Заметки |
|------|--------|-------|---------|
| Связывание | ✅/❌ | Xms | - |
| Расписание | ✅/❌ | Xms | - |
| QR-коды | ✅/❌ | Xms | - |
| Уведомления | ✅/❌ | Xms | - |
| Нагрузка | ✅/❌ | Xms | - |