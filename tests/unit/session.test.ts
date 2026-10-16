import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import {
  SESSION_TTL_SECONDS,
  getJwtSecret,
  isAuthConfigured,
  sessionCookieMaxAge,
  sessionTtlSeconds,
  shouldUseSecureCookie,
  signSession,
  verifySession,
} from '@/lib/auth/session';

const SECRET = 'test-secret-at-least-32-characters-long-xxxx';
const ORIGINAL_SECRET = process.env.JWT_SECRET;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_COOKIE_SECURE = process.env.COOKIE_SECURE;
const ORIGINAL_TTL = process.env.SESSION_TTL_HOURS;

/** NODE_ENV ถูกประกาศเป็น read-only ใน type ของ Next — ตั้งผ่าน cast เพื่อทดสอบ */
function setNodeEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}


beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_SECRET;
  setNodeEnv(ORIGINAL_NODE_ENV);
  if (ORIGINAL_COOKIE_SECURE === undefined) delete process.env.COOKIE_SECURE;
  else process.env.COOKIE_SECURE = ORIGINAL_COOKIE_SECURE;
  if (ORIGINAL_TTL === undefined) delete process.env.SESSION_TTL_HOURS;
  else process.env.SESSION_TTL_HOURS = ORIGINAL_TTL;
});

describe('session — JWT round-trip', () => {
  it('sign แล้ว verify ได้ payload เดิม', async () => {
    const token = await signSession({ sub: 'admin1', email: 'a@example.com', role: 'OWNER' });
    const payload = await verifySession(token);
    expect(payload).toEqual({ sub: 'admin1', email: 'a@example.com', role: 'OWNER' });
  });

  it('token ที่ถูกแก้ไข (tampered) ถูกปฏิเสธ', async () => {
    const token = await signSession({ sub: 'admin1', email: 'a@example.com', role: 'ADMIN' });
    const tampered = token.slice(0, -3) + 'xyz';
    expect(await verifySession(tampered)).toBeNull();
  });

  it('token ที่เซ็นด้วย secret อื่นถูกปฏิเสธ', async () => {
    const other = await new SignJWT({ email: 'a@example.com', role: 'OWNER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('another-secret-at-least-32-characters-long'));
    expect(await verifySession(other)).toBeNull();
  });

  it('token ที่หมดอายุถูกปฏิเสธ', async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const expired = await new SignJWT({ email: 'a@example.com', role: 'OWNER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin1')
      .setIssuedAt(past - 100)
      .setExpirationTime(past)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(expired)).toBeNull();
  });

  it('role ที่ไม่รู้จักถูกปฏิเสธ', async () => {
    const bad = await new SignJWT({ email: 'a@example.com', role: 'SUPERUSER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(bad)).toBeNull();
  });

  it('token ว่างคืน null', async () => {
    expect(await verifySession('')).toBeNull();
  });
});

describe('session — การจัดการ JWT_SECRET', () => {
  it('secret ที่สั้นกว่า 32 ตัวอักษรถือว่าไม่พร้อมใช้', () => {
    process.env.JWT_SECRET = 'too-short';
    expect(getJwtSecret()).toBeNull();
    expect(isAuthConfigured()).toBe(false);
  });

  it('ไม่มี secret → ไม่พร้อมใช้ (fail closed)', () => {
    delete process.env.JWT_SECRET;
    expect(isAuthConfigured()).toBe(false);
  });

  it('sign จะ throw เมื่อไม่มี secret ที่ใช้ได้', async () => {
    process.env.JWT_SECRET = 'short';
    await expect(signSession({ sub: 'a', email: 'a@b.com', role: 'ADMIN' })).rejects.toThrow();
  });

  it('Max-Age ของ cookie ตรงกับอายุ token', () => {
    delete process.env.SESSION_TTL_HOURS;
    expect(sessionCookieMaxAge()).toBe(SESSION_TTL_SECONDS);
    expect(SESSION_TTL_SECONDS).toBe(8 * 60 * 60);
  });

  it('SESSION_TTL_HOURS ตั้งค่าได้ และค่าที่ไม่ถูกต้องถอยไปใช้ค่าเริ่มต้น', () => {
    process.env.SESSION_TTL_HOURS = '2';
    expect(sessionTtlSeconds()).toBe(2 * 60 * 60);
    expect(sessionCookieMaxAge()).toBe(2 * 60 * 60);

    for (const bad of ['0', '-1', 'abc', '9999', '']) {
      process.env.SESSION_TTL_HOURS = bad;
      expect(sessionTtlSeconds()).toBe(SESSION_TTL_SECONDS);
    }
  });
});

describe('session — cookie Secure flag', () => {
  it('production + ไม่ตั้ง COOKIE_SECURE → Secure = true', () => {
    setNodeEnv('production');
    delete process.env.COOKIE_SECURE;
    expect(shouldUseSecureCookie()).toBe(true);
  });

  it('COOKIE_SECURE=false ปิด Secure ได้ (สำหรับทดสอบ HTTP local)', () => {
    setNodeEnv('production');
    process.env.COOKIE_SECURE = 'false';
    expect(shouldUseSecureCookie()).toBe(false);
  });

  it('development → Secure = false', () => {
    setNodeEnv('development');
    delete process.env.COOKIE_SECURE;
    expect(shouldUseSecureCookie()).toBe(false);
  });
});
