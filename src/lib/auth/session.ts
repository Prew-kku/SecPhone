import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { AdminRole } from '@prisma/client';

/**
 * เซสชันของผู้ดูแล: signed JWT (HS256) เก็บใน HttpOnly cookie
 *
 * ทำไมใช้ jose ไม่ใช่ jsonwebtoken: jose ทำงานบน Web Crypto และ edge runtime ได้
 * (จำเป็นถ้าอนาคตย้าย middleware ไป edge) และ pin ไว้ตาม PLAN §3.2
 */

export const SESSION_COOKIE_NAME = 'sp_session';

/** ค่าเริ่มต้นอายุเซสชัน 8 ชั่วโมง ตาม PLAN §7.2 */
const DEFAULT_SESSION_TTL_HOURS = 8;

/** อายุเซสชันเริ่มต้น (วินาที) — คงที่ไว้เพื่อให้เทสต์อ้างอิงได้ */
export const SESSION_TTL_SECONDS = DEFAULT_SESSION_TTL_HOURS * 60 * 60;

/**
 * อายุเซสชันจริง (วินาที) — อ่าน SESSION_TTL_HOURS ถ้าตั้งไว้ (1–720 ชั่วโมง)
 * ค่าที่ไม่ถูกต้อง/นอกช่วงจะถอยกลับไปใช้ค่าเริ่มต้น 8 ชั่วโมง
 */
export function sessionTtlSeconds(): number {
  const raw = Number(process.env.SESSION_TTL_HOURS);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 720) return Math.floor(raw) * 60 * 60;
  return SESSION_TTL_SECONDS;
}

export type SessionPayload = {
  sub: string;
  email: string;
  role: AdminRole;
};

const ALG = 'HS256';

/**
 * อ่าน JWT_SECRET จาก env
 *
 * คืน null เมื่อไม่มี/สั้นเกินไป — ผู้เรียกต้องจัดการเอง (fail closed)
 * ห้าม log ค่าของ secret เด็ดขาด
 */
export function getJwtSecret(): Uint8Array | null {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw) return null;
  // PLAN §7.5: ยาว ≥ 32 bytes — ใช้จำนวนอักขระเป็นตัววัดขั้นต่ำ
  if (raw.length < 32) return null;
  return new TextEncoder().encode(raw);
}

/** production ที่ไม่มี JWT_SECRET ที่ใช้ได้ = ตั้งค่าไม่ครบ → ต้องไม่ยอมให้ login */
export function isAuthConfigured(): boolean {
  return getJwtSecret() !== null;
}

function toUint8Array(secret: Uint8Array | string): Uint8Array {
  return typeof secret === 'string' ? new TextEncoder().encode(secret) : secret;
}

/**
 * สร้าง JWT ของเซสชัน
 * @param secret ระบุได้เพื่อให้เทสต์ส่ง secret เอง (ค่าเริ่มต้นอ่านจาก env)
 */
export async function signSession(
  payload: SessionPayload,
  secret?: Uint8Array | string,
): Promise<string> {
  const key = secret ? toUint8Array(secret) : getJwtSecret();
  if (!key) throw new Error('JWT_SECRET ไม่ถูกตั้งค่าหรือสั้นกว่า 32 ตัวอักษร');

  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + sessionTtlSeconds())
    .sign(key);
}

/**
 * ตรวจสอบ JWT และคืน payload
 * คืน null สำหรับ token ที่ผิดรูปแบบ/ลายเซ็นไม่ถูก/หมดอายุ (ไม่ throw ให้ผู้เรียกจัดการ)
 */
export async function verifySession(
  token: string,
  secret?: Uint8Array | string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const key = secret ? toUint8Array(secret) : getJwtSecret();
  if (!key) return null;

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    const email = typeof payload.email === 'string' ? payload.email : null;
    const role = payload.role;
    if (!sub || !email || (role !== 'OWNER' && role !== 'ADMIN')) return null;
    return { sub, email, role } satisfies SessionPayload & JWTPayload;
  } catch {
    return null;
  }
}

/** อายุ Max-Age ของ cookie ให้ตรงกับอายุ token จริง */
export function sessionCookieMaxAge(): number {
  return sessionTtlSeconds();
}

/**
 * cookie ต้องเป็น Secure เสมอใน production
 * ปิดได้เฉพาะเมื่อ COOKIE_SECURE=false (สำหรับทดสอบบน HTTP ท้องถิ่นเท่านั้น)
 */
export function shouldUseSecureCookie(): boolean {
  if (process.env.COOKIE_SECURE?.trim().toLowerCase() === 'false') return false;
  return process.env.NODE_ENV === 'production';
}
