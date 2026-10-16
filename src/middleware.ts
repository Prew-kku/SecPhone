import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session';

/**
 * middleware — **ชั้น routing เท่านั้น** ไม่ใช่ชั้นความปลอดภัยจริง (PLAN §7.3)
 *
 * หน้าที่: ถ้าไม่มี/ไม่ถูกต้อง cookie สำหรับ path ของ /admin/* (ยกเว้น /admin/login)
 * ให้ redirect ไปหน้า login พร้อม ?next=
 *
 * การอนุญาตจริง (ตรวจ JWT + สถานะบัญชี + role) อยู่ใน `requireAdmin()` ที่เรียกใน
 * ทุก server action/mutation เสมอ — ห้ามพึ่ง middleware เพียงอย่างเดียว
 *
 * ใช้ jose (Web Crypto) จึงทำงานได้ทั้ง node และ edge runtime
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // allowlist ระดับ path: หน้า login ต้องเข้าถึงได้เสมอ (กัน redirect loop)
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (session) return NextResponse.next();

  // ไม่ผ่าน → ส่งไป login พร้อมเก็บปลายทางที่ต้องการ (path ภายในเท่านั้น)
  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // ครอบเฉพาะ /admin/* ไม่รวม static/api (และไม่รวม /admin/login ซึ่งจัดการใน handler)
  matcher: ['/admin/:path*'],
};
