/**
 * ค่าตั้งต้นของร้าน อ่านจาก environment variables ตอน runtime (ฝั่ง server)
 *
 * หมายเหตุการออกแบบ (ต่างจาก PLAN §9.5 เล็กน้อย):
 * ใช้ชื่อ env แบบไม่ขึ้นต้น NEXT_PUBLIC_ เพื่อให้อ่านได้ที่ runtime ใน Docker
 * เพราะ NEXT_PUBLIC_* จะถูก inline ลง bundle ตอน build ทำให้แก้ค่าแล้วต้อง rebuild
 * ยังรองรับชื่อ NEXT_PUBLIC_* เดิมเป็น fallback เพื่อความเข้ากันได้
 *
 * โมดูลนี้เป็น server-only — client component ต้องรับค่าเป็น props
 */

export type ContactChannel = {
  key: 'line' | 'facebook' | 'phone';
  label: string;
  href: string;
  /** ข้อความที่แสดงเป็นค่าที่คัดลอก/อ่าน เช่น เบอร์โทร */
  display: string;
};

export type SiteConfig = {
  name: string;
  description: string;
  contacts: ContactChannel[];
};

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** LINE ID → URL ที่เปิดแชทได้จริง (ถ้าผู้ใช้ใส่ URL มาแล้วให้ใช้ตามนั้น) */
function lineHref(rawId: string): string | null {
  const id = rawId.replace(/^@/, '').trim();
  if (!id) return null;
  if (/^https?:\/\//i.test(id)) return id;
  if (!/^[A-Za-z0-9._-]{2,64}$/.test(id)) return null;
  return `https://line.me/R/ti/p/~${id}`;
}

function facebookHref(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** เบอร์โทรไทย: ตัดอักขระที่ไม่ใช่ตัวเลข แล้วตรวจความยาว */
function phoneHref(rawPhone: string): string | null {
  const digits = rawPhone.replace(/[^0-9+]/g, '').replace(/^\+?66/, '0');
  if (!/^0[0-9]{8,9}$/.test(digits)) return null;
  return `tel:${digits}`;
}

export function getSiteConfig(): SiteConfig {
  const name = firstNonEmpty(process.env.SITE_NAME, process.env.NEXT_PUBLIC_SITE_NAME, 'SecondPhone Store');

  const contacts: ContactChannel[] = [];

  const lineId = firstNonEmpty(process.env.LINE_ID, process.env.NEXT_PUBLIC_LINE_ID);
  const line = lineHref(lineId);
  if (line) {
    contacts.push({
      key: 'line',
      label: 'แชทผ่าน LINE',
      href: line,
      display: lineId.replace(/^@/, ''),
    });
  }

  const facebookUrl = firstNonEmpty(
    process.env.FACEBOOK_URL,
    process.env.NEXT_PUBLIC_FACEBOOK_URL,
  );
  const facebook = facebookHref(facebookUrl);
  if (facebook) {
    contacts.push({ key: 'facebook', label: 'Facebook', href: facebook, display: 'เพจร้านค้า' });
  }

  const phoneRaw = firstNonEmpty(process.env.PHONE_NUMBER, process.env.NEXT_PUBLIC_PHONE_NUMBER);
  const phone = phoneHref(phoneRaw);
  if (phone) {
    const digits = phone.replace('tel:', '');
    const formatted = digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    contacts.push({ key: 'phone', label: 'โทรสอบถาม', href: phone, display: formatted });
  }

  return {
    name,
    description:
      'ร้านขายสมาร์ทโฟนมือสองคุณภาพคัดสรร ตรวจสภาพทุกเครื่อง พร้อมบริการให้คำปรึกษาก่อนซื้อ',
    contacts,
  };
}

/** มีช่องทางติดต่อที่ตั้งค่าไว้หรือไม่ (ใช้ซ่อนส่วน CTA ทั้งบล็อก) */
export function hasContactChannels(): boolean {
  return getSiteConfig().contacts.length > 0;
}
