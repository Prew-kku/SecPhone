import type { Metadata } from 'next';
import { getBrandOptions } from '@/lib/queries/admin-devices';
import { DeviceForm } from '@/components/admin/device-form';

export const metadata: Metadata = {
  title: 'เพิ่มสินค้า',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewDevicePage() {
  const brands = await getBrandOptions();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">เพิ่มสินค้าใหม่</h1>
      <DeviceForm mode="create" brands={brands} />
    </div>
  );
}
