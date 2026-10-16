/**
 * ความปลอดภัยของฐานข้อมูลสำหรับ integration test
 *
 * ⚠️ เหตุผลที่ไฟล์นี้สำคัญ
 * ------------------------------------------------------------------
 * integration test เรียก `deleteMany({})` บนตารางสินค้าแบบไม่จำกัด
 * ถ้า `DATABASE_URL` เผลอชี้ไปที่ production (Railway) ข้อมูลจริงจะหายทั้งหมด
 *
 * เราจึง **แยกตรรกะการตรวจออกมาเป็นฟังก์ชันบริสุทธิ์** ที่เทสต์ได้โดยไม่ต้องมี DB
 * และบังคับใช้ (enforce) ก่อน query ใด ๆ รวมถึงตรวจซ้ำในตัว cleanup เอง
 *
 * หลักการ:
 *  - ตรวจ **ชื่อฐานข้อมูลจริง** (pathname ของ URL) ไม่ใช่แค่ "URL มีคำว่า test"
 *  - ปฏิเสธชื่อที่รู้ว่าเป็น production/dev ปกติ (secondphone, postgres, prod ฯลฯ)
 *  - ปฏิเสธ host ที่เป็น Railway หรือคล้าย production
 *  - fail closed: ถ้าตรวจไม่ได้/ไม่ชัดเจน → throw
 *  - รองรับการระบุชื่อที่ทิ้งได้แบบชัดเจนผ่าน TEST_DATABASE_NAME
 */

/** ชื่อฐานข้อมูลที่ห้ามลบเด็ดขาด (ฐานข้อมูลแอปจริง/ค่ามาตรฐานของ Postgres) */
const FORBIDDEN_DATABASE_NAMES = new Set([
  'postgres',
  'template0',
  'template1',
  'secondphone',
  'secondphone_store',
  'production',
  'prod',
  'railway',
  'main',
  'live',
]);

/** โดเมน/host ที่ถือว่าเป็น production (ปฏิเสธเสมอ) */
const FORBIDDEN_HOST_PATTERNS = [/railway/i, /\.prod\./i, /\bprod\b/i];

/**
 * token ที่ยอมรับว่าเป็นฐานข้อมูลทิ้งได้
 * ต้องเป็นคำที่คั่นด้วย `_`, `.`, `-` หรืออยู่ต้น/ท้าย เพื่อไม่ให้ "contest" ผ่าน
 */
const TEST_TOKEN = /(^|[_\-.])test($|[_\-.])/i;

export type DatabaseSafetyVerdict = {
  safe: boolean;
  /** ชื่อฐานข้อมูลที่ parse ได้ (ว่างถ้า parse ไม่ได้) */
  database: string | null;
  /** host ที่ parse ได้ */
  host: string | null;
  /** เหตุผลเมื่อไม่ปลอดภัย */
  reason: string | null;
};

/**
 * ตรวจว่า URL ชี้ไปฐานข้อมูลที่ทิ้งได้จริงหรือไม่ (ฟังก์ชันบริสุทธิ์ — ไม่แตะ env/DB)
 *
 * @param url connection string แบบ postgresql://
 * @param options.allowName ชื่อฐานข้อมูลที่อนุญาตแบบชัดเจน (จาก TEST_DATABASE_NAME)
 */
export function classifyTestDatabaseUrl(
  url: string | undefined | null,
  options: { allowName?: string | null } = {},
): DatabaseSafetyVerdict {
  if (!url) {
    return { safe: false, database: null, host: null, reason: 'ไม่ได้ตั้งค่าฐานข้อมูลทดสอบ' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, database: null, host: null, reason: 'URL ฐานข้อมูลไม่ถูกต้อง' };
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return {
      safe: false,
      database: null,
      host: null,
      reason: `โปรโตคอลไม่ใช่ PostgreSQL (${parsed.protocol})`,
    };
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')).trim();
  const host = parsed.hostname.toLowerCase();

  if (!database) {
    return { safe: false, database: null, host, reason: 'URL ไม่มีชื่อฐานข้อมูล' };
  }

  // 1) ชื่อที่รู้ว่าเป็น production/dev ปกติ → ปฏิเสธเด็ดขาด (ห้าม override)
  if (FORBIDDEN_DATABASE_NAMES.has(database.toLowerCase())) {
    return {
      safe: false,
      database,
      host,
      reason: `ชื่อฐานข้อมูล "${database}" เป็นชื่อที่สงวนไว้ (production/dev)`,
    };
  }

  // 2) host ที่เป็น production → ปฏิเสธเด็ดขาด
  if (FORBIDDEN_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    return { safe: false, database, host, reason: `host "${host}" ดูเหมือน production` };
  }

  // 3) ถ้าระบุชื่อที่อนุญาตชัดเจน → ต้องตรงเป๊ะ
  const allowName = options.allowName?.trim();
  if (allowName) {
    if (database !== allowName) {
      return {
        safe: false,
        database,
        host,
        reason: `ชื่อฐานข้อมูล "${database}" ไม่ตรงกับ TEST_DATABASE_NAME "${allowName}"`,
      };
    }
    return { safe: true, database, host, reason: null };
  }

  // 4) อย่างอื่น → ชื่อต้องมี token บอกว่าเป็นฐานข้อมูลทดสอบ
  if (!TEST_TOKEN.test(database)) {
    return {
      safe: false,
      database,
      host,
      reason:
        `ชื่อฐานข้อมูล "${database}" ไม่ได้ระบุว่าเป็นฐานข้อมูลทดสอบ ` +
        `(ต้องมีคำว่า test คั่นด้วย _ . - หรือตั้ง TEST_DATABASE_NAME ให้ตรง)`,
    };
  }

  return { safe: true, database, host, reason: null };
}

/** error ที่ใช้สื่อว่า "ปฏิเสธเพื่อความปลอดภัย" */
export class UnsafeTestDatabaseError extends Error {
  constructor(reason: string) {
    super(`ปฏิเสธการรัน integration test: ${reason}`);
    this.name = 'UnsafeTestDatabaseError';
  }
}

/**
 * บังคับใช้: throw ถ้าฐานข้อมูลไม่ปลอดภัย
 * เรียกก่อน query ใด ๆ และตรวจซ้ำใน cleanup helper
 */
export function assertSafeTestDatabaseUrl(
  url: string | undefined | null,
  options: { allowName?: string | null } = {},
): void {
  const verdict = classifyTestDatabaseUrl(url, options);
  if (!verdict.safe) throw new UnsafeTestDatabaseError(verdict.reason ?? 'ตรวจสอบไม่ผ่าน');
}

/**
 * ตรวจชื่อฐานข้อมูลเดี่ยว ๆ (ใช้ยืนยันชื่อจริงจาก `current_database()` ของ server)
 * สร้างเป็น verdict เทียบเท่าโดยไม่ต้องมี host
 */
export function assertSafeDatabaseName(
  name: string,
  options: { allowName?: string | null } = {},
): void {
  const verdict = classifyTestDatabaseUrl(`postgresql://localhost/${name}`, options);
  if (!verdict.safe) throw new UnsafeTestDatabaseError(verdict.reason ?? 'ตรวจสอบไม่ผ่าน');
}

/**
 * เลือก URL ของฐานข้อมูลทดสอบ
 * - ใช้ `TEST_DATABASE_URL` ก่อน (ชัดเจนที่สุด)
 * - ถอยไปใช้ `DATABASE_URL`
 * คืน null เมื่อไม่มีทั้งคู่ (ผู้เรียกจะ skip suite)
 */
export function resolveTestDatabaseUrl(): string | null {
  const explicit = process.env.TEST_DATABASE_URL?.trim();
  if (explicit) return explicit;
  const fallback = process.env.DATABASE_URL?.trim();
  return fallback || null;
}

/** ชื่อฐานข้อมูลที่อนุญาตแบบชัดเจน (ถ้าตั้งไว้) */
export function allowNameFromEnv(): string | null {
  return process.env.TEST_DATABASE_NAME?.trim() || null;
}
