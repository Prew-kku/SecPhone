# Integration Tests

Integration tests รันกับ **PostgreSQL จริง** (ไม่ mock Prisma) ตาม PLAN §12.2

## กฎความปลอดภัยที่ต้องปฏิบัติ

> ⚠️ **ห้ามชี้ `DATABASE_URL` ไปที่ฐานข้อมูล production ของ Railway เด็ดขาด**
> Test เหล่านี้ลบข้อมูล (`deleteMany`) เพื่อเตรียมสถานะก่อนทดสอบ

ใช้ฐานข้อมูลแยกชื่อ `secondphone_test` เท่านั้น

## วิธีรัน

```bash
# 1) สตาร์ท PostgreSQL ทิ้งได้ (ตัวอย่างด้วย Docker)
docker run -d --name sp-test-db \
  -e POSTGRES_USER=sp -e POSTGRES_PASSWORD=sp_pass_change_me \
  -e POSTGRES_DB=secondphone_test -p 55432:5432 \
  postgres:17.11-alpine

# 2) ชี้ DATABASE_URL ไปที่ฐานข้อมูลทดสอบ แล้ว apply migration
export DATABASE_URL="postgresql://sp:sp_pass_change_me@localhost:55432/secondphone_test?schema=public"
npx prisma migrate deploy

# 3) รัน integration tests
npm run test:integration
```

ถ้าไม่ได้ตั้ง `DATABASE_URL` หรือเชื่อมต่อไม่ได้ suite จะ **skip** ตัวเอง
(ไม่ทำให้ `npm run test` ล้มเหลว) และรายงานชัดว่าไม่ได้ทดสอบ

## ไฟล์

- `auth.test.ts` — login สำเร็จ/ล้มเหลว, บัญชีปิดใช้งาน, rate limit
- `devices-mutation.test.ts` — create/update/status/soft-delete + unique slug/sku
- `images.test.ts` — ประมวลผลรูปจริง (magic bytes/oversize), path traversal, persistence
- `public-visibility.test.ts` — สถานะมีผลกับ query ของหน้า public
