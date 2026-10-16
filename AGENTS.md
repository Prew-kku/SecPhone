# AGENTS.md — SecondPhone Store

บันทึกความรู้เฉพาะโปรเจกต์สำหรับ agent/session ถัดไป อัปเดตทุกครั้งที่พบข้อเท็จจริงใหม่

## สถานะปัจจุบัน
- **Phase 1: เสร็จครบ (1.1–1.13)** — โครง Next.js 15 + TS + Tailwind 4 + Prisma 6 + migration + Prisma client singleton + seed idempotent (14 devices) + placeholder assets + `scripts/create-admin.ts` + `.dockerignore` + Dockerfile/compose/entrypoint
- **Phase 2: Public Storefront เสร็จและตรวจแล้ว** — `/`, `/phones`, `/phones/[slug]`, sitemap, robots, `/api/images/[...path]`
- **Phase 3: Admin System เสร็จครบ (3.1–3.16) และตรวจใน container จริงแล้ว (2026-10-16)** — login/logout, session JWT (httpOnly cookie), bcrypt cost 12, rate limit, CRUD device, upload รูป (sharp→webp), status/featured/soft-delete, authorization matrix (`requireAdmin` ทุก server action)
- **Security & Railway Hardening เสร็จและตรวจแล้ว (2026-10-16)** — branch `security/railway-hardening` (14 tasks): JSON-LD escape + regression test, image endpoint symlink defense, `/api/health`, seed non-destructive + `SEED_DEMO_ADMIN`, `SITE_URL`/Railway-aware base URL, demo-mode disclosure, Docker production fixes, vitest infra, README + `docs/DEPLOYMENT.md`
- ทำจริงกับ PostgreSQL แล้ว (ไม่ใช่ UNVERIFIED) — migration apply + `migrate deploy` + seed idempotent + query ผ่าน Prisma client จริง
- **Docker Path A ตรวจซ้ำพร้อม Phase 3 (2026-10-16)** — `docker compose up -d --build` สำเร็จ, `db` + `web` healthy, login ผ่าน cookie จริงได้ (200), จำกัด login 5 ครั้ง/15 นาทีทำงาน (ครั้งที่ 6 = 429), รูปใน volume ยังเสิร์ฟหลัง `restart` (200), symlink/path traversal → 404, `sharp` โหลดได้ใน container (webp 76 bytes)
- ยังไม่ทำ: **Phase 4 (Integration)**, **Phase 5 (Testing & Docs)**
- ยัง **UNVERIFIED**: การ deploy ขึ้น Railway จริง (ไม่มี credential/target)

### Phase 3 — Admin System บทเรียนสำคัญ (2026-10-16)

1. **`isTrustedOrigin` ต้องอ่าน host จาก header ไม่ใช่ `request.url`** — ใน container `HOSTNAME=0.0.0.0` ทำให้ `request.url` เป็น `http://0.0.0.0:3000` แต่เบราว์เซอร์ส่ง `Origin: http://localhost:3000` → login POST ได้ **403 ทุกครั้ง** (เจอเฉพาะตอนรันใน Docker ไม่เจอใน unit test ที่สร้าง `Request` เอง)
   - แก้: `requestHost()` อ่านลำดับ `X-Forwarded-Host` → `Host` → host ของ `request.url` (ดู `src/lib/auth/origin.ts`)
   - มี regression test 3 ตัวใหม่ใน `tests/unit/slug-and-origin.test.ts` (เคส container 0.0.0.0, X-Forwarded-Host ของ Railway, และยังปฏิเสธ origin แปลก)
   - **บทเรียน:** ตรรกะที่พึ่ง `request.url` ต้องทดสอบใน container จริง ไม่ใช่แค่ unit test

2. **middleware ทำหน้าที่แค่ routing** — การตรวจสิทธิ์จริงอยู่ที่ `requireAdmin()` ในทุก server action (JWT + สถานะบัญชีใน DB + role) ไม่เชื่อ middleware อย่างเดียว

3. **route handler ไม่มี origin/CSRF check ให้เอง** (ต่างจาก Server Action) → `/api/auth/login` และ `/api/auth/logout` เรียก `isTrustedOrigin()` เอง; logout ไม่ต้อง auth แต่ต้องผ่าน origin (พิสูจน์ใน container: ไม่มี Origin → 403)

4. **login ต้องไม่เป็น oracle** — ไม่พบผู้ใช้ → เทียบ dummy hash (คงเวลา), ข้อความ error กลาง ๆ เหมือนกันทุกกรณี, ตรวจ `isActive` แล้วยังตอบกลาง ๆ

5. **volume `/app/uploads` ต้องเขียนได้โดย non-root (uid 1001)** — ตรวจแล้วในคอนเทนเนอร์: `touch /app/uploads/devices/.writetest` ผ่าน; Railway volume เป็น root ต้องตั้ง `RAILWAY_RUN_UID=0` (ดู `docs/DEPLOYMENT.md`)

6. **rate limiter เป็น in-memory** — จำกัดต่อ process ไม่ distributed; บน Railway หลาย instance/restart ตัวนับแยกกัน → เป็น defense-in-depth เท่านั้น (ไม่กล่าวอ้างว่า distributed)

7. **`sharp` ถูก trace เข้า `.next/standalone`** — พบ `@img/sharp-linux-x64-0.35.5.node` ใน standalone output → Docker build COPY ได้; ยืนยันด้วย `node -e "require('sharp')"` ใน container

### Security & Railway Hardening — บทเรียนสำคัญ (2026-10-16)

1. **JSON-LD ต้อง escape ก่อนใส่ `dangerouslySetInnerHTML`** — `JSON.stringify` ตรง ๆ ทำให้ข้อมูลจาก DB ที่มี `</script>` ปิดแท็กแล้วแทรก JS ได้ (XSS)
   - ใช้ `serializeJsonLd()` จาก `src/lib/json-ld.ts` (escape `<` `>` `&` `\u2028` `\u2029`)
   - มี regression test: `tests/unit/json-ld.test.ts`

2. **`/api/images` ต้องกัน symlink escape ไม่ใช่แค่ path traversal** — `path.resolve` อย่างเดียวพอสำหรับ `..` แต่ไม่จับ symlink ที่ชี้ `/etc/passwd`
   - ต้อง `realpath` แล้วเช็ค containment (`isInsideUploadRoot`) หลัง realpath
   - 404 ต้อง `Cache-Control: no-store` (ห้าม cache ผลลบ เพราะไฟล์อาจมาทีหลัง)
   - พิสูจน์แล้ว: สร้าง symlink → `/api/images/...` ตอบ 404 ไม่คืนเนื้อหา

3. **Prisma `binaryTargets` ต้องตรงกับ base image** — image build (`node:24-bookworm-slim`) **ไม่มี** libssl ตอน `prisma generate` → auto-detect ได้ `openssl-1.1.x` แต่ runtime เป็น 3.0.x → `Prisma Client could not locate the Query Engine for runtime "debian-openssl-3.0.x"`
   - แก้: ตั้ง `binaryTargets = ["native", "debian-openssl-3.0.x"]` ใน `prisma/schema.prisma` **เสมอ**

4. **ห้าม COPY `node_modules/.bin/prisma` ใน Dockerfile** — `.bin/prisma` เป็น symlink → Docker dereference เป็นไฟล์จริง → `__dirname` ผิด → `ENOENT ... prisma_schema_build_bg.wasm`
   - แก้: สร้าง symlink เอง (`ln -sf ../prisma/build/index.js`) แล้ว verify ด้วย `prisma --version` ตอน build

5. **ห้าม COPY Prisma CLI ทีละแพ็กเกจ** — `@prisma/config` ต้องใช้ `effect` (dependency ข้ามแพ็กเกจ) → `Cannot find module 'effect'`
   - แก้: แยก stage `cli` แล้ว `npm install prisma tsx bcryptjs` ให้ dependency ครบ แล้ว COPY `node_modules` ทั้งชุด (merge กับ standalone)

6. **seed ต้องเป็น create-only โดยค่าเริ่มต้น** — `upsert` ที่มี `update:` เต็มจะทับราคา/สถานะที่ผู้ดูแลแก้ทุกครั้งที่รัน
   - ค่าเริ่มต้น: `update: {}` (no-op); เขียนทับเฉพาะเมื่อ `SEED_OVERWRITE=true`
   - พิสูจน์แล้ว: แก้ราคา → reseed → ราคาไม่เปลี่ยน; `SEED_OVERWRITE=true` → กลับเป็นค่า seed
   - `SEED_DEMO_ADMIN` ถูก implement จริงแล้ว (เดิมมีแต่ในคอมเมนต์)

7. **Railway: volume เป็น root** — image รัน non-root (uid 1001) จะเขียน `/app/uploads` ไม่ได้ ต้องตั้ง `RAILWAY_RUN_UID=0` (ดู `docs/DEPLOYMENT.md`)
   - Railway inject `PORT` เอง — `server.js` + entrypoint อ่านอยู่แล้ว
   - `SITE_URL` ควร normalize: Railway ให้ `RAILWAY_PUBLIC_DOMAIN` เป็น host เปล่า ๆ (ไม่มี scheme) → `src/lib/site-url.ts` เติม `https://` ให้และไม่ throw เมื่อค่าผิด

8. **Demo data ต้อง disclose** — เว็บที่มี claim "ตรวจสภาพทุกเครื่อง"/"รับประกัน" โดยข้อมูลเป็นตัวอย่างคือ misleading
   - `DEMO_MODE` (ค่าเริ่มต้น `true`) → `<DemoBanner>` + ข้อความกำกับที่ hero/หน้ารายละเอียด
   - fail-safe: ถ้าไม่ได้ตั้งถือว่าเป็น demo (เตือนไว้ก่อน)

9. **`npm audit` advisory อยู่ใน tooling ไม่ใช่ runtime path** — postcss (ฝังมากับ next) เป็น build-time CSS, prisma/@prisma/config/deepmerge-ts ใช้เฉพาะ CLI
   - แก้ต้องอัป next 16 / prisma 7 (major) — บันทึกเหตุผลในคอมเมนต์ `Dockerfile`
   - runtime ใช้ `@prisma/client` ซึ่งไม่อยู่ใน advisory

10. **vitest config ต้องเป็น `.mts`** — `vitest.config.ts` ถูกโหลดเป็น CommonJS แล้วเตือน ESM; เปลี่ยนเป็น `vitest.config.mts` หายเตือน (package.json ไม่ได้ตั้ง `"type": "module"`)

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
- **Railway deploy จริง** — ไม่ได้ deploy ขึ้น Railway ในเซสชันนี้ (ไม่มี credential/target); config (`railway.json`, entrypoint, `SITE_URL` fallback) เตรียมไว้และตรวจด้วย unit test + Docker build บนเครื่องแล้ว
- **การอัปโหลดรูปจริงผ่าน admin** — พิสูจน์แล้วว่า pipeline `sharp` ทำงาน (เขียน webp ผ่าน `sharp` ใน container แล้วเสิร์ฟผ่าน `/api/images` ได้ 200); flow อัปโหลดผ่าน UI เบราว์เซอร์ยังไม่ได้ทดสอบ end-to-end (ข้อจำกัดของ browser tooling ในเซสชันนี้) แต่ server action + storage ถูกทดสอบด้วย integration test

### ตรวจแล้ว (Docker Path A) — 2026-10-16
- `docker compose up -d --build` สำเร็จ, `db` + `web` healthy ทั้งคู่
- `prisma migrate deploy` + `prisma db seed` (14 devices / 5 brands / 10 models / 1 admin) ทำงานใน container จริง
- standalone build โหลด `@prisma/client` ได้ (แก้ binaryTargets แล้ว) — พิสูจน์ด้วย `/api/health` = `{"status":"ok","database":"up"}`
- รูปคงอยู่หลัง restart (volume `uploads-data`), `/api/images/...` ตอบ 200
- symlink escape ถูกบล็อก (404, no-store)
- smoke test 21/21 ผ่าน; unit test 27/27 ผ่าน; lint + typecheck + build สะอาด

## หมายเหตุสำหรับเฟสถัดไป (Phase 4 — Integration)
- **Phase 3 เสร็จแล้ว** (login, CRUD, upload, authorization matrix) — โครงที่ใช้: `src/app/admin/{login,(protected)/*}`, `src/components/admin/*`, `src/lib/{auth,mutations,queries,storage,validation}/*`, `src/app/api/{auth/*,images/[...path],health}`
- ต่อที่เหลือของ Phase 4: ตรวจ contact links จาก env (`LINE_ID`/`FACEBOOK_URL`/`PHONE_NUMBER`), loading/error/empty states ที่ยังขาด, และกลั่นกรอง integration ให้ครบ
- **`UPLOAD_DIR` เขียนไฟล์:** ใช้ `getUploadRoot()` จาก `src/lib/storage/upload-dir.ts` เป็นฐานเดียวกับ image route เพื่อให้อ่าน/เขียนตรงกัน
- ไฟล์ที่อัปโหลดต้องตั้งชื่อ `<uuid-v4>.webp` ใต้ `devices/<deviceId>/` เพื่อให้ผ่าน allowlist ของ `/api/images`
- ถ้ารัน `next start` บนเครื่อง ให้ระวังว่า `output: standalone` เตือน — ใน dev/verify ใช้ `npm run dev` หรือ `node .next/standalone/server.js`
- `lucide-react@1.57` ไม่มี brand icon — ใช้ `Globe`/`MessageCircle`/`Phone`
- **ห้าม finalize การ login โดยไม่รันใน container** — บทเรียน origin/`request.url` (ดูหัวข้อ Phase 3 ข้อ 1)

## หมายเหตุสำหรับเฟสถัดไป (Phase 1 เดิม — เก็บไว้)
- Task 1.12 ต้องพิจารณาย้าย `prisma` CLI เข้า dependencies **หรือ** คัดลอกเข้า runner image ตาม PLAN §9.2 (ปัจจุบันยังเป็น devDependency → entrypoint ต้องมี prisma CLI ให้ `migrate deploy` ได้)
