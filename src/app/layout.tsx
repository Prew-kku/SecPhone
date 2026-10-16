import type { Metadata } from 'next';
import '@fontsource-variable/noto-sans-thai';
import './globals.css';
import { getSiteConfig } from '@/lib/site-config';
import { getSiteUrl } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const config = getSiteConfig();
  return {
    metadataBase: new URL(getSiteUrl()),
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

/**
 * Root layout: มีเฉพาะ <html>/<body> และ accessibility skip link
 * chrome ของหน้า public (header/footer/banner) อยู่ใน `(public)/layout.tsx`
 * ส่วนหน้า admin มี shell ของตัวเองใน `admin/(protected)/layout.tsx`
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="flex min-h-screen flex-col bg-white font-sans text-slate-900 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        {children}
      </body>
    </html>
  );
}
