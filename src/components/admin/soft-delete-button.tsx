'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { softDeleteDeviceAction } from '@/app/admin/(protected)/actions';

/** ปุ่มเก็บสินค้าเข้ากรุ (soft-delete) — ยืนยันก่อนทำ */
export function SoftDeleteButton({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!confirm('ยืนยันเก็บสินค้านี้เข้ากรุ? สินค้าจะหายจากหน้าเว็บทันที')) return;
    setError(null);
    startTransition(async () => {
      const result = await softDeleteDeviceAction(deviceId);
      if (result.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" onClick={onDelete} disabled={pending}>
        {pending ? 'กำลังดำเนินการ…' : 'เก็บเข้ากรุ'}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
