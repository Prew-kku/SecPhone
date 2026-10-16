import { Skeleton } from '@/components/ui/skeleton';
import { DeviceGridSkeleton } from '@/components/product/device-grid';

/** Fallback ระหว่างรอข้อมูลหน้าแรกจากฐานข้อมูล (ใช้กับ <Suspense>) */
export function HomeCatalogSkeleton() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Skeleton className="h-7 w-40" />
        <div className="mt-6">
          <DeviceGridSkeleton count={4} />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Skeleton className="h-7 w-40" />
        <div className="mt-6">
          <DeviceGridSkeleton count={8} />
        </div>
      </section>
    </>
  );
}
