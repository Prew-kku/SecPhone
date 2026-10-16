import { MessageCircle, Globe, Phone } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { ContactChannel } from '@/lib/site-config';
import { cn } from '@/lib/utils';

const ICONS = { line: MessageCircle, facebook: Globe, phone: Phone } as const;

type ContactLinksProps = {
  contacts: ContactChannel[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * แสดงเฉพาะช่องทางที่ตั้งค่าไว้จริง (sender ต้องกรองมาแล้ว)
 * ถ้าไม่มีช่องทางเลย จะไม่ render อะไร
 */
export function ContactLinks({ contacts, size = 'md', className }: ContactLinksProps) {
  if (contacts.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap items-center gap-3', className)}>
      {contacts.map((contact) => {
        const Icon = ICONS[contact.key];
        const isExternal = contact.key !== 'phone';
        return (
          <li key={contact.key}>
            <a
              href={contact.href}
              className={cn(
                buttonVariants({
                  variant: contact.key === 'line' ? 'line' : contact.key === 'facebook' ? 'facebook' : 'outline',
                  size,
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
  );
}
