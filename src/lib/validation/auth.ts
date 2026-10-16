import { z } from 'zod';

/** อีเมล: trim + lowercase เสมอ เพื่อให้ตรงกับค่าที่เก็บในฐานข้อมูล */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'กรุณากรอกอีเมล')
  .max(254)
  .email('รูปแบบอีเมลไม่ถูกต้อง');

/**
 * รหัสผ่าน login: ไม่บังคับความยาวขั้นต่ำแบบเด้ง error
 * เพราะเราไม่ต้องการบอกใบ้เรื่องนโยบายรหัสผ่านผ่านหน้า login
 * (ข้อความ error ต้องเป็นกลางเสมอ) แต่กันค่าว่าง/ค่าที่ใหญ่ผิดปกติ
 */
export const passwordSchema = z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  /**
   * ปลายทางหลัง login สำเร็จ — ตรวจให้เป็น path ภายในเท่านั้น
   * (กัน open redirect: ห้าม //evil.com หรือ http://evil.com)
   */
  next: z
    .string()
    .trim()
    .max(512)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type LoginInput = z.output<typeof loginSchema>;

/**
 * ตรวจว่า path ปลอดภัยสำหรับ redirect ภายในเว็บเท่านั้น
 * - ต้องขึ้นต้นด้วย "/" เดียว (ไม่ใช่ "//" ซึ่งเป็น protocol-relative URL)
 * - ห้ามมี backslash (บางเบราว์เซอร์ตีความเป็น "/")
 * - ห้ามมี control character
 */
export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('\\')) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return true;
}

/** คืน path ที่ปลอดภัย หรือ fallback เมื่อค่าไม่ผ่าน */
export function safeRedirectPath(value: string | null | undefined, fallback = '/admin'): string {
  return isSafeInternalPath(value) ? value : fallback;
}
