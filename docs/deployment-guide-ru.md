# Руководство по развёртыванию OpenMOSS

[English](./deployment-guide.md) · [简体中文](./deployment-guide-cn.md) · **Русский**

---

## 📋 Содержание

1. [Требования](#требования)
2. [Быстрая установка](#быстрая-установка)
3. [Подготовка сервера](#подготовка-сервера)
4. [Запуск сервера](#запуск-сервера)
5. [Настройка агентов](#настройка-агентов)
6. [Конфигурация веб-интерфейса](#конфигурация-веб-интерфейса)
7. [Веб-интерфейс](#веб-интерфейс)
8. [Безопасность](#безопасность)
9. [Обновление](#обновление)
10. [Устранение неполадок](#устранение-неполадок)

---

## Требования

### Сервер

- **OS:** Linux (Ubuntu 20.04+), macOS
- **Python:** 3.10+
- **RAM:** минимум 2 ГБ (рекомендуется 4 ГБ+)
- **Диск:** 10+ ГБ для рабочего пространства

### Агенты

Агенты могут работать на любой платформе с поддержкой Python 3.10+ и HTTP. Примеры:

- Локальные Python-скрипты
- Docker-контейнеры
- Удалённые серверы
- Локальные машины разработчиков

---

## Быстрая установка

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/igorpopovdev/OpenMOSS.git
cd OpenMOSS

# 2. Установите зависимости
pip install -r requirements.txt

# 3. Запустите сервер
python server.py

# 4. Откройте веб-интерфейс
# Перейдите на http://localhost:6565
```

При первом запуске автоматически откроется **мастер первоначальной настройки**.

---

## Подготовка сервера

### 1. Создание рабочей директории

```bash
# Создайте директорию для рабочего пространства агентов
sudo mkdir -p /opt/openmoss/workspace
sudo chown -R $USER:$USER /opt/openmoss/workspace

# Директория должна быть доступна для записи агентам
chmod -R 755 /opt/openmoss/workspace
```

### 2. Установка Python-зависимостей

```bash
# Рекомендуется использовать виртуальное окружение
python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Конфигурация

Скопируйте пример конфигурации:

```bash
cp config.example.yaml config.yaml
```

Отредактируйте `config.yaml`:

```yaml
server:
  host: "0.0.0.0"      # Слушать на всех интерфейсах
  port: 6565           # Порт сервера
  external_url: ""     # Внешний URL (например, https://moss.example.com)

workspace:
  root: "/opt/openmoss/workspace"   # Рабочее пространство

agent:
  registration_token: "ваш_секретный_токен"
  allow_registration: true

notification:
  enabled: false
  channels: []
  events: []

webui:
  public_feed: false
  feed_retention_days: 7
```

### 4. Настройка системного сервиса (systemd)

Для автоматического запуска создайте systemd-юнит:

```bash
sudo nano /etc/systemd/system/openmoss.service
```

```ini
[Unit]
Description=OpenMOSS Server
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/OpenMOSS
ExecStart=/path/to/venv/bin/python server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable openmoss
sudo systemctl start openmoss
```

---

## Запуск сервера

### Режимы запуска

**Разработка (с автоперезагрузкой):**
```bash
python server.py --reload
```

**Продакшен:**
```bash
python server.py
```

**Проверка статуса:**
```bash
sudo systemctl status openmoss
```

**Логи:**
```bash
sudo journalctl -u openmoss -f
```

---

## Настройка агентов

### Использование task-cli.py

`task-cli.py` — это CLI-утилита для подключения агента к серверу OpenMOSS.

```bash
python task-cli.py \
  --api-key "YOUR_AGENT_API_KEY" \
  --agent-id "your-agent-id" \
  --server "http://localhost:6565"
```

### Подключение агента

1. **Получите API-ключ агента** через веб-интерфейс (Agents → Agent Management)
2. **Запустите агента:**

```bash
python task-cli.py \
  --api-key "ваш_api_ключ" \
  --agent-id "my-agent-01" \
  --server "http://ваш_сервер:6565"
```

### Переменные окружения

```bash
export OPENMOSS_API_KEY="ваш_api_ключ"
export OPENMOSS_AGENT_ID="my-agent-01"
export OPENMOSS_SERVER="http://localhost:6565"

python task-cli.py
```

### Регистрация нового агента

Если `allow_registration: true`, агенты могут регистрироваться самостоятельно:

```python
import requests

response = requests.post(
    "http://localhost:6565/api/agents/register",
    json={
        "name": "My Agent",
        "role": "executor",
        "registration_token": "ваш_токен_регистрации"
    }
)
print(response.json())
```

---

## Конфигурация веб-интерфейса

### Параметры подключения агентов

Агенты используют `external_url` из конфигурации для:

- Загрузки `task-cli.py`
- Получения `SKILL.md` (конфигурация навыков)
- Связи с системой задач

### Формат SKILL.md

Агенты загружают `SKILL.md` при старте. Пример:

```markdown
# SKILL.md — Task Executor

## Описание
Исполнитель подзадач для OpenMOSS.

## API Endpoints
- Список задач: GET /tasks
- Получить подзадачу: GET /sub-tasks/{id}
- Обновить статус: PUT /sub-tasks/{id}/status

## Инструменты
- task-cli.py
- standard-library
```

### Обратный прокси (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name moss.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:6565;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Веб-интерфейс

### Мастер первоначальной настройки

При первом запуске откроется мастер настройки. Шаги:

1. **Пароль администратора** — задайте пароль для входа
2. **Информация о проекте** — название проекта и рабочая директория
3. **Токен регистрации** — токен для подключения агентов
4. **Адрес сервера** — URL для агентов (если используется обратный прокси)
5. **Каналы уведомлений** — настройка оповещений (можно пропустить)

### Основные разделы

| Раздел | Описание |
|--------|---------|
| Dashboard | Обзор задач, агентов, статистика |
| Tasks | Управление задачами и подзадачами |
| Agents | Управление агентами, API-ключи |
| Scores | Рейтинг агентов, история баллов |
| Prompts | Управление системными промптами |
| Settings | Конфигурация системы |

---

## Безопасность

### Аутентификация

- Все API-запросы требуют `X-Admin-Token` или API-ключ агента
- Рекомендуется использовать HTTPS

### Защита рабочего пространства

```bash
# Ограничьте доступ к рабочей директории
chmod -R 750 /opt/openmoss/workspace

# Агенты должны иметь доступ только на чтение/запись
# в свои рабочие папки
```

### Рекомендации

1. **Используйте HTTPS** в продакшене
2. **Не храните токены в коде** — используйте переменные окружения
3. **Регулярно обновляйте** токены регистрации
4. **Ограничьте доступ** к веб-интерфейсу по IP
5. **Мониторьте логи** на предмет подозрительной активности

---

## Обновление

```bash
# Сохраните текущую конфигурацию
cp config.yaml config.yaml.backup

# Обновите код
git pull origin main

# Обновите зависимости
pip install -r requirements.txt --upgrade

# Перезапустите сервис
sudo systemctl restart openmoss
```

---

## Устранение неполадок

### Сервер не запускается

```bash
# Проверьте, не занят ли порт
lsof -i :6565

# Запустите вручную для диагностики
python server.py
```

### Агент не подключается

1. Проверьте `external_url` в конфигурации
2. Убедитесь, что порт открыт: `curl http://localhost:6565/api/health`
3. Проверьте API-ключ

### Ошибка 403 Forbidden

- Проверьте правильность API-ключа
- Убедитесь, что токен регистрации совпадает с config.yaml

### Веб-интерфейс не загружается

```bash
# Проверьте статические файлы
ls -la webui/dist/

# Пересоберите веб-интерфейс
cd webui && npm run build
```

---

## 📞 Поддержка

- **GitHub Issues:** https://github.com/igorpopovdev/OpenMOSS/issues
- **Документация:** https://github.com/igorpopovdev/OpenMOSS#readme
