import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, PackageX } from 'lucide-react';
import { getDeviceBySlug } from '@/lib/queries/devices';
import { getSiteConfig } from '@/lib/site-config';
import { conditionLabel } from '@/lib/device-labels';
import { formatStorage, formatTHB } from '@/lib/format';
import { DeviceGallery } from '@/components/product/device-gallery';
import { ContactCta } from '@/components/product/contact-cta';
import { SpecTable } from '@/components/product/spec-table';
import { ConditionBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/empty-state';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const device = await getDeviceBySlug(slug);
  if (!device) {
    return { title: 'ไม่พบสินค้า' };
  }

  const title = `${device.brandName} ${device.modelName} ${formatStorage(device.storageGb)} สี${device.color}`;
  const description = `${title} สภาพ${conditionLabel(device.conditionGrade)} ราคา ${formatTHB(
    device.priceThb,
  )} — ${device.brandName} ${device.modelName} มือสองจากร้าน ${getSiteConfig().name}`;

  return {
    title,
    description,
    alternates: { canonical: `/phones/${device.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      images: device.images.length > 0 ? [device.images[0].src] : undefined,
    },
  };
}

export default async function DeviceDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const device = await getDeviceBySlug(slug);
  if (!device) notFound();

  const config = getSiteConfig();
  const title = `${device.brandName} ${device.modelName}`;
  const sold = device.status === 'SOLD';
  const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${title} ${formatStorage(device.storageGb)} สี${device.color}`,
    description: device.description,
    brand: { '@type': 'Brand', name: device.brandName },
    sku: device.sku,
    offers: {
      '@type': 'Offer',
      price: device.priceThb,
      priceCurrency: 'THB',
      availability: sold
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url: `${siteUrl}/phones/${device.slug}`,
    },
  };

  const specRows = [
    { label: 'แบรนด์', value: device.brandName },
    { label: 'รุ่น', value: device.modelName },
    { label: 'ความจุ', value: formatStorage(device.storageGb) },
    { label: 'หน่วยความจำ (RAM)', value: device.ramGb ? `${device.ramGb} GB` : 'ไม่ระบุ' },
    { label: 'สี', value: device.color },
    { label: 'เกรดสภาพ', value: conditionLabel(device.conditionGrade) },
    {
      label: 'สุขภาพแบตเตอรี่',
      value: device.batteryHealthPct !== null ? `${device.batteryHealthPct}%` : 'ไม่ระบุ',
    },
    { label: 'ตำหนิที่พบ', value: device.cosmeticDefects ?? 'ไม่มีข้อมูล' },
    { label: 'ประวัติการซ่อม', value: device.repairHistory ?? 'ไม่มีข้อมูล' },
    { label: 'อุปกรณ์ที่ให้มา', value: device.accessories ?? 'ไม่มีข้อมูล' },
    { label: 'การรับประกัน', value: device.warrantyInfo ?? 'ไม่มีข้อมูล' },
    { label: 'รหัสสินค้า', value: device.sku },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <script
        type="application/ld+json"
        // ข้อมูลมาจากฐานข้อมูลของร้าน ไม่มีข้อมูลอ่อนไหว
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="เส้นทางนำทาง" className="mb-6">
        <ol className="flex items-center gap-1.5 text-sm text-slate-500">
          <li>
            <Link href="/" className="hover:text-slate-900">
              หน้าแรก
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/phones" className="hover:text-slate-900">
              สมาร์ทโฟนทั้งหมด
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-slate-900">{title}</li>
        </ol>
      </nav>

      <Link
        href="/phones"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        กลับไปหน้ารายการ
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <DeviceGallery
          images={device.images}
          alt={`${title} ${formatStorage(device.storageGb)}`}
          tint={device.color}
        />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ConditionBadge grade={device.conditionGrade} />
            {sold ? (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                ขายแล้ว
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                พร้อมขาย
              </span>
            )}
          </div>

          <p className="mt-4 text-sm font-medium uppercase tracking-wide text-slate-400">
            {device.brandName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {device.modelName}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {formatStorage(device.storageGb)} · สี{device.color}
            {device.ramGb ? ` · RAM ${device.ramGb} GB` : ''}
          </p>

          <p className="mt-5 text-3xl font-semibold text-slate-900">
            {sold ? <span className="text-slate-400">ขายแล้ว</span> : formatTHB(device.priceThb)}
          </p>

          {sold ? (
            <p className="mt-2 text-sm text-slate-500">
              เครื่องนี้ขายไปแล้ว หากสนใจรุ่นใกล้เคียงสามารถดูรายการอื่นในร้านได้
            </p>
          ) : null}

          <div className="mt-6">
            {sold ? (
              <EmptyState
                icon={PackageX}
                title="เครื่องนี้ถูกขายไปแล้ว"
                description="ดูเครื่องรุ่นอื่นที่ยังพร้อมจำหน่ายในร้าน"
              >
                <ButtonLink href="/phones" variant="outline">
                  ดูเครื่องอื่นในร้าน
                </ButtonLink>
              </EmptyState>
            ) : (
              <ContactCta contacts={config.contacts} reference={device.sku} />
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section aria-labelledby="description-heading">
            <h2 id="description-heading" className="text-lg font-semibold text-slate-900">
              รายละเอียดสินค้า
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {device.description}
            </p>
          </section>

          <div className="mt-10">
            <SpecTable rows={specRows} title="ข้อมูลจำเพาะและสภาพเครื่อง" />
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-base font-semibold text-slate-900">สิ่งที่ควรทราบก่อนซื้อ</h2>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                สินค้าเป็นเครื่องมือสองหนึ่งเครื่องต่อหนึ่งรายการ ไม่มีสต็อกซ้ำรุ่นเดิม
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                สภาพและอุปกรณ์ที่ให้มาอ้างอิงตามที่ระบุในหน้าสินค้านี้
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                ราคาและสถานะของเครื่องอาจเปลี่ยนแปลงได้ ควรสอบถามร้านก่อนตัดสินใจ
              </li>
            </ul>
            <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
              รหัสสินค้าของเครื่องนี้ <span className="font-semibold text-slate-900">{device.sku}</span>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
