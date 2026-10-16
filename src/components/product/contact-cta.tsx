import { MessageCircle, Globe, Phone } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { ContactChannel } from '@/lib/site-config';
import { cn } from '@/lib/utils';

const ICONS = { line: MessageCircle, facebook: Globe, phone: Phone } as const;

/**
 * ปุ่มติดต่อร้าน พร้อมข้อความอ้างอิงรุ่น/SKU
 * - LINE: ใช้ข้อความเริ่มต้นอ้างอิง SKU (ไม่ใส่ใน URL เพื่อเลี่ยงรูปแบบไม่แน่นอน)
 * - Facebook: เปิดเพจร้าน
 * - โทร: tel: link
 */
export function ContactCta({
  contacts,
  reference,
  deemphasize,
}: {
  contacts: ContactChannel[];
  reference: string;
  deemphasize?: boolean;
}) {
  if (contacts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        ร้านนี้ยังไม่ได้ตั้งค่าช่องทางติดต่อ กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มข้อมูลติดต่อ
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <p className="text-sm text-slate-600">
        สนใจเครื่องนี้? แจ้งรหัสสินค้า{' '}
        <span className="font-semibold text-slate-900">{reference}</span> ให้ทางร้านเพื่อสอบถามเร็วขึ้น
      </p>
      <ul className={cn('mt-4 flex flex-wrap gap-3', deemphasize && 'opacity-70')}>
        {contacts.map((contact) => {
          const Icon = ICONS[contact.key];
          const isExternal = contact.key !== 'phone';
          return (
            <li key={contact.key}>
              <a
                href={contact.href}
                className={cn(
                  buttonVariants({
                    variant:
                      contact.key === 'line'
                        ? 'line'
                        : contact.key === 'facebook'
                          ? 'facebook'
                          : 'outline',
                    size: 'md',
                  }),
                )}
                {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{contact.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
