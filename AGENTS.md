# AGENTS.md — SecondPhone Store

บันทึกความรู้เฉพาะโปรเจกต์สำหรับ agent/session ถัดไป อัปเดตทุกครั้งที่พบข้อเท็จจริงใหม่

## สถานะปัจจุบัน
- **Phase 1: เสร็จครบ (1.1–1.13)** — โครง Next.js 15 + TS + Tailwind 4 + Prisma 6 + migration + Prisma client singleton + seed idempotent (12 devices) + placeholder assets + `scripts/create-admin.ts` + `.dockerignore` + Dockerfile/compose/entrypoint
- **Phase 2: Public Storefront เสร็จและตรวจแล้ว** — `/`, `/phones`, `/phones/[slug]`, sitemap, robots, `/api/images/[...path]`
- ทำจริงกับ PostgreSQL แล้ว (ไม่ใช่ UNVERIFIED) — migration apply + `migrate deploy` + seed idempotent + query ผ่าน Prisma client จริง
- ยังไม่ทำ: **Phase 3 (Admin System)**, Phase 4 (Integration), Phase 5 (Testing/Docs)
- **Path A (Docker) ยัง UNVERIFIED** — ยังไม่ได้รัน `docker compose up -d --build` ในเซสชันนี้ (ดูหัวข้อ Docker ด้านล่าง)

### Phase 2 — บทเรียนสำคัญ (สำคัญมากสำหรับเฟสถัดไป)

1. **ห้ามมี `loading.tsx` ที่ระดับ route ที่มี `notFound()`** — route-level `loading.tsx` สร้าง Suspense boundary ทำให้ Next เริ่ม stream และส่ง **HTTP 200 ไปแล้ว** ก่อนที่ `notFound()` จะทำงาน → slug ที่ไม่มีจะคืน 200 แทน 404
   - วิธีที่ใช้ได้จริง: **ลบ** `src/app/loading.tsx` และ `src/app/phones/loading.tsx` แล้วใช้ `<Suspense>` ภายใน component แทน (ดู `catalog-results.tsx` + `catalog-results-skeleton.tsx`, `home-catalog.tsx` + `home-catalog-skeleton.tsx`)
   - ตรวจ 404 ต้องดู **status code** (`curl -o /dev/null -w '%{http_code}'`) ไม่ใช่แค่เนื้อหาในหน้าว่ามีคำว่า 404

2. **`src/app/page.tsx` ต้องมี `export const dynamic = 'force-dynamic'`** — ถ้าดึง DB ผ่าน async child component ใน Suspense, Next จะ prerender homepage เป็น static (`○`) แล้วข้อมูลสินค้าค้าง ณ เวลา build
   - เช็คได้จาก build output: `/` ต้องเป็น `ƒ (Dynamic)` ไม่ใช่ `○ (Static)`

3. **`UPLOAD_DIR` ต้องว่างใน `.env` local** — `.env` เดิมตั้ง `UPLOAD_DIR="/app/uploads"` (ค่าของ container) ทำให้รัน `npm start` บนเครื่องแล้ว `/api/images/*` คืน 404 แม้ไฟล์มีจริง
   - `docker-compose.yml` override เป็น `/app/uploads` อยู่แล้ว จึงไม่ต้องพึ่งค่าจาก `.env`
   - helper: `src/lib/storage/upload-dir.ts` → `getUploadRoot()` (เว้นว่าง = `./uploads`), `isInsideUploadRoot()`
   - **สำคัญ:** `process.env.UPLOAD_DIR ?? default` ไม่จับ empty string → ต้อง `.trim()` แล้วเช็ค `.length > 0`

4. **allowlist รูป:** `src/lib/storage/paths.ts` → `resolveImageSrc()`/`isUploadedImageFilename()` บังคับ pattern `devices/<id>/<uuid-v4>.webp` เท่านั้น. รูปที่อัปโหลดจริงเท่านั้นที่ผ่าน `/api/images`; placeholder เป็น static asset ใน `public/placeholders/` (ไม่ผ่าน API)
   - ทดสอบ image route ต้องใช้ชื่อที่ตรง pattern จริง เช่น `devices/testdev/11111111-2222-3333-4444-555555555555.webp` (ชื่อมั่วจะได้ 404 ซึ่งถูกต้อง)

5. **placeholder มีสีตามเครื่อง** — `SafeImage` รับ prop `tint` (ข้อความสีไทย) แล้วสร้าง data-URI SVG ผ่าน `demoTintFor()` ใน `paths.ts`. การ์ดและแกลเลอรีส่ง `device.color` เข้าไป

6. **`lucide-react@1.57` ไม่มี brand icon** — ไม่มี `Facebook`/`Instagram`. ใช้ `Globe` (Facebook), `MessageCircle` (LINE), `Phone` (โทร) แทน

7. **ตรวจ 404 ด้วย `curl` ให้ครบทุกเส้น:** `/phones/<ไม่มี>` → 404, `/api/images/<ผิด pattern>` → 404, `/nonexistent` → 404, `/admin` → 404 (ยังไม่ทำ Phase 3)

8. **Pagination ต้อง clamp หน้าที่เกินขอบเขต** — `getCatalog()` ใน `src/lib/queries/catalog.ts` นับ `total` **ก่อน** แล้ว `page = Math.min(requested, pageCount)` มิฉะนั้น `?page=99` จะโชว์ "พบ 12 รายการ" คู่กับ empty state (ขัดกัน)
   - หมายเหตุ: เป็นการ query count + findMany แยกกัน 2 ครั้ง (เดิมใช้ `Promise.all`) — ยอมรับได้เพราะ count ต้องเสร็จก่อนเพื่อ clamp

9. **Test seed/admin ที่เป็น TS script ต้องวางไฟล์ใต้ `./scripts/`** — `npx tsx /tmp/x.ts` จะ resolve `@prisma/client` ไม่ได้ (นอก project root) → เขียนแล้วลบทิ้งตามกฎ FILE_SYSTEM_GUIDELINES

### Phase 1 — Task 1.5–1.7 (รายละเอียดเดิม ยังถูกต้อง)
- `prisma/schema.prisma` — 5 models (`Brand`, `PhoneModel`, `Device`, `DeviceImage`, `AdminUser`), 3 enums (`ConditionGrade`, `DeviceStatus`, `AdminRole`) ตรงตาม PLAN §5
- `prisma/migrations/20261016054316_init/migration.sql` — migration แรก
- `src/lib/prisma.ts` — PrismaClient singleton (globalThis caching)
- `.env.example` + `.env` (local, gitignored) — `DATABASE_URL`, `POSTGRES_*`, contact, `JWT_SECRET`, `COOKIE_SECURE`, `UPLOAD_DIR`

### Dependency ของ Prisma (สำคัญ)
- `prisma@6.19.3` อยู่ใน **devDependencies** (ตาม PLAN §3.2) และ `@prisma/client@6.19.3` อยู่ใน **dependencies**
- `@prisma/client` มี `peerOptional prisma@"*"` → `npm audit --omit=dev` จึงยังนับ `prisma` CLI เป็น prod surface ด้วย (ดูหัวข้อ audit)
- `tsx@4.23.15` อยู่ใน devDependencies (ใช้ seed/scripts เฟสถัดไป)

### Schema decisions ที่ต้องรู้
- ใช้ `@@map` เป็น **snake_case** (`brands`, `phone_models`, `devices`, `device_images`, `admin_users`) ส่วน **ชื่อ column คง camelCase** (Prisma default) เช่น `"priceThb"`, `"deviceId"` → เวลาเขียน raw SQL ต้อง quote
- `Brand` **ไม่มี** `createdAt/updatedAt` (PLAN §5.2 ระบุแค่ id/name/slug) — model อื่นมีครบ
- FK delete rules (ยืนยันใน DB จริง): `device_images→devices` CASCADE, `devices→phone_models` RESTRICT, `devices→admin_users` SET NULL, `phone_models→brands` RESTRICT
- **ไม่มี** `imei`/`serialNumber` ใน `Device` (ตั้งใจ — PLAN §5.2)

## คำสั่งที่ใช้จริง (ยืนยันแล้ว)
| คำสั่ง | ผล |
|---|---|
| `npm ci` | ผ่าน (ใช้ `package-lock.json` ที่ commit) |
| `npm run dev` | บูตที่ :3000, `GET /` = 200 |
| `npm run lint` | ผ่าน (`eslint .`) |
| `npm run typecheck` | ผ่าน (`tsc --noEmit`) |
| `npm run build` | ผ่าน, สร้าง `.next/standalone/server.js` |
| `npm start` | ผ่าน, `GET /` = 200 + security headers ครบ |
| `npx prisma validate` | ผ่าน (ต้องมี `DATABASE_URL` มิฉะนั้น P1012) |
| `npx prisma generate` | ผ่าน → `node_modules/@prisma/client` |
| `npx prisma migrate dev --name <name>` | ผ่าน (apply จริงกับ Postgres) |
| `npx prisma migrate deploy` | ผ่าน + idempotent (รันซ้ำ = "No pending migrations") |
| `npx prisma migrate status` | ผ่าน → "Database schema is up to date!" |

## การรัน PostgreSQL สำหรับพัฒนา (Path B)
Docker daemon ไม่ได้ทำงานโดยค่าเริ่มต้น แต่**สามารถสตาร์ทได้**:
```bash
sudo dockerd > /tmp/dockerd.log 2>&1 &
sleep 10
sudo docker run -d --name sp-verify-db \
  -e POSTGRES_USER=sp_user -e POSTGRES_PASSWORD=sp_pass -e POSTGRES_DB=secondphone \
  -p 127.0.0.1:5432:5432 postgres:17-alpine
# รอ: sudo docker exec sp-verify-db pg_isready -U sp_user -d secondphone
```
`.env` ในเครื่องชี้ไป `localhost:5432` แล้ว (bind เฉพาะ 127.0.0.1 ไม่ expose ออกนอก)
- **หมายเหตุ:** container `sp-verify-db` นี้เป็นของชั่วคราวเพื่อ verify เท่านั้น ไม่ใช่ส่วนของ `docker-compose.yml` (Task 1.12)
- ฐานข้อมูลชื่อ `secondphone` ที่ migrate แล้วจะ**ว่างเปล่า** (ยังไม่มี seed — Task 1.8)
- `psql` ไม่มีในเครื่อง host → ใช้ `sudo docker exec sp-verify-db psql -U sp_user -d secondphone -c "..."`

## กฎสำคัญ (ห้ามละเมิด)
1. **ห้ามใช้ `next lint`** — deprecate ใน Next 15.5 ใช้ `eslint .` (`npm run lint`)
2. **ห้ามติดตั้งด้วย `@latest` หรือ `npm update`** — dist-tag `latest` ต่างจากที่ pin ไว้มาก:
   - `next` ต้อง 15.5.28 (`latest`=16.x)
   - `typescript` ต้อง 5.9.3 (`latest`=7.x)
   - `eslint` ต้อง 9.39.5 (`latest`=10.x)
   - `zod` ต้อง 3.25.76 (`latest`=4.x)
   - `prisma` ต้อง 6.19.3 (**`latest`=8.0.0-rc pre-release — อันตรายมาก**)
   - `lucide-react` ต้อง 1.57.0 (`latest`=1.53.0 ซึ่งต่ำกว่า)
3. **ห้ามสร้าง `tailwind.config.ts`** — ใช้ CSS-first: `@import "tailwindcss"` + `@theme` ใน `src/app/globals.css`
4. **pin เวอร์ชัน exact** ใน `package.json` (ไม่มี `^`/`~`) — ตรวจด้วย `grep -nE '[\^~][0-9]' package.json`
5. `next.config.ts` ต้องมี `output: 'standalone'` และ security headers 4 ตัว

## Environment
- Node.js v24.21.0, npm 11.19.1
- **Docker daemon ไม่ทำงาน** (CLI/compose ติดตั้งอยู่แต่ต้อง `sudo dockerd` ก่อน) → ใช้ Path B (local) ตรวจสอบเป็นหลัก
- ไม่มี `psql` ในเครื่อง

## เวอร์ชันที่ยืนยันกับ npm registry แล้ว (2026-10-16)
- dependencies: `next@15.5.28`, `react@19.1.10`, `react-dom@19.1.10`, `clsx@2.1.1`, `tailwind-merge@3.7.0`, `@fontsource-variable/noto-sans-thai@5.3.0`
- devDependencies: `typescript@5.9.3`, `@types/node@22.20.5`, `@types/react@19.1.17`, `@types/react-dom@19.1.11`, `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`, `eslint@9.39.5`, `eslint-config-next@15.5.28`, `eslint-config-prettier@10.1.8`, `prettier@3.9.10`, `@eslint/eslintrc@3.3.7`
- `@eslint/eslintrc` ต้องมี เพราะ Next 15 ใช้ legacy config → ต้องผ่าน `FlatCompat` ใน `eslint.config.mjs`

## npm audit — ผลหลัง Task 1.5–1.7 (2026-10-16) ประเมินแล้ว ยอมรับไว้ชั่วคราว

**`npm audit --omit=dev` = 5 รายการ (1 moderate, 4 high)** — เดิม 2 รายการก่อนติดตั้ง Prisma

| # | package | sev | advisory | path | prod/dev | fix |
|---|---|---|---|---|---|---|
| 1 | `postcss@8.4.31` | high | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-qx2v-qp2m-jg93, GHSA-fxqj-rqcc-2cmp | `next@15.5.28` → `node_modules/next/node_modules/postcss` | build-time เท่านั้น | ต้องอัป `next@16.4.2` (major) → ห้าม |
| 2 | `next@15.5.28` | moderate | ไม่มี advisory ของตัวเอง | ผ่าน `postcss` ข้างบน | build-time | แก้ทางเดียวกับข้อ 1 (ห้าม) |
| 3 | `deepmerge-ts@7.1.5` | high | GHSA-ggr8-5vv4-36mx (stack exhaustion เมื่อ merge recursive object graph) | `prisma@6.19.3` → `@prisma/config` → `deepmerge-ts` | **dev/CLI เท่านั้น** | ต้องอัป `prisma@7.x` (major) → ห้าม |
| 4 | `@prisma/config@6.19.3` | high | ผ่าน `deepmerge-ts` | เดียวกัน | dev/CLI | prisma 7 (ห้าม) |
| 5 | `prisma@6.19.3` | high | ผ่าน `@prisma/config` | devDependency + `peerOptional` ของ `@prisma/client` | dev/CLI | prisma 7 (ห้าม) |

**ดุลพินิจสำคัญ:**
- `@prisma/client@6.19.3` ประกาศ `peerOptional prisma@"*"` → npm audit นับ `prisma` CLI เป็น prod surface ด้วย ทั้งที่ `prisma` เป็น devDependency จริง
- `deepmerge-ts` ใช้ใน `@prisma/config` = "Internal package used to define and read Prisma configuration files" → โหลดเฉพาะตอน CLI อ่าน config **ไม่อยู่ใน query/runtime path ของ `@prisma/client`** → production Next.js ไม่โหลดโค้ดนี้
- ทั้ง 5 รายการ fix ได้เฉพาะด้วย **semver-major** (`next@16`, `prisma@7`) ซึ่งขัดกับ pin (AD-7, AD-8) → ไม่ทำในเฟสนี้
- **สรุป: ไม่มี known high-severity vulnerability ที่ exploitable ในเส้นทาง runtime/request handling ของ production** ทั้งหมดเป็น build/lint/CLI tooling

## UNVERIFIED (ยังไม่ยืนยัน — อย่ากล่าวอ้างว่าผ่าน)
- **Docker Path A** (`docker compose up -d --build`) — ยังไม่ได้รันในเซสชันนี้ เพราะไม่มี docker access; ไฟล์ Docker/entrypoint/compose พร้อมแล้วแต่ยัง **ไม่เคยทดสอบ end-to-end**
- **Prisma client ใน standalone build จริง** — ยังไม่ทดสอบว่า `node .next/standalone/server.js` โหลด `@prisma/client` ได้ (ต้องมี `outputFileTracingIncludes`) → **ต้องตรวจใน Phase 5**
- ไม่ได้ทดสอบ migrate ผ่าน network ของ docker compose (ทดสอบผ่าน 127.0.0.1 publish port เท่านั้น)
- **Phase 3 (Admin System) ยังไม่เริ่ม** — ทุกอย่างเกี่ยวกับ admin (`login`, CRUD, upload endpoint ที่เขียนไฟล์จริง) ยังไม่มี
- **ไม่มีการทดสอบอัตโนมัติ (vitest/playwright)** — การตรวจ Phase 1–2 ทำด้วย curl + build + browser manual ทั้งหมด

## หมายเหตุสำหรับเฟสถัดไป (Phase 3 — Admin System)
- ต้องสร้างก่อน: `src/lib/auth/*` (session cookie, bcryptjs verify), middleware/guard ป้องกัน `/admin` + server actions
- **`UPLOAD_DIR` เขียนไฟล์:** ใช้ `getUploadRoot()` จาก `src/lib/storage/upload-dir.ts` เป็นฐานเดียวกับ image route เพื่อให้อ่าน/เขียนตรงกัน
- ไฟล์ที่อัปโหลดต้องตั้งชื่อ `<uuid-v4>.webp` ใต้ `devices/<deviceId>/` เพื่อให้ผ่าน allowlist ของ `/api/images`
- ถ้ารัน `next start` บนเครื่อง ให้ระวังว่า `output: standalone` เตือน — ใน dev/verify ใช้ `npm run dev` หรือ `node .next/standalone/server.js`
- `lucide-react@1.57` ไม่มี brand icon — ใช้ `Globe`/`MessageCircle`/`Phone`

## หมายเหตุสำหรับเฟสถัดไป (Phase 1 เดิม — เก็บไว้)
- Task 1.12 ต้องพิจารณาย้าย `prisma` CLI เข้า dependencies **หรือ** คัดลอกเข้า runner image ตาม PLAN §9.2 (ปัจจุบันยังเป็น devDependency → entrypoint ต้องมี prisma CLI ให้ `migrate deploy` ได้)
