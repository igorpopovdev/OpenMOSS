# grok-search — Тестирование и приёмка (RU)

## 1. Базовая работоспособность
```bash
/usr/bin/python3 ~/.openclaw/workspace/projects/grok-search/scripts/grok_search.py \
  --query "Что последнее опубликовал Sam Altman в X? Дайте оригинал и ссылку." \
  --mode stateless
```
**Приёмка**: вывод — разбираемый JSON, `sources` >= 2, каждая с `url/published_at/quote`.

## 2. Триггер фолбэка (симуляция)
- Временно измените `--api-key` на невалидное значение, убедитесь что primary неуспешен и происходит фолбэк.
- Смотрите поле `error` или `fallback_reason` (с флагом `--with-meta`).

```bash
/usr/bin/python3 ~/.openclaw/workspace/projects/grok-search/scripts/grok_search.py \
  --query "Тест фолбэка" \
  --api-key "bad-key" \
  --with-meta
```

## 3. Регрессия контекста
```bash
/usr/bin/python3 ~/.openclaw/workspace/projects/grok-search/scripts/grok_search.py \
  --thread-id "user:123" \
  --query "Что недавно публиковал CEO OpenAI в X?" \
  --mode auto

/usr/bin/python3 ~/.openclaw/workspace/projects/grok-search/scripts/grok_search.py \
  --thread-id "user:123" \
  --query "Продолжить и дополнить оригинал последнего сообщения" \
  --mode auto
```
**Приёмка**: второй вызов подхватывает контекст (см. `meta.context.include_context`).
