import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { isTrustedOrigin } from '@/lib/auth/origin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 *
 * ล้าง cookie ฝั่ง server (Max-Age=0) — ไม่พึ่ง client เพียงอย่างเดียว (PLAN §7.4)
 * ตรวจ Origin ก่อนเพราะเป็นการเปลี่ยนสถานะ (กัน CSRF logout)
 */
export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json(
      { error: 'คำขอไม่ถูกต้อง' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  return response;
}
