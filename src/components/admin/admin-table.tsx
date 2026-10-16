import Link from 'next/link';
import type { AdminDeviceRow } from '@/lib/queries/admin-devices';
import { formatStorage, formatTHB } from '@/lib/format';
import { SafeImage } from '@/components/common/safe-image';
import { ConditionBadge } from '@/components/ui/badge';
import { StatusControl } from '@/components/admin/status-control';
import { FeaturedToggle } from '@/components/admin/featured-toggle';
import { EmptyState } from '@/components/common/empty-state';

/**
 * ตารางสินค้าของ admin
 * - แสดงทุกสถานะ (DRAFT/AVAILABLE/SOLD/ARCHIVED)
 * - บนมือถือแสดงเป็นการ์ด (ไม่ใช่ตารางเลื่อนแนวนอน) เพื่อใช้งานได้จริงที่ 375px
 */
export function AdminTable({ rows }: { rows: AdminDeviceRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="ไม่พบสินค้า"
        description="ยังไม่มีรายการที่ตรงกับเงื่อนไข ลองล้างคำค้นหา หรือเพิ่มสินค้าใหม่"
      />
    );
  }

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">สินค้า</th>
              <th className="px-3 py-2 font-medium">ราคา</th>
              <th className="px-3 py-2 font-medium">สภาพ</th>
              <th className="px-3 py-2 font-medium">สถานะ</th>
              <th className="px-3 py-2 font-medium">แนะนำ</th>
              <th className="px-3 py-2 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-slate-200">
                      <SafeImage
                        src={row.imageSrc}
                        alt={`${row.brandName} ${row.modelName}`}
                        className="h-full w-full object-cover"
                        tint={row.color}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {row.brandName} {row.modelName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatStorage(row.storageGb)} · {row.color} · {row.sku}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">{formatTHB(row.priceThb)}</td>
                <td className="px-3 py-3">
                  <ConditionBadge grade={row.conditionGrade} />
                </td>
                <td className="px-3 py-3">
                  <StatusControl deviceId={row.id} status={row.status} />
                </td>
                <td className="px-3 py-3">
                  <FeaturedToggle deviceId={row.id} isFeatured={row.isFeatured} />
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/phones/${row.id}/edit`}
                    className="text-sm text-slate-700 underline-offset-2 hover:underline"
                  >
                    แก้ไข
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* จอเล็ก: การ์ด */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded border border-slate-200">
                <SafeImage
                  src={row.imageSrc}
                  alt={`${row.brandName} ${row.modelName}`}
                  className="h-full w-full object-cover"
                  tint={row.color}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {row.brandName} {row.modelName}
                </p>
                <p className="text-xs text-slate-500">
                  {formatStorage(row.storageGb)} · {row.color}
                </p>
                <p className="mt-1 text-sm font-medium">{formatTHB(row.priceThb)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <ConditionBadge grade={row.conditionGrade} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusControl deviceId={row.id} status={row.status} />
              <FeaturedToggle deviceId={row.id} isFeatured={row.isFeatured} />
              <Link
                href={`/admin/phones/${row.id}/edit`}
                className="ml-auto text-sm text-slate-700 underline-offset-2 hover:underline"
              >
                แก้ไข
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
