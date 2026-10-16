import { PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { getActiveBrands } from '@/lib/queries/brands';
import { getFeaturedDevices, getLatestDevices } from '@/lib/queries/devices';
import { DeviceCard } from '@/components/product/device-card';
import { DeviceGrid } from '@/components/product/device-grid';
import { EmptyState } from '@/components/common/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { SectionHeading } from '@/components/layout/home-sections';

/** สินค้าแนะนำ + แบรนด์ + มาใหม่ล่าสุด (โหลดข้อมูลจาก PostgreSQL) */
export async function HomeCatalog() {
  const [featured, latest, brands] = await Promise.all([
    getFeaturedDevices(4),
    getLatestDevices(8),
    getActiveBrands(),
  ]);

  if (featured.length === 0 && latest.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={PackageOpen}
          title="ยังไม่มีสินค้าในระบบ"
          description="เมื่อผู้ดูแลระบบเพิ่มสินค้าแล้ว รายการจะแสดงที่นี่โดยอัตโนมัติ"
        />
      </section>
    );
  }

  return (
    <>
      {featured.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeading
            title="สินค้าแนะนำ"
            description="เครื่องที่ร้านคัดมาแล้วว่าสภาพดีและน่าสนใจ"
            action={{ href: '/phones', label: 'ดูทั้งหมด' }}
          />
          <DeviceGrid className="mt-6">
            {featured.map((device, index) => (
              <DeviceCard key={device.id} device={device} priority={index < 2} />
            ))}
          </DeviceGrid>
        </section>
      ) : null}

      {brands.length > 0 ? (
        <section className="border-y border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading
              title="เลือกตามแบรนด์"
              description="แบรนด์ที่มีเครื่องพร้อมจำหน่ายในร้านขณะนี้"
            />
            <ul className="mt-6 flex flex-wrap gap-3">
              {brands.map((brand) => (
                <li key={brand.id}>
                  <Link
                    href={`/phones?brand=${encodeURIComponent(brand.slug)}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-card transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    {brand.name}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {brand.deviceCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {latest.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeading
            title="มาใหม่ล่าสุด"
            description="เครื่องที่เพิ่มเข้าล่าสุดในร้าน"
            action={{ href: '/phones?sort=newest', label: 'ดูทั้งหมด' }}
          />
          <DeviceGrid className="mt-6">
            {latest.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </DeviceGrid>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-card">
          <div>
            <h2 className="text-base font-semibold text-slate-900">ยังไม่เจอเครื่องที่ถูกใจ?</h2>
            <p className="mt-1 text-sm text-slate-500">
              ดูรายการทั้งหมดที่มีในร้าน หรือติดต่อร้านเพื่อให้ช่วยแนะนำ
            </p>
          </div>
          <ButtonLink href="/phones">ดูสมาร์ทโฟนทั้งหมด</ButtonLink>
        </div>
      </section>
    </>
  );
}
