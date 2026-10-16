import { PrismaClient } from '@prisma/client';

// ใน dev, Next.js hot reload อาจประเมินโมดูลซ้ำ ทำให้เกิด PrismaClient
// หลาย instance และ connection ล้น — cache ไว้บน globalThis จึงเป็นวิธีมาตรฐาน
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
