import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { Smartphone, ShieldCheck, BadgeCheck, MessageCircle } from 'lucide-react';
import type { SiteConfig } from '@/lib/site-config';
import { ContactLinks } from '@/components/layout/contact-links';

export function HeroSection({ config }: { config: SiteConfig }) {
  return (
    <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            สมาร์ทโฟนมือสอง ตรวจสภาพทุกเครื่อง
          </p>
          <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            สมาร์ทโฟนมือสองคุณภาพ
            <br />
            คัดสภาพแล้วทุกเครื่อง
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
            {config.name} คัดเลือกสมาร์ทโฟนมือสองสภาพดีจากหลากหลายแบรนด์
            ระบุเกรดสภาพ แบตเตอรี่ และอุปกรณ์ที่ให้มาอย่างชัดเจน
            เพื่อให้คุณเลือกซื้อได้อย่างมั่นใจ
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/phones" size="lg">
              ดูสมาร์ทโฟนทั้งหมด
            </ButtonLink>
            {config.contacts.length > 0 ? (
              <ButtonLink href="#contact" variant="outline" size="lg">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                สอบถามก่อนซื้อ
              </ButtonLink>
            ) : null}
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <TrustItem
            icon={ShieldCheck}
            title="ระบุสภาพตามจริง"
            description="แจ้งเกรดสภาพ ตำหนิ และประวัติซ่อมของทุกเครื่อง"
          />
          <TrustItem
            icon={BadgeCheck}
            title="ข้อมูลครบถ้วน"
            description="แสดงความจุ แบตเตอรี่ และอุปกรณ์ที่ให้มาอย่างชัดเจน"
          />
          <TrustItem
            icon={MessageCircle}
            title="ปรึกษาก่อนได้"
            description="สอบถามรายละเอียดเครื่องผ่านช่องทางที่ร้านเปิดให้ติดต่อ"
          />
        </ul>
      </div>
    </section>
  );
}

function TrustItem({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Smartphone;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900/5 text-slate-900">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </li>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function ContactSection({ config }: { config: SiteConfig }) {
  return (
    <section id="contact" className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          ติดต่อร้าน
        </h2>
        {config.contacts.length > 0 ? (
          <>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              สนใจเครื่องไหน สอบถามรายละเอียดเพิ่มเติมได้โดยตรงผ่านช่องทางด้านล่างนี้
              ทางร้านจะตอบกลับโดยเร็วที่สุด
            </p>
            <div className="mt-6">
              <ContactLinks contacts={config.contacts} size="lg" />
            </div>
          </>
        ) : (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            ยังไม่ได้ตั้งค่าช่องทางติดต่อสำหรับร้านนี้
            ผู้ดูแลระบบสามารถตั้งค่าได้ผ่านตัวแปรสภาพแวดล้อม
          </p>
        )}
      </div>
    </section>
  );
}
