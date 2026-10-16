# SecondPhone Store

เว็บไซต์แสดงรายการ **สมาร์ทโฟนมือสอง** (SecondPhone Store) — Next.js + TypeScript + Tailwind CSS + Prisma + PostgreSQL

> ⚠️ **หมายเหตุสำคัญ:** โปรเจกต์นี้เป็น **ระบบสาธิต** สินค้า ราคา สภาพ และการรับประกันทั้งหมดเป็นข้อมูลตัวอย่าง
> ไม่ใช่สินค้าจริงและไม่ใช่ข้อเสนอขาย เว็บจะแสดงแบนเนอร์แจ้งเตือนนี้ตราบใดที่ `DEMO_MODE="true"`
> เมื่อขึ้นใช้งานจริงกับข้อมูลที่ตรวจสอบแล้ว ให้ตั้ง `DEMO_MODE="false"`

---

## ภาพรวม

ร้านสมาร์ทโฟนมือสองแบบเจ้าของรายเดียว มี 2 บทบาท:

- **Visitor** — ดู ค้นหา กรอง และเปิดรายละเอียดสินค้าได้โดยไม่ต้องสมัครสมาชิก
- **Administrator** — เข้าสู่ระบบเพื่อจัดการรายการสินค้า ราคา สภาพ รูป และสถานะ

สินค้าแต่ละชิ้นเป็น **เครื่องจริงหนึ่งเครื่อง** (unique physical item) มี SKU เฉพาะของตัวเอง
แม้เป็นรุ่นเดียวกันก็มีรายการแยกกัน

**ขอบเขตเวอร์ชันแรก:** ไม่มีระบบสมัครสมาชิกลูกค้า, ตะกร้า, checkout, ชำระเงิน, จอง, จัดส่ง, multi-vendor
ลูกค้าติดต่อร้านโดยตรงผ่าน LINE / Facebook / โทรศัพท์

---

## เทคโนโลยี

| ส่วน | เทคโนโลยี | เวอร์ชัน |
| --- | --- | --- |
| ภาษา | TypeScript | 5.9.3 |
| Framework | Next.js (App Router) | 15.5.28 |
| UI | React | 19.1.10 |
| Styling | Tailwind CSS | 4.3.3 |
| Backend | Next.js Route Handlers / Server Actions | — |
| Database | PostgreSQL | 17 |
| ORM | Prisma | 6.19.3 |
| Validation | Zod | 3.25.76 |
| Package manager | npm | — |
| Deployment | Docker / Docker Compose | — |

เวอร์ชันทั้งหมดถูก **pin แบบเจาะจง** (ไม่มี `^` / `~`) ใน `package.json`

---

## เริ่มต้นอย่างเร็ว (Docker Compose)

```bash
cp .env.example .env
# แก้ค่าใน .env — อย่างน้อยต้องตั้ง POSTGRES_PASSWORD และ JWT_SECRET
#   JWT_SECRET: openssl rand -base64 48

docker compose up -d --build
```

เปิด http://localhost:3000

รันครั้งแรกให้ตั้ง `RUN_SEED="true"` ใน `.env` เพื่อใส่ข้อมูลสาธิต แล้วตั้งกลับเป็น `"false"`
(seed เป็นแบบ create-only จะไม่ทับข้อมูลที่แก้ผ่านหลังบ้าน)

```bash
docker compose logs -f web      # ดู log
docker compose down             # หยุด (ข้อมูลใน volume ยังอยู่)
docker compose down -v          # หยุด + ลบข้อมูลทั้งหมด
```

---

## เริ่มต้นแบบ local (ไม่ใช้ Docker)

ต้องมี PostgreSQL รันอยู่ และตั้ง `DATABASE_URL` ให้ชี้ไปที่มัน

```bash
cp .env.example .env
# ตั้ง DATABASE_URL ให้ชี้ localhost เช่น
#   DATABASE_URL="postgresql://sp_user:sp_pass@localhost:5432/secondphone?schema=public"
# สำคัญ: ปล่อย UPLOAD_DIR ให้ว่างเมื่อรันนอก container

npm install
npx prisma migrate deploy
npm run db:seed                 # ไม่บังคับ — ข้อมูลสาธิต
npm run dev                     # http://localhost:3000
```

คำสั่งที่มีให้

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # production server (ต้อง build ก่อน)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # unit tests (vitest)
npm run test:smoke   # smoke test กับ server ที่รันอยู่ (ต้องตั้ง BASE_URL)
npm run db:migrate   # prisma migrate dev (สร้าง migration ใหม่)
npm run db:deploy    # prisma migrate deploy (ใช้ใน production)
npm run db:seed      # ข้อมูลสาธิต
npm run admin:create # สร้าง/อัปเดตบัญชีผู้ดูแล
```

---

## หน้าทั้งหมด

**สาธารณะ**

| เส้นทาง | คำอธิบาย |
| --- | --- |
| `/` | หน้าแรก — hero, สินค้าแนะนำ, แบรนด์, รายการล่าสุด |
| `/phones` | แคตตาล็อก — ค้นหา + กรองแบรนด์/ราคา/ความจุ/สภาพ |
| `/phones/[slug]` | รายละเอียด — แกลเลอรีรูป + ข้อมูลจำเพาะครบ |
| `/api/health` | สถานะระบบ (ตรวจ DB ด้วย) สำหรับ healthcheck/uptime |
| `/api/images/[...path]` | เสิร์ฟรูปที่อัปโหลด (มี allowlist + กัน symlink escape) |
| `/sitemap.xml`, `/robots.txt` | SEO |

**ผู้ดูแล** (Phase 3)

| เส้นทาง | คำอธิบาย |
| --- | --- |
| `/admin/login` | เข้าสู่ระบบ |
| `/admin` | จัดการรายการสินค้า |
| `/admin/phones/new` | เพิ่มสินค้า |
| `/admin/phones/[id]/edit` | แก้ไขสินค้า |

---

## ตัวแปรสภาพแวดล้อม

ดูรายละเอียดทั้งหมดใน [`.env.example`](./.env.example) ตัวที่สำคัญ:

| ตัวแปร | จำเป็น | คำอธิบาย |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | connection string ของ PostgreSQL |
| `JWT_SECRET` | ✅ | ใช้เซ็น session ของผู้ดูแล (`openssl rand -base64 48`) |
| `SITE_URL` | แนะนำ | URL สาธารณะแบบเต็ม (canonical / OG / sitemap) ถ้าไม่ตั้งจะใช้ `RAILWAY_PUBLIC_DOMAIN` แล้ว fallback เป็น `http://localhost:3000` |
| `SITE_NAME` | — | ชื่อร้านที่แสดงบนเว็บ |
| `DEMO_MODE` | — | `true` (ค่าเริ่มต้น) = แสดงแบนเนอร์ข้อมูลสาธิต |
| `LINE_ID` / `FACEBOOK_URL` / `PHONE_NUMBER` | — | ช่องทางติดต่อ (เว้นว่าง = ไม่แสดง) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | ใช้กับ seed / `admin:create` |
| `RUN_SEED` | — | `true` = ให้ entrypoint รัน seed ตอนเริ่ม (ครั้งแรกเท่านั้น) |
| `SEED_DEMO_ADMIN` | — | `true` = ให้ seed สร้างบัญชีผู้ดูแลด้วย |
| `SEED_OVERWRITE` | — | `true` = อนุญาตให้ seed **เขียนทับ** ข้อมูลเดิม (ค่าเริ่มต้น create-only) |
| `UPLOAD_DIR` | — | โฟลเดอร์เก็บรูป (`/app/uploads` ใน container, เว้นว่าง = `./uploads` เมื่อรัน local) |
| `MAX_UPLOAD_MB` | — | ขนาดรูปสูงสุด (MB) |
| `COOKIE_SECURE` | — | `true` (ค่าเริ่มต้น) ตั้ง cookie แบบ secure — ปิดเฉพาะเมื่อทดสอบบน http |

---

## โครงสร้างโปรเจกต์

```
src/
  app/
    page.tsx                     # หน้าแรก
    layout.tsx                   # layout หลัก (header/footer/demo banner)
    phones/                      # แคตตาล็อก + รายละเอียด
    admin/                       # หน้าผู้ดูแล (Phase 3)
    api/
      health/route.ts            # healthcheck
      images/[...path]/route.ts  # เสิร์ฟรูปที่อัปโหลด
    robots.ts, sitemap.ts
  components/
    layout/                      # header, footer, sections, demo banner
    ui/                          # ปุ่ม, badge, empty state ฯลฯ
  lib/
    queries/                     # business logic อ่านข้อมูล (devices, catalog)
    storage/                     # upload dir + path allowlist
    json-ld.ts                   # serialize JSON-LD อย่างปลอดภัย
    site-url.ts                  # resolve base URL (Railway-aware)
    site-config.ts               # ชื่อร้าน + ช่องทางติดต่อ + demo mode
    validation/                  # Zod schemas
    auth/                        # session + password (Phase 3)
    db.ts                        # Prisma client singleton
prisma/
  schema.prisma                  # data model
  migrations/                    # migration ของ production
  seed.ts                        # ข้อมูลสาธิต (create-only, idempotent)
scripts/
  create-admin.ts
docker/
  entrypoint.sh                  # รอ DB → migrate → seed (ถ้าสั่ง) → start
tests/
  unit/                          # vitest
  smoke/                         # HTTP smoke test
```

---

## Deploy

### Docker Compose (production บนเครื่องตัวเอง)

```bash
cp .env.example .env
# ตั้งค่า production: POSTGRES_PASSWORD, JWT_SECRET, SITE_URL, COOKIE_SECURE=true
docker compose up -d --build
```

- `db` — PostgreSQL พร้อม volume ถาวร (`db-data`) และ healthcheck (ไม่ได้ expose port ออกนอก)
- `web` — Next.js multi-stage build รันด้วย user `nextjs` (non-root, uid 1001)
- volume `uploads-data` เก็บรูปสินค้า — รูปยังอยู่หลัง rebuild/restart
- `web` รอ `db` healthy ก่อน แล้วค่อยรัน `prisma migrate deploy`

### Railway

ดูคู่มือฉบับเต็มที่ **[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)** — สรุปสั้น:

1. สร้าง project ใหม่ + เพิ่ม service PostgreSQL
2. เพิ่ม service จาก repo นี้ (Railway ใช้ `Dockerfile` อัตโนมัติ)
3. ตั้ง Variables: `DATABASE_URL` (reference จาก service Postgres), `JWT_SECRET`, `SITE_URL`, `RUN_SEED`
4. ตั้ง healthcheck path = `/api/health`
5. ตั้ง `RAILWAY_RUN_UID=0` ถ้าใช้ volume (ดูหัวข้อ Railway volume permissions)

---

## ความปลอดภัย

- **ห้าม commit `.env`** — อยู่ใน `.gitignore` แล้ว (commit เฉพาะ `.env.example`)
- รหัสผ่านผู้ดูแล hash ด้วย bcrypt (cost 12) ไม่มี public admin registration
- session ใช้ HttpOnly + SameSite cookie และ `Secure` (เปิดได้ด้วย `COOKIE_SECURE`)
- ทุก write ของ admin ตรวจ authorization ฝั่ง server
- input ทั้งหมด validate ด้วย Zod
- JSON-LD escape `<`, `>`, `&` กัน script tag breakout (มี regression test)
- `/api/images` ตรวจ allowlist ชื่อไฟล์ + realpath กัน symlink escape
- ตอบ 404 แบบ no-store ที่ image endpoint ไม่ cache ผลลบ
- `/api/health` ไม่เปิดเผยรายละเอียดภายใน (เฉพาะ `status` / `database` / `latencyMs`)

### npm audit

`npm audit` พบ advisory ใน tooling (postcss ที่ฝังมากับ Next, Prisma CLI) ซึ่งไม่อยู่ใน path ที่รับ request
และแก้ต้องอัปเป็น major ใหม่ (Next 16 / Prisma 7) — ดูเหตุผลในคอมเมนต์ของ `Dockerfile`

---

## การทดสอบ

```bash
npm run lint
npm run typecheck
npm run test                       # unit: JSON-LD, storage paths, site-url

# smoke test ต้องมี server รันอยู่
BASE_URL=http://localhost:3000 npm run test:smoke
```

`npm run test:smoke` ตรวจ: หน้า public ตอบ 200 + ภาษาไทย, 404 ที่ถูกต้อง, `/api/health`,
image endpoint กัน traversal, security headers

---

## เอกสารเพิ่มเติม

- [`PLAN.md`](./PLAN.md) — แผนสถาปัตยกรรมและเฟสการทำงานฉบับเต็ม
- [`AGENTS.md`](./AGENTS.md) — บันทึกความรู้เฉพาะโปรเจกต์สำหรับ session ถัดไป
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — คู่มือ deploy (Docker + Railway) และการตรวจสอบ
