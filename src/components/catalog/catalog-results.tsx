import { getCatalog, getCatalogFilterOptions, type CatalogResult } from '@/lib/queries/catalog';
import { countActiveFilters, type CatalogFilters } from '@/lib/validation/filters';
import { DeviceCard } from '@/components/product/device-card';
import { DeviceGrid } from '@/components/product/device-grid';
import { CatalogFilterBar } from '@/components/catalog/catalog-filter-bar';
import { CatalogPagination } from '@/components/catalog/catalog-pagination';
import { EmptyState } from '@/components/common/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { PackageSearch } from 'lucide-react';

/**
 * ดึงข้อมูลและแสดงผลลัพธ์แยกเป็น async component
 * เพื่อให้ <Suspense> ในหน้าเพจแสดง skeleton ระหว่างรอฐานข้อมูลได้
 */
export async function CatalogResults({ filters }: { filters: CatalogFilters }) {
  const [result, options] = await Promise.all([getCatalog(filters), getCatalogFilterOptions()]);
  const activeCount = countActiveFilters(filters);

  return (
    <>
      <div className="mt-6">
        <CatalogFilterBar filters={filters} options={options} activeCount={activeCount} />
      </div>

      <div className="mt-6">
        <p className="text-sm text-slate-500" aria-live="polite">
          พบ <span className="font-semibold text-slate-900">{result.total}</span> รายการ
          {result.pageCount > 1 ? ` · หน้า ${result.page} จาก ${result.pageCount}` : ''}
        </p>
      </div>

      <div className="mt-4">
        {result.items.length > 0 ? (
          <DeviceGrid>
            {result.items.map((device, index) => (
              <DeviceCard key={device.id} device={device} priority={index < 4} />
            ))}
          </DeviceGrid>
        ) : (
          <EmptyState
            icon={PackageSearch}
            title="ไม่พบสินค้าที่ตรงกับเงื่อนไข"
            description="ลองปรับช่วงราคา เปลี่ยนแบรนด์ หรือลดตัวกรองลง แล้วค้นหาอีกครั้ง"
          >
            <ButtonLink href="/phones" variant="outline">
              ล้างตัวกรองทั้งหมด
            </ButtonLink>
          </EmptyState>
        )}
      </div>

      <CatalogPagination filters={filters} page={result.page} pageCount={result.pageCount} />
    </>
  );
}

export type { CatalogResult };
