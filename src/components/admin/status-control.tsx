'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DeviceStatus } from '@prisma/client';
import { STATUS_LABELS } from '@/lib/device-labels';
import { changeStatusAction } from '@/app/admin/(protected)/actions';
import { cn } from '@/lib/utils';

const OPTIONS: DeviceStatus[] = ['DRAFT', 'AVAILABLE', 'SOLD', 'ARCHIVED'];

const TONE: Record<DeviceStatus, string> = {
  DRAFT: 'data-[active=true]:bg-slate-700 data-[active=true]:text-white',
  AVAILABLE: 'data-[active=true]:bg-emerald-600 data-[active=true]:text-white',
  SOLD: 'data-[active=true]:bg-rose-600 data-[active=true]:text-white',
  ARCHIVED: 'data-[active=true]:bg-slate-400 data-[active=true]:text-white',
};

/**
 * ตัวเปลี่ยนสถานะสินค้า — เรียก server action และแสดง feedback
 * การอนุญาตตรวจฝั่ง server (requireAdmin ใน action) ไม่ใช่ที่นี่
 */
export function StatusControl({
  deviceId,
  status,
}: {
  deviceId: string;
  status: DeviceStatus;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<DeviceStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: DeviceStatus) {
    if (next === current) return;
    setError(null);
    const previous = current;
    setCurrent(next); // optimistic

    startTransition(async () => {
      const result = await changeStatusAction(deviceId, next);
      if (result.ok) {
        router.refresh();
      } else {
        setCurrent(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        role="group"
        aria-label="เปลี่ยนสถานะสินค้า"
        className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white"
      >
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            data-active={current === option}
            disabled={pending}
            onClick={() => onChange(option)}
            className={cn(
              'px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60',
              TONE[option],
            )}
          >
            {STATUS_LABELS[option]}
          </button>
        ))}
      </div>
      {error ? (
        <span role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
