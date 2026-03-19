# Context Router Tool & Model Call Flow (LEGACY) — RU

> Интегрировано в grok-search; данный файл — историческая справка.

## 1. Структура директорий

```
projects/context-router-skill/
  ├─ DESIGN.md
  └─ USAGE.md

tools/context_router/
  ├─ context_router.py
  └─ README.md

skills/context-router/
  ├─ SKILL.md
  ├─ scripts/context_router_cli.py
  └─ examples/minimal_cli_flow.py
```

---

## 2. Переменные окружения (не пишите Keys в документации)

Рекомендуется задать в `.env`:

```
GAPI_CUSTOM_BASE_URL=https://api.example.com/
GAPI_CUSTOM_API_KEY=***
CONTEXT_DB_PATH=./data/context.db
```

> Внимание: дочерние процессы не наследуют `.env` автоматически — загружайте явно.

---

## 3. Skill/CLI использование (рекомендуется)

**CLI выводит JSON, удобный для инструментов.**

**Маршрутизация:**

```bash
/usr/bin/python3 ~/.openclaw/workspace/skills/context-router/scripts/context_router_cli.py route \
  --thread-id "user:123" \
  --user-text "Продолжить этот вопрос" \
  --mode auto
```

**Сборка контекста:**

```bash
/usr/bin/python3 ~/.openclaw/workspace/skills/context-router/scripts/context_router_cli.py build \
  --thread-id "user:123" \
  --task-id "<task_id_from_route>"
```

**Запись раунда:**

```bash
/usr/bin/python3 ~/.openclaw/workspace/skills/context-router/scripts/context_router_cli.py record \
  --thread-id "user:123" \
  --task-id "<task_id>" \
  --user-text "Продолжить этот вопрос" \
  --assistant-text "...ответ модели..."
```

**Очистка устаревших:**

```bash
/usr/bin/python3 ~/.openclaw/workspace/skills/context-router/scripts/context_router_cli.py prune --ttl-seconds 86400
```

### 3.1 Минимальный рабочий пример (полный CLI flow)

```bash
/usr/bin/python3 ~/.openclaw/workspace/skills/context-router/examples/minimal_cli_flow.py
```

> Скрипт использует временный путь к БД, последовательно выполняет route → build → record → get → prune и печатает JSON на каждом шаге.

### 3.2 Тестирование и приёмка

См. `projects/context-router-skill/TESTING.md` (минимальный CLI flow + TTL regression).

---

## 4. Базовое использование (Python)

```python
from tools.context_router.context_router import ContextStore, ContextRouter, ContextConfig

store = ContextStore("./data/context.db")
router = ContextRouter(store, ContextConfig(max_messages=8, max_context_tokens=4000))

# 1) Маршрутизация
decision = router.route(
    thread_id="user:123",
    user_text="Продолжить этот вопрос",
    mode="auto",  # stateless / auto / always
)

# 2) Сборка контекста
messages = [
    {"role": "system", "content": "Вы должны искать в сети и возвращать источники…"},
    *router.build_context_messages(decision.snapshot),
    {"role": "user", "content": "Продолжить этот вопрос"},
]

# 3) Вызов модели (псевдокод)
resp = call_model("grok-4.20-beta", messages)
if is_failed(resp):
    resp = call_model("grok-4.1-thinking", messages)

# 4) Запись
router.record_turn(
    thread_id="user:123",
    task_id=decision.task_id,
    user_text="Продолжить этот вопрос",
    assistant_text=resp.text,
    meta={"model": resp.model},
)
```

---

## 5. Стратегии контекста

- `stateless`: без контекста (для поисковых инструментов)
- `auto`: подмешивает контекст только при совпадении ключевых слов (рекомендуемое значение по умолчанию)
- `always`: всегда с контекстом

Рекомендация: по умолчанию `auto`, модель предлагает, **но решение принимает код**.

---

## 6. Фолбэк при сбоях (4.2 → 4.1)

**Рекомендуемые триггеры:**

- HTTP не 200 / таймаут / 429
- sources пуст
- Любой source без url/времени/quote

---

## 7. Рекомендуемый шаблон системного промпта (требует "поиск + источники")

```
Вы должны активно искать в сети и возвращать доказательства.
Требования:
1) Минимум 2 источника (URL, время публикации, цитата)
2) Не придумывайте источники; если не нашли — напишите "Не найдено"
3) Сначала доказательства, потом вывод
Вывод JSON:
{
  "sources":[{"title":"","url":"","published_at":"","quote":""}],
  "claims":[{"statement":"","source_index":[0]}],
  "answer":"…",
  "unknowns":["…"],
  "confidence":0-1
}
```

---

## 8. Обрезка и суммаризация контекста

- При превышении порога автоматически удаляются самые старые сообщения
- Можно подключить суммаризатор (рекомендуется grok-4.1-thinking)

```python
def summarizer(removed_messages, existing_summary):
    return "...сжатая сводка..."

router = ContextRouter(store, summarizer=summarizer)
```

---

## 9. Параллельные задачи (task_id)

```python
# Новостная задача
router.route(thread_id, user_text, task_id="news:20260302", mode="always")
# Финансовая задача
router.route(thread_id, user_text, task_id="finance:tsla", mode="always")
```

---

## 10. Очистка устаревших контекстов

```python
store.prune_expired(ttl_seconds=24*3600)
```

---

## 11. Важные замечания

- API не возвращает session handle; контекст должен быть инъецирован сервером
- Не сохраняйте длинные страницы/логи — только "вывод + доказательства"
- Для сохранения между перезапусками используйте персистентное хранилище (SQLite/Redis/Postgres)
