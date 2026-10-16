import path from 'node:path';
import { realpathSync } from 'node:fs';

/**
 * โฟลเดอร์รากของรูปที่อัปโหลด (server-only — ห้าม import จาก client component)
 *
 * - ถ้า UPLOAD_DIR ถูกตั้งเป็นค่าที่ไม่ว่าง ใช้ค่านั้น (เช่น /app/uploads ใน container)
 * - ถ้าว่างหรือไม่ตั้ง ใช้ ./uploads ใต้ process.cwd() (local dev / รัน Next ตรง ๆ)
 */
export function getUploadRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  return path.resolve(
    configured && configured.length > 0 ? configured : path.join(process.cwd(), 'uploads'),
  );
}

/**
 * ตรวจว่า absolute path อยู่ภายใน root ที่กำหนด (กัน path traversal)
 * ต้อง resolve ทั้งสองฝั่งให้เป็น absolute/normalized ก่อนเรียก
 */
export function isInsideRoot(root: string, absolutePath: string): boolean {
  return absolutePath === root || absolutePath.startsWith(root + path.sep);
}

/**
 * realpath ของ path เป้าหมาย — คืน null เมื่อ resolve ไม่ได้
 * (ตอน start ครั้งแรก volume อาจยังว่าง หรือ path ยังไม่ถูกสร้าง)
 */
export function resolveRealpathOrNull(target: string): string | null {
  try {
    return realpathSync(target);
  } catch {
    return null;
  }
}
