import { Skeleton } from '@/components/ui/skeleton';
import { DeviceGridSkeleton } from '@/components/product/device-grid';

/** Fallback ที่แสดงระหว่างรอผลลัพธ์แคตตาล็อก (ใช้กับ <Suspense>) */
export function CatalogResultsSkeleton() {
  return (
    <>
      <div className="mt-6">
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <div className="mt-6">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mt-4">
        <DeviceGridSkeleton count={8} />
      </div>
    </>
  );
}
