import { Prisma, type DeviceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildSkuBase, uniqueSlug, uniqueSku } from '@/lib/slug';
import { type DeviceFields } from '@/lib/validation/device';
import { processAndStoreImage, removeStoredImage } from '@/lib/storage/upload';

/**
 * Business logic สำหรับ Device (CREATE/UPDATE/DELETE) — แยกจาก UI/route
 *
 * หลักการ:
 * - **ไม่รับ object ดิบจากฟอร์มแล้ว spread ลง prisma** (กัน mass assignment)
 *   เราดึงเฉพาะ field ที่ schema อนุญาต
 * - ใช้ transaction เมื่อมีการเขียนหลายตาราง (device + images) เพื่อไม่ให้ข้อมูลค้างครึ่งทาง
 * - สถานะ publishedAt จัดการที่นี่ที่เดียว
 * - ห้ามลบจริง: ใช้ soft-delete (deletedAt) ตาม PLAN §5.3
 */

export class DeviceMutationError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'DeviceMutationError';
    this.field = field;
  }
}

/** ตรวจว่าเป็น unique constraint ของ Prisma (P2002) และคืนชื่อ field ที่ชน */
function uniqueFieldOf(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = error.meta?.target;
    if (Array.isArray(target) && target.length > 0) return String(target[0]);
    if (typeof target === 'string') return target;
    return 'unique';
  }
  return null;
}

/**
 * จัดการแบรนด์/รุ่นจาก input: ใช้ของเดิม (id) หรือสร้างใหม่ (ชื่อ)
 * ทำงานภายใน transaction (tx) เพื่อให้ atomic
 */
async function resolveBrandAndModel(
  tx: Prisma.TransactionClient,
  input: DeviceFields,
): Promise<{ modelId: string; brandName: string; modelName: string }> {
  // ---- แบรนด์ ----
  let brandId: string;
  let brandName: string;

  if (input.brandId) {
    const brand = await tx.brand.findUnique({ where: { id: input.brandId } });
    if (!brand) throw new DeviceMutationError('ไม่พบแบรนด์ที่เลือก', 'brandId');
    brandId = brand.id;
    brandName = brand.name;
  } else {
    const name = input.newBrandName!;
    // ถ้ามีแบรนด์ชื่อเดียวกันอยู่แล้ว ให้ใช้ของเดิม — ไม่พยายามสร้างซ้ำ
    // (Brand.name เป็น @unique จึง create ซ้ำจะล้มด้วย P2002)
    const existingByName = await tx.brand.findFirst({ where: { name } });
    if (existingByName) {
      brandId = existingByName.id;
      brandName = existingByName.name;
    } else {
      const prefix = slugifySafe(name);
      const existingSlugs = new Set(
        (
          await tx.brand.findMany({
            where: prefix ? { slug: { startsWith: prefix } } : {},
            select: { slug: true },
          })
        ).map((b) => b.slug),
      );
      const slug = uniqueSlug(name, (candidate) => existingSlugs.has(candidate));
      const created = await tx.brand.create({ data: { name, slug } });
      brandId = created.id;
      brandName = created.name;
    }
  }

  // ---- รุ่น ----
  if (input.modelId) {
    const model = await tx.phoneModel.findUnique({ where: { id: input.modelId } });
    if (!model) throw new DeviceMutationError('ไม่พบรุ่นที่เลือก', 'modelId');
    if (model.brandId !== brandId) {
      throw new DeviceMutationError('รุ่นที่เลือกไม่ได้อยู่ภายใต้แบรนด์ที่เลือก', 'modelId');
    }
    return { modelId: model.id, brandName, modelName: model.name };
  }

  const modelName = input.newModelName!;
  // ตรวจว่าไม่ซ้ำกับ (brandId, name) ที่มีอยู่
  const duplicate = await tx.phoneModel.findFirst({
    where: { brandId, name: modelName },
    select: { id: true, name: true },
  });
  if (duplicate) {
    // ถือว่าใช้รุ่นที่มีอยู่แล้ว (ไม่ error) เพื่อความสะดวกของผู้ใช้
    return { modelId: duplicate.id, brandName, modelName: duplicate.name };
  }

  const modelSlugs = new Set(
    (await tx.phoneModel.findMany({ select: { slug: true } })).map((m) => m.slug),
  );
  const modelSlug = uniqueSlug(modelName, (candidate) => modelSlugs.has(candidate));
  const created = await tx.phoneModel.create({
    data: { brandId, name: modelName, slug: modelSlug },
  });
  return { modelId: created.id, brandName, modelName: created.name };
}

/** slugify แบบเบา ๆ สำหรับ prefix query (ต้องไม่ import ของ client) */
function slugifySafe(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** สถานะที่ถือว่า "เผยแพร่แล้ว" — ตั้ง publishedAt เมื่อเข้าสถานะเหล่านี้ครั้งแรก */
const PUBLISHED_STATUSES: DeviceStatus[] = ['AVAILABLE', 'SOLD'];

/**
 * สร้าง Device ใหม่
 * @param createdById ผู้ดูแลที่สร้าง (audit)
 */
export async function createDevice(
  input: DeviceFields,
  createdById: string,
): Promise<{ id: string; slug: string; sku: string }> {
  return prisma.$transaction(async (tx) => {
    const { modelId, brandName, modelName } = await resolveBrandAndModel(tx, input);

    // สร้าง slug/sku ที่ไม่ซ้ำจริง (ตรวจกับ DB)
    const takenSlugs = new Set(
      (await tx.device.findMany({ select: { slug: true } })).map((d) => d.slug),
    );
    const takenSkus = new Set(
      (await tx.device.findMany({ select: { sku: true } })).map((d) => d.sku),
    );

    const slugBase = `${brandName}-${modelName}-${input.storageGb}-${input.color}`;
    const slug = uniqueSlug(slugBase, (candidate) => takenSlugs.has(candidate));
    const skuBase = buildSkuBase(brandName, modelName, input.storageGb, input.color);
    const sku = uniqueSku(skuBase, (candidate) => takenSkus.has(candidate));

    const publishedAt = PUBLISHED_STATUSES.includes(input.status) ? new Date() : null;

    const device = await tx.device.create({
      data: {
        sku,
        slug,
        modelId,
        storageGb: input.storageGb,
        ramGb: input.ramGb ?? null,
        color: input.color,
        priceThb: input.priceThb,
        conditionGrade: input.conditionGrade,
        batteryHealthPct: input.batteryHealthPct ?? null,
        cosmeticDefects: input.cosmeticDefects ?? null,
        repairHistory: input.repairHistory ?? null,
        accessories: input.accessories ?? null,
        warrantyInfo: input.warrantyInfo ?? null,
        description: input.description,
        status: input.status,
        isFeatured: input.isFeatured,
        publishedAt,
        createdById,
      },
      select: { id: true, slug: true, sku: true },
    });

    return device;
  });
}

/**
 * อัปเดต Device ที่มีอยู่
 *
 * - เปลี่ยน model/brand ได้ (จะไม่ย้าย device ข้ามแบรนด์โดยไม่ตั้งใจ เพราะตรวจว่า model อยู่ใต้ brand)
 * - publishedAt: ตั้งเมื่อเข้า published status ครั้งแรก และคงไว้ (ไม่รีเซ็ต)
 */
export async function updateDevice(
  deviceId: string,
  input: DeviceFields,
): Promise<{ id: string; slug: string }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.device.findUnique({
      where: { id: deviceId },
      select: { id: true, publishedAt: true, deletedAt: true, status: true },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new DeviceMutationError('ไม่พบสินค้าที่ต้องการแก้ไข');
    }

    const { modelId } = await resolveBrandAndModel(tx, input);

    const shouldPublish = PUBLISHED_STATUSES.includes(input.status);
    const publishedAt = shouldPublish ? (existing.publishedAt ?? new Date()) : existing.publishedAt;

    try {
      const device = await tx.device.update({
        where: { id: deviceId },
        data: {
          modelId,
          storageGb: input.storageGb,
          ramGb: input.ramGb ?? null,
          color: input.color,
          priceThb: input.priceThb,
          conditionGrade: input.conditionGrade,
          batteryHealthPct: input.batteryHealthPct ?? null,
          cosmeticDefects: input.cosmeticDefects ?? null,
          repairHistory: input.repairHistory ?? null,
          accessories: input.accessories ?? null,
          warrantyInfo: input.warrantyInfo ?? null,
          description: input.description,
          status: input.status,
          isFeatured: input.isFeatured,
          publishedAt,
        },
        select: { id: true, slug: true },
      });
      return device;
    } catch (error) {
      const field = uniqueFieldOf(error);
      if (field) throw new DeviceMutationError('ข้อมูลชนกับรายการอื่น (slug/sku ซ้ำ)', field);
      throw error;
    }
  });
}

/**
 * เปลี่ยนสถานะอย่างเดียว (ใช้จาก status control)
 * - ARCHIVED/DRAFT จะถูกซ่อนจากหน้า public ทันที เพราะ query public กรองด้วย status
 */
export async function changeDeviceStatus(deviceId: string, status: DeviceStatus): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.device.findUnique({
      where: { id: deviceId },
      select: { id: true, publishedAt: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new DeviceMutationError('ไม่พบสินค้า');
    }
    const shouldPublish = PUBLISHED_STATUSES.includes(status);
    await tx.device.update({
      where: { id: deviceId },
      data: {
        status,
        publishedAt: shouldPublish ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      },
    });
  });
}

/** สลับสถานะสินค้าแนะนำ */
export async function setDeviceFeatured(deviceId: string, isFeatured: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.device.findUnique({
      where: { id: deviceId },
      select: { id: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new DeviceMutationError('ไม่พบสินค้า');
    }
    await tx.device.update({ where: { id: deviceId }, data: { isFeatured } });
  });
}

/**
 * Soft-delete: ตั้ง deletedAt และซ่อนจาก public (ARCHIVED)
 * ไม่ลบแถวจริง เพื่อรักษาประวัติ/รูป (PLAN §5.3)
 */
export async function softDeleteDevice(deviceId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.device.findUnique({
      where: { id: deviceId },
      select: { id: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new DeviceMutationError('ไม่พบสินค้า');
    }
    await tx.device.update({
      where: { id: deviceId },
      data: { deletedAt: new Date(), status: 'ARCHIVED', isFeatured: false },
    });
  });
}

/* ------------------------------------------------------------------ */
/* Image management                                                    */
/* ------------------------------------------------------------------ */

const MAX_IMAGES_PER_DEVICE = 12;

/**
 * เพิ่มรูปให้ device — ประมวลผลก่อน แล้วเขียน DB ใน transaction
 *
 * สำคัญ: ถ้าเขียน DB ล้มเหลวหลังเขียนไฟล์แล้ว ต้องลบไฟล์ที่เพิ่งเขียนทิ้ง
 * เพื่อไม่ให้เหลือไฟล์กำพร้า (orphan) หรือ record ที่ไม่สอดคล้อง
 */
export async function addDeviceImages(
  deviceId: string,
  files: Uint8Array[],
): Promise<{ added: number; failures: string[] }> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, deletedAt: true, _count: { select: { images: true } } },
  });
  if (!device || device.deletedAt !== null) {
    throw new DeviceMutationError('ไม่พบสินค้า');
  }
  if (device._count.images + files.length > MAX_IMAGES_PER_DEVICE) {
    throw new DeviceMutationError(`แต่ละสินค้ามีรูปได้ไม่เกิน ${MAX_IMAGES_PER_DEVICE} รูป`);
  }

  const stored: { filename: string; width: number; height: number }[] = [];
  const failures: string[] = [];

  // ประมวลผล/เขียนไฟล์ก่อน — ถ้าล้มเหลวจะไม่แตะ DB
  for (const file of files) {
    try {
      const processed = await processAndStoreImage(deviceId, file);
      stored.push({ filename: processed.filename, width: processed.width, height: processed.height });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'อัปโหลดไม่สำเร็จ');
    }
  }

  if (stored.length === 0) {
    return { added: 0, failures };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const count = await tx.deviceImage.count({ where: { deviceId } });
      const hasPrimary = (await tx.deviceImage.count({ where: { deviceId, isPrimary: true } })) > 0;

      await tx.deviceImage.createMany({
        data: stored.map((image, index) => ({
          deviceId,
          filename: image.filename,
          width: image.width,
          height: image.height,
          sortOrder: count + index,
          // รูปแรกของ device กลายเป็น primary อัตโนมัติ
          isPrimary: !hasPrimary && index === 0,
        })),
      });
    });
  } catch (error) {
    // ลบไฟล์ที่เพิ่งเขียน เพื่อไม่ให้เหลือ orphan
    await Promise.all(stored.map((image) => removeStoredImage(image.filename).catch(() => {})));
    throw error;
  }

  return { added: stored.length, failures };
}

/** ลบรูป: ลบทั้ง record (transaction) และไฟล์บนดิสก์ */
export async function deleteDeviceImage(deviceId: string, imageId: string): Promise<void> {
  const image = await prisma.deviceImage.findFirst({
    where: { id: imageId, deviceId },
    select: { id: true, filename: true, isPrimary: true, sortOrder: true },
  });
  if (!image) throw new DeviceMutationError('ไม่พบรูปที่ต้องการลบ');

  await prisma.$transaction(async (tx) => {
    await tx.deviceImage.delete({ where: { id: image.id } });

    // ถ้าลบรูป primary ไป ให้เลื่อนรูปแรกที่เหลือขึ้นเป็น primary
    if (image.isPrimary) {
      const next = await tx.deviceImage.findFirst({
        where: { deviceId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (next) {
        await tx.deviceImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }
  });

  // ลบไฟล์จริงหลัง DB สำเร็จ — ถ้าลบไฟล์ไม่สำเร็จ อย่างน้อย metadata ก็ถูกต้อง
  await removeStoredImage(image.filename).catch(() => {});
}

/** ตั้งรูปที่ระบุเป็น primary และยกเลิก primary ของรูปอื่น */
export async function setPrimaryDeviceImage(deviceId: string, imageId: string): Promise<void> {
  const image = await prisma.deviceImage.findFirst({
    where: { id: imageId, deviceId },
    select: { id: true },
  });
  if (!image) throw new DeviceMutationError('ไม่พบรูปที่เลือก');

  await prisma.$transaction(async (tx) => {
    await tx.deviceImage.updateMany({ where: { deviceId }, data: { isPrimary: false } });
    await tx.deviceImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  });
}

/**
 * จัดลำดับรูปใหม่ตาม orderedIds
 * ตรวจว่ารายการที่ส่งมาตรงกับรูปของ device นี้ทั้งหมด (กันการแอบอ้าง imageId ของ device อื่น)
 */
export async function reorderDeviceImages(deviceId: string, orderedIds: string[]): Promise<void> {
  const images = await prisma.deviceImage.findMany({
    where: { deviceId },
    select: { id: true },
  });
  const existingIds = new Set(images.map((image) => image.id));
  const uniqueOrdered = [...new Set(orderedIds)];

  if (uniqueOrdered.length !== existingIds.size || uniqueOrdered.some((id) => !existingIds.has(id))) {
    throw new DeviceMutationError('รายการลำดับรูปไม่ตรงกับรูปของสินค้านี้');
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, imageId] of uniqueOrdered.entries()) {
      await tx.deviceImage.update({ where: { id: imageId }, data: { sortOrder: index } });
    }
  });
}
