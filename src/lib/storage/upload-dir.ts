import path from 'node:path';

/**
 * โฟลเดอร์รากของรูปที่อัปโหลด (server-only — ห้าม import จาก client component)
 *
 * - ถ้า UPLOAD_DIR ถูกตั้งเป็นค่าที่ไม่ว่าง ใช้ค่านั้น (เช่น /app/uploads ใน container)
 * - ถ้าว่างหรือไม่ตั้ง ใช้ ./uploads ใต้ process.cwd() (local dev / รัน Next ตรง ๆ)
 */
export function getUploadRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  return path.resolve(configured && configured.length > 0 ? configured : path.join(process.cwd(), 'uploads'));
}

/** ตรวจว่า absolute path อยู่ภายใน upload root จริง (กัน path traversal) */
export function isInsideUploadRoot(absolutePath: string): boolean {
  const root = getUploadRoot();
  return absolutePath === root || absolutePath.startsWith(root + path.sep);
}
