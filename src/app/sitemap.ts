import type { MetadataRoute } from 'next';
import { getPublicDeviceSlugs } from '@/lib/queries/devices';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const devices = await getPublicDeviceSlugs();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/phones`, changeFrequency: 'daily', priority: 0.9 },
  ];

  const deviceRoutes: MetadataRoute.Sitemap = devices.map((device) => ({
    url: `${baseUrl}/phones/${device.slug}`,
    lastModified: device.updatedAt ?? device.createdAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...deviceRoutes];
}
