# CordLyx Backups

## Содержание

1. [Основные команды](#1-основные-команды)
2. [Автоматическое расписание](#2-автоматическое-расписание)
3. [Как это работает](#3-как-это-работает)
4. [Восстановление](#4-восстановление)
5. [Примеры](#5-примеры)
6. [Переменные окружения](#6-переменные-окружения)

---

## 1. Основные команды

```bash
./backup/backup.sh                # Полный бекап (БД + uploads + очистка)
./backup/backup.sh --db           # Только SQL dump базы
./backup/backup.sh --uploads      # Только файлы (uploads/)
./backup/backup.sh --cleanup      # Удалить бекапы старше 14 дней
./backup/backup.sh --help         # Все опции
```

Бекапы сохраняются в `backups/`:

```
backups/
├── dump_20260705_163633.sql    # SQL dump базы (56K)
├── uploads_20260705_163700/    # Папка с файлами (dev)
└── uploads_20260705_163700.tar.gz  # Архив uploads (Docker)
```

---

## 2. Автоматическое расписание

```bash
./backup/setup-cron.sh                # Авто: systemd → cron
./backup/setup-cron.sh --systemd      # Принудительно systemd timer
./backup/setup-cron.sh --cron         # Принудительно crontab
./backup/setup-cron.sh --uninstall    # Удалить расписание
```

### systemd (рекомендуется для ноутбука)

- Работает ежедневно
- Если компьютер был выключен в момент срабатывания, задача запустится при следующем включении (`Persistent=true`)
- Не требует дополнительных зависимостей

```bash
# Установить
./backup/setup-cron.sh

# Посмотреть статус
systemctl --user list-timers | grep cordlyx

# Запустить вручную (не ждать расписания)
systemctl --user start cordlyx-backup.service
```

### crontab (для сервера 24/7)

```bash
# Установить
./backup/setup-cron.sh --cron

# Посмотреть
crontab -l | grep cordlyx

# Логи
tail -f backups/cron.log
```

---

## 3. Как это работает

### Откуда запускается

Все бекапы запускаются **с хост-машины**, а не из Docker-контейнера. Скрипт использует `docker compose exec` и `docker exec` для взаимодействия с контейнерами.

### База данных

```
docker compose exec -T postgres pg_dump -U cordlyx --clean --if-exists cordlyx > backups/dump_TIMESTAMP.sql
```

- Используется нативный `pg_dump` без промежуточных слоёв
- `--clean` добавляет `DROP TABLE` перед `CREATE TABLE` — дамп можно применять напрямую к пустой БД
- `--if-exists` — чтобы не было ошибок если таблицы нет

### Uploads (файлы)

**Dev-режим** (файлы на хосте в `data/uploads/`):

```
cp -a data/uploads/ backups/uploads_TIMESTAMP/
```

**Docker-режим** (файлы в named volume внутри контейнера `api`):

```
docker compose exec -T api tar -czf - -C /app/data/uploads . > backups/uploads_TIMESTAMP.tar.gz
```

### Если контейнеры остановлены

Скрипт автоматически:

1. Запускает контейнер (`docker start`)
2. Ждёт готовности PostgreSQL (pg_isready, до 15 секунд)
3. Делает бекап
4. Останавливает контейнер обратно (`docker stop`)

Если контейнер не существует (никогда не создавался) — шаг пропускается с предупреждением.

### Хранение

По умолчанию бекапы хранятся **14 дней**. Старые автоматически удаляются при `--cleanup` (запускается после каждого полного бекапа и отдельно по расписанию в 4:00).

---

## 4. Восстановление

### База данных

Через `dev.sh`:

```bash
./dev.sh                    # → Option 9 (Database: restore)
```

Вручную:

```bash
# Сбросить схему
docker compose exec -T postgres psql -U cordlyx -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Применить дамп
docker compose exec -T postgres psql -U cordlyx < backups/dump_20260705_163633.sql
```

### Uploads

**Dev (папка):**

```bash
rm -rf data/uploads
cp -a backups/uploads_20260705_163700/ data/uploads
```

**Docker (архив):**

```bash
# Создать временный контейнер с volume, распаковать
docker run --rm -v cordlyx_uploads:/data -v $(pwd)/backups:/backups alpine \
    tar -xzf /backups/uploads_20260705_163700.tar.gz -C /data
# Или через запущенный api контейнер
docker exec -i cordlyx-api tar -xzf - -C /app/data/uploads < backups/uploads_20260705_163700.tar.gz
```

---

## 5. Примеры

```bash
# Поставить systemd timer на ноутбуке (с догоном после выключения)
./backup/setup-cron.sh

# Поставить crontab на сервере 24/7
./backup/setup-cron.sh --cron

# Сделать бекап перед обновлением/миграцией
./backup/backup.sh

# Посмотреть что есть
ls -lh backups/

# Отключить автоматические бекапы
./backup/setup-cron.sh --uninstall
```

---

## 6. Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `BACKUP_DIR` | `./backups` | Куда сохранять бекапы |
| `RETENTION_DAYS` | `14` | Хранить N дней |
| `POSTGRES_CONTAINER` | `cordlyx-postgres` | Имя PostgreSQL контейнера |
| `API_CONTAINER` | `cordlyx-api` | Имя API контейнера (для uploads) |

```bash
# Пример: хранить 30 дней, другой контейнер
RETENTION_DAYS=30 POSTGRES_CONTAINER=my-postgres ./backup/backup.sh
```
