import { prisma } from '@/lib/prisma';
import { resolveImageSrc } from '@/lib/storage/paths';

/**
 * รูปร่างข้อมูลที่ส่งออกให้ UI ได้ (public shape)
 * ไม่มีข้อมูลอ่อนไหว เช่น IMEI/serial (ไม่มีใน schema อยู่แล้ว) หรือ field ภายใน
 */
export type PublicDeviceCard = {
  id: string;
  sku: string;
  slug: string;
  brandName: string;
  brandSlug: string;
  modelName: string;
  storageGb: number;
  color: string;
  priceThb: number;
  conditionGrade: 'A' | 'B' | 'C';
  status: 'AVAILABLE' | 'SOLD';
  imageSrc: string | null;
};

export type PublicDeviceDetail = PublicDeviceCard & {
  modelSlug: string;
  ramGb: number | null;
  batteryHealthPct: number | null;
  cosmeticDefects: string | null;
  repairHistory: string | null;
  accessories: string | null;
  warrantyInfo: string | null;
  description: string;
  publishedAt: Date | null;
  createdAt: Date;
  images: { src: string; alt: string }[];
};

const cardSelect = {
  id: true,
  sku: true,
  slug: true,
  storageGb: true,
  color: true,
  priceThb: true,
  conditionGrade: true,
  status: true,
  model: {
    select: {
      name: true,
      slug: true,
      brand: { select: { name: true, slug: true } },
    },
  },
  images: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
    select: { filename: true, altText: true },
  },
};

type CardRow = {
  id: string;
  sku: string;
  slug: string;
  storageGb: number;
  color: string;
  priceThb: number;
  conditionGrade: 'A' | 'B' | 'C';
  status: 'DRAFT' | 'AVAILABLE' | 'SOLD' | 'ARCHIVED';
  model: { name: string; slug: string; brand: { name: string; slug: string } };
  images: { filename: string; altText: string | null }[];
};

function toCard(row: CardRow): PublicDeviceCard {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    brandName: row.model.brand.name,
    brandSlug: row.model.brand.slug,
    modelName: row.model.name,
    storageGb: row.storageGb,
    color: row.color,
    priceThb: row.priceThb,
    conditionGrade: row.conditionGrade,
    status: row.status === 'SOLD' ? 'SOLD' : 'AVAILABLE',
    imageSrc: resolveImageSrc(row.images[0]?.filename),
  };
}

/** สินค้าแนะนำ (AVAILABLE + isFeatured) */
export async function getFeaturedDevices(limit = 6): Promise<PublicDeviceCard[]> {
  const rows = await prisma.device.findMany({
    where: { status: 'AVAILABLE', isFeatured: true, deletedAt: null },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}

/** สินค้าใหม่ล่าสุด (AVAILABLE) */
export async function getLatestDevices(limit = 8): Promise<PublicDeviceCard[]> {
  const rows = await prisma.device.findMany({
    where: { status: 'AVAILABLE', deletedAt: null },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}

/**
 * รายละเอียดสินค้าตาม slug
 * คืน null สำหรับ DRAFT/ARCHIVED เพื่อให้หน้ารายละเอียดตอบ 404
 */
export async function getDeviceBySlug(slug: string): Promise<PublicDeviceDetail | null> {
  const row = await prisma.device.findUnique({
    where: { slug },
    select: {
      ...cardSelect,
      modelId: true,
      ramGb: true,
      batteryHealthPct: true,
      cosmeticDefects: true,
      repairHistory: true,
      accessories: true,
      warrantyInfo: true,
      description: true,
      publishedAt: true,
      createdAt: true,
      deletedAt: true,
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { filename: true, altText: true },
      },
    },
  });

  if (!row || row.deletedAt !== null || row.status === 'DRAFT' || row.status === 'ARCHIVED') {
    return null;
  }

  const card = toCard(row);
  const images = row.images
    .map((image) => ({
      src: resolveImageSrc(image.filename),
      alt: image.altText ?? `${card.brandName} ${card.modelName} ${card.storageGb}GB`,
    }))
    .filter((image): image is { src: string; alt: string } => image.src !== null);

  return {
    ...card,
    modelSlug: row.model.slug,
    ramGb: row.ramGb,
    batteryHealthPct: row.batteryHealthPct,
    cosmeticDefects: row.cosmeticDefects,
    repairHistory: row.repairHistory,
    accessories: row.accessories,
    warrantyInfo: row.warrantyInfo,
    description: row.description,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    images,
  };
}

/** slug ทั้งหมดที่เปิดเผยต่อสาธารณะ (ใช้ทำ sitemap) */
export async function getPublicDeviceSlugs(): Promise<
  { slug: string; createdAt: Date; updatedAt: Date }[]
> {
  return prisma.device.findMany({
    where: { status: { in: ['AVAILABLE', 'SOLD'] }, deletedAt: null },
    select: { slug: true, createdAt: true, updatedAt: true },
    orderBy: { publishedAt: 'desc' },
  });
}
