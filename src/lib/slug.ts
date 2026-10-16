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
