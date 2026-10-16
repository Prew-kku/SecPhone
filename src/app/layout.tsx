import type { Metadata } from 'next';
import '@fontsource-variable/noto-sans-thai';
import './globals.css';
import { getSiteConfig } from '@/lib/site-config';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

export async function generateMetadata(): Promise<Metadata> {
  const config = getSiteConfig();
  const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${config.name} — สมาร์ทโฟนมือสองคุณภาพคัดสรร`,
      template: `%s | ${config.name}`,
    },
    description: config.description,
    openGraph: {
      type: 'website',
      locale: 'th_TH',
      siteName: config.name,
      title: config.name,
      description: config.description,
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = getSiteConfig();

  return (
    <html lang="th">
      <body className="flex min-h-screen flex-col bg-white font-sans text-slate-900 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        <SiteHeader siteName={config.name} />
        <div id="main" className="flex-1">
          {children}
        </div>
        <SiteFooter config={config} />
      </body>
    </html>
  );
}
