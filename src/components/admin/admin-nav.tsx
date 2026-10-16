'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const items = [
  { href: '/admin', label: 'ภาพรวม' },
  { href: '/admin/phones/new', label: 'เพิ่มสินค้า' },
];

/** เมนูของ admin — ไฮไลต์รายการที่กำลังเปิดอยู่ */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto max-w-6xl px-4 sm:px-6" aria-label="เมนูจัดการ">
      <ul className="flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block border-b-2 px-3 py-2 text-sm transition-colors',
                  active
                    ? 'border-slate-900 font-medium text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
