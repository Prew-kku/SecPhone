import type { CatalogFilters } from '@/lib/validation/filters';

/**
 * สร้าง query string จาก filters โดยตัดค่าที่เป็นค่าเริ่มต้นออก
 * เพื่อให้ URL สะอาดและแชร์ได้
 */
export function buildCatalogQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
  if (filters.storage !== undefined) params.set('storage', String(filters.storage));
  if (filters.condition) params.set('condition', filters.condition);
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}

export function catalogHref(filters: CatalogFilters): string {
  const query = buildCatalogQuery(filters);
  return query ? `/phones?${query}` : '/phones';
}

/** เปลี่ยนค่าบาง field แล้วรีเซ็ต page กลับเป็น 1 (เว้นแต่เปลี่ยน page เอง) */
export function withFilterChange(
  filters: CatalogFilters,
  patch: Partial<CatalogFilters>,
): CatalogFilters {
  const next = { ...filters, ...patch };
  if (!('page' in patch)) next.page = 1;
  return next;
}
