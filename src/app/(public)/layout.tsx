import { getSiteConfig, isDemoMode } from '@/lib/site-config';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { DemoBanner } from '@/components/layout/demo-banner';

/**
 * Layout ของหน้า public (route group) — มี header/footer/แบนเนอร์สาธิต
 * หน้า admin อยู่ใน route group คนละอัน จึงไม่ได้รับ chrome เหล่านี้
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const config = getSiteConfig();

  return (
    <>
      <SiteHeader siteName={config.name} />
      {isDemoMode() ? <DemoBanner /> : null}
      <div id="main" className="flex-1">
        {children}
      </div>
      <SiteFooter config={config} />
    </>
  );
}
