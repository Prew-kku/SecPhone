import { Suspense } from 'react';
import { getSiteConfig } from '@/lib/site-config';
import { ContactSection, HeroSection } from '@/components/layout/home-sections';
import { HomeCatalog } from '@/components/layout/home-catalog';
import { HomeCatalogSkeleton } from '@/components/layout/home-catalog-skeleton';

// ต้องอ่านข้อมูลสดจาก PostgreSQL ทุกครั้ง (ไม่ให้ prerender ค้างข้อมูล)
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const config = getSiteConfig();

  return (
    <main>
      <HeroSection config={config} />
      <Suspense fallback={<HomeCatalogSkeleton />}>
        <HomeCatalog />
      </Suspense>
      <ContactSection config={config} />
    </main>
  );
}
