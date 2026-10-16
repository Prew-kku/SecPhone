import { z } from 'zod';

/**
 * Schema สำหรับ query parameters ของหน้า catalog
 * ค่าที่ไม่ถูกต้องจะ fallback เป็นค่าเริ่มต้น (ไม่ throw) ผ่าน .catch()
 */
const intFromQuery = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === 'number' ? value : Number(value.replace(/[^0-9]/g, ''))))
    .pipe(z.number().int().min(min).max(max))
    .catch(Number.NaN);

export const CATALOG_PAGE_SIZE = 12;

export const SORT_OPTIONS = ['newest', 'price-asc', 'price-desc'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  newest: 'ใหม่ล่าสุด',
  'price-asc': 'ราคาต่ำไปสูง',
  'price-desc': 'ราคาสูงไปต่ำ',
};

export const filtersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .optional()
    .catch(undefined)
    .transform((value) => (value ? value : undefined)),
  brand: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,64}$/)
    .optional()
    .catch(undefined),
  minPrice: intFromQuery(0, 10_000_000).optional().catch(undefined),
  maxPrice: intFromQuery(0, 10_000_000).optional().catch(undefined),
  storage: intFromQuery(1, 4096).optional().catch(undefined),
  condition: z.enum(['A', 'B', 'C']).optional().catch(undefined),
  sort: z.enum(SORT_OPTIONS).optional().catch(undefined).default('newest'),
  page: intFromQuery(1, 10_000).optional().catch(undefined).default(1),
});

export type CatalogFilters = z.output<typeof filtersSchema>;

/** แปลงค่าจาก searchParams (string | string[] | undefined) เป็น filters ที่ปลอดภัย */
export function parseFilters(raw: Record<string, string | string[] | undefined>): CatalogFilters {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }
  const parsed = filtersSchema.safeParse(flat);
  if (parsed.success) {
    return normalizeFilters(parsed.data);
  }
  return { sort: 'newest', page: 1 };
}

/** สลับ min/max ที่กรอกกลับด้าน และตัดค่า NaN ออก */
export function normalizeFilters(filters: CatalogFilters): CatalogFilters {
  const next: CatalogFilters = { ...filters };
  if (Number.isNaN(next.minPrice as number)) next.minPrice = undefined;
  if (Number.isNaN(next.maxPrice as number)) next.maxPrice = undefined;
  if (Number.isNaN(next.storage as number)) next.storage = undefined;
  if (Number.isNaN(next.page as number)) next.page = 1;
  if (
    next.minPrice !== undefined &&
    next.maxPrice !== undefined &&
    next.minPrice > next.maxPrice
  ) {
    [next.minPrice, next.maxPrice] = [next.maxPrice, next.minPrice];
  }
  return next;
}

/** จำนวน filter ที่เปิดใช้งานอยู่ (ไม่นับ sort/page) */
export function countActiveFilters(filters: CatalogFilters): number {
  return [filters.q, filters.brand, filters.minPrice, filters.maxPrice, filters.storage, filters.condition]
    .filter((value) => value !== undefined && value !== '').length;
}
