import path from 'node:path';
import { defineConfig } from 'vitest/config';
import {
  allowNameFromEnv,
  classifyTestDatabaseUrl,
  resolveTestDatabaseUrl,
} from './tests/integration/db-safety';

/**
 * Config สำหรับ integration test — ใช้ PostgreSQL จริง (ห้าม mock Prisma)
 *
 * ตั้ง `TEST_DATABASE_URL` (แนะนำ) หรือ `DATABASE_URL` ให้ชี้ไปที่ **ฐานข้อมูลทดสอบที่ทิ้งได้**
 * ห้ามชี้ไปที่ Railway production เด็ดขาด (ดู tests/integration/README.md)
 *
 * ความปลอดภัย: config นี้ **ตรวจ URL ก่อน** และเขียนทับ `process.env.DATABASE_URL`
 * เฉพาะเมื่อ URL นั้นผ่านการตรวจแล้วเท่านั้น
 *  - ถ้า URL ไม่ปลอดภัย → ตั้ง DATABASE_URL เป็น placeholder ที่เชื่อมต่อไม่ได้
 *    เพื่อไม่ให้ singleton (`src/lib/prisma.ts`) ชี้ไปที่ฐานข้อมูลจริง
 *    แล้วให้ helper ในตัวเทสต์ throw `UnsafeTestDatabaseError` (fail closed)
 */
const testUrl = resolveTestDatabaseUrl();
const verdict = classifyTestDatabaseUrl(testUrl, { allowName: allowNameFromEnv() });

if (verdict.safe && testUrl) {
  // ให้ singleton ของแอปชี้ไปที่ฐานข้อมูลทดสอบเดียวกัน
  process.env.DATABASE_URL = testUrl;
} else if (testUrl) {
  // URL ถูกปฏิเสธ — เก็บ URL เดิมไว้ใน TEST_DATABASE_URL เพื่อให้ helper รายงานเหตุผลจริง
  // แล้วกัน singleton ไม่ให้ชี้ไปที่ฐานข้อมูลจริง
  process.env.TEST_DATABASE_URL = testUrl;
  process.env.DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:1/unsafe_placeholder_db';
}

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
