# แผนการพัฒนา: SecondPhone Store

> สถานะเอกสาร: PLAN MODE — เอกสารนี้คือแผนเท่านั้น ยังไม่มีการเขียนโค้ดแอปพลิเคชัน
> เวอร์ชันแผน: 1.0
> วันที่จัดทำ: 2026-10-16

เอกสารนี้เป็นแผนการพัฒนาที่พร้อมนำไป implement โดยโมเดลโค้ดขนาดเล็ก
โดยแบ่งเป็น 5 เฟส แต่ละเฟสมีงานย่อย, ไฟล์ที่ต้องสร้าง, เกณฑ์ยอมรับ (acceptance criteria) และวิธีตรวจสอบ (verification)

---

## 1. ภาพรวมโครงการและขอบเขต (Project Overview and Scope)

### 1.1 ภาพรวม
**SecondPhone Store** คือเว็บไซต์ e-commerce แบบ showcase สำหรับร้านขายสมาร์ทโฟนมือสองรายเดียว (single-vendor)
จุดขายสำคัญคือสินค้าแต่ละชิ้นเป็น **เครื่องจริงที่ไม่ซ้ำกัน** (unique physical device) ไม่ใช่ stock แบบนับจำนวน
ลูกค้าดูสินค้าและติดต่อร้านโดยตรงผ่าน LINE / Facebook / โทรศัพท์ (ไม่มีตะกร้าสินค้า/ชำระเงิน)

### 1.2 บทบาทผู้ใช้
| บทบาท | สิทธิ์ |
|---|---|
| Visitor | ดูหน้าเว็บ, ค้นหา, กรอง, ดูรายละเอียดสินค้า โดยไม่ต้องสมัครสมาชิก |
| Administrator | เข้าสู่ระบบเพื่อจัดการรายการสินค้า ราคา สภาพ รูปภาพ และสถานะการขาย |

### 1.3 สิ่งที่อยู่ในขอบเขต (In Scope)
- หน้า public: Homepage, Product catalog (ค้นหา/กรอง), Product detail
- หน้า admin: login, จัดการสินค้า (CRUD), อัปโหลดรูปหลายรูป, เปลี่ยนสถานะสินค้า
- ฐานข้อมูล PostgreSQL จริง + Prisma migrations + seed data
- Admin authentication แบบ session cookie (single admin, ไม่มี public registration)
- Docker Compose (web + db) พร้อม persistent volumes
- ข้อมูล demo อย่างน้อย 12 รายการ

### 1.4 สิ่งที่ไม่อยู่ในขอบเขต (Out of Scope — ห้าม implement)
- Customer registration / login
- Shopping cart / checkout / online payment
- Reservation system / shipping management
- Multi-vendor marketplace
- Analytics dashboard / recommendation engine
- Email หรือ SMS notification
- i18n หลายภาษา (UI เป็นภาษาไทยเท่านั้นในเวอร์ชันแรก)

### 1.5 สมมติฐาน (Assumptions)
1. เป็นร้านเดียว มี admin 1–3 คน และ **ไม่มี public admin registration** — สร้าง admin ผ่าน seed หรือ CLI script เท่านั้น
2. ราคาเก็บเป็น **integer THB** (หน่วยบาทเต็ม) ไม่ใช้ floating point
3. ข้อมูลติดต่อร้าน (LINE ID, Facebook URL, เบอร์โทร, ชื่อร้าน) มาจาก environment variables ทั้งหมด
4. Workspace เริ่มจาก **ศูนย์ (empty repo)** — planner ตรวจสอบแล้วพบเฉพาะไดเรกทอรี `.git` และยังไม่มี commit ใด ๆ จึงวางแผนแบบ clean initialization
5. รูปสินค้าถูกเก็บบน **filesystem volume** และให้ Next.js serve ผ่าน route handler (ไม่พึ่งพา external CDN หรือ object storage ในเวอร์ชันแรก)
6. ตัวเลข dependency ทั้งหมดอ้างอิงจาก npm registry และ Docker Hub ณ วันที่จัดทำแผน (ดูหัวข้อ 3.4)

---

## 2. การตัดสินใจเชิงสถาปัตยกรรม (Final Architecture Decisions)

เว็บไซต์เป็น **single full-stack Next.js application** ที่คุยกับ PostgreSQL ผ่าน Prisma
ไม่แยก service, ไม่มี Redis, ไม่มี message queue, ไม่มี reverse proxy แยก (Caddy/Nginx) ในเวอร์ชันแรก

| # | การตัดสินใจ | เหตุผล | ทางเลือกที่ตัดออก |
|---|---|---|---|
| AD-1 | Next.js App Router + Server Components เป็นหลัก | ใช้ data fetching ฝั่ง server ตรงกับ Prisma, ลด JS ที่ส่งไป client, เป็นแนวทางปัจจุบันของ Next.js | Pages Router (เก่า), แยก frontend/backend |
| AD-2 | Server Actions สำหรับ admin mutations, Route Handlers สำหรับ public read API และการ serve รูป | ลดจำนวน endpoint ที่ต้องเขียน, ได้ CSRF protection พื้นฐานจาก Next.js | REST API เต็มรูปแบบ (ซ้ำซ้อน) |
| AD-3 | Session cookie แบบ signed JWT ผ่าน `jose` + HttpOnly/Secure/SameSite | เบา, stateless, ไม่ต้องเพิ่มตาราง session, ตรวจสอบสิทธิ์ได้ใน middleware และ server layer | NextAuth (ใหญ่เกินความจำเป็น), DB session table |
| AD-4 | รหัสผ่าน hash ด้วย bcrypt (`bcryptjs`, cost ≥ 12) | เสถียร, pure-JS, ติดตั้งง่ายบน Alpine/Docker | argon2 native (ต้อง build toolchain เพิ่ม) |
| AD-5 | รูปสินค้าเก็บใน volume ที่ mount เข้า container แล้ว serve ผ่าน catch-all route handler `/api/images/[...path]` | image optimizer ของ Next.js ใน Docker มีข้อจำกัดเรื่อง volume/share; route handler ให้ full control เรื่อง path, cache header และการจำกัดการเข้าถึง | serve ผ่าน `public/` (หายเมื่อ rebuild), object storage (เกินขอบเขต v1) |
| AD-6 | Validation ด้วย Zod ทั้งฝั่ง server และฝั่ง form | schema เดียวใช้ได้ทั้ง client/server และให้ error message ที่สอดคล้อง | manual validation |
| AD-7 | Prisma **v6 (6.19.3)** | v7 เป็นการเปลี่ยนแปลงใหญ่ (บังคับ ESM-first, บังคับ driver adapter, บังคับ output path, ย้าย config ไป `prisma.config.ts`) ซึ่งเพิ่มความเสี่ยงให้โมเดลเล็ก; v6 ยัง maintain และเสถียร | Prisma 7/8 (RC) |
| AD-8 | TypeScript **5.9.x** | Next.js 15 และ toolchain ส่วนใหญ่ยังไม่รองรับ TypeScript 7 (native compiler) อย่างสมบูรณ์ | TypeScript 7 |
| AD-9 | Tailwind CSS **v4** (config ผ่าน CSS) | มาตรฐานปัจจุบัน, เข้ากับ Next.js 15 ในตัว | Tailwind v3 (legacy) |
| AD-10 | shadcn/ui แบบ copy-in component (ไม่ใช่ npm package) | โมเดลเล็กอ่านและแก้โค้ดที่อยู่ในโปรเจกต์ได้ง่ายกว่า dependency ที่ซ่อนอยู่ | component library ภายนอก (MUI, Chakra) |
| AD-11 | Docker multi-stage build + `output: 'standalone'` + non-root user | image เล็กลง, ไม่ต้องมี devDependencies ใน production, ลดสิทธิ์ใน container | single-stage build |
| AD-12 | PostgreSQL volume + upload volume เป็น **named volume** | ข้อมูลและรูปคงอยู่หลัง rebuild/restart | bind mount (พึ่งพา host path) |

### 2.1 หมายเหตุสำคัญเรื่อง Docker ในสภาพแวดล้อมพัฒนา
Docker CLI และ Docker Compose **มีอยู่ในเครื่อง dev นี้** (Docker 29.8.1, Compose v5.5.1)
แต่ planner ตรวจสอบแล้วว่า **Docker daemon ยังไม่ทำงาน** (`sudo dockerd` ต้องเริ่มก่อน)
ดังนั้นในเฟส 1–4 ให้ใช้ **แนวทาง dual-path** ต่อไปนี้เสมอ:

- **Path A (Docker):** ใช้เมื่อ daemon ทำงานได้ → `docker compose up -d --build`
- **Path B (Local, ไม่ต้องพึ่ง Docker):** ใช้สำหรับตรวจสอบระหว่างพัฒนา → รัน PostgreSQL จาก binary/service ที่มีในเครื่อง หรือใช้ `DATABASE_URL` ชี้ไป PostgreSQL instance ที่มีอยู่ แล้วรัน `npm run dev` และ `npm run build`

ทุก task ต้องระบุเกณฑ์ยอมรับ (acceptance criteria) ที่ตรวจสอบได้ด้วย Path B ก่อนเสมอ แล้วจึงตรวจซ้ำด้วย Path A ถ้า daemon พร้อม
ห้ามถือว่า task ผ่านเพราะ "คาดว่า Docker จะผ่าน"

---

## 3. เทคโนโลยีและกลยุทธ์ด้าน Dependency (Technology Stack and Dependency Strategy)

### 3.1 Stack หลัก
| ชั้น | เทคโนโลยี |
|---|---|
| Language | TypeScript 5.9.x |
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui |
| Backend | Next.js Server Actions / Route Handlers |
| Database | PostgreSQL 17 |
| ORM | Prisma 6 |
| Validation | Zod 3 |
| Auth | `jose` (signed session cookie) + `bcryptjs` |
| Image processing | `sharp` (validate/resize ฝั่ง server) |
| Package manager | npm |
| Deployment | Docker + Docker Compose |
| Runtime image | Node.js 24 LTS (bookworm-slim) |

### 3.2 ตาราง dependency ที่ pin เวอร์ชัน (ตรวจสอบกับ npm registry แล้ว)

**dependencies**
| package | version |
|---|---|
| next | 15.5.28 |
| react | 19.1.10 |
| react-dom | 19.1.10 |
| @prisma/client | 6.19.3 |
| zod | 3.25.76 |
| jose | 6.2.12 |
| bcryptjs | 3.0.3 |
| sharp | 0.35.5 |
| clsx | 2.1.1 |
| tailwind-merge | 3.7.0 |
| class-variance-authority | 0.7.1 |
| lucide-react | 1.57.0 |
| sonner | 2.0.8 |
| @fontsource-variable/noto-sans-thai | 5.3.0 |

**devDependencies**
| package | version |
|---|---|
| typescript | 5.9.3 |
| prisma | 6.19.3 |
| tsx | 4.23.15 |
| tailwindcss | 4.3.3 |
| @tailwindcss/postcss | 4.3.3 |
| tw-animate-css | 1.4.0 |
| eslint | 9.39.5 |
| eslint-config-next | 15.5.28 |
| eslint-config-prettier | 10.1.8 |
| prettier | 3.9.10 |
| vitest | 3.2.7 |
| @vitejs/plugin-react | 5.2.0 |
| vite-tsconfig-paths | 6.1.1 |
| jsdom | 30.1.3 |
| @testing-library/react | 16.3.3 |
| @testing-library/dom | 10.4.2 |
| @testing-library/jest-dom | 7.0.1 |
| @types/node | 22.20.5 |
| @types/react | 19.1.17 |
| @types/react-dom | 19.1.11 |

**Docker base images**
| image | tag |
|---|---|
| node (builder + runner) | `node:24.22.0-bookworm-slim` |
| postgres | `postgres:17.11-alpine` |

### 3.3 กฎการใช้ dependency
1. Pin เวอร์ชันแบบ **exact** ใน `package.json` (ไม่มี `^` หรือ `~`) เพื่อให้ผลลัพธ์ทำซ้ำได้
2. Commit `package-lock.json`
3. **ห้าม**เพิ่ม dependency นอกตารางนี้โดยไม่จำเป็น ถ้าจำเป็นต้องเพิ่ม ให้บันทึกเหตุผลใน `AGENTS.md`
4. `npm audit` ต้องไม่มีช่องโหว่ระดับ high/critical ก่อนปิดเฟส (ถ้ามี ให้บันทึกและประเมิน)
5. Dockerfile ใช้ `npm ci` (ไม่ใช่ `npm install`) เพื่อความ deterministic

### 3.4 ข้อควรระวังเรื่องเวอร์ชัน
- **Prisma:** ใช้ v6 เท่านั้น ห้ามอัปเกรดเป็น v7/v8 ระหว่าง implement (ดู AD-7) ถ้า Prisma CLI เตือนเรื่องเวอร์ชันใหม่ ให้เพิกเฉย
- **TypeScript:** ใช้ 5.9.x เท่านั้น (latest บน npm คือ 7.x ซึ่งเข้ากับ Next.js 15 ที่ pin ไว้ไม่ได้)
- **Node:** `@types/node` pin ที่ 22 ถือว่าเข้ากับ Node 24 runtime ได้; ถ้า type ใหม่ที่ต้องใช้ไม่มี ให้ปรับเป็น 24.x และบันทึก
- **Tailwind v4:** ไม่ใช้ `tailwind.config.ts` แบบ v3 — ใช้ `@import "tailwindcss"` และ `@theme` ใน `globals.css`
- **ข้อบังคับเรื่อง `latest`:** dist-tag `latest` ของหลายแพ็กเกจต่างจากเวอร์ชันที่ pin ไว้มาก — `next` (`latest`=16.x), `typescript` (`latest`=7.x), `eslint` (`latest`=10.x), `zod` (`latest`=4.x), `prisma` (**`latest`=8.0.0-rc pre-release**), และ `lucide-react` (`latest`=1.53.0 ซึ่งต่ำกว่า 1.57.0 ที่ pin) → **ต้องระบุเวอร์ชัน exact ทุกครั้ง ห้าม `npm install <pkg>@latest` และห้าม `npm update`** (รายละเอียดผลยืนยันอยู่ภาคผนวก D)
- **`next lint`:** ถูก deprecate ใน Next 15.5 → ใช้ `eslint .` (ดู §12.3)

---

## 4. โครงสร้างโฟลเดอร์ที่เสนอ (Proposed Project Folder Structure)

```
secondphone-store/
├── .dockerignore
├── .env.example
├── .env                     # local only — ห้าม commit
├── .gitignore
├── AGENTS.md                # บันทึกความรู้เฉพาะโปรเจกต์สำหรับ session ถัดไป
├── PLAN.md                  # เอกสารนี้
├── README.md
├── docker-compose.yml
├── Dockerfile
├── package.json
├── package-lock.json
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/          # generated โดย prisma migrate
│   └── seed.ts
├── public/
│   ├── favicon.ico
│   └── placeholders/        # รูป placeholder ที่ commit ไว้ (ไม่พึ่ง external URL)
│       ├── phone-placeholder.svg
│       └── brand-placeholder.svg
├── docker/
│   └── entrypoint.sh        # รอ db → migrate → start
├── scripts/
│   ├── create-admin.ts      # สร้าง/รีเซ็ต admin (ใช้ bcryptjs)
│   └── check-env.ts         # ตรวจ env ที่จำเป็นก่อน start
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx                       # Homepage
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── phones/
│   │   │   ├── page.tsx                   # Catalog
│   │   │   ├── loading.tsx
│   │   │   └── [slug]/
│   │   │       ├── page.tsx               # Product detail
│   │   │       └── not-found.tsx
│   │   ├── admin/
│   │   │   ├── login/
│   │   │   │   └── page.tsx               # public (อยู่นอก route group (protected))
│   │   │   └── (protected)/               # route group: auth guard ครอบเฉพาะกลุ่มนี้
│   │   │       ├── layout.tsx             # admin shell (auth guard)
│   │   │       ├── page.tsx               # Product management
│   │   │       ├── phones/
│   │   │       │   ├── new/page.tsx
│   │   │       │   └── [id]/edit/page.tsx
│   │   │       └── actions.ts             # server actions (admin mutations)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   └── logout/route.ts
│   │       ├── devices/route.ts           # public read API (optional, ใช้โดย filter)
│   │       └── images/
│   │           └── [...path]/route.ts     # catch-all: serve รูปจาก upload volume
│   ├── components/
│   │   ├── ui/                            # shadcn/ui copy-in components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── label.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   └── skeleton.tsx
│   │   ├── layout/
│   │   │   ├── site-header.tsx
│   │   │   ├── site-footer.tsx
│   │   │   ├── mobile-nav.tsx
│   │   │   └── contact-links.tsx
│   │   ├── product/
│   │   │   ├── device-card.tsx
│   │   │   ├── device-grid.tsx
│   │   │   ├── device-gallery.tsx
│   │   │   ├── condition-badge.tsx
│   │   │   ├── status-badge.tsx
│   │   │   ├── price-tag.tsx
│   │   │   └── spec-list.tsx
│   │   ├── catalog/
│   │   │   ├── search-bar.tsx
│   │   │   ├── filter-panel.tsx
│   │   │   ├── sort-select.tsx
│   │   │   └── active-filters.tsx
│   │   ├── admin/
│   │   │   ├── login-form.tsx
│   │   │   ├── device-form.tsx
│   │   │   ├── image-uploader.tsx
│   │   │   ├── admin-table.tsx
│   │   │   ├── status-control.tsx
│   │   │   └── delete-dialog.tsx
│   │   └── common/
│   │       ├── empty-state.tsx
│   │       ├── error-state.tsx
│   │       ├── loading-skeleton.tsx
│   │       └── safe-image.tsx
│   ├── lib/
│   │   ├── prisma.ts                     # PrismaClient singleton
│   │   ├── auth/
│   │   │   ├── session.ts                # sign/verify JWT + cookie helpers
│   │   │   ├── password.ts               # bcryptjs hash/verify
│   │   │   ├── rate-limit.ts             # in-memory rate limiter
│   │   │   └── guard.ts                  # requireAdmin() สำหรับ server layer
│   │   ├── storage/
│   │   │   ├── upload.ts                 # บันทึกไฟล์ลง upload volume
│   │   │   └── paths.ts                  # resolve path อย่างปลอดภัย
│   │   ├── validation/
│   │   │   ├── device.ts                 # Zod schemas
│   │   │   ├── auth.ts
│   │   │   └── filters.ts
│   │   ├── queries/
│   │   │   ├── devices.ts                # READ queries (public + admin)
│   │   │   ├── brands.ts
│   │   │   └── filters.ts                # ดึง options สำหรับ filter
│   │   ├── mutations/
│   │   │   └── devices.ts                # CREATE/UPDATE/DELETE logic
│   │   ├── site-config.ts                # อ่าน contact env vars
│   │   ├── slug.ts                       # สร้าง slug แบบ unique
│   │   └── utils.ts                      # cn(), formatTHB(), formatDate()
│   ├── types/
│   │   ├── device.ts
│   │   └── filters.ts
│   └── middleware.ts                     # ป้องกัน /admin/* ยกเว้น /admin/login
└── tests/
    ├── setup.ts
    ├── unit/
    │   ├── validation.test.ts
    │   ├── slug.test.ts
    │   ├── utils.test.ts
    │   └── password.test.ts
    ├── integration/
    │   ├── devices-query.test.ts
    │   ├── devices-mutation.test.ts
    │   └── seed-idempotency.test.ts
    └── e2e/                              # เตรียมไว้ (ไม่บังคับในเฟส 5)
        └── README.md
```

### 4.1 หลักการจัดโครงสร้าง
- แยก **queries** (อ่าน) ออกจาก **mutations** (เขียน) เพื่อลดความสับสนและทำให้ทดสอบง่าย
- Business logic อยู่ใน `src/lib` ไม่กระจายใน components
- Components แบ่งตามโดเมน (`product`, `catalog`, `admin`) ไม่ยัดทุกอย่างใน `ui`
- ไม่สร้าง abstraction ที่ไม่จำเป็น เช่น repository layer, DI container, event bus

---

## 5. เอนทิตีและความสัมพันธ์ในฐานข้อมูล (Database Entities and Relationships)

### 5.1 แนวคิดหลัก
สินค้าแต่ละชิ้นคือ **Device** หนึ่งเครื่อง (unique physical item) ที่ผูกกับ **PhoneModel** หนึ่งรุ่น
`PhoneModel` ผูกกับ `Brand` หนึ่งแบรนด์ และ `Device` มี `DeviceImage` ได้หลายรูป

ความสัมพันธ์:
```
Brand 1 ──< PhoneModel 1 ──< Device 1 ──< DeviceImage
                                    │
                                AdminUser (ผู้สร้าง/แก้ไข — optional FK, set null on delete)
```

### 5.2 โมเดล (Prisma)

**Brand**
| field | type | หมายเหตุ |
|---|---|---|
| id | String @id @default(cuid()) | |
| name | String @unique | เช่น "Apple", "Samsung" |
| slug | String @unique | ใช้ใน URL |

**PhoneModel**
| field | type | หมายเหตุ |
|---|---|---|
| id | String @id @default(cuid()) | |
| brandId | String | FK → Brand |
| name | String | เช่น "iPhone 13 Pro" |
| slug | String @unique | เช่น "iphone-13-pro" |
| releaseYear | Int? | |
| createdAt / updatedAt | DateTime | |

- `@@unique([brandId, name])`
- `@@index([brandId])`

**Device** (หัวใจของระบบ)
| field | type | หมายเหตุ |
|---|---|---|
| id | String @id @default(cuid()) | |
| sku | String @unique | internal product identifier เช่น `SP-IP13P-256-GD-001` |
| slug | String @unique | unique ต่อเครื่อง (รวม sku suffix) |
| modelId | String | FK → PhoneModel |
| storageGb | Int | ความจุ (GB) |
| ramGb | Int? | RAM (ไม่บังคับ) |
| color | String | |
| priceThb | Int | ราคาเป็นจำนวนเต็มบาท |
| conditionGrade | ConditionGrade | enum A/B/C |
| batteryHealthPct | Int? | 0–100 (ไม่บังคับ เช่น Android บางรุ่น) |
| cosmeticDefects | String? | ตำหนิภายนอก (free text) |
| repairHistory | String? | ประวัติซ่อม |
| accessories | String? | อุปกรณ์ที่แถม |
| warrantyInfo | String? | ข้อมูลประกัน |
| description | String | รายละเอียดสินค้า |
| status | DeviceStatus | DRAFT/AVAILABLE/SOLD/ARCHIVED |
| isFeatured | Boolean @default(false) | |
| publishedAt | DateTime? | วันที่เผยแพร่ |
| createdById | String? | FK → AdminUser (onDelete: SetNull) |
| createdAt / updatedAt | DateTime | |
| deletedAt | DateTime? | soft delete (optional, ใช้กับ ARCHIVED) |

- enum `ConditionGrade { A, B, C }`
- enum `DeviceStatus { DRAFT, AVAILABLE, SOLD, ARCHIVED }`
- `@@index([status, publishedAt])`
- `@@index([modelId])`
- `@@index([priceThb])`
- `@@index([conditionGrade])`
- หมายเหตุ: `imei` และ `serialNumber` **ไม่เก็บใน Device** เวอร์ชันแรก ถ้าจำเป็นในอนาคตให้เก็บในตารางแยก `DevicePrivateInfo` ที่ไม่ query ในเส้นทาง public (ดูหัวข้อ 16)

**DeviceImage**
| field | type | หมายเหตุ |
|---|---|---|
| id | String @id @default(cuid()) | |
| deviceId | String | FK → Device (onDelete: Cascade) |
| filename | String | ชื่อไฟล์ที่เก็บจริงใน volume |
| altText | String? | |
| sortOrder | Int @default(0) | ลำดับการแสดง |
| isPrimary | Boolean @default(false) | รูปหลัก |
| width / height | Int? | จาก sharp |
| createdAt | DateTime | |

- `@@index([deviceId, sortOrder])`
- รูปหลักมีได้ 1 รูปต่อ device — บังคับผ่าน business logic (ไม่ใช้ partial unique index ใน v1 เพื่อลดความซับซ้อน)

**AdminUser**
| field | type | หมายเหตุ |
|---|---|---|
| id | String @id @default(cuid()) | |
| email | String @unique | ใช้เป็น username |
| passwordHash | String | bcrypt |
| displayName | String | |
| role | AdminRole @default(ADMIN) | enum: ADMIN, OWNER |
| isActive | Boolean @default(true) | |
| lastLoginAt | DateTime? | |
| createdAt / updatedAt | DateTime | |

- enum `AdminRole { OWNER, ADMIN }`
- ไม่มี field สำหรับ reset password ผ่านอีเมล (นอกขอบเขต) — ใช้ `scripts/create-admin.ts` แทน

### 5.3 กฎการลบ (Deletion Behavior)
| ความสัมพันธ์ | onDelete |
|---|---|
| PhoneModel → Brand | Restrict (ลบแบรนด์ที่มีรุ่นอยู่ไม่ได้) |
| Device → PhoneModel | Restrict (ลบรุ่นที่มีเครื่องอยู่ไม่ได้) |
| DeviceImage → Device | Cascade |
| Device → AdminUser (createdById) | SetNull |

**Admin ลบสินค้า:** ใช้ soft delete เป็นค่าเริ่มต้น (ตั้ง `status = ARCHIVED` + `deletedAt`)
การลบถาวรทำได้เฉพาะผ่าน script เท่านั้น

### 5.4 กฎเรื่องราคา
- เก็บ `priceThb` เป็น `Int` เท่านั้น
- Zod schema บังคับ `z.number().int().min(0).max(1_000_000)`
- ฟอร์แมตแสดงผลด้วย `Intl.NumberFormat('th-TH')` + suffix "บาท"

### 5.5 ดัชนีและข้อจำกัดโดยสรุป
- `sku` unique, `slug` unique (Brand, PhoneModel, Device)
- `@@unique([brandId, name])` บน PhoneModel
- index สำหรับ query ที่ใช้บ่อย: `Device(status, publishedAt)`, `Device(priceThb)`, `Device(conditionGrade)`, `DeviceImage(deviceId, sortOrder)`

---

## 6. สถาปัตยกรรมหน้า Public (Public Page Architecture)

### 6.1 หลักการ
- ใช้ **Server Components** เป็นค่าเริ่มต้น ดึงข้อมูลจาก Prisma โดยตรง
- ใช้ **Client Components** เฉพาะส่วนที่ต้อง interactivity (search bar, filter panel, image gallery, admin forms)
- Query string เป็นแหล่งความจริงของ filter (แชร์ URL ได้, รองรับ back/forward)
- ใช้ `loading.tsx` + Suspense สำหรับ loading state และ `Suspense` skeleton สำหรับส่วนที่ช้า

### 6.2 หน้าและพารามิเตอร์

**`/` — Homepage**
| ส่วน | เนื้อหา | แหล่งข้อมูล |
|---|---|---|
| Hero | ชื่อร้าน, tagline, ปุ่มไป catalog, ปุ่มติดต่อ | static + site config |
| Featured | สินค้า `isFeatured = true` และ `status = AVAILABLE` สูงสุด 4–6 ชิ้น | `getFeaturedDevices()` |
| Brands | แบรนด์ที่มีสินค้า `AVAILABLE` | `getActiveBrands()` |
| Latest | สินค้า `AVAILABLE` เรียงตาม `publishedAt`/`createdAt` 8 ชิ้น | `getLatestDevices()` |
| Trust strip | จุดขาย (รับประกัน, ตรวจสภาพ) — ต้องเป็นข้อมูลจริงที่กำหนดได้ ไม่ใช่ปุ่มหลอก | static config |
| Contact CTA | LINE / Facebook / โทรศัพท์ | `site-config.ts` จาก env |

**`/phones` — Catalog**
Query parameters:
| param | ชนิด | ความหมาย |
|---|---|---|
| `q` | string | ค้นหาชื่อแบรนด์หรือรุ่น |
| `brand` | string (slug) | กรองแบรนด์ (รองรับหลายค่าได้ในอนาคต แต่ v1 ใช้ค่าเดียว) |
| `minPrice` / `maxPrice` | int (THB) | ช่วงราคา |
| `storage` | int (GB) | ความจุ |
| `condition` | A \| B \| C | สภาพ |
| `sort` | `newest` \| `price-asc` \| `price-desc` | เรียงลำดับ |
| `page` | int | หน้า (page size 12) |

- แสดงเฉพาะ `status = AVAILABLE`
- มี `searchParams` validation ด้วย Zod (`filtersSchema`) — ค่าที่ผิดให้ fallback เป็นค่าเริ่มต้น (ไม่ throw)
- แสดง active filters + ปุ่มล้าง filter
- Empty state เมื่อไม่พบผลลัพธ์ (พร้อมปุ่มล้าง filter)
- Pagination แบบ server-side (`skip`/`take` + `count`)

**`/phones/[slug]` — Product Detail**
- 404 ผ่าน `notFound()` ถ้าไม่พบ slug หรือ status เป็น DRAFT/ARCHIVED
- สินค้า `SOLD` ยังแสดงได้ แต่มี badge "ขายแล้ว" ชัดเจนและปุ่มติดต่อถูก deemphasize
- Image gallery: รูปหลัก + thumbnail (client component), fallback เป็น placeholder
- Spec table: brand/model, storage, RAM, color, condition, battery health, defects, repair history, accessories, warranty
- ปุ่มติดต่อร้าน (LINE/Facebook/โทร) พร้อมข้อความ prefill ระบุ SKU

### 6.3 Metadata และ SEO
- `generateMetadata()` ทุกหน้า public (title, description, OpenGraph)
- Product detail ใส่ JSON-LD `Product` (`offers.price` เป็น THB, `priceCurrency: "THB"`)
- `sitemap.ts` และ `robots.ts` (block `/admin`)
- ห้ามใส่ JSON-LD ที่มีข้อมูลอ่อนไหว

### 6.4 สถานะที่ต้องมีทุกหน้า
| สถานะ | การจัดการ |
|---|---|
| Loading | `loading.tsx` + Skeleton |
| Error | `error.tsx` ข้อความภาษาไทย + ปุ่มลองใหม่ |
| Empty | `EmptyState` component (ข้อความ + คำแนะนำ) |
| Not found | `not-found.tsx` |
| รูปไม่โหลด | `SafeImage` แสดง placeholder อัตโนมัติ (`onError`) |

---

## 7. การออกแบบ Admin Authentication และ Authorization

### 7.1 ภาพรวม
Single-admin (หรือไม่กี่คน) ไม่มี public registration
เข้าสู่ระบบด้วย email + password → ได้ signed JWT เก็บใน HttpOnly cookie

### 7.2 ขั้นตอน Login
1. `POST /api/auth/login` รับ `{ email, password }`
2. ตรวจ rate limit (ดู 7.5) — เกินกำหนดตอบ `429`
3. Validate ด้วย Zod (`loginSchema`)
4. ดึง `AdminUser` ตาม email; ถ้าไม่พบให้ยังเทียบ hash กับ dummy hash เพื่อลด timing attack
5. `bcryptjs.compare` → ถ้าไม่ตรงตอบ `401` พร้อมข้อความกลาง ๆ ("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
6. ถ้า `isActive = false` → `403`
7. สร้าง JWT ด้วย `jose` (HS256, `JWT_SECRET` จาก env) payload: `{ sub: adminId, email, role }` อายุ 8 ชั่วโมง
8. ตั้ง cookie `sp_session`: `HttpOnly`, `Secure` (เมื่อ `NODE_ENV === 'production' && COOKIE_SECURE !== 'false'`), `SameSite=Lax`, `Path=/`, `Max-Age` ตรงกับ token
9. อัปเดต `lastLoginAt`

### 7.3 การตรวจสอบสิทธิ์ (Authorization)
ใช้ 3 ชั้น:
1. **`src/middleware.ts`** — `matcher: ['/admin/:path*']` และบรรทัดแรกของ handler เป็น **runtime allowlist**: `if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return NextResponse.next()`; path อื่นของ `/admin/*` ถ้าไม่มี/ไม่ถูกต้อง cookie → redirect ไป `/admin/login?next=...` (เป็นการป้องกันระดับ routing ไม่ใช่ระดับ data)
   - โครงสร้างใช้ **route group** `src/app/admin/(protected)/` สำหรับหน้าที่ต้องล็อกอิน โดย `src/app/admin/login/` อยู่นอก group เพื่อให้ `(protected)/layout.tsx` guard ไม่ครอบหน้า login (กัน redirect loop)
2. **`requireAdmin()` ใน `src/lib/auth/guard.ts`** — เรียกทุก server action และ admin query/mutation; verify JWT จริงและคืน `AdminUser` หรือ throw
3. **ในแต่ละ server action** — ตรวจ role ถ้าต้องการสิทธิ์สูง (เช่น ลบถาวรเฉพาะ OWNER)

> **สำคัญ:** middleware ไม่ใช่ชั้นความปลอดภัยเพียงพอ — การป้องกันจริงต้องอยู่ใน server layer เสมอ

### 7.4 Logout
`POST /api/auth/logout` ล้าง cookie (set `Max-Age=0`) แล้ว redirect ไป `/admin/login`

### 7.5 มาตรการความปลอดภัยของ auth
| ประเด็น | แนวทาง |
|---|---|
| Password hashing | bcrypt cost ≥ 12 |
| Brute force | in-memory rate limit: 5 ครั้ง / 15 นาที ต่อ (IP + email); คืน `429` + header `Retry-After` |
| Session | JWT signed, HttpOnly + Secure (ปิดได้ด้วย `COOKIE_SECURE=false` เฉพาะทดสอบ HTTP ท้องถิ่น) + SameSite=Lax |
| CSRF | Server Actions ของ Next.js มี origin check ในตัว; Route Handlers ที่เป็น mutation ต้องตรวจ `Origin` header เอง |
| Secret | `JWT_SECRET` จาก env, ยาว ≥ 32 bytes, ห้าม commit, ถ้าไม่มีใน production ให้แอป fail fast |
| Session fixation | ออก token ใหม่ทุกครั้งที่ login (ไม่ใช้ค่าซ้ำ) |
| Logout | ล้าง cookie ฝั่ง server ไม่พึ่ง client เท่านั้น |
| Timing | เทียบ dummy hash เมื่อไม่พบ user |
| ข้อความ error | ไม่บอกว่า email มีอยู่หรือไม่ |

### 7.6 การสร้าง/รีเซ็ต Admin
- `scripts/create-admin.ts` รับ `ADMIN_EMAIL` / `ADMIN_PASSWORD` (หรือ args) → hash แล้ว upsert
- Seed สร้าง admin demo **เฉพาะเมื่อ `SEED_DEMO_ADMIN=true`** และใช้รหัสจาก env
- ห้าม hardcode รหัสผ่านในโค้ดหรือใน git
- README ต้องระบุวิธีเปลี่ยนรหัส admin หลังติดตั้ง
- ลำดับ first-run ที่ปลอดภัย (ดูภาคผนวก C):
  1. `cp .env.example .env` แล้วตั้งค่า
  2. `npm ci`
  3. `npx prisma migrate deploy` — **ห้าม `migrate dev` บน production DB** (R-17)
  4. `RUN_SEED=true npx prisma db seed` **ครั้งแรกเท่านั้น** แล้วตั้งกลับ `false` (seed ต้อง idempotent)
  5. `npm run admin:create` (ใช้ `ADMIN_EMAIL`/`ADMIN_PASSWORD` จาก env)
  6. `npm run build && npm start` แล้วตรวจ `/` ได้ 200

---

## 8. กลยุทธ์การจัดเก็บและอัปโหลดรูปภาพ (Image Storage and Upload Strategy)

### 8.1 ทำไมไม่ใช้ `public/`
`public/` ถูก copy เข้า build image และ **หายเมื่อ rebuild** จึงไม่เหมาะกับรูปที่ผู้ใช้อัปโหลด
จึงเลือกใช้ **named volume** mount ที่ `/app/uploads` และอ่านผ่าน route handler

### 8.2 โครงสร้างไฟล์ใน volume
```
/app/uploads/
└── devices/
    └── <deviceId>/
        ├── <uuid>.webp
        ├── <uuid>.webp
        └── ...
```
- ชื่อไฟล์เป็น UUID v4 ห้ามใช้ชื่อจากผู้ใช้ตรง ๆ (กัน path traversal)
- เก็บนามสกุลที่ normalize (จาก mime type จริง ไม่จากชื่อไฟล์)

### 8.3 ขั้นตอนอัปโหลด (Server Action / Route Handler)
1. `requireAdmin()`
2. ตรวจ `Content-Type` เป็น `multipart/form-data`
3. ตรวจจำนวนไฟล์ต่อ request (เช่น ≤ 10) และขนาดต่อไฟล์ (≤ 8 MB)
4. อ่าน buffer แล้วตรวจ **magic bytes** ว่าเป็น JPEG/PNG/WebP จริง
5. ประมวลผลด้วย `sharp`: หมุนตาม EXIF, ย่อด้านยาวสุด ≤ 1600px, แปลงเป็น WebP (quality ~82), strip metadata
6. เขียนไฟล์ลง `uploads/devices/<deviceId>/<uuid>.webp`
7. บันทึก `DeviceImage` (filename, width, height, sortOrder)
8. ถ้าเป็นรูปแรกของ device ให้ตั้ง `isPrimary = true`

### 8.4 การ Serve รูป
`GET /api/images/[...path]` (catch-all route: `src/app/api/images/[...path]/route.ts`)
- เพราะไฟล์ถูกเก็บซ้อนชั้นเป็น `devices/<deviceId>/<uuid>.webp` จึงต้องใช้ catch-all segment ไม่ใช่ `[filename]` เดียว
- handler: `const p = (params.path ?? []).join('/')` แล้วตรวจ allowlist regex เต็มรูปแบบ:
  `^devices/[a-z0-9]{1,64}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$`
- ปฏิเสธ `..`, absolute path, symlink
- resolve ภายใน `UPLOAD_DIR` เท่านั้น: `path.resolve(UPLOAD_DIR, p)` แล้วตรวจว่า resolved path ขึ้นต้นด้วย `UPLOAD_DIR + path.sep`
- ตอบ `Cache-Control: public, max-age=31536000, immutable` และ ETag
- `Content-Type` จาก extension ที่ allowlist (เฉพาะ `.webp`)
- 404 แบบไม่รั่วข้อมูล path จริง
- **รูปทุกไฟล์ถูก serve เป็น public** (เหมาะกับ showcase) แต่ชื่อไฟล์ UUID ทำให้คาดเดายาก
- ไม่ render รูปก่อนยืนยัน admin สำหรับสินค้า DRAFT: หน้า public ไม่ query DRAFT อยู่แล้ว จึงไม่รั่วผ่าน UI
- ทางเลือกที่ตัดออก: flatten ไฟล์เป็น `<uuid>.webp` เพื่อใช้ `[filename]` — ตัดออกเพราะทำให้จัดการ/ลบรูปต่อ device ยากขึ้น

### 8.5 รูป Placeholder และ Seed
- Placeholder เป็น **static asset ใน `public/placeholders/`** (`phone-placeholder.svg`, `brand-placeholder.svg`) ซึ่ง Next.js serve จาก `public/` ตรง ๆ **ไม่ผ่าน** `/api/images` จึงไม่ติดข้อจำกัด allowlist `.webp`
- Seed **ไม่เขียน SVG ลง upload volume** และ **ไม่สร้าง `DeviceImage` ที่อ้าง placeholder**
- `DeviceImage.filename` เก็บ **เฉพาะชื่อไฟล์ที่อัปโหลดจริง** (relative ใต้ `devices/`) เท่านั้น
- UI (`SafeImage`, `device-card`) แสดง placeholder จาก static path เมื่อ device ไม่มี `DeviceImage` หรือรูปโหลดไม่สำเร็จ
- helper `placeholderFor(kind)` เก็บใน `src/lib/storage/paths.ts` เพื่อคืน static placeholder path ที่ถูกต้อง (ทำใน Phase 3)
- Seed **ไม่พึ่ง external URL** — ห้ามใช้ `https://...` ของบุคคลที่สามใน seed/tests

### 8.6 ความคงอยู่ (Persistence)
- volume `uploads_data` mount ที่ `/app/uploads`
- ต้องรอด `docker compose down` (แต่หายเมื่อ `down -v` — ระบุในเอกสาร)

---

## 9. สถาปัตยกรรม Docker และกลยุทธ์ความคงอยู่ (Docker Architecture)

### 9.1 Services (`docker-compose.yml`)
```
services:
  db:    postgres:17.11-alpine   (ไม่ publish port โดยค่าเริ่มต้น)
  web:   build จาก Dockerfile    (publish 3000:3000)
volumes:
  db_data:        # /var/lib/postgresql/data
  uploads_data:   # /app/uploads
```

| service | รายละเอียด |
|---|---|
| `db` | `POSTGRES_USER/PASSWORD/DB` จาก `.env`, healthcheck `pg_isready`, ไม่ expose port ออก host (เปิดเฉพาะเมื่อต้อง debug ผ่าน `compose.override`) |
| `web` | build multi-stage, `depends_on: db: condition: service_healthy`, env จาก `.env`, mount `uploads_data:/app/uploads`, รัน entrypoint ที่ migrate ก่อน start |

### 9.2 Dockerfile (multi-stage)
1. **deps** — `node:24.22.0-bookworm-slim`, copy package files, `npm ci`
2. **builder** — copy source, `npx prisma generate`, `npm run build` (ต้องมี `output: 'standalone'` ใน `next.config.ts`)
3. **runner** — `node:24.22.0-bookworm-slim`, non-root user (`nextjs:nodejs`, uid 1001), copy standalone output + static + public + prisma client + `node_modules/.bin` ที่จำเป็น, สร้าง `/app/uploads` และ chown ให้ user, `EXPOSE 3000`
   - **ต้องคัดลอกเพิ่มเข้า runner เพื่อให้ migrate/seed ได้ใน production:**
     - `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`
     - Prisma CLI — แนะนำให้ **ย้าย `prisma` จาก devDependencies → dependencies** (หรือคัดลอก `node_modules/prisma` + `@prisma/engines` + `node_modules/.bin/prisma` ให้ครบ)
     - `tsx` ใน runner ถ้า `prisma/seed.ts` / `scripts/*.ts` เป็น TypeScript (หรือ compile เป็น JS ก่อนคัดลอก)
     - `scripts/create-admin.ts`
   - `next.config.ts` ตั้ง `outputFileTracingIncludes` สำหรับไฟล์ Prisma ที่ runtime ต้องใช้ (schema/migrations) เพื่อให้ standalone ไม่ตัดออก
- ติดตั้ง `postgresql-client` (`pg_isready`) ใน runner สำหรับรอ DB/healthcheck — ระบุให้ชัด
- `ENTRYPOINT ["docker/entrypoint.sh"]`

### 9.3 `docker/entrypoint.sh`
1. รอ PostgreSQL พร้อม (ถ้ามี `pg_isready` ให้ใช้ซ้ำกับ healthcheck)
2. `npx prisma migrate deploy` (production migration)
3. รัน seed แบบ idempotent **เฉพาะเมื่อ `RUN_SEED=true`** (ค่าเริ่มต้น false ใน production)
4. `exec node server.js` (จาก standalone)

> หมายเหตุ: `sharp` และ Prisma engine บน `bookworm-slim` (glibc) ทำงานได้ตรง ไม่ต้องใช้ `linux-musl` target

### 9.4 ไฟล์ที่เกี่ยวข้อง
| ไฟล์ | หน้าที่ |
|---|---|
| `Dockerfile` | multi-stage build |
| `.dockerignore` | ตัด `node_modules`, `.next`, `.git`, `.env`, `uploads`, `tests/e2e`, `*.log` |
| `docker-compose.yml` | services + volumes |
| `docker-compose.override.yml` | (optional) เปิด port db สำหรับ dev — **ไม่ commit ใน production** |
| `.env.example` | ตัวแปรทั้งหมดพร้อมคำอธิบาย |
| `docker/entrypoint.sh` | migrate + start |

### 9.5 Environment variables (`.env.example`)
| ตัวแปร | ตัวอย่าง | หมายเหตุ |
|---|---|---|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | `postgresql://sp_user:sp_pass@db:5432/secondphone?schema=public` | host เป็น `db` ใน compose |
| `POSTGRES_USER` | `sp_user` | |
| `POSTGRES_PASSWORD` | `<ตั้งเอง>` | ห้าม commit |
| `POSTGRES_DB` | `secondphone` | |
| `JWT_SECRET` | `<openssl rand -base64 48>` | ≥ 32 bytes |
| `SESSION_TTL_HOURS` | `8` | |
| `COOKIE_SECURE` | (ไม่ตั้ง = true ใน production) | ตั้ง `false` **เฉพาะ** เมื่อทดสอบ production build บน HTTP ท้องถิ่น; ห้ามตั้ง `false` ใน production จริง |
| `UPLOAD_DIR` | `/app/uploads` | |
| `MAX_UPLOAD_MB` | `8` | |
| `RUN_SEED` | `false` | production |
| `SEED_DEMO_ADMIN` | `false` | |
| `ADMIN_EMAIL` | `admin@example.com` | ใช้ตอน seed/สร้าง admin |
| `ADMIN_PASSWORD` | `<ตั้งเอง>` | ห้าม commit |
| `NEXT_PUBLIC_SITE_NAME` | `SecondPhone Store` | |
| `NEXT_PUBLIC_LINE_ID` | `` | ถ้าว่างให้ซ่อนปุ่ม LINE |
| `NEXT_PUBLIC_FACEBOOK_URL` | `` | ถ้าว่างให้ซ่อนปุ่ม Facebook |
| `NEXT_PUBLIC_PHONE_NUMBER` | `` | ถ้าว่างให้ซ่อนปุ่มโทร |

### 9.6 Contact links แบบไม่ hardcode
`src/lib/site-config.ts` อ่าน env ทั้งหมด แล้วคืน object
ถ้าค่าใดว่าง → `ContactLinks` **ไม่ render** ช่องทางนั้น (ไม่แสดงปุ่มปลอม)

### 9.7 คำสั่งเป้าหมาย
```
docker compose up -d --build
```
เข้าเว็บที่ `http://localhost:3000`

### 9.8 แผนสำรองเมื่อ Docker ใช้ไม่ได้ (Docker-unavailable validation)
เนื่องจาก daemon อาจไม่ทำงานในบาง environment ให้ทุกเฟสตรวจสอบด้วย **Path B** ก่อน:
1. เตรียม PostgreSQL ที่เข้าถึงได้ (มี `DATABASE_URL` ใช้ได้)
2. `npx prisma migrate deploy && npx prisma db seed`
3. `npm run lint && npx tsc --noEmit && npm run build`
4. `npm run dev` แล้วตรวจหน้าจอตาม checklist ด้วยตนเอง/ด้วย test
5. บันทึกใน README ว่า "ตรวจสอบแล้วด้วย Path B" และระบุว่า Path A ยังไม่ได้ตรวจ (ถ้าไม่พร้อม)


---

## 10. ข้อพิจารณาด้านความปลอดภัย (Security Considerations)

### 10.1 การยืนยันตัวตนและเซสชัน
- bcrypt (cost ≥ 12) + signed JWT ใน HttpOnly cookie (ดูหัวข้อ 7)
- `JWT_SECRET` ≥ 32 bytes, fail fast ถ้าไม่มีใน production
- Session TTL 8 ชั่วโมง, ออก token ใหม่ทุก login
- Rate limit login 5 ครั้ง / 15 นาที ต่อ IP+email

### 10.2 การตรวจสอบสิทธิ์
- `requireAdmin()` ทุก server action / admin query
- middleware เป็นเพียงชั้นแรก
- ไม่มี endpoint ใดให้ผู้ไม่ยืนยันตัวตนเรียก mutation ได้

### 10.3 การตรวจสอบข้อมูลนำเข้า (Input Validation)
- Zod ทุกจุดที่รับข้อมูลเข้า (entry point): login, create/edit device, upload, filter query params
- จำกัดความยาว string (เช่น description ≤ 5000, ชื่อ ≤ 200)
- ราคาเป็น int ในช่วงที่กำหนด
- enum ใช้ Zod enum ตรงกับ Prisma enum
- sanitize ข้อความที่จะแสดงผลลัพธ์ (React escape ให้อยู่แล้ว ห้ามใช้ `dangerouslySetInnerHTML`)

### 10.4 การอัปโหลดไฟล์
- ตรวจ magic bytes ไม่เชื่อ `Content-Type` หรือนามสกุล
- จำกัดขนาด/จำนวน
- ชื่อไฟล์เป็น UUID ที่ระบบสร้าง
- re-encode ด้วย sharp (ตัด embedded script/payload ที่อาจแฝงในไฟล์ภาพ)
- เขียนได้เฉพาะใน `UPLOAD_DIR`
- ตรวจ path traversal ตอน serve

### 10.5 การเปิดเผยข้อมูล (Data Exposure)
- Public query เลือกเฉพาะ field ที่จำเป็น — **ห้าม select `AdminUser.passwordHash`, IMEI, serial**
- หน้า public ไม่ query `status IN (DRAFT, ARCHIVED)`
- ตอบ 404 (ไม่ใช่ 403) สำหรับ resource ที่ไม่มีสิทธิ์เห็น
- Error response ฝั่ง client เป็นข้อความกลาง ๆ; log รายละเอียดไว้ฝั่ง server

### 10.6 ฐานข้อมูลและการ deploy
- PostgreSQL ไม่ expose port ออก host โดยค่าเริ่มต้น
- ใช้ non-root user ใน container
- `hashedPassword` เท่านั้น เก็บ plaintext ไม่ได้
- `.env` อยู่ใน `.gitignore` และ `.dockerignore`
- Database credentials มาจาก env ไม่ hardcode
- รัน `npm audit` และ `npx tsc --noEmit` ก่อนปิดเฟส

### 10.7 CSRF
- Server Actions: Next.js ตรวจ origin ให้
- Route Handlers สำหรับ mutation (upload, login, logout): ตรวจ `Origin`/`Referer` ตรงกับ host
- Cookie ใช้ `SameSite=Lax` (เพียงพอเมื่อไม่ใช้ cross-site form)

### 10.8 Security headers
กำหนดใน `next.config.ts`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (หรือ `frame-ancestors 'none'` ผ่าน CSP)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` ปิดกล้อง/ไมค์
- CSP: เริ่มด้วย report-only ใน v1 (เพราะ Next.js inline script) และบันทึกไว้เป็นงานอนาคต

---

## 11. เฟสการพัฒนาและ Checklist (Detailed Implementation Phases and Task Checklists)

**กฎสำหรับผู้ implement (โมเดลเล็ก):**
1. ทำ **ทีละ task ตามลำดับ** และห้ามข้ามไปเฟสถัดไปจนกว่า acceptance criteria ของ task นั้นจะผ่าน
2. ถ้าพบ critical error ให้ **หยุดและแก้ก่อน** ห้ามเดินหน้า
3. รันคำสั่งตรวจสอบทุกครั้งหลังจบ task
4. อัปเดต `AGENTS.md` ด้วยสิ่งที่เรียนรู้ (คำสั่ง, ข้อจำกัด) ทุกครั้งที่พบ
5. แยกให้ชัดระหว่าง "ทำเสร็จและตรวจแล้ว" กับ "ยังไม่ตรวจ"

---

### Phase 1 — Project Foundation

**เป้าหมาย:** มีโปรเจกต์ Next.js + TypeScript + Tailwind + Prisma ที่ migrate/seed ได้ และบูตได้ทั้ง Path A และ Path B

| task | งาน | ไฟล์/โมดูล | เกณฑ์ยอมรับ | วิธีตรวจสอบ |
|---|---|---|---|---|
| 1.1 | เริ่มโปรเจกต์ Next.js 15 + TS + Tailwind 4 + ESLint + App Router + `src/` | `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `src/app/*` | `npm run dev` บูตได้ที่ :3000 ไม่มี error | `npm run dev` แล้ว curl `/` ได้ 200 |
| 1.2 | Pin dependency ตามตาราง 3.2 (exact) และ commit `package-lock.json` | `package.json` | ไม่มี `^`/`~`; `npm ci` ผ่าน | `npm ci` แล้ว `npm ls --depth=0` ไม่มี error |
| 1.3 | ตั้งค่า Tailwind 4 (design tokens ใน `globals.css`) + ฟอนต์ไทย (`Noto Sans Thai`) | `src/app/globals.css`, `src/app/layout.tsx` | พื้นหลังขาว/สว่าง, ตัวอักษรไทยอ่านง่าย, token สี/ระยะครบ | เปิดหน้าแรกดูด้วยตา + ไม่มี hydration warning ใน console |
| 1.4 | ปรับ `next.config.ts`: `output: 'standalone'`, security headers | `next.config.ts` | `npm run build` สร้าง `.next/standalone` | `ls .next/standalone/server.js` |
| 1.5 | ติดตั้ง Prisma 6 + สร้าง schema ตามหัวข้อ 5 ทั้งหมด | `prisma/schema.prisma` | `npx prisma validate` ผ่าน | `npx prisma validate` |
| 1.6 | สร้าง migration แรก | `prisma/migrations/**` | migrate apply กับ DB จริงสำเร็จ | `npx prisma migrate dev --name init` แล้ว `npx prisma migrate status` |
| 1.7 | สร้าง Prisma client singleton | `src/lib/prisma.ts` | import ได้ ไม่เกิดหลาย instance ใน dev | `npx tsc --noEmit` ผ่าน + smoke query ด้วย `tsx` |
| 1.8 | เขียน seed idempotent: ≥ 12 devices, ≥ 4 brands, หลายรุ่น/ความจุ/สภาพ, มี SOLD, ราคา THB สมจริง | `prisma/seed.ts` | รัน 2 ครั้งแล้วจำนวน Device/Brand/Model/Image เท่าเดิม | `npx prisma db seed` สองครั้ง + เทียบ `count()` ด้วย query script |
| 1.9 | Seed รูป placeholder แบบ local (ไม่พึ่ง external URL) | `public/placeholders/*` (static asset) | ทุก device แสดงรูปได้: มี `DeviceImage` จริง หรือ fallback ไป static placeholder; ไม่มี URL ภายนอก; seed ไม่สร้าง `DeviceImage` ที่อ้าง SVG placeholder | ตรวจว่าไม่มี `https://` ใน seed; สแกน `DeviceImage.filename` ให้อยู่ใต้ `devices/` เท่านั้น |
| 1.10 | สร้าง `scripts/create-admin.ts` (bcryptjs upsert) | `scripts/create-admin.ts` | รันแล้วสร้าง/อัปเดต admin; hash ตรวจสอบได้ | รันด้วย env แล้ว `bcryptjs.compare` สำเร็จ |
| 1.11 | `.env.example`, `.gitignore`, `.dockerignore` | ไฟล์ที่ระบุ | `.env` ไม่ถูก track; `.dockerignore` ตัด node_modules/.next/.env | `git status --porcelain` ไม่มี `.env`; `git check-ignore -v .env` |
| 1.12 | `Dockerfile` multi-stage + `docker/entrypoint.sh` + `docker-compose.yml` (db healthcheck, named volumes) | `Dockerfile`, `docker/*`, `docker-compose.yml` | Path A: `docker compose up -d --build` แล้วเว็บ +500/200; Path B: build/migrate/seed ผ่าน | ดู 1.13 |
| 1.13 | ตรวจสอบเฟส 1 แบบ dual-path | — | Path B: lint+typecheck+build+migrate+seed ผ่านครบ. Path A (ถ้า daemon พร้อม): container ขึ้นครบและ `docker compose ps` healthy | `npm run lint && npx tsc --noEmit && npm run build`; `docker compose up -d --build && docker compose ps` |

**Acceptance criteria ของ Phase 1 (ต้องผ่านทั้งหมด)**
- [ ] แอปบูตได้และเข้า `/` ได้ (Path B อย่างน้อย)
- [ ] `prisma migrate` และ `prisma db seed` ทำงานได้และ seed idempotent
- [ ] มีข้อมูล demo ≥ 12 devices
- [ ] Dockerfile/compose/entrypoint พร้อม และตรวจ Path A ได้ถ้า daemon ทำงาน (ไม่ทำ → บันทึกเป็น unverified)

---

### Phase 2 — Public Storefront

**เป้าหมาย:** หน้า public 3 หน้าดึงข้อมูลจาก PostgreSQL จริง + responsive + ครบ loading/empty/error

**Dependencies:** Phase 1 ผ่าน

| task | งาน | ไฟล์/โมดูล | เกณฑ์ยอมรับ | วิธีตรวจสอบ |
|---|---|---|---|---|
| 2.1 | Layout กลาง: header, nav, footer, mobile nav, container/spacing tokens | `src/app/layout.tsx`, `src/components/layout/*` | responsive 3 breakpoint; nav ทำงาน; footer แสดงข้อมูลร้าน | เปิดดู 375px / 768px / 1280px |
| 2.2 | shadcn/ui base components (button, card, badge, input, select, label, textarea, skeleton) | `src/components/ui/*` | component ใช้ token ของ Tailwind 4 และ render ได้ | build ผ่าน + ดูหน้าแสดงตัวอย่างชั่วคราวแล้วลบ |
| 2.3 | `site-config.ts` + `ContactLinks` | `src/lib/site-config.ts`, `src/components/layout/contact-links.tsx` | อ่าน env ครบ; ค่าที่ว่างไม่แสดงปุ่ม | ตั้ง env ว่าง แล้วยืนยันว่าปุ่มหาย |
| 2.4 | Query layer: `getFeaturedDevices`, `getLatestDevices`, `getActiveBrands` | `src/lib/queries/devices.ts`, `brands.ts` | คืนเฉพาะ `status = AVAILABLE`; จำกัดจำนวน | unit/integration test กับ DB จริง |
| 2.5 | Product card + grid + condition/status badge + price tag + SafeImage | `src/components/product/*`, `common/safe-image.tsx` | รูป fallback เป็น placeholder เมื่อ error/ไม่มีรูป; ราคาแสดง "บาท" | เปิดดูหน้า + จำลองรูปเสีย |
| 2.6 | Homepage | `src/app/page.tsx` (+ `loading.tsx`) | มี hero, featured, brands, latest, contact CTA; ทุกปุ่มทำงานจริง | ตรวจด้วยตา + คลิกทุกปุ่ม |
| 2.7 | Filter schema + query | `src/lib/validation/filters.ts`, `src/lib/queries/filters.ts` | ค่า query ผิด fallback ได้; ดึง options (brands, storage, price range) จริง | unit test schema + ตรวจ options ตรงกับ DB |
| 2.8 | Catalog page + search + filter + sort + pagination | `src/app/phones/page.tsx`, `src/components/catalog/*` | filter ทำงานร่วมกันถูกต้อง; URL แชร์ได้; มี active filters และปุ่มล้าง | ทดสอบ combination: q+brand+price+storage+condition+sort+page |
| 2.9 | Empty state ของ catalog | `src/components/common/empty-state.tsx` | เมื่อไม่พบผลลัพธ์แสดงข้อความ + ปุ่มล้าง filter | กรองด้วยค่าไม่มีผลลัพธ์ |
| 2.10 | Product detail page + gallery | `src/app/phones/[slug]/page.tsx`, `src/components/product/device-gallery.tsx` | 404 สำหรับ slug ไม่มี/DRAFT/ARCHIVED; SOLD แสดง badge; gallery เลื่อนรูปได้; spec ครบ | ทดสอบ slug จริง, slug ปลอม, สินค้า SOLD |
| 2.11 | Metadata + JSON-LD + sitemap/robots | ส่วนที่เกี่ยว | title/description ถูกต้อง; robots block `/admin` | เปิด view-source ตรวจ JSON-LD; `curl /robots.txt` |
| 2.12 | Responsive + a11y pass | ทุกหน้า public | ไม่มี horizontal scroll; ปุ่มมี label; คอนทราสต์เพียงพอ | ตรวจ 3 breakpoint + keyboard navigation |

**Acceptance criteria ของ Phase 2**
- [ ] หน้า `/`, `/phones`, `/phones/[slug]` ทำงานจากข้อมูลจริงใน PostgreSQL
- [ ] ค้นหา + กรอง (brand, price, storage, condition) + sort ทำงานถูกต้อง
- [ ] Loading/empty/error/not-found ครบ
- [ ] Responsive ที่ 375/768/1280
- [ ] ไม่มีปุ่มหลอก

---

### Phase 3 — Admin System

**เป้าหมาย:** admin login ปลอดภัย + CRUD สินค้า + อัปโหลดรูป + จัดการสถานะ

**Dependencies:** Phase 2 ผ่าน

| task | งาน | ไฟล์/โมดูล | เกณฑ์ยอมรับ | วิธีตรวจสอบ |
|---|---|---|---|---|
| 3.1 | password + session libs | `src/lib/auth/password.ts`, `session.ts` | sign/verify JWT ได้; cookie flags ถูกต้อง | unit test round-trip + ตรวจ Set-Cookie |
| 3.2 | rate limiter | `src/lib/auth/rate-limit.ts` | เกิน 5 ครั้ง/15 นาที ตอบ 429 | test ยิง 6 ครั้ง |
| 3.3 | login route + logout route | `src/app/api/auth/login/route.ts`, `logout/route.ts` | สำเร็จตั้ง cookie; ล้มเหลวไม่รั่วข้อมูล; ตรวจ Origin | curl ทดสอบ success/wrong/429 |
| 3.4 | login page + form | `src/app/admin/login/page.tsx`, `components/admin/login-form.tsx` | แสดง error ภาษาไทย; redirect ไป `next` หลังสำเร็จ | ทดสอบ flow |
| 3.5 | middleware (runtime allowlist สำหรับ `/admin/login`) + guard `requireAdmin()` | `src/middleware.ts`, `src/lib/auth/guard.ts` | เข้า `/admin` โดยไม่ login → redirect; `/admin/login` เข้าได้; guard throw ถ้าไม่มีสิทธิ์ | ทดสอบ path ตรง/อ้อม และ `/admin/login` ต้องไม่ redirect |
| 3.6 | admin layout (ใน route group) + table + search | `src/app/admin/(protected)/layout.tsx`, `src/app/admin/(protected)/page.tsx`, `components/admin/admin-table.tsx` | แสดงสินค้าทุกสถานะ; ค้นหาได้; ปุ่ม logout ทำงาน; guard ไม่ครอบ `/admin/login` | ตรวจด้วยตา + ทดสอบ search |
| 3.7 | Zod schema สำหรับ device (create/update ย่อย) | `src/lib/validation/device.ts` | validate ครบทุก field; ราคา int; enum ตรง Prisma | unit test เคสดี/ไม่ดี |
| 3.8 | slug/sku generation | `src/lib/slug.ts` | unique จริงเมื่อชนกัน | unit test ชนกัน |
| 3.9 | create mutation + server action | `src/lib/mutations/devices.ts`, `src/app/admin/(protected)/actions.ts` | สร้าง Device + slug/sku unique; ต้องผ่าน requireAdmin | integration test + เรียกโดยไม่ login ต้อง fail |
| 3.10 | create page + form | `src/app/admin/(protected)/phones/new/page.tsx`, `components/admin/device-form.tsx` | สร้างได้; error แสดง near field; redirect ไป edit/detail | ทดสอบ flow |
| 3.11 | update mutation + edit page | `src/lib/mutations/devices.ts`, `src/app/admin/(protected)/phones/[id]/edit/page.tsx` | แก้ไขได้; ไม่แก้ field อ่อนไหวโดยไม่ตั้งใจ | ทดสอบ flow + diff ใน DB |
| 3.12 | upload pipeline + image route (catch-all) | `src/lib/storage/*`, `src/app/api/images/[...path]/route.ts` | รับได้เฉพาะ jpeg/png/webp; แปลง WebP; serve ได้ + cache header; ปฏิเสธ path traversal และ path ที่ไม่ตรง allowlist regex | test magic bytes ปลอม + `../` + path นอก `devices/` |
| 3.13 | image uploader UI + จัดลำดับ + set primary + delete | `src/components/admin/image-uploader.tsx`, actions | อัปโหลดหลายรูป; เรียงลำดับ; ลบ; primary ถูกต้อง | ทดสอบ flow + ตรวจ DB |
| 3.14 | status control (DRAFT/AVAILABLE/SOLD/ARCHIVED) | `src/components/admin/status-control.tsx`, actions | เปลี่ยนสถานะมีผลกับหน้า public ทันที; ARCHIVED หายจาก public | เปลี่ยนสถานะแล้วเช็คหน้าบ้าน |
| 3.15 | publish/feature toggle | actions + form | `isFeatured`, `publishedAt` ตั้งได้ | ตรวจหน้าแรก |
| 3.16 | authorization matrix pass | — | ไม่มี mutation ใดเรียกได้โดยไม่ยืนยันตัวตน | ยิงทุก action โดยไม่มี cookie ต้อง 401/redirect |

**Acceptance criteria ของ Phase 3**
- [ ] Login/logout ทำงานและป้องกัน `/admin/*`
- [ ] CRUD สินค้าครบ
- [ ] อัปโหลด/ลบ/เรียงรูปได้ และ persist
- [ ] เปลี่ยนสถานะแล้วหน้า public สะท้อนทันที
- [ ] ไม่มี public registration

---

### Phase 4 — Integration

**เป้าหมาย:** เชื่อมทุกส่วนเข้าด้วยกันและกำปัญหาชายขอบ

**Dependencies:** Phase 3 ผ่าน

| task | งาน | เกณฑ์ยอมรับ | วิธีตรวจสอบ |
|---|---|---|---|
| 4.1 | ตรวจ image persistence หลัง rebuild/restart | รูปยังแสดงหลัง `docker compose up -d --build` และ restart | ดู 5.5 |
| 4.2 | ตรวจ contact links ทุกหน้า | ตรงกับ env; ไม่มีปุ่มปลอม | ตั้ง env ครบ/v่าง แล้วดูทุกหน้า |
| 4.3 | เก็บ loading/error/empty ทุกหน้าทั้ง public + admin | ทุกหน้ามีครบ | เดินตาม checklist ทุกเส้นทาง |
| 4.4 | แก้ปัญหา integration ที่พบ | ไม่มี error ค้างใน console/server log | ไล่ server log + browser console |
| 4.5 | ตรวจ cache/ISR/revalidate กับข้อมูลที่เปลี่ยน | หลัง admin แก้สินค้า หน้า public อัปเดตภายในเวลาที่ยอมรับได้ | ใช้ `revalidatePath` ที่เหมาะสม + ทดสอบ |
| 4.6 | ตรวจ mobile UX ของ admin | ฟอร์มและตารางใช้งานได้บนมือถือ | ทดสอบ 375px |

**Acceptance criteria ของ Phase 4**
- [ ] ทุกฟีเจอร์ในขอบเขตเชื่อมกันทำงานได้จริง
- [ ] รูป persist ข้าม rebuild
- [ ] ไม่มีปุ่มหลอก/หน้าว่างเปล่าโดยไม่มีคำอธิบาย

---

### Phase 5 — Testing and Documentation

**เป้าหมาย:** ทดสอบครบ + lint/typecheck/build ผ่าน + เอกสารพร้อม

**Dependencies:** Phase 4 ผ่าน

| task | งาน | เกณฑ์ยอมรับ | วิธีตรวจสอบ |
|---|---|---|---|
| 5.1 | unit tests: validation, slug, utils (formatTHB), password | ผ่านทั้งหมด | `npm run test` |
| 5.2 | integration tests กับ DB จริง: devices query, mutations, seed idempotency | ผ่านทั้งหมด | `npm run test:integration` |
| 5.3 | auth/authz tests: login success/fail/rate limit/guard | ผ่านทั้งหมด | test suite |
| 5.4 | image tests: reject ไฟล์ปลอม, path traversal, serve header | ผ่านทั้งหมด | test suite |
| 5.5 | persistence test (manual + script) | รูปยังอยู่หลัง restart | `docker compose restart web` แล้วเช็ครูป |
| 5.6 | lint + typecheck + production build | ผ่านทั้งหมด | `npm run lint && npx tsc --noEmit && npm run build` |
| 5.7 | Docker startup verification (Path A ถ้าทำได้) | container ขึ้น healthy และเว็บเข้าได้ | `docker compose up -d --build && docker compose ps` |
| 5.8 | README: setup, env, migrate/seed, admin, deploy, troubleshooting, dual-path | ครบและทำตามได้จริง | ทำตาม README บน DB สะอาด |
| 5.9 | อัปเดต `AGENTS.md` | บันทึกคำสั่ง/ข้อจำกัดจริง | ตรวจว่าไม่ขัดกับความจริง |
| 5.10 | ตรวจ acceptance criteria ทั้งโครงการ | ทุกข้อผ่านหรือบันทึกเป็น unverified พร้อมเหตุผล | ไล่ checklist หัวข้อ 13 |

**Acceptance criteria ของ Phase 5**
- [ ] test ผ่านทั้งหมด (หรือบันทึกเคสที่ข้ามพร้อมเหตุผล)
- [ ] lint/typecheck/build ผ่าน
- [ ] README ทำให้ผู้ใหม่ตั้งระบบได้
- [ ] Docker Path A verified หรือบันทึกชัดว่า unverified

---

## 12. กลยุทธ์การทดสอบและตรวจสอบ (Testing and Verification Strategy)

### 12.1 ระดับการทดสอบ
| ระดับ | เครื่องมือ | ขอบเขต |
|---|---|---|
| Unit | Vitest + jsdom | validation schema, utils (`formatTHB`, `slug`), password, rate-limit |
| Integration | Vitest + PostgreSQL จริง | queries, mutations, seed idempotency, image validation |
| Manual/E2E | checklist + (optional) Playwright | flow ผู้ใช้, responsive, persistence |

### 12.2 กฎการทดสอบ
- ใช้ **DB จริง** กับ integration test (ห้าม mock Prisma) — ใช้ database แยกชื่อ `secondphone_test` และ reset ระหว่าง suite
- ห้าม mock ในระดับที่ทำให้เส้นทางจริงไม่ถูกทดสอบ
- Test ต้อง deterministic: ใช้ seed/fixture ที่คุมได้ ไม่พึ่งเวลาจริงหรือ network
- ถ้าจำเป็นต้องมี external service → ห้ามใช้ เปลี่ยนวิธีทดสอบแทน

### 12.3 คำสั่งมาตรฐาน (ต้องมีใน `package.json`)
| script | คำสั่ง |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `next lint` หรือ `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `test:integration` | `vitest run tests/integration` |
| `db:migrate` | `prisma migrate dev` |
| `db:deploy` | `prisma migrate deploy` |
| `db:seed` | `prisma db seed` |
| `db:studio` | `prisma studio` |
| `admin:create` | `tsx scripts/create-admin.ts` |

### 12.4 Manual QA checklist (ย่อ)
- [ ] หน้าแรกโหลด < 3 วินาทีในเครื่อง dev และรูปแสดงครบ
- [ ] ค้นหา "iPhone" ได้ผลลัพธ์ที่ถูกต้อง
- [ ] กรอง brand + price + storage + condition พร้อมกันถูกต้อง
- [ ] Sort ทั้ง 3 แบบถูกต้อง
- [ ] Pagination ทำงานและไม่กระโดด
- [ ] Product detail: gallery, spec, badge สถานะ
- [ ] Contact links ตรง env
- [ ] Admin login ผิด 6 ครั้งถูกบล็อก
- [ ] เข้า `/admin` โดยไม่ login ถูก redirect
- [ ] สร้าง/แก้/archive สินค้าแล้วหน้า public เปลี่ยนตาม
- [ ] อัปโหลดรูป JPG/PNG/WebP สำเร็จ; ไฟล์ปลอม (.jpg ที่จริงเป็น text) ถูกปฏิเสธ
- [ ] รูปอยู่ครบหลัง restart container

---

## 13. เกณฑ์ยอมรับของโครงการ (Acceptance Criteria)

| # | เกณฑ์ | วิธีพิสูจน์ |
|---|---|---|
| AC-1 | `docker compose up -d --build` แล้วเว็บเข้าได้ที่ `http://localhost:3000` | Path A หรือบันทึก unverified |
| AC-2 | หน้า public 3 หน้าดึงข้อมูลจาก PostgreSQL จริง | เปลี่ยน DB แล้วเห็นผล |
| AC-3 | ค้นหา/กรอง/เรียง ทำงานถูกต้อง | manual + integration test |
| AC-4 | Admin login ปลอดภัยและป้องกันทุก write path | authz test |
| AC-5 | CRUD สินค้า + จัดการรูป + สถานะ ครบ | manual flow |
| AC-6 | รูป persist หลัง rebuild/restart | ทดสอบจริง |
| AC-7 | Seed idempotent; ≥ 12 devices ที่สมจริง | รันซ้ำ + นับ |
| AC-8 | ราคาเป็น integer THB | schema + test |
| AC-9 | ไม่มีข้อมูลอ่อนไหวใน public API (password, IMEI, serial) | ตรวจ payload หน้า public |
| AC-10 | UI ภาษาไทย, responsive 3 breakpoint, ไม่มีปุ่มหลอก | manual QA |
| AC-11 | lint + typecheck + build + test ผ่าน | รันคำสั่ง |
| AC-12 | ไม่มี secret ใน git | `git status`, grep, `.gitignore` |
| AC-13 | README อธิบายการติดตั้ง/ดีพลอยได้จริง | ทำตามบน DB สะอาด |
| AC-14 | Contact channels มาจาก env ทั้งหมด | ตั้ง env แล้วดูผล |
| AC-15 | Dependency ตรงตามตาราง 3.2 (pin exact) | ตรวจ `package.json` |

---

## 14. ความเสี่ยงและแนวทางแก้ (Potential Risks and Solutions)

| # | ความเสี่ยง | ผลกระทบ | แนวทางแก้ |
|---|---|---|---|
| R-1 | Docker daemon ไม่ทำงานใน environment | ตรวจ Path A ไม่ได้ | ใช้ dual-path; พิสูจน์ด้วย Path B ทุกเฟส; บันทึก Path A เป็น unverified พร้อมคำสั่งให้รันเอง |
| R-2 | โมเดลเล็กเลือก Prisma v7 โดยไม่ตั้งใจ (CLI แนะนำ latest) | schema/config พังยกชุด (ESM, driver adapter, output path) | pin 6.19.3 exact; ห้าม `npm update`; เตือนใน `AGENTS.md` และหัวข้อ 3.4 |
| R-3 | TypeScript 7 เข้ามาแทน 5.9 จาก `npm install typescript` | build พัง | pin `typescript: 5.9.3` exact |
| R-4 | Tailwind v4 config ต่างจาก v3 | style ไม่ติด | ใช้ CSS-first config เท่านั้น; ห้ามสร้าง `tailwind.config.ts` แบบ v3 |
| R-5 | รูปหายหลัง rebuild | AC-6 fail | ใช้ named volume `uploads_data` + serve ผ่าน route handler + ทดสอบ restart |
| R-6 | Path traversal ที่ image route | ช่องโหว่ความปลอดภัย | allowlist regex + resolve ภายใน `UPLOAD_DIR` + test |
| R-7 | อัปโหลดไฟล์อันตราย | XSS/กู้คืนไม่ได้ | ตรวจ magic bytes + re-encode ด้วย sharp + UUID name |
| R-8 | Search/filter หลายเงื่อนไขทำ Prisma query ผิด | ผลลัพธ์ผิด | สร้าง `where` จาก schema ทีละเงื่อนไข + integration test ทุก combination หลัก |
| R-9 | Seed สร้างข้อมูลซ้ำ | ข้อมูลเบิ้ล | upsert ด้วย natural key (`sku`, `slug`, `@@unique([brandId,name])`) + unique constraint |
| R-10 | Next.js cache แสดงข้อมูลเก่าหลัง admin แก้ | ผู้ใช้เห็นข้อมูลผิด | `revalidatePath` ใน actions + ตั้ง dynamic ที่เหมาะสม; test |
| R-11 | `sharp`/Prisma บน Alpine | native error | ใช้ `bookworm-slim` (glibc) เป็น base |
| R-12 | `middleware` ถูกเข้าใจผิดว่าเป็นการป้องกันพอ | ช่องโหว่ authz | บังคับ `requireAdmin()` ทุก mutation; เขียนในเอกสารและ comment ชัด |
| R-13 | cookie `Secure` ทำให้ dev/test ล็อกอินไม่ได้ | ทดสอบไม่ได้ | `Secure` = `NODE_ENV === 'production' && COOKIE_SECURE !== 'false'`; เพิ่ม env `COOKIE_SECURE` (ตั้ง `false` เฉพาะทดสอบ production build บน HTTP ท้องถิ่น) |
| R-14 | Rate limiter in-memory รีเซ็ตเมื่อ restart / ไม่ทำงานหลาย instance | brute force ได้บางช่วง | ยอมรับใน v1 (single instance) และบันทึกเป็นงานอนาคต |
| R-15 | ฟอร์ม admin ใช้ Server Action กับไฟล์ใหญ่ | timeout/หน่วยความจำ | จำกัดขนาด + อัปโหลดทีละ batch |
| R-16 | ข้อมูล demo ไม่สมจริง/ราคาเพี้ยน | คุณภาพเดโมต่ำ | กำหนดตาราง seed ให้ชัดใน `prisma/seed.ts` และตรวจด้วยตา |
| R-17 | ไม่มี migration policy ชัดเจน | schema drift | หลัง init ห้าม `migrate dev` ใน production; ใช้ `migrate deploy` เท่านั้น |

---

## 15. ฟีเจอร์ที่ยกเว้นอย่างชัดเจน (Explicitly Excluded Features)

- Customer accounts / registration / login
- Shopping cart, checkout, payment gateway
- Reservation/booking, shipping/delivery tracking
- Multi-vendor marketplace
- Analytics/metrics dashboard
- Reviews/ratings/comments จากผู้ใช้
- Wishlist/favorites
- Email/SMS/push notification
- i18n หลายภาษา (UI ไทยเท่านั้น)
- Object storage/CDN/third-party image hosting
- Elasticsearch/external search engine
- Redis/cache server/message queue
- Microservices/monorepo tooling
- Mobile app
- Full IMEI/serial storage หรือการเปิดเผยต่อสาธารณะ
- ระบบ reset password ผ่านอีเมล (ใช้ script แทน)

---

## 16. ความเป็นไปได้ในการขยายในอนาคต (Future Extension Possibilities)

แผนนี้ออกแบบให้ต่อยอดได้โดยไม่ต้องรื้อ:

| ฟีเจอร์ | ช่องทางขยาย |
|---|---|
| ระบบตะกร้า/จอง | เพิ่มตาราง `Reservation`/`Cart` และเปลี่ยน `Device.status` ให้มี RESERVED |
| ชำระเงินออนไลน์ | เพิ่ม service ชำระเงิน (ภายนอก) และตาราง `Order`/`Payment` |
| Multi-vendor | เพิ่ม `Store`/`Vendor` และ FK ใน `Device` |
| หลายรูปหลายขนาด | เพิ่มการ generate variants ด้วย sharp ตอน upload (เก็บใน subfolder) |
| Object storage | เปลี่ยน layer `src/lib/storage/*` ให้เป็น adapter ไป S3/R2 โดยไม่แตะ UI |
| Multi-admin + roles ละเอียด | ขยาย `AdminRole` + ตาราง permission |
| Audit log | เพิ่มตาราง `AuditLog` บันทึก action ของ admin |
| IMEI/serial | เพิ่มตาราง `DevicePrivateInfo` (1-1) ที่ query เฉพาะ admin |
| ค้นหาขั้นสูง | เพิ่ม PostgreSQL full-text search หรือ pg_trgm |
| Analytics | เพิ่มตาราง event/metric (ภายนอกขอบเขตปัจจุบัน) |
| i18n | เพิ่ม dictionary + `next-intl` |
| CSP เข้ม | ปรับจาก report-only เป็น enforcing หลังเก็บ inline script |

---

## 17. สรุปการทบทวนแผน (Plan Review)

### 17.1 ตรวจสอบ requirements ครบถ้วน
| requirements | ที่อยู่ในแผน |
|---|---|
| Tech stack ที่กำหนด | หัวข้อ 3 (pin เวอร์ชันจริงจาก registry) |
| Public pages 3 หน้า + Admin 4 หน้า | หัวข้อ 6, 7 และ phase 2/3 |
| Data model แบบ unique device | หัวข้อ 5 |
| สถานะ DRAFT/AVAILABLE/SOLD/ARCHIVED | หัวข้อ 5.2 |
| ราคาเป็น integer THB | หัวข้อ 5.4 |
| ไม่เปิดเผย IMEI/serial | หัวข้อ 10.5, 15 |
| Contact จาก env | หัวข้อ 9.6 |
| ข้อมูลจริงไม่ใช่ mock | phase 2 acceptance |
| Admin auth ปลอดภัย | หัวข้อ 7, 10 |
| Docker 2 services + volumes | หัวข้อ 9 |
| Seed idempotent ≥ 12 รายการ | phase 1 task 1.8 |
| 5 เฟส | หัวข้อ 11 |
| กลยุทธ์สำหรับโมเดลเล็ก | หัวข้อ 11 + กฎในเฟส |

### 17.2 ตรวจสอบ contradiction/overengineering
- **ตัดออกแล้ว:** ไม่มีตาราง session (stateless JWT), ไม่มี Redis, ไม่มี service แยก, ไม่มี repository layer/DI
- **ตรวจพบและแก้:** planner พบว่า Prisma/TypeScript "latest" บน npm กระโดดไป v7/v8 และ TS 7 ซึ่งจะทำให้ Next.js 15 ที่ pin ไว้เสี่ยงพัง → ระบุ pin exact + ห้ามอัปเกรด (R-2, R-3, หัวข้อ 3.4)
- **ตรวจพบและแก้:** Docker daemon ไม่ทำงานใน environment นี้ → กำหนด dual-path + ยอมรับ Path A เป็น unverified ได้ (R-1, หัวข้อ 9.8)
- **ตรวจพบและแก้:** `public/` ไม่คงอยู่เมื่อ rebuild → เปลี่ยนเป็น volume + route handler (AD-5, หัวข้อ 8)
- **ตรวจพบและแก้:** middleware ไม่ใช่ชั้นความปลอดภัย → บังคับ guard ใน server layer (หัวข้อ 7.3, R-12)

### 17.3 ข้อจำกัดที่บันทึกไว้ (Known limitations)
1. Rate limiter เป็น in-memory → ใช้ได้กับ single instance เท่านั้น
2. รูปทั้งหมดที่อัปโหลดแล้วเข้าถึงได้แบบ public ถ้ามี URL (ชื่อไฟล์ UUID ช่วยลดการเดา)
3. ไม่มี CSRF token แบบ stateful (พึ่ง origin check ของ Next.js + `SameSite=Lax`)
4. Path A (Docker) อาจไม่ถูกตรวจใน session ที่ daemon ไม่ทำงาน

### 17.4 จุดที่ผู้ implement ต้องยืนยันด้วยตนเอง (Unverified assumptions)
- Docker build จริงใน environment เป้าหมาย (`docker compose up -d --build`) ยังไม่เคยรันในเซสชันนี้
- จำนวนและความสมจริงของข้อมูล demo ขึ้นกับการตัดสินใจใน `seed.ts`
- หน้าตาสุดท้ายของ UI ต้องตรวจด้วยตา (แผนระบุได้แค่ทิศทาง)

---

## ภาคผนวก A — ลำดับการทำแบบสั้น (Execution Order)

```
Phase 1 (1.1 → 1.13)  → ยืนยัน AC Phase 1
Phase 2 (2.1 → 2.12)  → ยืนยัน AC Phase 2
Phase 3 (3.1 → 3.16)  → ยืนยัน AC Phase 3
Phase 4 (4.1 → 4.6)   → ยืนยัน AC Phase 4
Phase 5 (5.1 → 5.10)  → ยืนยัน AC Phase 5 + AC-1..AC-15
```

## ภาคผนวก B — หมายเหตุสำหรับการรัน seed

- Seed ต้อง idempotent: ใช้ `upsert` โดยอิง `sku` (Device), `slug` (Brand/PhoneModel/Device), `@@unique([brandId, name])` (PhoneModel)
- ต้องระบุชัดว่าเป็นข้อมูลสาธิต เช่น SKU ขึ้นต้น `DEMO-`
- ต้องไม่ลบข้อมูลจริงของผู้ใช้: ห้ามใช้ `deleteMany()` แบบไม่จำกัด
- รันได้เฉพาะเมื่อ `RUN_SEED=true` ใน Docker; ในเครื่อง dev รันได้ผ่าน `npm run db:seed`
- Seed **ไม่สร้าง** `DeviceImage` ที่อ้าง placeholder SVG (ดู §8.5); การแสดงรูป fallback เป็นหน้าที่ของ UI

## ภาคผนวก C — ลำดับ First-run Initialization

ใช้สำหรับการติดตั้งครั้งแรก (ทั้ง Path A Docker และ Path B local):

```
1) cp .env.example .env                      # แล้วตั้ง POSTGRES_*, DATABASE_URL, JWT_SECRET (openssl rand -base64 48), ค่า contact
2) npm ci                                    # ใช้ lock file ที่ commit ไว้
3) npx prisma migrate deploy                 # production migration — ห้าม migrate dev บน production (R-17)
4) RUN_SEED=true npx prisma db seed          # ครั้งแรกเท่านั้น แล้วตั้ง RUN_SEED=false (seed ต้อง idempotent)
5) npm run admin:create                      # ใช้ ADMIN_EMAIL / ADMIN_PASSWORD จาก env — ห้าม hardcode
6) npm run build && npm start                # ตรวจ GET / ได้ 200
```

ใน Path A (Docker) ขั้นตอน 3–6 ทำงานใน `docker/entrypoint.sh` โดยอัตโนมัติ (seed เฉพาะเมื่อ `RUN_SEED=true`)
สำหรับ admin ใน Docker ให้รัน `docker compose exec web npm run admin:create`

## ภาคผนวก D — บันทึกเวอร์ชัน dependency (ยืนยันเมื่อ 2026-10-16)

ยืนยันกับ npm registry/GitHub release แล้ว (Phase 1):

| package | pin | ผลยืนยัน |
|---|---|---|
| next | 15.5.28 | มีจริง (`latest`=16.4.2 — ห้ามใช้ `latest`) |
| react / react-dom | 19.1.10 | มีจริง (`latest`=19.3.1) |
| typescript | 5.9.3 | มีจริง (`latest`=7.0.2 — ห้ามใช้ `latest`) |
| eslint | 9.39.5 | มีจริง (`latest`=10.x) |
| eslint-config-next | 15.5.28 | มีจริง (peer eslint ^7\|^8\|^9) |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | มีจริง |
| prisma / @prisma/client | 6.19.3 | มีจริง (**`latest`=8.0.0-rc pre-release — อันตราย**) |
| zod | 3.25.76 | มีจริง (`latest`=4.x) |
| jose / bcryptjs / sharp | 6.2.12 / 3.0.3 / 0.35.5 | มีจริง |
| clsx / tailwind-merge | 2.1.1 / 3.7.0 | มีจริง |
| lucide-react | 1.57.0 | มีจริง (`latest`=1.53.0 ต่ำกว่า → ต้อง pin exact) |
| @fontsource-variable/noto-sans-thai | 5.3.0 | มีจริง |
| @types/node | 22.20.5 | มีจริง |
| @types/react / @types/react-dom | 19.1.17 / 19.1.11 | มีจริง |
| jsdom | 30.1.3 | มีจริง |
| @testing-library/jest-dom | 7.0.1 | มีจริง |
| class-variance-authority | 0.7.1 | มีจริง |
| Docker base | `node:24.22.0-bookworm-slim`, `postgres:17.11-alpine` | tag มีจริงบน Docker Hub |

**ข้อบังคับ:** ระบุเวอร์ชัน exact ทุกครั้ง ห้ามใช้ `@latest` / `npm update` (เพราะ dist-tag `latest` ของ next/typescript/eslint/zod/prisma ต่างจากที่ pin ไว้)

