'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">เกิดข้อผิดพลาดในการโหลดข้อมูล</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        ขออภัย ระบบไม่สามารถแสดงข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง
        หากยังพบปัญหาโปรดติดต่อร้านโดยตรง
      </p>
      <div className="mt-6">
        <Button type="button" onClick={() => reset()}>
          ลองใหม่อีกครั้ง
        </Button>
      </div>
    </main>
  );
}
