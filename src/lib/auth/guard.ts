import { cookies } from 'next/headers';
import type { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, isAuthConfigured, verifySession } from '@/lib/auth/session';

/**
 * ชั้นการตรวจสอบสิทธิ์จริง (server-side) — PLAN §7.3 ข้อ 2
 *
 * middleware ทำได้แค่ "เปลี่ยนเส้นทาง" ตามการมีอยู่ของ cookie ซึ่งปลอมได้/หมดอายุได้
 * การอนุญาตจริงต้องตรวจ JWT + สถานะบัญชีจากฐานข้อมูลทุกครั้งก่อนทำ mutation
 * ห้ามพึ่ง middleware เพียงอย่างเดียว
 */

export type AdminSessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
};

/** error ที่ส่งกลับเมื่อไม่ผ่านการตรวจสอบ (แยกจาก error ทางธุรกิจ) */
export class UnauthorizedError extends Error {
  readonly status: 401 | 403;
  constructor(message = 'ต้องเข้าสู่ระบบก่อน', status: 401 | 403 = 401) {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = status;
  }
}

/** สร้าง error แบบ 403 (ล็อกอินแล้วแต่สิทธิ์ไม่พอ) */
export class ForbiddenError extends UnauthorizedError {
  constructor(message = 'คุณไม่มีสิทธิ์ดำเนินการนี้') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * อ่านเซสชันปัจจุบันจาก cookie แล้วตรวจกับฐานข้อมูล
 *
 * คืน null เมื่อ: ไม่มี cookie / JWT ผิดหรือหมดอายุ / JWT_SECRET ไม่ได้ตั้ง /
 * ผู้ใช้ถูกลบ / บัญชีถูกปิดใช้งาน (isActive = false)
 *
 * การตรวจ isActive ทุกครั้งทำให้ "ปิดบัญชีแล้วต้องหลุดทันที" โดยไม่ต้องรอ token หมดอายุ
 */
export async function getCurrentAdmin(): Promise<AdminSessionUser | null> {
  if (!isAuthConfigured()) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, displayName: true, role: true, isActive: true },
  });

  if (!admin || !admin.isActive) return null;

  return {
    id: admin.id,
    email: admin.email,
    displayName: admin.displayName,
    role: admin.role,
  };
}

/**
 * บังคับว่าต้องเป็นผู้ดูแลที่ล็อกอินแล้ว — throw ถ้าไม่ผ่าน
 * เรียกในทุก server action / admin mutation
 */
export async function requireAdmin(): Promise<AdminSessionUser> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new UnauthorizedError();
  return admin;
}

/** บังคับว่าต้องมีสิทธิ์ระดับที่กำหนด (OWNER เท่านั้นสำหรับปฏิบัติการที่ทำลายได้) */
export async function requireRole(role: AdminRole): Promise<AdminSessionUser> {
  const admin = await requireAdmin();
  if (admin.role !== role) throw new ForbiddenError();
  return admin;
}

/** true เมื่อเป็น OWNER — ใช้ตัดสินว่าอนุญาตการลบถาวร/จัดการผู้ดูแลหรือไม่ */
export function isOwner(admin: AdminSessionUser): boolean {
  return admin.role === 'OWNER';
}
