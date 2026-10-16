import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatalogFilters } from '@/lib/validation/filters';
import { catalogHref, withFilterChange } from '@/lib/catalog-url';

type PaginationProps = {
  filters: CatalogFilters;
  page: number;
  pageCount: number;
};

/** สร้างเลขหน้าที่จะแสดง (มี ellipsis เมื่อหลายหน้า) */
function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const valid = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  let previous = 0;
  for (const value of valid) {
    if (previous && value - previous > 1) result.push('gap');
    result.push(value);
    previous = value;
  }
  return result;
}

export function CatalogPagination({ filters, page, pageCount }: PaginationProps) {
  if (pageCount <= 1) return null;

  const linkClass =
    'inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50';

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="แบ่งหน้า">
      <PageLink
        filters={filters}
        page={page - 1}
        disabled={page <= 1}
        className={linkClass}
        ariaLabel="หน้าก่อนหน้า"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </PageLink>

      {pageWindow(page, pageCount).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden="true">
            …
          </span>
        ) : (
          <PageLink
            key={item}
            filters={filters}
            page={item}
            className={cn(linkClass, item === page && 'border-slate-900 bg-slate-900 text-white hover:bg-slate-900')}
            ariaLabel={`หน้า ${item}`}
            ariaCurrent={item === page ? 'page' : undefined}
          >
            {item}
          </PageLink>
        ),
      )}

      <PageLink
        filters={filters}
        page={page + 1}
        disabled={page >= pageCount}
        className={linkClass}
        ariaLabel="หน้าถัดไป"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  filters,
  page,
  disabled,
  className,
  children,
  ariaLabel,
  ariaCurrent,
}: {
  filters: CatalogFilters;
  page: number;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  ariaLabel: string;
  ariaCurrent?: 'page';
}) {
  if (disabled) {
    return (
      <span className={cn(className, 'pointer-events-none opacity-40')} aria-hidden="true">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={catalogHref(withFilterChange(filters, { page }))}
      className={className}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
    >
      {children}
    </Link>
  );
}
