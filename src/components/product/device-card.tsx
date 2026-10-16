import Link from 'next/link';
import { SafeImage } from '@/components/common/safe-image';
import { ConditionBadge, StatusBadge } from '@/components/ui/badge';
import { formatStorage, formatTHB } from '@/lib/format';
import type { PublicDeviceCard } from '@/lib/queries/devices';
import { cn } from '@/lib/utils';

export function DeviceCard({ device, priority }: { device: PublicDeviceCard; priority?: boolean }) {
  const sold = device.status === 'SOLD';
  const alt = `${device.brandName} ${device.modelName} ${formatStorage(device.storageGb)} สี${device.color}`;

  return (
    <article className="group h-full">
      <Link
        href={`/phones/${device.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        <div className="relative aspect-square overflow-hidden bg-slate-50">
          <SafeImage
            src={device.imageSrc}
            alt={alt}
            tint={device.color}
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn('transition-transform duration-300 group-hover:scale-[1.03]', sold && 'opacity-70')}
          />
          <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5">
            {sold ? <StatusBadge status={device.status} /> : null}
          </div>
          <div className="pointer-events-none absolute right-2 top-2">
            <ConditionBadge grade={device.conditionGrade} />
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {device.brandName}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
            {device.modelName}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {formatStorage(device.storageGb)} · สี{device.color}
          </p>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            {sold ? (
              <span className="text-sm font-medium text-slate-400">ขายแล้ว</span>
            ) : (
              <span className="text-base font-semibold text-slate-900">
                {formatTHB(device.priceThb)}
              </span>
            )}
            <span className="truncate text-[11px] text-slate-400">{device.sku}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
