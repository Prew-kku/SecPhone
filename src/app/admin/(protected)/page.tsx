import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { getAdminDevices, getAdminStats } from '@/lib/queries/admin-devices';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminSearch } from '@/components/admin/admin-search';
import { STATUS_VALUES } from '@/lib/validation/device';
import { STATUS_LABELS } from '@/lib/device-labels';
import { Skeleton } from '@/components/ui/skeleton';
import type { DeviceStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'จัดการสินค้า',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** อ่าน status จาก query อย่างปลอดภัย (ไม่ throw เมื่อค่าผิด) */
function parseStatus(raw: string | undefined): DeviceStatus | undefined {
  if (!raw) return undefined;
  return (STATUS_VALUES as readonly string[]).includes(raw) ? (raw as DeviceStatus) : undefined;
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums text-slate-900', tone)}>{value}</p>
    </div>
  );
}

async function DeviceTableSection({
  q,
  status,
}: {
  q: string | undefined;
  status: DeviceStatus | undefined;
}) {
  const rows = await getAdminDevices({ q, status });
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">พบ {rows.length} รายการ</p>
      <AdminTable rows={rows} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = first(params.q)?.trim() || undefined;
  const status = parseStatus(first(params.status));
  const stats = await getAdminStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">ภาพรวมสินค้า</h1>
        <Link
          href="/admin/phones/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden />
          เพิ่มสินค้า
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="ทั้งหมด" value={stats.total} />
        <StatCard label="พร้อมขาย" value={stats.available} tone="text-emerald-600" />
        <StatCard label="ฉบับร่าง" value={stats.draft} />
        <StatCard label="ขายแล้ว" value={stats.sold} tone="text-rose-600" />
        <StatCard label="เก็บถาวร" value={stats.archived} tone="text-slate-400" />
        <StatCard label="สินค้าแนะนำ" value={stats.featured} tone="text-amber-600" />
      </div>

      <div className="space-y-3">
        <AdminSearch initialQuery={q ?? ''} />
        <div className="flex flex-wrap gap-2">
          <Link
            href={q ? `/admin?q=${encodeURIComponent(q)}` : '/admin'}
            className={cn(
              'rounded-full border px-3 py-1 text-xs',
              !status
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            ทุกสถานะ
          </Link>
          {STATUS_VALUES.map((value) => {
            const active = status === value;
            const search = new URLSearchParams();
            if (q) search.set('q', q);
            search.set('status', value);
            return (
              <Link
                key={value}
                href={`/admin?${search.toString()}`}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {STATUS_LABELS[value]}
              </Link>
            );
          })}
        </div>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <DeviceTableSection q={q} status={status} />
      </Suspense>
    </div>
  );
}
