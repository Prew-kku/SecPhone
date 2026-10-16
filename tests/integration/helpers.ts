import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  UnsafeTestDatabaseError,
  allowNameFromEnv,
  assertSafeDatabaseName,
  assertSafeTestDatabaseUrl,
  classifyTestDatabaseUrl,
  resolveTestDatabaseUrl,
} from './db-safety';

/**
 * Helper สำหรับ integration test
 *
 * ความปลอดภัยมาก่อน (ดู `db-safety.ts`):
 *  1. resolve URL ทดสอบจาก `TEST_DATABASE_URL` (แนะนำ) หรือ `DATABASE_URL`
 *  2. ตรวจความปลอดภัยของ URL **ก่อน** ทุกอย่าง
 *  3. ถ้า URL ไม่ปลอดภัย → throw (fail closed) ไม่ใช่ skip เงียบ ๆ
 *  4. ยืนยันชื่อฐานข้อมูล **จริงจาก server** (`current_database()`) ก่อนรันเทสต์
 *  5. ตรวจซ้ำในตัว cleanup destructive เอง (defense in depth)
 *
 * หมายเหตุ: `DATABASE_URL` ถูกตั้งเป็น URL ฐานข้อมูลทดสอบโดย `vitest.integration.config.mts`
 * **เฉพาะเมื่อ URL นั้นปลอดภัย** ดังนั้น singleton ใน `src/lib/prisma.ts` จึงชี้ไปที่
 * ฐานข้อมูลทดสอบเสมอเมื่อเทสต์รันจริง
 */

const url = resolveTestDatabaseUrl();
const allowName = allowNameFromEnv();
const verdict = classifyTestDatabaseUrl(url, { allowName });

/** มี URL และ URL นั้นผ่านการตรวจความปลอดภัย */
export const hasDatabase = Boolean(url) && verdict.safe;

/** URL ถูกปฏิเสธเพราะไม่ปลอดภัย (ใช้แยก "ไม่มี DB → skip" ออกจาก "DB ไม่ปลอดภัย → fail") */
export const databaseRejected = Boolean(url) && !verdict.safe;

/** ชื่อฐานข้อมูลที่คาดหวัง (จาก URL) */
export const expectedDatabaseName = verdict.database;

/** ตรวจ URL ที่กำลังใช้งานอยู่จริง — throw ถ้าไม่ปลอดภัย */
function assertCurrentDatabaseUrl(): void {
  if (!url) throw new UnsafeTestDatabaseError('ไม่ได้ตั้งค่า TEST_DATABASE_URL หรือ DATABASE_URL');
  assertSafeTestDatabaseUrl(url, { allowName });
}

/**
 * คงชื่อเดิมไว้เพื่อความเข้ากันได้ แต่ตอนนี้ตรวจ **ชื่อฐานข้อมูลจริง** และ fail closed
 */
export function assertTestDatabase(candidateUrl: string | undefined | null): void {
  assertSafeTestDatabaseUrl(candidateUrl, { allowName });
}

/**
 * เชื่อมต่อได้หรือไม่ พร้อมยืนยันความปลอดภัย
 *
 * - ไม่ตั้ง URL → คืน false (suite skip)
 * - URL ไม่ปลอดภัย → throw UnsafeTestDatabaseError (fail closed, ไม่ skip)
 * - ต่อได้แต่ชื่อ DB จริงบน server ไม่ตรง/ไม่ปลอดภัย → throw
 */
export async function canConnect(): Promise<boolean> {
  if (!url) return false;

  // fail closed: URL ที่ไม่ปลอดภัยต้องหยุดทันที
  assertCurrentDatabaseUrl();

  const client = new PrismaClient({ datasourceUrl: url });
  try {
    const rows = await client.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    const actual = rows[0]?.current_database ?? '';

    // ยืนยันชื่อฐานข้อมูลจริงจาก server (ไม่ใช่แค่ URL) ก่อนอนุญาตลบข้อมูล
    assertSafeDatabaseName(actual, { allowName });
    if (expectedDatabaseName && actual !== expectedDatabaseName) {
      throw new UnsafeTestDatabaseError(
        `ชื่อฐานข้อมูลจริง "${actual}" ไม่ตรงกับที่ระบุใน URL "${expectedDatabaseName}"`,
      );
    }
    return true;
  } catch (error) {
    if (error instanceof UnsafeTestDatabaseError) throw error;
    // เชื่อมต่อไม่ได้ (เช่น DB ยังไม่สตาร์ท) → false เพื่อให้ suite skip
    return false;
  } finally {
    await client.$disconnect();
  }
}

export { prisma };

/** อีเมลเฉพาะกิจของเทสต์ เพื่อไม่ชนกับข้อมูลอื่น */
export function testEmail(tag: string): string {
  return `test-${tag}-${Date.now()}@example.test`;
}

/**
 * ล้างข้อมูลสินค้า/แบรนด์/รุ่น/ผู้ดูแลที่สร้างจากเทสต์
 * ลบตามลำดับ FK: images → devices → phone_models → brands
 * (adminUsers: เฉพาะอีเมล @example.test)
 *
 * ⚠️ ตรวจความปลอดภัย **ซ้ำ** ที่นี่ก่อนลบทุกครั้ง — ห้ามลบถ้าฐานข้อมูลไม่ผ่านการตรวจ
 */
export async function cleanTransactionalData(): Promise<void> {
  assertCurrentDatabaseUrl();

  await prisma.deviceImage.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.phoneModel.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: '@example.test' } } });
}
