import bcrypt from 'bcryptjs';

/**
 * bcrypt cost 12 ตาม PLAN §7.5
 * ยอมรับได้กับฮาร์ดแวร์ปัจจุบัน (~250 ms/hash) และทำให้ brute-force ทางออนไลน์แพงขึ้นมาก
 */
const BCRYPT_COST = 12;

/** ข้อความ error กลาง ๆ — ห้ามบอกว่าอีเมลมีอยู่หรือไม่ (กัน user enumeration) */
export const GENERIC_AUTH_ERROR = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';

/**
 * hash ปลอมสำหรับเทียบเมื่อไม่พบผู้ใช้ เพื่อให้เวลาตอบสนองใกล้เคียงเคสที่พบผู้ใช้
 * (ลด timing side-channel ที่ใช้เดาว่าอีเมลมีอยู่ในระบบหรือไม่)
 *
 * ค่านี้ hash มาจากข้อความสุ่มที่ไม่มีใครใช้เป็นรหัสผ่านจริง — ไม่ใช่ความลับ
 */
const DUMMY_HASH = '$2b$12$/.28lLRvuUU29UnVcPnQP.32C0FVxEELNkDfHqN0nfs5azNiS7mo2';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * เทียบรหัสผ่านกับ hash ปลอมเมื่อไม่พบผู้ใช้ แล้วคืน false เสมอ
 * ใช้เพื่อให้ใช้เวลาคล้ายการเทียบจริง
 */
export async function burnTimeWithDummyCompare(plain: string): Promise<false> {
  await verifyPassword(plain, DUMMY_HASH);
  return false;
}
