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

# ---------- Stage 3: runner — production image (non-root) ----------
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
# Prisma CLI + engines + tsx (เป็น devDependency จึงไม่ถูกคัดลอกมาใน standalone)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.bin/tsx ./node_modules/.bin/tsx
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@esbuild ./node_modules/@esbuild

# entrypoint (ต้องรัน prisma migrate deploy ก่อน start server)
COPY --from=builder --chown=nextjs:nodejs /app/docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

# upload volume — user ต้องเขียนได้
RUN mkdir -p /app/uploads/devices && chown -R nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
