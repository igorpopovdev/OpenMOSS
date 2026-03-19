# Тестирование и приёмка (LEGACY) — RU

> Интегрировано в grok-search; данный файл — историческая справка.
> Цель: проверить базовую работоспособность CLI flow и поведение prune TTL (ttl=0 / ttl=1).
> Внимание: используется временный путь к БД во избежание влияния на стандартный `data/context.db`.

## 0. Предварительные требования
- Выполнять из корня OpenClaw workspace.
- Python 3 доступен (примеры используют `/usr/bin/python3`).
- Путь к CLI: `skills/context-router/scripts/context_router_cli.py`

Рекомендуется явно передавать `--db <временный путь>` вместо зависимости от `CONTEXT_DB_PATH`.

---

## 1. Минимальный тест (CLI flow, включая ttl=0)
Запустите встроенный пример (с временной БД):

```bash
/usr/bin/python3 skills/context-router/examples/minimal_cli_flow.py
```

**Ожидаемые результаты:**
- Вывод содержит пять блоков JSON: `route → build → record → get → prune`.
- `route` возвращает поля `task_id`, `include_context`, `reason` и др.
- `record` возвращает `{"ok": true}`.
- `get` возвращает `snapshot.messages` минимум с двумя сообщениями (user/assistant).
- `prune` с `ttl=0`; скрипт уже делает `sleep(1)`, так что `deleted` должен быть ≥ 1.

---

## 2. Минимальный тест: prune ttl=1
> Проверка: **меньше 1 секунды — не удаляет**, **больше 1 секунды — удаляет**.

Пример (ручной процесс, просто скопируйте `task_id`):

```bash
TMPDIR=$(mktemp -d)
DB="$TMPDIR/context.db"
CLI="/usr/bin/python3 skills/context-router/scripts/context_router_cli.py"
THREAD="test:user:ttl1"
TEXT="Продолжить этот вопрос"

# 1) route
$CLI route --thread-id "$THREAD" --user-text "$TEXT" --mode auto --db "$DB"
# запишите task_id из вывода

# 2) record
$CLI record --thread-id "$THREAD" --task-id "<task_id>" \
  --user-text "$TEXT" --assistant-text "ok" --db "$DB"

# 3) prune ttl=1 сразу (обычно должно быть 0 удалений)
$CLI prune --ttl-seconds 1 --db "$DB"

# 4) подождать 2 сек., затем prune снова (должно быть ≥ 1)
sleep 2
$CLI prune --ttl-seconds 1 --db "$DB"
```

**Ожидаемые результаты:**
- Первый `prune`: `deleted` обычно `0` (запись ещё в пределах TTL).
- После сна второй `prune`: `deleted` должен быть ≥ 1.

---

## 3. Чеклист регресса (функциональность)
- **CLI работает**: `context_router_cli.py` запускается и выводит JSON.
- **route**:
  - Новый поток по умолчанию `reason=new_task`; при явном `--task-id` — `explicit_task_id`.
  - `include_context` при отсутствии ключевых слов + режим auto обычно `false`.
- **build**: при отсутствии snapshot `messages` должен быть пустым массивом `[]`.
- **record/get**: после `record`, `get` возвращает snapshot с сообщениями user/assistant.
- **prune**: `ttl=0` + ожидание 1 сек. удаляет; `ttl=1` сразу не удаляет, после ожидания — удаляет.

---

## 4. (Опционально) Простой Smoke-скрипт
Для быстрой проверки сохраните как `smoke_context_router.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
CLI="/usr/bin/python3 skills/context-router/scripts/context_router_cli.py"
TMPDIR=$(mktemp -d)
DB="$TMPDIR/context.db"
THREAD="smoke:user:1"
TEXT="Продолжить этот вопрос"

route_json=$($CLI route --thread-id "$THREAD" --user-text "$TEXT" --mode auto --db "$DB")
TASK_ID=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["task_id"])' "$route_json")

$CLI build --thread-id "$THREAD" --task-id "$TASK_ID" --db "$DB" >/dev/null
$CLI record --thread-id "$THREAD" --task-id "$TASK_ID" --user-text "$TEXT" --assistant-text "ok" --db "$DB" >/dev/null
$CLI get --thread-id "$THREAD" --task-id "$TASK_ID" --db "$DB" >/dev/null

sleep 1
$CLI prune --ttl-seconds 0 --db "$DB"
$CLI prune --ttl-seconds 1 --db "$DB"
```

> Скрипт выполняет только базовую проверку связности и TTL-поведения, без зависимости от тестовых фреймворков.
