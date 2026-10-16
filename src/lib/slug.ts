/**
 * สร้าง slug จากข้อความ โดยรองรับตัวอักษรละติน/ตัวเลข
 * หมายเหตุ: ข้อความภาษาไทยจะถูกละทิ้ง จึงต้องมี fallback เสมอ
 * (slug ของ Brand/PhoneModel/Device มาจากค่าคงที่ใน seed ไม่ใช่ชื่อผู้ใช้)
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * สร้าง slug ที่ไม่ซ้ำ โดยเติม suffix ตัวเลขเมื่อชนกัน
 * `isTaken` ต้องคืนค่า synchronous เพื่อให้ deterministic
 */
export function uniqueSlug(base: string, isTaken: (candidate: string) => boolean): string {
  const root = slugify(base) || 'item';
  if (!isTaken(root)) return root;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`;
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error(`ไม่สามารถสร้าง slug ที่ไม่ซ้ำได้จาก "${base}"`);
}

/**
 * สร้าง SKU ภายในจากชื่อแบรนด์/รุ่น/ความจุ/สี
 *
 * รูปแบบ: <BRAND>-<MODEL>-<STORAGE>-<COLOR>-<SUFFIX>
 *   เช่น APPLE-IPHONE-13-PRO-256-THONG-A1B2
 * - ใช้ตัวอักษรละติน/ตัวเลขเท่านั้น (ตัดอักขระไทยออก)
 * - เติม suffix สุ่ม 4 ตัวเพื่อลดการชนกัน (เมื่อชนจริงจะเติมตัวนับต่อ)
 * - ต้องผ่าน isTaken เพื่อรับประกัน unique จริงในฐานข้อมูล
 */
export function buildSkuBase(brand: string, model: string, storageGb: number, color: string): string {
  const brandPart = slugify(brand).toUpperCase() || 'BRAND';
  const modelPart = slugify(model).toUpperCase() || 'MODEL';
  const colorPart = slugify(color).toUpperCase() || 'COLOR';
  const raw = `${brandPart}-${modelPart}-${storageGb}-${colorPart}`;
  // จำกัดความยาวส่วนต้นไม่ให้ SKU ยาวเกินขีดที่อ่านง่าย
  return raw.slice(0, 60);
}

/** สุ่ม suffix 4 ตัว (A-Z0-9) จาก crypto — ไม่ใช้ Math.random เพื่อลดการเดา */
export function randomSkuSuffix(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

/**
 * สร้าง SKU ที่ไม่ซ้ำ
 * ลอง `<base>-<random>` ก่อน แล้วถ้าชนให้ไล่ตัวนับต่อท้าย (deterministic fallback)
 */
export function uniqueSku(
  base: string,
  isTaken: (candidate: string) => boolean,
  attempts = 8,
): string {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = `${base}-${randomSkuSuffix()}`;
    if (!isTaken(candidate)) return candidate;
  }
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error(`ไม่สามารถสร้าง SKU ที่ไม่ซ้ำได้จาก "${base}"`);
}
