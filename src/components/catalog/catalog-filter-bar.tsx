'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { CONDITION_LABELS, CONDITION_SHORT_LABELS } from '@/lib/device-labels';
import { SORT_LABELS, SORT_OPTIONS, type CatalogFilters } from '@/lib/validation/filters';
import type { CatalogFilterOptions } from '@/lib/queries/catalog';
import { catalogHref, withFilterChange } from '@/lib/catalog-url';

type CatalogFilterBarProps = {
  filters: CatalogFilters;
  options: CatalogFilterOptions;
  activeCount: number;
};

export function CatalogFilterBar({ filters, options, activeCount }: CatalogFilterBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q ?? '');

  useEffect(() => {
    setSearch(filters.q ?? '');
  }, [filters.q]);

  function apply(patch: Partial<CatalogFilters>) {
    router.push(catalogHref(withFilterChange(filters, patch)));
  }

  function onSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({ q: search.trim() || undefined });
  }

  function clearAll() {
    setSearch('');
    router.push('/phones');
  }

  const priceHint =
    options.minPrice > 0 || options.maxPrice > 0
      ? `ช่วงราคาในร้าน ${options.minPrice.toLocaleString('th-TH')} – ${options.maxPrice.toLocaleString('th-TH')} บาท`
      : undefined;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <form onSubmit={onSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor="catalog-search">ค้นหาแบรนด์หรือรุ่น</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id="catalog-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="เช่น iPhone 13, Galaxy, Pixel"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="sm:self-end">
          <Button type="submit" className="w-full sm:w-auto">
            ค้นหา
          </Button>
        </div>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="filter-brand">แบรนด์</Label>
          <Select
            id="filter-brand"
            value={filters.brand ?? ''}
            onChange={(event) => apply({ brand: event.target.value || undefined })}
          >
            <option value="">ทั้งหมด</option>
            {options.brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name} ({brand.deviceCount})
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="filter-storage">ความจุ</Label>
          <Select
            id="filter-storage"
            value={filters.storage !== undefined ? String(filters.storage) : ''}
            onChange={(event) =>
              apply({ storage: event.target.value ? Number(event.target.value) : undefined })
            }
          >
            <option value="">ทั้งหมด</option>
            {options.storages.map((storage) => (
              <option key={storage} value={storage}>
                {storage} GB
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="filter-condition">สภาพ</Label>
          <Select
            id="filter-condition"
            value={filters.condition ?? ''}
            onChange={(event) =>
              apply({ condition: (event.target.value || undefined) as CatalogFilters['condition'] })
            }
          >
            <option value="">ทั้งหมด</option>
            {(['A', 'B', 'C'] as const).map((grade) => (
              <option key={grade} value={grade}>
                {CONDITION_LABELS[grade]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="filter-sort">เรียงตาม</Label>
          <Select
            id="filter-sort"
            value={filters.sort}
            onChange={(event) =>
              apply({ sort: event.target.value as CatalogFilters['sort'], page: 1 })
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="filter-min-price">ราคาต่ำสุด (บาท)</Label>
          <Input
            id="filter-min-price"
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            key={`min-${filters.minPrice ?? ''}`}
            defaultValue={filters.minPrice ?? ''}
            placeholder={options.minPrice ? String(options.minPrice) : '0'}
            onBlur={(event) =>
              apply({
                minPrice: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
          />
        </div>
        <div>
          <Label htmlFor="filter-max-price">ราคาสูงสุด (บาท)</Label>
          <Input
            id="filter-max-price"
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            key={`max-${filters.maxPrice ?? ''}`}
            defaultValue={filters.maxPrice ?? ''}
            placeholder={options.maxPrice ? String(options.maxPrice) : 'ไม่จำกัด'}
            onBlur={(event) =>
              apply({
                maxPrice: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
          />
        </div>
        <div className="flex items-end sm:col-span-2">
          {activeCount > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>
              <X className="h-4 w-4" aria-hidden="true" />
              ล้างตัวกรอง ({activeCount})
            </Button>
          ) : (
            <p className="text-xs text-slate-400">
              เลือกตัวกรองเพื่อค้นหาเครื่องที่ต้องการ
            </p>
          )}
        </div>
      </div>

      {activeCount > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="ตัวกรองที่ใช้อยู่">
          {filters.q ? (
            <li>
              <ActiveChip onClear={() => apply({ q: undefined })}>
                ค้นหา: {filters.q}
              </ActiveChip>
            </li>
          ) : null}
          {filters.brand ? (
            <li>
              <ActiveChip onClear={() => apply({ brand: undefined })}>
                แบรนด์:{' '}
                {options.brands.find((brand) => brand.slug === filters.brand)?.name ?? filters.brand}
              </ActiveChip>
            </li>
          ) : null}
          {filters.storage !== undefined ? (
            <li>
              <ActiveChip onClear={() => apply({ storage: undefined })}>
                ความจุ: {filters.storage} GB
              </ActiveChip>
            </li>
          ) : null}
          {filters.condition ? (
            <li>
              <ActiveChip onClear={() => apply({ condition: undefined })}>
                สภาพ: {CONDITION_SHORT_LABELS[filters.condition]}
              </ActiveChip>
            </li>
          ) : null}
          {filters.minPrice !== undefined ? (
            <li>
              <ActiveChip onClear={() => apply({ minPrice: undefined })}>
                ราคาต่ำสุด: {filters.minPrice.toLocaleString('th-TH')} บาท
              </ActiveChip>
            </li>
          ) : null}
          {filters.maxPrice !== undefined ? (
            <li>
              <ActiveChip onClear={() => apply({ maxPrice: undefined })}>
                ราคาสูงสุด: {filters.maxPrice.toLocaleString('th-TH')} บาท
              </ActiveChip>
            </li>
          ) : null}
        </ul>
      ) : null}

      {priceHint ? <p className="mt-3 text-xs text-slate-400">{priceHint}</p> : null}
    </div>
  );
}

function ActiveChip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs font-medium text-slate-700">
      {children}
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900"
        aria-label="ลบตัวกรองนี้"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}
