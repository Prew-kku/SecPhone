# syntax=docker/dockerfile:1

# ---------- Stage 1: deps — ติดตั้ง dependency ทั้งหมด (รวม dev) เพื่อ build ----------
FROM node:24.22.0-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Stage 2: builder — generate Prisma Client และ build Next.js ----------
FROM node:24.22.0-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL เป็น dummy สำหรับ prisma generate (ไม่เชื่อมต่อฐานข้อมูล)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
RUN npx prisma generate && npm run build

# หมายเหตุ npm audit (Task 3) — ทุก advisory อยู่ใน tooling ตอน build/CLI ไม่ใช่ path ที่รับ request
#   postcss 8.4.31 (ฝังมากับ next): XSS/path-traversal เป็นเรื่อง build-time CSS,
#     ไม่ได้ประมวลผล CSS จากผู้ใช้ → ไม่ exploit ได้; แก้ต้องอัปเป็น next 16 (นอกสโคปของโปรเจกต์)
#   prisma / @prisma/config / deepmerge-ts: ใช้เฉพาะ CLI (migrate/seed) ที่รันด้วย env ที่เราคุม
#     ส่วน runtime ใช้ @prisma/client ซึ่งไม่อยู่ใน advisory
# ทางแก้ระยะยาว = อัป Next 16 + Prisma 7 ซึ่งเป็นการเปลี่ยน major ของทั้ง stack (ต้องมีแผนแยก)

# ---------- Stage 3: cli — Prisma CLI + tsx สำหรับ migrate/seed ตอน runtime ----------
# แยก stage เพราะการ COPY ทีละแพ็กเกจจาก deps ทำให้ dependency ข้ามแพ็กเกจหายไป
# (เช่น @prisma/config ต้องใช้ effect) — ติดตั้งชุด CLI แบบครบ dependency แทน
FROM node:24.22.0-bookworm-slim AS cli
WORKDIR /cli
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --no-save --no-audit --no-fund \
      prisma@6.19.3 \
      tsx@4.23.15 \
      bcryptjs@3.0.3 \
 && npm cache clean --force

# ---------- Stage 4: runner — production image (non-root) ----------
FROM node:24.22.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOAD_DIR=/app/uploads

# postgresql-client ให้ pg_isready สำหรับรอ DB พร้อม (entrypoint)
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output (มีเฉพาะ dependency ที่ runtime ต้องใช้)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# ต้องมีสำหรับ prisma migrate deploy / db seed ใน entrypoint
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# Prisma CLI + tsx + dependency ครบชุด (standalone ไม่มี devDependency)
# COPY ทับแบบ merge — แพ็กเกจของแอปที่ standalone ใส่ไว้ (next, @prisma/client) ยังคงอยู่
COPY --from=cli --chown=nextjs:nodejs /cli/node_modules ./node_modules

# สร้าง symlink ของ CLI เอง — ห้าม COPY node_modules/.bin/prisma ตรง ๆ
# เพราะ Docker จะ dereference symlink กลายเป็นไฟล์จริง ทำให้ __dirname ผิด
# แล้ว prisma หา prisma_schema_build_bg.wasm ไม่เจอ (ENOENT ตอน migrate deploy)
RUN rm -rf ./node_modules/.bin \
 && mkdir -p ./node_modules/.bin \
 && ln -sf ../prisma/build/index.js ./node_modules/.bin/prisma \
 && ln -sf ../tsx/dist/cli.mjs ./node_modules/.bin/tsx \
 && chmod +x ./node_modules/prisma/build/index.js ./node_modules/tsx/dist/cli.mjs \
 && node ./node_modules/.bin/prisma --version \
 && node ./node_modules/.bin/tsx --version

# entrypoint (ต้องรัน prisma migrate deploy ก่อน start server)
COPY --from=builder --chown=nextjs:nodejs /app/docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

# upload volume — user ต้องเขียนได้
# หมายเหตุ Railway: volume ถูก mount ทับ /app/uploads ด้วย uid/gid ของ root
# ทำให้ user nextjs (uid 1001) เขียนไม่ได้ วิธีแก้คือตั้ง UPLOAD_DIR ไปที่
# path ย่อยที่ mount ได้จริง หรือใช้ Railway volume mount path ที่ต้องการ
# (ดู README หัวข้อ "Railway volume permissions") — ค่าเริ่มต้นนี้คง least privilege ไว้
RUN mkdir -p /app/uploads/devices \
 && chown -R nextjs:nodejs /app/uploads \
 && chmod 0775 /app/uploads /app/uploads/devices

USER nextjs
EXPOSE 3000

# healthcheck ใช้ endpoint ที่ตรวจ DB ด้วย (Railway ใช้ค่านี้ตัดสินใจ deploy)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker/entrypoint.sh"]
