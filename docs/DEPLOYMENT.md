# คู่มือ Deploy — SecondPhone Store

คู่มือนี้ครอบคลุมการ deploy 2 แบบ

1. **Docker Compose** — รันบนเครื่องตัวเองหรือ VPS (ตรวจสอบแล้วในเซสชันนี้)
2. **Railway** — staging/production บนคลาวด์ (เตรียม config ให้แล้ว ยังไม่ได้ deploy จริง)

และปิดท้ายด้วย **วิธีตรวจสอบ** สำหรับ environment ที่รัน Docker ไม่ได้

---

## 1. Docker Compose

### สิ่งที่ต้องมี

- Docker Engine + Docker Compose v2
- พอร์ต 3000 ว่าง

### ขั้นตอน

```bash
cp .env.example .env
```

แก้ `.env` ค่าที่จำเป็นสำหรับ production

```dotenv
POSTGRES_PASSWORD=<รหัสผ่านที่แข็งแรง>
JWT_SECRET=<openssl rand -base64 48>
SITE_URL=https://your-domain.example
COOKIE_SECURE=true
DEMO_MODE=true           # ตั้ง false เมื่อใช้ข้อมูลจริง
RUN_SEED=true            # ครั้งแรกเท่านั้น แล้วตั้งกลับ false
SEED_DEMO_ADMIN=true     # ครั้งแรกเท่านั้น (ถ้าต้องการบัญชีผู้ดูแล)
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<รหัสผ่านผู้ดูแล>
```

```bash
docker compose up -d --build
```

### สถาปัตยกรรมที่ compose สร้าง

| Service | รายละเอียด |
| --- | --- |
| `web` | Next.js standalone + Prisma CLI รันด้วย user `nextjs` (uid 1001, non-root) |
| `db` | PostgreSQL 17 พร้อม healthcheck — **ไม่** publish port ออกนอก |
| volume `db-data` | ข้อมูลฐานข้อมูล (ถาวร) |
| volume `uploads-data` | รูปสินค้าที่อัปโหลด (ถาวร) |

ลำดับการเริ่มของ `web` (ใน `docker/entrypoint.sh`)

1. รอ PostgreSQL พร้อม (`pg_isready` สูงสุด 60 ครั้ง × 2 วินาที)
2. `prisma migrate deploy` — ใช้ migration ของ production
3. `prisma db seed` — เฉพาะเมื่อ `RUN_SEED=true`
4. `exec node server.js`

### ตรวจสอบ

```bash
docker compose ps                          # ทั้งสองต้อง healthy
docker compose logs web | tail -20
curl -s http://localhost:3000/api/health   # {"status":"ok","database":"up",...}
docker compose exec web id                 # uid=1001 (non-root)
```

### ข้อมูลถาวร (สำคัญ)

- **ข้อมูล DB** อยู่ใน volume `db-data` — `docker compose down` ไม่ลบ, `down -v` ลบ
- **รูปสินค้า** อยู่ใน volume `uploads-data` mount ที่ `/app/uploads` — รูปยังอยู่หลัง rebuild/restart
  (พิสูจน์แล้วในเซสชันนี้: เขียนไฟล์ → restart → ไฟล์ยังอยู่และ `/api/images/...` ตอบ 200)
- ⚠️ อย่าให้ path ของรูปอยู่ใน layer ของ image เพราะจะหายเมื่อ rebuild

### การตั้งค่า seed ที่ปลอดภัย

seed เป็น **create-only โดยค่าเริ่มต้น** — รันซ้ำจะไม่แตะข้อมูลที่มีอยู่
(พิสูจน์แล้ว: แก้ราคาใน DB → reseed → ราคาไม่เปลี่ยน; ตั้ง `SEED_OVERWRITE=true` → ราคากลับเป็นค่า seed)

แนวปฏิบัติ

1. deploy ครั้งแรก: `RUN_SEED=true`
2. ตรวจว่าได้ข้อมูลแล้ว: `RUN_SEED=false`
3. อย่าตั้ง `SEED_OVERWRITE=true` บน production ที่มีข้อมูลจริงอยู่แล้ว

---

## 2. Railway

### ภาพรวม

`railway.json` ที่ root ตั้งค่าไว้แล้ว

```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 120,
    "startupTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Railway จะใช้ `Dockerfile` ของโปรเจกต์และตรวจสุขภาพที่ `/api/health`

### ขั้นตอน

1. **สร้าง project** — New Project
2. **เพิ่ม PostgreSQL** — Add Service → Database → PostgreSQL
3. **เพิ่ม service ของแอป** — Deploy from GitHub repo (เลือก repo นี้)
4. **ตั้ง Variables** ที่ service ของแอป

   | ตัวแปร | ค่า |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference ไป service Postgres) |
   | `JWT_SECRET` | สุ่มค่าใหม่ (`openssl rand -base64 48`) |
   | `SITE_URL` | `https://<domain ของคุณ>` (หรือเว้นว่างให้ใช้ `RAILWAY_PUBLIC_DOMAIN` อัตโนมัติ) |
   | `SITE_NAME` | `SecondPhone Store` |
   | `DEMO_MODE` | `true` หรือ `false` |
   | `COOKIE_SECURE` | `true` |
   | `RUN_SEED` | `true` ครั้งแรก แล้วเปลี่ยนเป็น `false` |
   | `SEED_DEMO_ADMIN` | `true` ครั้งแรก แล้วเปลี่ยนเป็น `false` |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | สำหรับสร้างบัญชีผู้ดูแลครั้งแรก |
   | `RAILWAY_RUN_UID` | `0` **ถ้าใช้ volume** (ดูหัวข้อถัดไป) |

   ถ้าไม่ได้ใช้ volume ให้ **ไม่ต้อง** ตั้ง `RAILWAY_RUN_UID` และแอปจะรันแบบ non-root (ปลอดภัยกว่า)

5. **เปิด Public Networking** — Settings → Networking → Generate Domain
6. **Deploy** — Railway จะ build แล้วรอ `/api/health` ตอบ 2xx ก่อนสลับ traffic

### Railway volume permissions (สำคัญ)

Railway mount volume ด้วย **root** ถ้า image รันด้วย non-root user (uid 1001) จะเขียน `/app/uploads` ไม่ได้
อาการคืออัปโหลดรูปไม่ผ่าน หรือแอป start ไม่ขึ้นเพราะ `mkdir`/`write` ไม่ได้

ทางเลือก

**A. ใช้ volume + ยอมรันเป็น root (ง่ายสุดสำหรับ staging)**

ตั้ง service variable

```
RAILWAY_RUN_UID=0
```

แล้ว mount volume ที่ `/app/uploads`

**B. ไม่ใช้ volume (ข้อมูลรูปไม่คงอยู่ข้าม deploy)**

ปล่อยให้รัน non-root ตามค่าเริ่มต้น — รูปจะหายเมื่อ redeploy
เหมาะกับ staging ชั่วคราวที่ seed รูปใหม่ได้

**C. ใช้ volume แบบ mount path ที่ owner ถูกต้อง**

mount volume ที่ `/app/uploads` แล้วตั้ง `RAILWAY_RUN_UID=0` เฉพาะตอนที่ต้องเขียน
(วิธีนี้เท่ากับ A ในทางปฏิบัติ)

> สรุปสำหรับ staging: ใช้ **A** ถ้าต้องการให้รูปคงอยู่, ใช้ **B** ถ้ายอมให้รูปหายเมื่อ redeploy

### หมายเหตุเฉพาะ Railway

- **PORT** — Railway inject `PORT` เอง แอปอ่านค่าอยู่แล้ว (`server.js` ของ Next standalone + entrypoint)
- **healthcheck hostname** — มาจาก `healthcheck.railway.app` ถ้ามี middleware จำกัด host ต้อง allow host นี้
- **volumes ไม่ถูก mount ตอน build** — อย่าเขียนรูปตอน build
- **pre-deploy** — ถ้าใช้ pre-deploy command และต้องแตะ volume ให้ย้าย logic เข้า start command (entrypoint)
- **TRUST_PROXY_HEADERS** — Railway เป็น reverse proxy จึงควรตั้ง `TRUST_PROXY_HEADERS=true`
  เพื่อให้การตรวจ Origin และการนับ rate limit เห็น host/IP จริง (ถ้าไม่ตั้ง ระบบยังทำงานได้
  แต่จะไม่เชื่อ `X-Forwarded-Host`/`X-Forwarded-For`)

### พิสูจน์ว่ารูปคงอยู่ข้าม deploy (ทำได้จริง)

รูปสินค้าอยู่ใน volume ที่ mount ที่ `/app/uploads` ไม่ใช่ layer ของ image จึงต้องพิสูจน์ว่า
"เขียนรูป → redeploy/restart → รูปยังอยู่และเสิร์ฟได้ 200" ทำตามลำดับ

```bash
# 0) เตรียมค่า (สมมติมี admin ที่ล็อกอินได้)
BASE_URL=https://<domain>

# 1) login เอา cookie
curl -s -c /tmp/sp.jar -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "Origin: $BASE_URL" \
  -d '{"email":"'"$ADMIN_EMAIL"'","password":"'"$ADMIN_PASSWORD"'"}'

# 2) อัปโหลดรูป (ต้องเป็นไฟล์จริง >1MB ได้ เพื่อพิสูจน์ขีดจำกัดใหม่)
#    endpoint: POST /api/admin/devices/<deviceId>/images  (multipart field name = "file")
curl -s -b /tmp/sp.jar -X POST "$BASE_URL/api/admin/devices/<deviceId>/images" \
  -H "Origin: $BASE_URL" \
  -F 'file=@./large-sample.jpg'      # ไฟล์จริง >1MB

# 3) จด path รูปที่ได้จากหน้า /admin/phones/<id>/edit แล้วยิงตรง
IMG="/api/images/devices/<deviceId>/<uuid>.webp"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE_URL$IMG"     # ต้อง 200
```

จากนั้น **redeploy** (หรือ restart service) แล้วยิง `$IMG` ซ้ำอีกครั้ง — ต้องยังได้ `200`
ถ้าได้ `404` แสดงว่าไม่ได้ใช้ volume (หรือ path ไม่ตรง) ให้กลับไปดูหัวข้อ Railway volume permissions

> ถ้าใช้ Docker Compose ให้ทดสอบแบบเดียวกันด้วย `docker compose restart web` (หรือ `up -d --build`)
> แล้วยิง path เดิม — ต้องได้ 200 และไฟล์ใน `docker compose exec web ls /app/uploads/devices/<id>` ต้องอยู่

### ตรวจจริงบน Railway (ยังไม่ได้ทำในเซสชันนี้)

หลัง deploy ให้ตรวจ

```bash
curl -s https://<domain>/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/phones
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/nonexistent   # ต้อง 404
curl -s https://<domain>/sitemap.xml | head
```

หรือใช้ชุด smoke test

```bash
BASE_URL=https://<domain> npm run test:smoke
```

> ⚠️ **สถานะ:** การ deploy ขึ้น Railway จริง **ยังไม่ได้รับการยืนยันในเซสชันนี้** (ไม่มี credential/target)
> สิ่งที่ตรวจแล้วคือ Docker build + compose stack บนเครื่อง (หัวข้อ 3)

---

## 3. ตรวจสอบเมื่อรัน Docker ไม่ได้

OpenHands Cloud และ environment บางแบบรัน Docker daemon ไม่ได้ ยังตรวจสอบได้เกือบครบด้วยวิธีนี้

### 3.1 ตรวจ build และ type (ไม่ต้องมี DB)

```bash
npm ci
export DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
npx prisma validate
npx prisma generate
npm run lint
npm run typecheck
npm run build
npm run test          # unit tests
```

### 3.2 ตรวจกับ PostgreSQL ที่รันแยก (ไม่ใช้ Docker)

ถ้ามี PostgreSQL จากที่อื่น ให้ตั้ง `DATABASE_URL` แล้ว

```bash
npx prisma migrate deploy
RUN_SEED=true npx prisma db seed
BASE_URL=http://localhost:3000 npm run test:smoke
```

### 3.3 ตรวจความถูกต้องของ Dockerfile แบบไม่ build

```bash
grep -n "FROM\|binaryTargets\|node_modules/.bin/prisma" Dockerfile
# ยืนยันว่า prisma/schema.prisma มี binaryTargets ตรงกับ base image
grep -n "binaryTargets" prisma/schema.prisma
```

### 3.4 รายการตรวจแบบ manual (เมื่อ HTTP ไม่พร้อม)

| หัวข้อ | วิธีตรวจ |
| --- | --- |
| JSON-LD ปลอดภัย | `npm run test` (มี regression test) |
| image allowlist | `npm run test` (unit) |
| symlink escape | `npm run test` (unit, สร้าง symlink จริงใน tmp) |
| SITE_URL / Railway fallback | `npm run test` (unit) |
| seed idempotent | รัน `prisma db seed` 2 ครั้ง เทียบ count |
| seed ไม่ทับข้อมูล | แก้ราคา → reseed → ราคาต้องไม่เปลี่ยน |
| non-root | `docker compose exec web id` |
| รูปคงอยู่ | เขียนไฟล์ → restart → ไฟล์ยังอยู่ |

---

## 4. แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
| --- | --- | --- |
| `Prisma Client could not locate the Query Engine for runtime "debian-openssl-3.0.x"` | `binaryTargets` ไม่ตรงกับ base image (build เจอ openssl-1.1.x แต่ runtime เป็น 3.0.x) | ตั้ง `binaryTargets = ["native", "debian-openssl-3.0.x"]` ใน `prisma/schema.prisma` (ตั้งไว้แล้ว) |
| `ENOENT ... prisma_schema_build_bg.wasm` | COPY `node_modules/.bin/prisma` (symlink) ทำให้ Docker dereference เป็นไฟล์จริง แล้ว `__dirname` ผิด | สร้าง symlink เองใน Dockerfile (ทำไว้แล้ว) |
| `Cannot find module 'effect'` | COPY Prisma CLI ทีละแพ็กเกจ ทำให้ dependency ข้ามแพ็กเกจหาย | ใช้ stage `cli` ที่ `npm install` ชุด CLI ครบ dependency |
| `web` restart วน (`Restarting`) | มักมาจาก migrate/seed ล้มเหลว — อ่าน `docker compose logs web` | ดู error จริง มักเป็น DB ไม่พร้อม หรือ engine mismatch |
| รูป 404 ทั้งที่ไฟล์มี | `UPLOAD_DIR` ตั้งเป็นค่าของ container ตอนรัน local | ปล่อย `UPLOAD_DIR` ว่างเมื่อรันนอก container |
| อัปโหลดรูปไม่ได้บน Railway | volume เป็น root แต่รัน non-root | ตั้ง `RAILWAY_RUN_UID=0` |
| `RAILWAY_RUN_UID` แล้วยังไม่ได้ | ต้อง redeploy ให้ variable มีผล | Redeploy service |

---

## 5. checklist ก่อนขึ้น production จริง

- [ ] ตั้ง `DEMO_MODE=false` (หลังยืนยันว่าข้อมูลจริงถูกต้องแล้ว)
- [ ] `JWT_SECRET` สุ่มใหม่ ไม่ซ้ำกับ dev
- [ ] `POSTGRES_PASSWORD` / `ADMIN_PASSWORD` แข็งแรง ไม่ใช่ค่าใน `.env.example`
- [ ] `SITE_URL` เป็น https จริง
- [ ] `COOKIE_SECURE=true`
- [ ] `RUN_SEED=false`, `SEED_OVERWRITE=false`
- [ ] ตรวจว่า `.env` ไม่ถูก commit (`git check-ignore .env`)
- [ ] ตั้ง volume สำหรับ DB และรูป
- [ ] ตรวจ backup ของ DB และรูป
- [ ] `/api/health` ตอบ 200 และ healthcheck ตั้งไว้ที่ path นี้
