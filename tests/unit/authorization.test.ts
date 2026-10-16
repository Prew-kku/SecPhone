import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Authorization matrix (T3.16)
 *
 * พิสูจน์ว่า **ทุก server action** ต้องผ่านการยืนยันตัวตนก่อนแตะฐานข้อมูล
 * เรา mock `next/headers` ให้มี cookie ว่าง (ไม่มีเซสชัน) แล้วยืนยันว่า action
 * เหล่านั้นโยน UnauthorizedError ไม่ใช่ทำงานสำเร็จ
 *
 * ทำไม mock: server action อ่าน cookie ผ่าน `next/headers` ซึ่งต้องมี request scope
 * ของ Next.js — นอกบริบทนั้นเราจำลอง cookie store เพื่อทดสอบเส้นทาง guard โดยตรง
 * (ตัว guard เองทดสอบกับ JWT จริงใน session.test.ts / auth.test.ts)
 */

const cookieGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet, set: vi.fn() }),
}));

// กันไม่ให้ next/cache และ next/navigation ทำงานจริงระหว่างเทสต์
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const {
  createDeviceAction,
  updateDeviceAction,
  changeStatusAction,
  toggleFeaturedAction,
  softDeleteDeviceAction,
  uploadImagesAction,
  deleteImageAction,
  setPrimaryImageAction,
  reorderImagesAction,
} = await import('@/app/admin/(protected)/actions');
const { requireAdmin, getCurrentAdmin, UnauthorizedError } = await import('@/lib/auth/guard');

beforeAll(() => {
  process.env.JWT_SECRET = 'authz-test-secret-at-least-32-characters';
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

/** ไม่มี cookie เซสชันเลย */
function noSession() {
  cookieGet.mockReturnValue(undefined);
}

/** มี cookie แต่เป็น token ขยะ */
function garbageSession() {
  cookieGet.mockReturnValue({ value: 'not.a.valid.jwt' });
}

describe('guard — getCurrentAdmin / requireAdmin', () => {
  it('ไม่มี cookie → getCurrentAdmin คืน null', async () => {
    noSession();
    expect(await getCurrentAdmin()).toBeNull();
  });

  it('token ขยะ → getCurrentAdmin คืน null', async () => {
    garbageSession();
    expect(await getCurrentAdmin()).toBeNull();
  });

  it('ไม่มี cookie → requireAdmin โยน UnauthorizedError (401)', async () => {
    noSession();
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('ไม่มี JWT_SECRET → ถือว่าไม่ผ่าน (fail closed)', async () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      cookieGet.mockReturnValue({ value: 'anything' });
      expect(await getCurrentAdmin()).toBeNull();
      await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    } finally {
      process.env.JWT_SECRET = original;
    }
  });
});

describe('authorization matrix — ทุก mutation ปฏิเสธเมื่อไม่ยืนยันตัวตน', () => {
  function formData(values: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  }

  const validForm = formData({
    newBrandName: 'X',
    newModelName: 'Y',
    storageGb: '128',
    color: 'ดำ',
    priceThb: '1000',
    conditionGrade: 'A',
    description: 'd',
    status: 'DRAFT',
  });

  const cases: { name: string; run: () => Promise<unknown> }[] = [
    { name: 'createDeviceAction', run: () => createDeviceAction(validForm) },
    { name: 'updateDeviceAction', run: () => updateDeviceAction('dev1', validForm) },
    { name: 'changeStatusAction', run: () => changeStatusAction('dev1', 'SOLD') },
    { name: 'toggleFeaturedAction', run: () => toggleFeaturedAction('dev1', true) },
    { name: 'softDeleteDeviceAction', run: () => softDeleteDeviceAction('dev1') },
    {
      name: 'uploadImagesAction',
      run: () => uploadImagesAction('dev1', formData({})),
    },
    { name: 'deleteImageAction', run: () => deleteImageAction('dev1', 'img1') },
    { name: 'setPrimaryImageAction', run: () => setPrimaryImageAction('dev1', 'img1') },
    { name: 'reorderImagesAction', run: () => reorderImagesAction('dev1', ['img1']) },
  ];

  for (const testCase of cases) {
    it(`${testCase.name} → โยน UnauthorizedError เมื่อไม่มีเซสชัน`, async () => {
      noSession();
      await expect(testCase.run()).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it(`${testCase.name} → โยน UnauthorizedError เมื่อ token ปลอม`, async () => {
      garbageSession();
      await expect(testCase.run()).rejects.toBeInstanceOf(UnauthorizedError);
    });
  }
});
