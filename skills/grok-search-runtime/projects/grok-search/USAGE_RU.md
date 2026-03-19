# grok-search — Инструкция по использованию

## 1. Структура директорий

```
projects/grok-search/
  ├─ DESIGN.md
  ├─ USAGE.md
  ├─ TESTING.md
  ├─ internal/ (shim)
  │   └─ context.py
  └─ scripts/grok_search.py

skills/grok-search/
  ├─ SKILL.md
  └─ scripts/grok_search_cli.py  # точка входа skill (делегирует в скрипт проекта)

tools/
  tools/grok_search/
  ├─ __init__.py
  └─ context.py # модуль контекстного поиска (internal)
```

## 2. Переменные окружения (рекомендуется)

```
GROK_BASE_URL=https://api.example.com
GROK_API_KEY=***
GROK_MODEL=grok-4.20-beta
GROK_FALLBACK_MODEL=grok-4.1-thinking
GROK_TIMEOUT=1200
```

> Текущая среда **GAPI — это Grok**: `GAPI_CUSTOM_BASE_URL / GAPI_CUSTOM_API_KEY` в `.env` используются как base/key Grok (эквивалент `GROK_*`).

## 3. Keychain (macOS, опционально)

```
security add-generic-password -U -s openclaw-grok -a base-url -w
security add-generic-password -U -s openclaw-grok -a api-key -w
security add-generic-password -U -s openclaw-grok -a model -w
```

## 4. Точка входа Skill (рекомендуется)

```bash
/usr/bin/python3 ~/.openclaw/workspace/skills/grok-search/scripts/grok_search_cli.py \
  --query "Что последнее опубликовал Sam Altman в X? Дайте оригинал и ссылку." \
  --mode stateless
```

> Это лёгкая обёртка; параметры идентичны скрипту проекта.

## 5. Базовое использование (без контекста)

```bash
/usr/bin/python3 ~/.openclaw/workspace/projects/grok-search/scripts/grok_search.py \
  --query "Что последнее опубликовал Sam Altman в X? Дайте оригинал и ссылку." \
  --mode stateless
```

## 6. С контекстом (можно продолжать)

```bash
/usr/bin/python3 ~/.openclaw/workspace/projects/grok-search/scripts/grok_search.py \
  --thread-id "user:123" \
  --query "Что недавно публиковал CEO OpenAI в X?" \
  --mode auto
```

## 7. Пользовательский системный промпт

```bash
/usr/bin/python3 ~/.openclaw/workspace/projects/grok-search/scripts/grok_search.py \
  --query "..." \
  --system-prompt "<ваш системный промпт>"
```

## 8. Формат вывода

По умолчанию выводится **JSON с результатами модели**; добавьте `--with-meta` для обёртки с `meta`.

```
{
  "sources": [...],
  "claims": [...],
  "answer": "...",
  "unknowns": [...],
  "confidence": 0.0
}
```
