import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Upload route authorization + request size (issue #2)
 *
 * พิสูจน์ว่า `POST /api/admin/devices/[id]/images`:
 *  - ปฏิเสธก่อนถึงชั้นประมวลผลรูปเมื่อไม่มีเซสชัน (401)
 *  - ปฏิเสธเมื่อ Origin ไม่ถูกต้อง (403)
 *  - ปฏิเสธ multipart ที่ใหญ่เกินเพดาน (413) **หลัง** ผ่าน auth แล้ว
 *
 * mock: route handler อ่าน cookie ผ่าน `next/headers` (ต้องมี request scope ของ Next)
 * และ guard อ่าน DB → เราจำลอง cookie store และ mock `@/lib/prisma` เพื่อไม่แตะ DB จริง
 * (เรื่องนี้ถือว่าจำเป็น: เราไม่ต้องการให้ unit test แตะฐานข้อมูลจริง)
 */

const cookieGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet, set: vi.fn() }),
}));

// mock singleton Prisma — guard ใช้ findUnique เพื่อตรวจบัญชี
vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
  },
  default: { adminUser: { findUnique: vi.fn() } },
}));

const addDeviceImages = vi.fn();

vi.mock('@/lib/mutations/devices', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mutations/devices')>(
    '@/lib/mutations/devices',
  );
  return { ...actual, addDeviceImages: (...args: unknown[]) => addDeviceImages(...args) };
});

const { POST } = await import('@/app/api/admin/devices/[id]/images/route');
const { signSession } = await import('@/lib/auth/session');
const { prisma } = await import('@/lib/prisma');
const { maxUploadBytes, maxRequestBytes } = await import('@/lib/storage/upload');

const SECRET = 'upload-route-secret-at-least-32-characters';
let validToken = '';
const findUnique = prisma.adminUser.findUnique as unknown as ReturnType<typeof vi.fn>;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  validToken = await signSession({ sub: 'admin-1', email: 'a@example.test', role: 'OWNER' }, SECRET);
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

/** ทำให้เซสชันถูกต้องและบัญชี active */
function authenticate() {
  cookieGet.mockReturnValue({ value: validToken });
  findUnique.mockResolvedValue({
    id: 'admin-1',
    email: 'a@example.test',
    displayName: 'Admin',
    role: 'OWNER',
    isActive: true,
  });
}

function uploadRequest(blob: Blob, options: { origin?: string | null; name?: string } = {}): Request {
  const form = new FormData();
  form.append('file', blob, options.name ?? 'photo.webp');
  const headers: Record<string, string> = {};
  if (options.origin !== null) headers.Origin = options.origin ?? 'http://localhost:3000';
  return new Request('http://localhost:3000/api/admin/devices/dev1/images', {
    method: 'POST',
    body: form,
    headers,
  });
}

const params = Promise.resolve({ id: 'dev1' });

describe('upload route — authorization', () => {
  it('ไม่มีเซสชัน → 401 และไม่แตะ addDeviceImages', async () => {
    cookieGet.mockReturnValue(undefined);
    addDeviceImages.mockClear();

    const response = await POST(uploadRequest(new Blob([new Uint8Array([1, 2, 3])])), { params });

    expect(response.status).toBe(401);
    expect(addDeviceImages).not.toHaveBeenCalled();
  });

  it('token ปลอม → 401', async () => {
    cookieGet.mockReturnValue({ value: 'not.a.jwt' });
    addDeviceImages.mockClear();

    const response = await POST(uploadRequest(new Blob([new Uint8Array([1, 2, 3])])), { params });
    expect(response.status).toBe(401);
    expect(addDeviceImages).not.toHaveBeenCalled();
  });

  it('บัญชีถูกปิดใช้งาน → 401', async () => {
    cookieGet.mockReturnValue({ value: validToken });
    findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'a@example.test',
      displayName: 'Admin',
      role: 'OWNER',
      isActive: false,
    });
    addDeviceImages.mockClear();

    const response = await POST(uploadRequest(new Blob([new Uint8Array([1])])), { params });
    expect(response.status).toBe(401);
    expect(addDeviceImages).not.toHaveBeenCalled();
  });

  it('ไม่มี Origin/Referer → 403 (CSRF fail closed)', async () => {
    authenticate();
    addDeviceImages.mockClear();

    const response = await POST(uploadRequest(new Blob([new Uint8Array([1])]), { origin: null }), {
      params,
    });
    expect(response.status).toBe(403);
    expect(addDeviceImages).not.toHaveBeenCalled();
  });

  it('Origin แปลก → 403', async () => {
    authenticate();
    const response = await POST(
      uploadRequest(new Blob([new Uint8Array([1])]), { origin: 'https://evil.example' }),
      { params },
    );
    expect(response.status).toBe(403);
  });
});

describe('upload route — request size limit', () => {
  it('multipart ที่เกินเพดาน request → 413 (หลังผ่าน auth) และไม่แตะ addDeviceImages', async () => {
    authenticate();
    addDeviceImages.mockClear();

    const tooLarge = new Blob([new Uint8Array(maxRequestBytes() + 1024)]);
    const response = await POST(uploadRequest(tooLarge), { params });

    expect(response.status).toBe(413);
    expect(addDeviceImages).not.toHaveBeenCalled();
  });

  it('เพดาน request ใหญ่กว่าขนาดไฟล์ (มี overhead ให้ multipart)', () => {
    expect(maxUploadBytes()).toBe(8 * 1024 * 1024);
    expect(maxRequestBytes()).toBeGreaterThan(maxUploadBytes());
  });
});
