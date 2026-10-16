import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import type { SiteConfig } from '@/lib/site-config';
import { ContactLinks } from '@/components/layout/contact-links';

export function SiteFooter({ config }: { config: SiteConfig }) {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold">{config.name}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
            {config.description}
          </p>
        </div>

        <nav aria-label="เมนูท้ายเว็บ">
          <h2 className="text-sm font-semibold text-slate-900">เมนู</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/" className="text-slate-500 hover:text-slate-900">
                หน้าแรก
              </Link>
            </li>
            <li>
              <Link href="/phones" className="text-slate-500 hover:text-slate-900">
                สมาร์ทโฟนทั้งหมด
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">ติดต่อร้าน</h2>
          {config.contacts.length > 0 ? (
            <div className="mt-3">
              <ContactLinks contacts={config.contacts} size="sm" />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">ยังไม่ได้ตั้งค่าช่องทางติดต่อ</p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-400 sm:px-6">
          © {new Date().getFullYear()} {config.name} — ข้อมูลสินค้าในเว็บนี้เป็นข้อมูลสาธิต
        </div>
      </div>
    </footer>
  );
}
