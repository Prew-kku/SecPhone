import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/guard';
import { LogoutButton } from '@/components/admin/logout-button';
import { AdminNav } from '@/components/admin/admin-nav';

export const dynamic = 'force-dynamic';

/**
 * Admin shell — route group (protected)
 *
 * `requireAdmin()` ที่นี่เป็น guard ชั้น server ของทุกหน้าในกลุ่มนี้ (ชั้นที่ 2 ของ 3)
 * ชั้นที่ 1 คือ middleware (routing), ชั้นที่ 3 คือ requireAdmin() ในทุก action
 * ทั้งสามชั้นจำเป็น เพราะการตรวจที่ layout อย่างเดียวไม่ครอบ server action
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="text-base font-semibold text-slate-900">
            จัดการร้านค้า
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {admin.displayName}
              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {admin.role === 'OWNER' ? 'เจ้าของ' : 'ผู้ดูแล'}
              </span>
            </span>
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
              ดูเว็บไซต์
            </Link>
            <LogoutButton />
          </div>
        </div>
        <AdminNav />
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
