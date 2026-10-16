import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveImageSrc } from '@/lib/storage/paths';
import {
  CATALOG_PAGE_SIZE,
  type CatalogFilters,
} from '@/lib/validation/filters';
import type { PublicDeviceCard } from '@/lib/queries/devices';

export type CatalogResult = {
  items: PublicDeviceCard[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

const catalogSelect = {
  id: true,
  sku: true,
  slug: true,
  storageGb: true,
  color: true,
  priceThb: true,
  conditionGrade: true,
  status: true,
  model: { select: { name: true, slug: true, brand: { select: { name: true, slug: true } } } },
  images: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
    select: { filename: true, altText: true },
  },
};

type CatalogRow = {
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

function toCard(row: CatalogRow): PublicDeviceCard {
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

/** สร้าง where clause จาก filters (แสดงเฉพาะ AVAILABLE และไม่ถูกลบ) */
function buildWhere(filters: CatalogFilters): Prisma.DeviceWhereInput {
  const where: Prisma.DeviceWhereInput = {
    status: 'AVAILABLE',
    deletedAt: null,
  };

  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { model: { name: { contains: q, mode: 'insensitive' } } },
      { model: { brand: { name: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  if (filters.brand) where.model = { brand: { slug: filters.brand } };
  if (filters.storage !== undefined) where.storageGb = filters.storage;
  if (filters.condition) where.conditionGrade = filters.condition;

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.priceThb = {};
    if (filters.minPrice !== undefined) where.priceThb.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) where.priceThb.lte = filters.maxPrice;
  }

  return where;
}

function buildOrderBy(sort: CatalogFilters['sort']): Prisma.DeviceOrderByWithRelationInput[] {
  switch (sort) {
    case 'price-asc':
      return [{ priceThb: 'asc' }, { id: 'asc' }];
    case 'price-desc':
      return [{ priceThb: 'desc' }, { id: 'asc' }];
    default:
      return [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  }
}

export async function getCatalog(filters: CatalogFilters): Promise<CatalogResult> {
  const where = buildWhere(filters);
  const requestedPage = filters.page && filters.page > 0 ? filters.page : 1;

  // นับก่อนเพื่อ clamp หน้าที่เกินขอบเขต ไม่ให้แสดง "พบ N รายการ" พร้อมผลลัพธ์ว่าง
  const total = await prisma.device.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const rows = await prisma.device.findMany({
    where,
    orderBy: buildOrderBy(filters.sort),
    skip: (page - 1) * CATALOG_PAGE_SIZE,
    take: CATALOG_PAGE_SIZE,
    select: catalogSelect,
  });

  return {
    items: rows.map(toCard),
    total,
    page,
    pageCount,
    pageSize: CATALOG_PAGE_SIZE,
  };
}

export type CatalogFilterOptions = {
  brands: { name: string; slug: string; deviceCount: number }[];
  storages: number[];
  minPrice: number;
  maxPrice: number;
};

/** ตัวเลือก filter ที่มีข้อมูลจริงในฐานข้อมูล (เฉพาะ AVAILABLE) */
export async function getCatalogFilterOptions(): Promise<CatalogFilterOptions> {
  const base: Prisma.DeviceWhereInput = { status: 'AVAILABLE', deletedAt: null };

  const [brands, storageGroups, priceRange] = await Promise.all([
    prisma.brand.findMany({
      where: { models: { some: { devices: { some: base } } } },
      orderBy: { name: 'asc' },
      select: {
        name: true,
        slug: true,
        models: {
          select: { _count: { select: { devices: { where: base } } } },
        },
      },
    }),
    prisma.device.groupBy({
      by: ['storageGb'],
      where: base,
      orderBy: { storageGb: 'asc' },
    }),
    prisma.device.aggregate({
      where: base,
      _min: { priceThb: true },
      _max: { priceThb: true },
    }),
  ]);

  return {
    brands: brands.map((brand) => ({
      name: brand.name,
      slug: brand.slug,
      deviceCount: brand.models.reduce((total, m) => total + m._count.devices, 0),
    })),
    storages: storageGroups.map((group) => group.storageGb),
    minPrice: priceRange._min.priceThb ?? 0,
    maxPrice: priceRange._max.priceThb ?? 0,
  };
}
