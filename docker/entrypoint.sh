#!/bin/sh
set -e

log() { echo "[entrypoint] $*"; }

# ---------- 1) รอ PostgreSQL พร้อม ----------
# บน Railway ฐานข้อมูลเป็น service แยก และอาจยังไม่พร้อมตอน container เริ่ม
# จึงยังต้องรอ แต่ต้องไม่ค้างตลอดกาลถ้า pg_isready ใช้ไม่ได้ (เช่น ไม่มี client)
if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(printf '%s' "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
  DB_PORT=$(printf '%s' "$DATABASE_URL" | sed -n 's|.*@[^:/]*:\([0-9]*\)/.*|\1|p')
  DB_USER=$(printf '%s' "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
  DB_NAME=$(printf '%s' "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
  DB_HOST=${DB_HOST:-db}
  DB_PORT=${DB_PORT:-5432}
  DB_NAME=${DB_NAME:-postgres}

  if command -v pg_isready >/dev/null 2>&1; then
    log "รอ PostgreSQL ที่ ${DB_HOST}:${DB_PORT} ..."
    tries=0
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "${DB_USER:-postgres}" -d "$DB_NAME" >/dev/null 2>&1; do
      tries=$((tries + 1))
      if [ "$tries" -ge 60 ]; then
        log "รอ PostgreSQL ครบ 60 ครั้งแล้ว ยังไม่พร้อม — ยกเลิกการเริ่มระบบ"
        exit 1
      fi
      sleep 2
    done
    log "PostgreSQL พร้อมใช้งาน"
  else
    log "ไม่พบ pg_isready — ให้ prisma migrate deploy จัดการ retry เอง"
  fi

  # ---------- 2) รัน migration ของ production ----------
  log "รัน prisma migrate deploy"
  npx prisma migrate deploy

  # ---------- 3) seed ข้อมูลสาธิต (เฉพาะเมื่อสั่ง; create-only โดยค่าเริ่มต้น) ----------
  if [ "$RUN_SEED" = "true" ]; then
    log "รัน prisma db seed (RUN_SEED=true)"
    npx prisma db seed
  fi
else
  log "ไม่พบ DATABASE_URL — ข้ามการรอ DB และ migration"
fi

# ---------- 4) เริ่ม Next.js standalone server ----------
log "เริ่ม Next.js server ที่พอร์ต ${PORT:-3000}"
exec node server.js
