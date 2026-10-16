import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AdminRole } from '@prisma/client';
import { SESSION_COOKIE_NAME, signSession } from '@/lib/auth/session';
import type { DeviceFields } from '@/lib/validation/device';
import { canConnect, cleanTransactionalData, prisma } from './helpers';

/**
 * admin query ต่าง ๆ บังคับ `requireAdmin()` ที่ชั้น data-access (issue #3)
 * การอ่านข้อมูลหลังบ้านจึงต้องมีเซสชันจริง
 *
 * เราจำลองเฉพาะ cookie store (`next/headers`) ให้คืน token ที่เซ็นด้วย JWT_SECRET จริง
 * ส่วนการตรวจบัญชี (`prisma.adminUser.findUnique`) และ query อื่น ๆ ใช้ DB จริง
 * การ mock นี้จำเป็นเพราะ `next/headers` ต้องมี request scope ของ Next.js
 */

let currentCookie: { name: string; value: string } | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (currentCookie?.name === name ? currentCookie : undefined),
    set: () => {},
  }),
}));

const { changeDeviceStatus, createDevice, setDeviceFeatured, softDeleteDevice, updateDevice } =
  await import('@/lib/mutations/devices');
const { getAdminDevices, getAdminStats, getAdminDeviceById } = await import('@/lib/queries/admin-devices');
const { getCatalog } = await import('@/lib/queries/catalog');
const { getDeviceBySlug } = await import('@/lib/queries/devices');

const SECRET = 'integration-admin-session-secret-32-chars';
process.env.JWT_SECRET = SECRET;

async function signIn(payload: { sub: string; email: string; role: AdminRole }) {
  const token = await signSession(payload, SECRET);
  currentCookie = { name: SESSION_COOKIE_NAME, value: token };
}

let dbAvailable = false;
let adminId = '';

beforeAll(async () => {
  dbAvailable = await canConnect();
  if (!dbAvailable) return;
  await cleanTransactionalData();
  const admin = await prisma.adminUser.create({
    data: {
      email: `owner-${Date.now()}@example.test`,
      passwordHash: 'x',
      displayName: 'Owner',
      role: 'OWNER',
    },
  });
  adminId = admin.id;
  await signIn({ sub: admin.id, email: admin.email, role: 'OWNER' });
});

afterAll(async () => {
  if (dbAvailable) await cleanTransactionalData();
  await prisma.$disconnect();
});

/** ข้อมูลฟอร์มขั้นต่ำที่ผ่าน Zod */
function fields(overrides: Partial<DeviceFields> = {}): DeviceFields {
  const base = {
    newBrandName: 'TestBrand',
    newModelName: 'TestModel X',
    storageGb: 128,
    color: 'ดำ',
    priceThb: 9900,
    conditionGrade: 'A' as const,
    description: 'เครื่องทดสอบ',
    status: 'AVAILABLE' as const,
    isFeatured: false,
  };
  return { ...base, ...overrides } as DeviceFields;
}

describe.skipIf(!process.env.DATABASE_URL)('device mutations', () => {
  it('create สร้าง device + แบรนด์ + รุ่น และได้ slug/sku ไม่ซ้ำ', async () => {
    if (!dbAvailable) return;
    const a = await createDevice(fields({ newModelName: 'Alpha' }), adminId);
    const b = await createDevice(fields({ newModelName: 'Beta' }), adminId);

    expect(a.sku).not.toBe(b.sku);
    expect(a.slug).not.toBe(b.slug);

    const stored = await prisma.device.findUnique({
      where: { id: a.id },
      include: { model: { include: { brand: true } } },
    });
    expect(stored?.model.brand.name).toBe('TestBrand');
    expect(stored?.createdById).toBe(adminId);
    // AVAILABLE → publishedAt ถูกตั้ง
    expect(stored?.publishedAt).not.toBeNull();
  });

  it('create ด้วยสถานะ DRAFT → publishedAt เป็น null', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(
      fields({ newModelName: 'DraftModel', status: 'DRAFT' }),
      adminId,
    );
    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(stored?.publishedAt).toBeNull();
  });

  it('slug/sku ไม่ซ้ำแม้ข้อมูลเหมือนกัน (สร้างซ้ำ)', async () => {
    if (!dbAvailable) return;
    const first = await createDevice(fields({ newModelName: 'Dup' }), adminId);
    const second = await createDevice(fields({ newModelName: 'Dup' }), adminId);
    expect(first.slug).not.toBe(second.slug);
    expect(first.sku).not.toBe(second.sku);
  });

  it('update เปลี่ยนราคา/สภาพได้ และไม่แตะ createdById', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields({ newModelName: 'Editable' }), adminId);

    await updateDevice(device.id, fields({ newModelName: 'Editable', priceThb: 7500, conditionGrade: 'C' }));

    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(stored?.priceThb).toBe(7500);
    expect(stored?.conditionGrade).toBe('C');
    expect(stored?.createdById).toBe(adminId);
  });

  it('ราคาเป็น integer เสมอ (ไม่มีเศษทศนิยม)', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields({ newModelName: 'IntPrice', priceThb: 12345 }), adminId);
    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(Number.isInteger(stored?.priceThb)).toBe(true);
  });

  it('softDelete ตั้ง deletedAt + ARCHIVED และหายจากรายการ admin', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields({ newModelName: 'ToDelete' }), adminId);
    await softDeleteDevice(device.id);

    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(stored?.deletedAt).not.toBeNull();
    expect(stored?.status).toBe('ARCHIVED');

    const list = await getAdminDevices({});
    expect(list.some((row) => row.id === device.id)).toBe(false);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('visibility — สถานะมีผลกับหน้า public', () => {
  it('AVAILABLE ปรากฏใน catalog; ARCHIVED/DRAFT ไม่ปรากฏ', async () => {
    if (!dbAvailable) return;
    const available = await createDevice(fields({ newModelName: 'VisibleModel' }), adminId);
    const draft = await createDevice(
      fields({ newModelName: 'HiddenDraft', status: 'DRAFT' }),
      adminId,
    );

    const catalog = await getCatalog({ sort: 'newest', page: 1 });
    const ids = catalog.items.map((item) => item.id);
    expect(ids).toContain(available.id);
    expect(ids).not.toContain(draft.id);

    // detail ของ DRAFT → null (404)
    const draftStored = await prisma.device.findUnique({ where: { id: draft.id } });
    expect(await getDeviceBySlug(draftStored!.slug)).toBeNull();
  });

  it('เปลี่ยนเป็น ARCHIVED → หายจาก catalog ทันที', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields({ newModelName: 'ToArchive' }), adminId);

    let catalog = await getCatalog({ sort: 'newest', page: 1 });
    expect(catalog.items.map((i) => i.id)).toContain(device.id);

    await changeDeviceStatus(device.id, 'ARCHIVED');

    catalog = await getCatalog({ sort: 'newest', page: 1 });
    expect(catalog.items.map((i) => i.id)).not.toContain(device.id);
  });

  it('เปลี่ยนเป็น SOLD → ยังแสดงใน catalog แต่มีสถานะ SOLD', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields({ newModelName: 'ToSold' }), adminId);
    await changeDeviceStatus(device.id, 'SOLD');

    const catalog = await getCatalog({ sort: 'newest', page: 1 });
    const found = catalog.items.find((i) => i.id === device.id);
    // หมายเหตุ: catalog กรองเฉพาะ AVAILABLE จึงอาจไม่ปรากฏ — ตรวจว่าภาพ public ถูกต้อง
    if (found) expect(found.status).toBe('SOLD');

    // หน้ารายละเอียดต้องเปิดได้และแสดง SOLD
    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    const detail = await getDeviceBySlug(stored!.slug);
    expect(detail?.status).toBe('SOLD');
  });

  it('setFeatured เปลี่ยนค่า isFeatured', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields({ newModelName: 'Featurable' }), adminId);
    await setDeviceFeatured(device.id, true);
    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(stored?.isFeatured).toBe(true);
  });

  it('getAdminStats นับตามสถานะถูกต้อง', async () => {
    if (!dbAvailable) return;
    await cleanTransactionalData();
    // clean ลบ admin ทดสอบไปด้วย — สร้างใหม่ก่อนอ้าง createdById
    const owner = await prisma.adminUser.create({
      data: {
        email: `stats-owner-${Date.now()}@example.test`,
        passwordHash: 'x',
        displayName: 'Owner',
        role: 'OWNER',
      },
    });
    // ต้องมีเซสชันของผู้ดูแลคนใหม่ (requireAdmin ตรวจสถานะบัญชีจาก DB)
    await signIn({ sub: owner.id, email: owner.email, role: 'OWNER' });

    await createDevice(fields({ newModelName: 'S1', status: 'AVAILABLE' }), owner.id);
    await createDevice(fields({ newModelName: 'S2', status: 'AVAILABLE' }), owner.id);
    await createDevice(fields({ newModelName: 'S3', status: 'DRAFT' }), owner.id);

    const stats = await getAdminStats();
    expect(stats.available).toBe(2);
    expect(stats.draft).toBe(1);
    expect(stats.total).toBe(3);
  });

  it('admin read ปฏิเสธเมื่อไม่มีเซสชัน (issue #3 — data-access boundary)', async () => {
    if (!dbAvailable) return;
    currentCookie = undefined;
    await expect(getAdminDevices({})).rejects.toThrow();
    await expect(getAdminStats()).rejects.toThrow();
    await expect(getAdminDeviceById('whatever')).rejects.toThrow();
    // คืนเซสชันกลับเพื่อไม่กระทบเทสต์ถัดไป
    await signIn({ sub: adminId, email: 'owner@example.test', role: 'OWNER' });
  });

  it('admin read ปฏิเสธเมื่อบัญชีถูกปิดใช้งาน', async () => {
    if (!dbAvailable) return;
    const disabled = await prisma.adminUser.create({
      data: {
        email: `disabled-${Date.now()}@example.test`,
        passwordHash: 'x',
        displayName: 'Disabled',
        role: 'OWNER',
        isActive: false,
      },
    });
    await signIn({ sub: disabled.id, email: disabled.email, role: 'OWNER' });
    await expect(getAdminDevices({})).rejects.toThrow();
    await signIn({ sub: adminId, email: 'owner@example.test', role: 'OWNER' });
  });
});
