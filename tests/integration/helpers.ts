import { PrismaClient } from '@prisma/client';

/**
 * Helper สำหรับ integration test
 *
 * - ตรวจว่ามี DATABASE_URL และเชื่อมต่อได้จริงก่อนรัน suite
 * - ล้างตารางที่เกี่ยวข้องระหว่างเทสต์ (ไม่แตะ migration history)
 * - ปฏิเสธอย่างชัดเจนถ้า URL ดูเหมือน production (กันความผิดพลาดร้ายแรง)
 */

export const hasDatabase = Boolean(process.env.DATABASE_URL);

/** ตรวจว่า URL ไม่ได้ชี้ไปที่ production — กันการลบข้อมูลจริงโดยอุบัติเหตุ */
export function assertTestDatabase(url: string | undefined): void {
  if (!url) throw new Error('ต้องตั้ง DATABASE_URL สำหรับ integration test');
  // ชื่อฐานข้อมูลต้องมีคำว่า test (ยกเว้นรันใน CI ที่ใช้ service แยกชัดเจน)
  if (!/test/i.test(url) && process.env.ALLOW_NON_TEST_DB !== 'true') {
    throw new Error(
      'ปฏิเสธการรัน integration test: DATABASE_URL ไม่ได้มีคำว่า "test" ' +
        '(ตั้ง ALLOW_NON_TEST_DB=true ถ้าแน่ใจว่าเป็นฐานข้อมูลทิ้งได้)',
    );
  }
}

/** เชื่อมต่อได้หรือไม่ (ไม่ throw) */
export async function canConnect(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const client = new PrismaClient();
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await client.$disconnect();
  }
}

export const prisma = new PrismaClient();

/** อีเมลเฉพาะกิจของเทสต์ เพื่อไม่ชนกับข้อมูลอื่น */
export function testEmail(tag: string): string {
  return `test-${tag}-${Date.now()}@example.test`;
}

/**
 * ล้างข้อมูลสินค้า/แบรนด์/รุ่น/ผู้ดูแลที่สร้างจากเทสต์
 * ลบตามลำดับ FK: images → devices → phone_models → brands
 * (adminUsers: เฉพาะอีเมล @example.test)
 */
export async function cleanTransactionalData(): Promise<void> {
  await prisma.deviceImage.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.phoneModel.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: '@example.test' } } });
}
