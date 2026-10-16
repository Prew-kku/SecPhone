/**
 * เส้นทางของ placeholder แบบ static ที่ commit ไว้ใน public/ (ไม่ผ่าน /api/images)
 * แยกจากไฟล์ที่อัปโหลดจริงซึ่งอยู่ใต้ devices/<deviceId>/<uuid>.webp
 */
export const PLACEHOLDER_PHONE = '/placeholders/phone-placeholder.svg';
export const PLACEHOLDER_BRAND = '/placeholders/brand-placeholder.svg';

export type PlaceholderKind = 'phone' | 'brand';

export function placeholderFor(kind: PlaceholderKind): string {
  return kind === 'brand' ? PLACEHOLDER_BRAND : PLACEHOLDER_PHONE;
}

/** รูปที่อัปโหลดจริง: devices/<deviceId>/<uuid-v4>.webp */
const UPLOADED_IMAGE_PATTERN =
  /^devices\/[a-z0-9]{1,64}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/**
 * แปลงค่า DeviceImage.filename ให้เป็น URL ที่ใช้ใน <img> ได้
 * คืน null เมื่อรูปแบบไม่ถูกต้อง เพื่อให้ UI ไปใช้ placeholder แทน
 * (ห้ามต่อ path ดิบจากฐานข้อมูลตรง ๆ)
 */
export function resolveImageSrc(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const normalized = filename.replace(/^\/+/, '');
  if (!UPLOADED_IMAGE_PATTERN.test(normalized)) return null;
  return `/api/images/${normalized}`;
}

export function isUploadedImageFilename(filename: string): boolean {
  return UPLOADED_IMAGE_PATTERN.test(filename.replace(/^\/+/, ''));
}

/**
 * สีของเครื่อง (ข้อความไทย) → สีพื้นของ placeholder เพื่อให้แยกแยะรุ่น/สีได้
 * เป็นการแสดงผลเชิงสาธิต ไม่ได้อ้างว่าเป็นรูปสินค้าจริง
 */
const COLOR_TINTS: Record<string, string> = {
  ดำ: '#1f2937',
  เทา: '#6b7280',
  เงิน: '#cbd5e1',
  ขาว: '#f8fafc',
  ทอง: '#d4b483',
  น้ำเงิน: '#1e3a8a',
  ฟ้า: '#38bdf8',
  เขียว: '#15803d',
  แดง: '#b91c1c',
  ชมพู: '#db2777',
  ม่วง: '#6d28d9',
  คราม: '#1e40af',
  ทองคำ: '#e0b252',
  ม่วงอ่อน: '#a78bfa',
};

export function demoTintFor(color: string): string {
  const key = color.trim();
  if (COLOR_TINTS[key]) return COLOR_TINTS[key];
  const found = Object.entries(COLOR_TINTS).find(([name]) => key.includes(name));
  return found ? found[1] : '#94a3b8';
}
