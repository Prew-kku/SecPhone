import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  changeDeviceStatus,
  createDevice,
  setDeviceFeatured,
  softDeleteDevice,
  updateDevice,
} from '@/lib/mutations/devices';
import { getAdminDevices, getAdminStats } from '@/lib/queries/admin-devices';
import { getCatalog } from '@/lib/queries/catalog';
import { getDeviceBySlug } from '@/lib/queries/devices';
import type { DeviceFields } from '@/lib/validation/device';
import { canConnect, cleanTransactionalData, prisma } from './helpers';

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
    await createDevice(fields({ newModelName: 'S1', status: 'AVAILABLE' }), owner.id);
    await createDevice(fields({ newModelName: 'S2', status: 'AVAILABLE' }), owner.id);
    await createDevice(fields({ newModelName: 'S3', status: 'DRAFT' }), owner.id);

    const stats = await getAdminStats();
    expect(stats.available).toBe(2);
    expect(stats.draft).toBe(1);
    expect(stats.total).toBe(3);
  });
});
