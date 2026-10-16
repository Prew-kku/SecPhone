import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  GENERIC_AUTH_ERROR,
  burnTimeWithDummyCompare,
  verifyPassword,
} from '@/lib/auth/password';
import {
  SESSION_COOKIE_NAME,
  isAuthConfigured,
  sessionCookieMaxAge,
  shouldUseSecureCookie,
  signSession,
} from '@/lib/auth/session';
import { LOGIN_RATE_LIMIT, checkRateLimit, clientIpFromHeaders } from '@/lib/auth/rate-limit';
import { loginSchema } from '@/lib/validation/auth';
import { isTrustedOrigin } from '@/lib/auth/origin';

export const dynamic = 'force-dynamic';

/** ไม่มี cache กับข้อมูล auth เด็ดขาด */
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function jsonError(message: string, status: number, extraHeaders?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

/**
 * POST /api/auth/login
 *
 * ลำดับตาม PLAN §7.2:
 *  1. ตรวจ Origin (กัน CSRF สำหรับ route handler)
 *  2. rate limit ต่อ (IP + email)
 *  3. validate ด้วย Zod
 *  4. หา user → ถ้าไม่พบให้เทียบ dummy hash (ลด timing side-channel)
 *  5. ตรวจ isActive
 *  6. ออก JWT ใหม่ + ตั้ง cookie
 *  7. อัปเดต lastLoginAt
 *
 * ข้อความ error ต้องเป็นกลางเสมอ — ห้ามบอกว่าอีเมลมีอยู่หรือไม่
 */
export async function POST(request: Request) {
  // 1) CSRF/origin check — route handler ไม่มี origin check ให้เองเหมือน server action
  if (!isTrustedOrigin(request)) {
    return jsonError('คำขอไม่ถูกต้อง', 403);
  }

  if (!isAuthConfigured()) {
    // ตั้งค่าไม่ครบ → ปิดการ login ไว้ก่อน (fail closed) และไม่เปิดเผยรายละเอียด
    console.error('[auth] ปฏิเสธการ login: JWT_SECRET ไม่ได้ตั้งค่าหรือสั้นกว่า 32 ตัวอักษร');
    return jsonError('ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน', 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(GENERIC_AUTH_ERROR, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    // ตอบข้อความกลาง ๆ ไม่ผูกกับ field เพื่อไม่ให้เป็น oracle
    return jsonError(GENERIC_AUTH_ERROR, 400);
  }
  const { email, password } = parsed.data;

  // 2) rate limit — คีย์ผูกกับ IP + อีเมล เพื่อไม่ให้การยิงอีเมลหนึ่งบล็อกทั้งระบบ
  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `${ip}:${email}`;
  const rate = checkRateLimit(rateKey, LOGIN_RATE_LIMIT);
  if (!rate.allowed) {
    return jsonError('พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง', 429, {
      'Retry-After': String(rate.retryAfterSeconds),
    });
  }

  // 4) หา user
  const admin = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, role: true, isActive: true },
  });

  if (!admin) {
    // เทียบกับ hash ปลอมเพื่อให้เวลาตอบใกล้เคียงเคสที่พบผู้ใช้
    await burnTimeWithDummyCompare(password);
    return jsonError(GENERIC_AUTH_ERROR, 401);
  }

  const passwordOk = await verifyPassword(password, admin.passwordHash);
  if (!passwordOk) {
    return jsonError(GENERIC_AUTH_ERROR, 401);
  }

  // 5) บัญชีที่ถูกปิดใช้งาน — ยังตอบกลาง ๆ เพื่อไม่ให้เป็น oracle
  //    (แต่บันทึก log ฝั่ง server ไว้ตรวจสอบ)
  if (!admin.isActive) {
    console.warn(`[auth] พยายาม login ด้วยบัญชีที่ปิดใช้งาน: ${admin.id}`);
    return jsonError(GENERIC_AUTH_ERROR, 403);
  }

  // 6) ออก token ใหม่ทุกครั้ง (กัน session fixation) แล้วตั้ง cookie
  const token = await signSession({ sub: admin.id, email: admin.email, role: admin.role });

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: sessionCookieMaxAge(),
  });

  // 7) อัปเดตเวลาที่ login ล่าสุด — ไม่ให้ความล้มเหลวตรงนี้ทำให้ login ทั้งหมดพัง
  try {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
  } catch (error) {
    console.error('[auth] อัปเดต lastLoginAt ไม่สำเร็จ', error instanceof Error ? error.message : error);
  }

  return response;
}
