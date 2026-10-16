import { Suspense } from 'react';
import type { Metadata } from 'next';
import { parseFilters } from '@/lib/validation/filters';
import { CatalogResults } from '@/components/catalog/catalog-results';
import { CatalogResultsSkeleton } from '@/components/catalog/catalog-results-skeleton';

export const metadata: Metadata = {
  title: 'สมาร์ทโฟนทั้งหมด',
  description:
    'เลือกซื้อสมาร์ทโฟนมือสองตามแบรนด์ ราคา ความจุ และเกรดสภาพ พร้อมข้อมูลครบถ้วน',
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PhonesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          สมาร์ทโฟนทั้งหมด
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          เลือกดูเครื่องที่พร้อมจำหน่ายในร้าน กรองตามแบรนด์ ราคา ความจุ และเกรดสภาพได้
        </p>
      </header>

      <Suspense key={JSON.stringify(filters)} fallback={<CatalogResultsSkeleton />}>
        <CatalogResults filters={filters} />
      </Suspense>
    </main>
  );
}
