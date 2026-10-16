import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { getCurrentAdmin } from '@/lib/auth/guard';
import { isAuthConfigured } from '@/lib/auth/session';
import { safeRedirectPath } from '@/lib/validation/auth';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบผู้ดูแล',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * หน้าเข้าสู่ระบบ — อยู่ **นอก** route group (protected) เพื่อให้ guard ไม่ครอบ
 * และ middleware ก็ allowlist ไว้แล้ว (กัน redirect loop)
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  // ตรวจปลายทางให้เป็น path ภายในเท่านั้น (กัน open redirect)
  const next = safeRedirectPath(rawNext, '/admin');

  // ถ้าล็อกอินอยู่แล้ว ไม่ต้องแสดงฟอร์ม
  const current = await getCurrentAdmin();
  if (current) redirect(next);

  const config = getSiteConfig();
  const authReady = isAuthConfigured();

  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">เข้าสู่ระบบผู้ดูแล</h1>
          <p className="mt-1 text-sm text-slate-500">{config.name}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">
          {authReady ? (
            <LoginForm next={next} />
          ) : (
            <p
              role="alert"
              className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า <code>JWT_SECRET</code>
              (ต้องยาวอย่างน้อย 32 ตัวอักษร) กรุณาตั้งค่า environment variable ก่อน
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          ระบบนี้ไม่มีหน้าสมัครสมาชิกสาธารณะ — บัญชีผู้ดูแลสร้างโดยผู้ดูแลระบบเท่านั้น
        </p>
      </div>
    </main>
  );
}
