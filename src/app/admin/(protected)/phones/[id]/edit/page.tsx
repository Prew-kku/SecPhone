import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminDeviceById, getBrandOptions } from '@/lib/queries/admin-devices';
import { DeviceForm } from '@/components/admin/device-form';
import { ImageUploader } from '@/components/admin/image-uploader';
import { SoftDeleteButton } from '@/components/admin/soft-delete-button';
import { formatThaiDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'แก้ไขสินค้า',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // ตรวจรูปแบบ id ก่อนแตะ DB (ลด query ที่ไม่จำเป็น)
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();

  const [device, brands] = await Promise.all([getAdminDeviceById(id), getBrandOptions()]);
  if (!device) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            แก้ไข: {device.brandName} {device.modelName}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            SKU {device.sku} · slug <code>{device.slug}</code> · แก้ไขล่าสุด{' '}
            {formatThaiDate(device.publishedAt ?? new Date())}
          </p>
        </div>
        <Link
          href={`/phones/${device.slug}`}
          className="text-sm text-slate-600 underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          ดูหน้าเว็บไซต์
        </Link>
      </div>

      <ImageUploader deviceId={device.id} images={device.images} />

      <DeviceForm
        mode="edit"
        deviceId={device.id}
        brands={brands}
        initial={{
          brandId: device.brandId,
          modelId: device.modelId,
          storageGb: device.storageGb,
          ramGb: device.ramGb,
          color: device.color,
          priceThb: device.priceThb,
          conditionGrade: device.conditionGrade,
          batteryHealthPct: device.batteryHealthPct,
          cosmeticDefects: device.cosmeticDefects,
          repairHistory: device.repairHistory,
          accessories: device.accessories,
          warrantyInfo: device.warrantyInfo,
          description: device.description,
          status: device.status,
          isFeatured: device.isFeatured,
        }}
      />

      <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-4">
        <h2 className="text-sm font-medium text-slate-900">เก็บสินค้าเข้ากรุ</h2>
        <p className="mt-1 text-sm text-slate-600">
          สินค้าจะถูกตั้งเป็น ARCHIVED และซ่อนจากหน้าเว็บทันที แต่ข้อมูลและรูปยังคงอยู่ในระบบ
        </p>
        <div className="mt-3">
          <SoftDeleteButton deviceId={device.id} />
        </div>
      </div>
    </div>
  );
}
