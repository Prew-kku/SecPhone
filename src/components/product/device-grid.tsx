import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function DeviceGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DeviceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

export function DeviceGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <DeviceGrid>
      {Array.from({ length: count }).map((_, index) => (
        <DeviceCardSkeleton key={index} />
      ))}
    </DeviceGrid>
  );
}
