import { Prisma, type DeviceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveImageSrc } from '@/lib/storage/paths';
import { requireAdmin } from '@/lib/auth/guard';

/**
 * READ queries สำหรับหน้า admin (เห็นทุกสถานะ รวม DRAFT/ARCHIVED)
 * แยกจาก src/lib/queries/devices.ts ที่กรองเฉพาะ AVAILABLE/SOLD สำหรับ public
 *
 * ⚠️ การอนุญาต (authorization) บังคับที่ **ชั้น data-access นี้เอง** ไม่ใช่พึ่ง layout
 * หรือ middleware เพียงอย่างเดียว — ทุกฟังก์ชันที่คืนข้อมูลหลังบ้านเรียก
 * `requireAdmin()` เป็นบรรทัดแรก (ตรวจ JWT + สถานะบัญชีจาก DB ทุกครั้ง)
 * เหตุผล: server component ใด ๆ ที่ import ฟังก์ชันนี้จะไม่สามารถอ่านข้อมูลหลังบ้าน
 * ได้โดยไม่ผ่านการตรวจ แม้จะถูกเรียกนอกหน้า admin ก็ตาม
 */

export type AdminDeviceRow = {
  id: string;
  sku: string;
  slug: string;
  brandName: string;
  modelName: string;
  storageGb: number;
  color: string;
  priceThb: number;
  conditionGrade: 'A' | 'B' | 'C';
  status: DeviceStatus;
  isFeatured: boolean;
  imageSrc: string | null;
  updatedAt: Date;
};

const adminRowSelect = {
  id: true,
  sku: true,
  slug: true,
  storageGb: true,
  color: true,
  priceThb: true,
  conditionGrade: true,
  status: true,
  isFeatured: true,
  updatedAt: true,
  model: { select: { name: true, brand: { select: { name: true } } } },
  images: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
    select: { filename: true },
  },
};

type AdminRowShape = {
  id: string;
  sku: string;
  slug: string;
  storageGb: number;
  color: string;
  priceThb: number;
  conditionGrade: 'A' | 'B' | 'C';
  status: DeviceStatus;
  isFeatured: boolean;
  updatedAt: Date;
  model: { name: string; brand: { name: string } };
  images: { filename: string }[];
};

function toAdminRow(row: AdminRowShape): AdminDeviceRow {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    brandName: row.model.brand.name,
    modelName: row.model.name,
    storageGb: row.storageGb,
    color: row.color,
    priceThb: row.priceThb,
    conditionGrade: row.conditionGrade,
    status: row.status,
    isFeatured: row.isFeatured,
    imageSrc: resolveImageSrc(row.images[0]?.filename),
    updatedAt: row.updatedAt,
  };
}

export type AdminDeviceFilter = {
  q?: string;
  status?: DeviceStatus;
};

/** รายการสินค้าทั้งหมดสำหรับตาราง admin (ไม่รวมที่ soft-deleted) */
export async function getAdminDevices(filter: AdminDeviceFilter = {}): Promise<AdminDeviceRow[]> {
  await requireAdmin();

  const where: Prisma.DeviceWhereInput = { deletedAt: null };

  if (filter.status) where.status = filter.status;
  if (filter.q) {
    const q = filter.q;
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { model: { name: { contains: q, mode: 'insensitive' } } },
      { model: { brand: { name: { contains: q, mode: 'insensitive' } } } },
      { color: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.device.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    take: 200,
    select: adminRowSelect,
  });
  return rows.map(toAdminRow);
}

export type AdminStats = {
  total: number;
  available: number;
  draft: number;
  sold: number;
  archived: number;
  featured: number;
};

/** สถิติสำหรับ dashboard */
export async function getAdminStats(): Promise<AdminStats> {
  await requireAdmin();

  const base: Prisma.DeviceWhereInput = { deletedAt: null };

  const [grouped, featured] = await Promise.all([
    prisma.device.groupBy({
      by: ['status'],
      where: base,
      _count: { _all: true },
    }),
    prisma.device.count({ where: { ...base, isFeatured: true, status: 'AVAILABLE' } }),
  ]);

  const counts: Record<DeviceStatus, number> = {
    DRAFT: 0,
    AVAILABLE: 0,
    SOLD: 0,
    ARCHIVED: 0,
  };
  for (const group of grouped) counts[group.status] = group._count._all;

  return {
    total: counts.DRAFT + counts.AVAILABLE + counts.SOLD + counts.ARCHIVED,
    available: counts.AVAILABLE,
    draft: counts.DRAFT,
    sold: counts.SOLD,
    archived: counts.ARCHIVED,
    featured,
  };
}

export type AdminDeviceImage = {
  id: string;
  filename: string;
  src: string | null;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
};

export type AdminDeviceDetail = {
  id: string;
  sku: string;
  slug: string;
  storageGb: number;
  ramGb: number | null;
  color: string;
  priceThb: number;
  conditionGrade: 'A' | 'B' | 'C';
  batteryHealthPct: number | null;
  cosmeticDefects: string | null;
  repairHistory: string | null;
  accessories: string | null;
  warrantyInfo: string | null;
  description: string;
  status: DeviceStatus;
  isFeatured: boolean;
  publishedAt: Date | null;
  brandId: string;
  modelId: string;
  brandName: string;
  modelName: string;
  images: AdminDeviceImage[];
};

/** รายละเอียดสินค้าสำหรับหน้า edit (ทุกสถานะ) */
export async function getAdminDeviceById(id: string): Promise<AdminDeviceDetail | null> {
  await requireAdmin();

  const row = await prisma.device.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      slug: true,
      storageGb: true,
      ramGb: true,
      color: true,
      priceThb: true,
      conditionGrade: true,
      batteryHealthPct: true,
      cosmeticDefects: true,
      repairHistory: true,
      accessories: true,
      warrantyInfo: true,
      description: true,
      status: true,
      isFeatured: true,
      publishedAt: true,
      deletedAt: true,
      model: { select: { id: true, name: true, brand: { select: { id: true, name: true } } } },
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          filename: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
          width: true,
          height: true,
        },
      },
    },
  });

  if (!row || row.deletedAt !== null) return null;

  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    storageGb: row.storageGb,
    ramGb: row.ramGb,
    color: row.color,
    priceThb: row.priceThb,
    conditionGrade: row.conditionGrade,
    batteryHealthPct: row.batteryHealthPct,
    cosmeticDefects: row.cosmeticDefects,
    repairHistory: row.repairHistory,
    accessories: row.accessories,
    warrantyInfo: row.warrantyInfo,
    description: row.description,
    status: row.status,
    isFeatured: row.isFeatured,
    publishedAt: row.publishedAt,
    brandId: row.model.brand.id,
    modelId: row.model.id,
    brandName: row.model.brand.name,
    modelName: row.model.name,
    images: row.images.map((image) => ({
      id: image.id,
      filename: image.filename,
      src: resolveImageSrc(image.filename),
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      width: image.width,
      height: image.height,
    })),
  };
}

/** ตัวเลือกแบรนด์/รุ่นสำหรับ dropdown ในฟอร์ม */
export type BrandOption = {
  id: string;
  name: string;
  models: { id: string; name: string }[];
};

export async function getBrandOptions(): Promise<BrandOption[]> {
  await requireAdmin();

  const brands = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      models: { orderBy: { name: 'asc' }, select: { id: true, name: true } },
    },
  });
  return brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    models: brand.models.map((model) => ({ id: model.id, name: model.name })),
  }));
}
