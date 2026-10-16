'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { toggleFeaturedAction } from '@/app/admin/(protected)/actions';
import { cn } from '@/lib/utils';

/** ปุ่มสลับ "สินค้าแนะนำ" (isFeatured) */
export function FeaturedToggle({
  deviceId,
  isFeatured,
}: {
  deviceId: string;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(isFeatured);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onToggle() {
    const next = !value;
    setError(null);
    setValue(next);
    startTransition(async () => {
      const result = await toggleFeaturedAction(deviceId, next);
      if (result.ok) {
        router.refresh();
      } else {
        setValue(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-pressed={value}
        title={value ? 'ยกเลิกสินค้าแนะนำ' : 'ตั้งเป็นสินค้าแนะนำ'}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-60',
          value
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
        )}
      >
        <Star className={cn('h-3.5 w-3.5', value && 'fill-amber-400 text-amber-400')} aria-hidden />
        {value ? 'แนะนำ' : 'ไม่แนะนำ'}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
