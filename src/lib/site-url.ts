/**
 * แหล่งความจริงเดียวของ base URL สาธารณะของเว็บไซต์
 *
 * ลำดับการหาค่า:
 * 1. SITE_URL — ค่าที่ตั้งเอง (ต้องเป็น URL แบบเต็ม)
 * 2. RAILWAY_PUBLIC_DOMAIN — Railway ใส่ให้อัตโนมัติเมื่อเปิด public domain
 *    (เป็น host เปล่า ๆ เช่น "myapp.up.railway.app" จึงต้องเติม https:// ให้)
 * 3. http://localhost:3000 — ค่าเริ่มต้นสำหรับ local dev
 *
 * ใช้สำหรับ canonical URL, Open Graph, sitemap.xml, robots.txt และ JSON-LD
 *
 * ทำไมต้อง normalize: ค่าที่ผู้ใช้วางอาจมี "/" ปิดท้าย หรือไม่มี scheme
 * ถ้าส่งค่าที่ parse ไม่ได้เข้า `new URL()` ตรง ๆ การ render จะ throw ทั้งหน้า
 * ฟังก์ชันนี้จึง fallback อย่างปลอดภัยแทนการล้ม
 */

const LOCAL_FALLBACK = 'http://localhost:3000';

function normalize(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  // Railway ให้ host เปล่า ๆ (ไม่มี scheme) — เติม https ให้
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withScheme);
    // รับเฉพาะ http/https — กันค่าแปลกเช่น "javascript:" หลุดเข้า metadata
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // ตัด "/" ปิดท้ายเพื่อไม่ให้เกิด "//" เมื่อต่อ path
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * คืน base URL ที่ใช้ได้เสมอ (ไม่ throw)
 * Railway domain ถูกเติม https:// ให้อัตโนมัติ (Railway เสิร์ฟผ่าน HTTPS)
 */
export function getSiteUrl(): string {
  return (
    normalize(process.env.SITE_URL) ??
    normalize(process.env.RAILWAY_PUBLIC_DOMAIN) ??
    LOCAL_FALLBACK
  );
}
