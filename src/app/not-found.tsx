import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold text-slate-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">ไม่พบหน้าที่คุณกำลังมองหา</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        หน้านี้อาจถูกย้าย ถูกลบ หรือลิงก์ไม่ถูกต้อง
        คุณสามารถกลับไปเลือกดูสมาร์ทโฟนที่มีอยู่ในร้านได้
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/phones">ดูสมาร์ทโฟนทั้งหมด</ButtonLink>
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
        >
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
