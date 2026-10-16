import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '@/lib/auth/password';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session';
import { resetRateLimits } from '@/lib/auth/rate-limit';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { canConnect, cleanTransactionalData, prisma, testEmail } from './helpers';

const SECRET = 'integration-test-secret-at-least-32-chars-xx';
const PASSWORD = 'correct-password-123456';

let dbAvailable = false;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  // อนุญาตให้ cookie ไม่ Secure ในเทสต์ (ไม่มี HTTPS ในระดับ route handler)
  process.env.COOKIE_SECURE = 'false';
  dbAvailable = await canConnect();
  if (dbAvailable) await cleanTransactionalData();
});

afterAll(async () => {
  if (dbAvailable) await cleanTransactionalData();
  await prisma.$disconnect();
});

afterEach(() => resetRateLimits());

/** สร้างคำขอ login พร้อม Origin ที่ถูกต้อง (ผ่าน origin check) */
function loginRequest(body: unknown, origin = 'http://localhost:3000'): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}

async function createAdmin(overrides: { isActive?: boolean; role?: 'OWNER' | 'ADMIN' } = {}) {
  const email = testEmail('admin');
  const passwordHash = await hashPassword(PASSWORD);
  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      displayName: 'ผู้ดูแลทดสอบ',
      role: overrides.role ?? 'OWNER',
      isActive: overrides.isActive ?? true,
    },
  });
  return { admin, email };
}

describe.skipIf(!process.env.DATABASE_URL)('auth integration — login', () => {
  it('login สำเร็จ → ตั้ง cookie sp_session ที่ verify ได้', async () => {
    if (!dbAvailable) return;
    const { admin, email } = await createAdmin();

    const response = await loginRoute(loginRequest({ email, password: PASSWORD }));
    expect(response.status).toBe(200);

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');

    const token = response.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(token).toBeTruthy();
    const payload = await verifySession(token!);
    expect(payload?.sub).toBe(admin.id);
    expect(payload?.role).toBe('OWNER');

    // lastLoginAt ถูกอัปเดต
    const updated = await prisma.adminUser.findUnique({ where: { id: admin.id } });
    expect(updated?.lastLoginAt).not.toBeNull();
  });

  it('รหัสผ่านผิด → 401 พร้อมข้อความกลาง ๆ ไม่ตั้ง cookie', async () => {
    if (!dbAvailable) return;
    const { email } = await createAdmin();

    const response = await loginRoute(loginRequest({ email, password: 'wrong-password' }));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('อีเมลที่ไม่มีในระบบ → 401 และข้อความเหมือนรหัสผ่านผิด (ไม่มี user enumeration)', async () => {
    if (!dbAvailable) return;

    const response = await loginRoute(
      loginRequest({ email: 'nobody@example.test', password: 'whatever-123' }),
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  });

  it('บัญชีที่ถูกปิดใช้งาน → ไม่ตั้ง cookie', async () => {
    if (!dbAvailable) return;
    const { email } = await createAdmin({ isActive: false });

    const response = await loginRoute(loginRequest({ email, password: PASSWORD }));
    expect(response.status).toBe(403);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it('Origin ที่ไม่ถูกต้อง → 403 ก่อนแตะ DB', async () => {
    if (!dbAvailable) return;
    const { email } = await createAdmin();

    const response = await loginRoute(
      loginRequest({ email, password: PASSWORD }, 'https://evil.example.com'),
    );
    expect(response.status).toBe(403);
  });

  it('rate limit: ยิงผิด 5 ครั้ง แล้วครั้งที่ 6 ได้ 429 + Retry-After', async () => {
    if (!dbAvailable) return;
    const { email } = await createAdmin();

    for (let i = 0; i < 5; i += 1) {
      const response = await loginRoute(loginRequest({ email, password: 'wrong' }));
      expect(response.status).toBe(401);
    }
    const blocked = await loginRoute(loginRequest({ email, password: 'wrong' }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('ไม่มี JWT_SECRET → 503 (fail closed)', async () => {
    if (!dbAvailable) return;
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      const response = await loginRoute(
        loginRequest({ email: 'x@example.test', password: 'x' }),
      );
      expect(response.status).toBe(503);
    } finally {
      process.env.JWT_SECRET = original;
    }
  });
});

describe.skipIf(!process.env.DATABASE_URL)('auth integration — logout', () => {
  it('logout ล้าง cookie (Max-Age=0)', async () => {
    if (!dbAvailable) return;

    const response = await logoutRoute(
      new Request('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
      }),
    );
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie.toLowerCase()).toContain('max-age=0');
  });

  it('logout จาก origin แปลก ๆ → 403', async () => {
    if (!dbAvailable) return;

    const response = await logoutRoute(
      new Request('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { origin: 'https://evil.example.com' },
      }),
    );
    expect(response.status).toBe(403);
  });
});
