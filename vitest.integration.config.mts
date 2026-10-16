import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Config สำหรับ integration test — ใช้ PostgreSQL จริง (ห้าม mock Prisma)
 *
 * ตั้ง DATABASE_URL ให้ชี้ไปที่ **ฐานข้อมูลทดสอบที่ทิ้งได้** เสมอ
 * ห้ามชี้ไปที่ Railway production เด็ดขาด (ดู tests/integration/README.md)
 *
 * รันแบบมี DB: DATABASE_URL=... npx vitest run --config vitest.integration.config.mts
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    // integration test แตะ DB/ไฟล์ระบบ จึงไม่ควรรันขนานกัน
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
