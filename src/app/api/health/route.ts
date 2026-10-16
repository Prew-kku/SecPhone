import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** ห้าม cache ผลตรวจสุขภาพ — Railway ต้องเห็นสถานะปัจจุบันเสมอ */
const HEADERS = { 'Cache-Control': 'no-store' } as const;

/** เวลาสูงสุดที่ยอมให้ query ตรวจ DB (ms) — health check ต้องตอบเร็ว */
const DB_TIMEOUT_MS = 3000;

/**
 * GET /api/health — health check สำหรับ Railway
 *
 * ตรวจว่าแอปตอบได้ **และ** ต่อฐานข้อมูลได้ (Railway ใช้ตัดสินใจ deploy/rollback)
 * - 200 = พร้อมใช้งาน
 * - 503 = ยังไม่พร้อม (DB ต่อไม่ได้/timeout)
 *
 * ไม่เปิดเผยข้อมูลอ่อนไหว: ไม่มี DATABASE_URL, host, ชื่อ DB, ข้อความ error ดิบ,
 * version, หรือ path ภายใน — คืนแค่สถานะเชิงตรรกะ
 */
export async function GET() {
  const startedAt = Date.now();

  let dbOk = false;
  try {
    const result = await Promise.race([
      prisma.$queryRaw`SELECT 1`.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), DB_TIMEOUT_MS)),
    ]);
    dbOk = result === true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'up' : 'down',
      latencyMs: Date.now() - startedAt,
    },
    { status: dbOk ? 200 : 503, headers: HEADERS },
  );
}
