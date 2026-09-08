# CordLyx Runbook — «упало, что делать»

Одна страница для человека, которого разбудили ночью. Все команды копипастой,
порядок важен. Проект: `/home/shardanov/projects/CordLyx` (на сервере — `$HOME/cordlyx`).

> Контакты и алерты: _TODO — вписать, кому звонить/писать_.

---

## 0. Быстрая диагностика (1 минута)

```bash
./dev.sh doctor          # локально: toolchain, контейнеры, схема, сервисы
curl -sf http://localhost:4000/health | python3 -m json.tool
# На проде (порт API может отличаться, см. docker-compose.prod.yml):
curl -sf http://localhost:3005/health | python3 -m json.tool
```

| Симптом | Куда смотреть |
|---|---|
| `status: degraded`, `postgres: down` | §1 База данных |
| `redis: down` | §2 Redis / очереди |
| `queue.failedAboveThreshold: true` или растёт `waiting` | §2, воркер |
| API отвечает, фронт 500 | §3 Фронтенд (обычно побитый `.next`) |
| Всё лежит после деплоя | §4 Откат деплоя |
| Нужны данные назад | §5 Восстановление из бэкапа |

Логи: `docker compose logs --tail 50 api worker postgres` (прод: `docker compose -f docker-compose.prod.yml logs ...`).

---

## 1. База данных

```bash
# Жива ли?
docker compose exec -T postgres pg_isready -U cordlyx
# Перезапуск (данные во volume pgdata, не теряются):
docker compose restart postgres
# Проверка схемы после любых работ:
./scripts/migrate.sh --list          # PENDING быть не должно
./scripts/migrate.sh                 # применить зависшие (идемпотентно)
```

## 2. Redis / очереди / воркер

```bash
docker compose exec -T redis redis-cli ping        # ждём PONG
docker compose restart redis worker                # рестарт очереди и воркера
# Что в очереди прямо сейчас:
curl -s http://localhost:4000/health | python3 -c "import sys,json; print(json.load(sys.stdin)['checks']['queue'])"
```

Зависший воркер виден как растущий `waiting` при живых `failed: 0`.
Логи воркера: `docker compose logs --tail 50 worker` — строки `[ActivityWorker] Failed:` с причиной.

## 3. Фронтенд 500 (`Cannot find module './vendor-chunks/...'`)

Классика: прод-билд затёр `.next` живому dev-серверу. Лечится только так, в этом порядке:

```bash
# 1. Найти и убить dev-процессы ТОЧНО по PID (не pkill -f — убьёте свою же shell-команду):
pgrep -af "bin/next|next-server" | grep -v pgrep
kill <PID> <PID> ...
# 2. Снести кэш и поднять заново:
rm -rf frontend/.next
(nohup npm run dev -w frontend > /tmp/cordlyx-frontend.log 2>&1 &)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # ждём 200
```

Правило: `next build` — только при остановленном dev-сервере.

## 4. Откат деплоя

```bash
# Вариант А — код (GitHub → Deploy → Run workflow → ref = предыдущий SHA)
# Вариант Б — руками на сервере:
cd ~/cordlyx
git fetch origin && git checkout --detach <предыдущий-SHA>
docker compose -f docker-compose.prod.yml up -d --build
curl --fail --max-time 5 http://localhost:3005/health
```

**Если откатываемая версия меняла схему деструктивно** (колонки/таблицы удалены миграцией) — сначала §5 (восстановить БД из дампа, снятого деплоем автоматически), потом код. Миграции `scripts/migrate.sh` — только вперёд, отката схемы вниз нет by design.

## 5. Восстановление из бэкапа

Бэкапы: `backups/dump_YYYYMMDD_HHMMSS.sql` (автоматом каждые 12 ч, systemd timer; хранение 14 дней). Последний проверенный restore-способом: см. дату ниже.

```bash
ls -lh backups/                          # выбрать дамп
# --- БД (данные текущей БД будут ЗАМЕНЕНЫ) ---
docker compose exec -T postgres psql -U cordlyx -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"  # (прод: добавить -f docker-compose.prod.yml)
docker compose exec -T postgres psql -U cordlyx -v ON_ERROR_STOP=1 -q -f - < backups/<dump>.sql
./scripts/migrate.sh                     # доставить версии, если дамп старше кода
./dev.sh doctor                          # users/projects/items на месте?
```

Проверка после восстановления (то, что гоняет `backup/verify-restore.sh`):

```bash
DATABASE_URL=postgres://cordlyx:cordlyx@localhost:5432/cordlyx \
  ./backup/verify-restore.sh backups/<dump>.sql
```

Uploads (если есть): `backups/uploads_*` — см. `backup/README.md` §4 (папка vs tar.gz).

> Последний ручной restore-дрill: 2026-09-08, дамп `dump_20260908_102632.sql` → scratch-БД: 27 таблиц, search_vector, 40 users / 59 projects / 6107 items — OK.

## 6. Миграции застряли

```bash
./scripts/migrate.sh --list              # что висит в PENDING
./scripts/migrate.sh                     # применить (по одной транзакции на файл)
```

- `empty database` — сначала `psql < backend/schema.sql`, потом migrate.
- Файл упал посередине — БД не тронута для этого файла (транзакция), чинить SQL и повторять.
- Никогда не править применённые файлы задним числом — только новым номером (`0011_...`).

## 7. Полный рестарт стека (dev-машина)

```bash
docker compose up -d postgres redis
nohup node backend/dist/src/main > /tmp/cordlyx-backend.log 2>&1 &
nohup node backend/dist/src/worker > /tmp/cordlyx-worker.log 2>&1 &
nohup npm run dev -w frontend > /tmp/cordlyx-frontend.log 2>&1 &
curl -s http://localhost:4000/health && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
```

---

*Обновлять этот файл при каждом изменении деплоя/бэкапов/схемы алертов.*
