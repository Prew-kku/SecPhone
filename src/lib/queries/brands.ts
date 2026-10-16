import { prisma } from '@/lib/prisma';

export type PublicBrand = {
  id: string;
  name: string;
  slug: string;
  deviceCount: number;
};

/** แบรนด์ที่มีสินค้า AVAILABLE อยู่ พร้อมจำนวนเครื่อง */
export async function getActiveBrands(): Promise<PublicBrand[]> {
  const brands = await prisma.brand.findMany({
    where: {
      models: {
        some: { devices: { some: { status: 'AVAILABLE', deletedAt: null } } },
      },
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      models: {
        select: {
          _count: { select: { devices: { where: { status: 'AVAILABLE', deletedAt: null } } } },
        },
      },
    },
  });

  return brands
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      deviceCount: brand.models.reduce((total, model) => total + model._count.devices, 0),
    }))
    .filter((brand) => brand.deviceCount > 0);
}
