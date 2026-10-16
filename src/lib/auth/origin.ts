/**
 * การตรวจ Origin/Referer สำหรับคำขอที่เปลี่ยนสถานะ (CSRF protection)
 *
 * Server Actions ของ Next.js มี origin check ให้เอง แต่ **route handler ไม่มี**
 * ดังนั้น route handler ที่เป็น mutation (เช่น login/logout) ต้องตรวจเอง — PLAN §7.5
 *
 * กลยุทธ์:
 *  - ใช้ host จริงที่ไคลเอนต์เรียก (Host / X-Forwarded-Host) เป็นหลัก
 *    เพราะใน container `request.url` อาจเป็น host ภายใน (เช่น 0.0.0.0:3000)
 *    ที่ไม่ตรงกับ Origin ที่เบราว์เซอร์ส่งมา
 *  - ถ้ามี Origin header → ต้องตรงกับ host ที่อนุญาต (หรือ host จาก TRUSTED_ORIGINS)
 *  - ถ้าไม่มี Origin → ยอมรับเฉพาะเมื่อ Referer ตรงกัน (เบราว์เซอร์เก่าบางตัวไม่ส่ง Origin)
 *  - ถ้าไม่มีทั้งคู่ → ปฏิเสธ (fail closed)
 */

/** host เพิ่มเติมที่อนุญาต เช่น reverse proxy/โดเมนอื่น (คั่นด้วย comma ใน TRUSTED_ORIGINS) */
function trustedExtraHosts(): string[] {
  return (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/** ดึง host จากค่า origin/referer (คืน null เมื่อ parse ไม่ได้) */
function hostOf(urlLike: string | null): string | null {
  if (!urlLike) return null;
  try {
    return new URL(urlLike).host.toLowerCase();
  } catch {
    return null;
  }
}

/** host ที่ไคลเอนต์ใช้จริง: X-Forwarded-Host → Host → host ของ request.url */
function requestHost(request: Request): string | null {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedHost) return forwardedHost.toLowerCase();

  const hostHeader = request.headers.get('host')?.trim();
  if (hostHeader) return hostHeader.toLowerCase();

  return hostOf(request.url);
}

/**
 * ตรวจว่าคำขอมาจาก origin ที่เชื่อถือได้
 *
 * ใช้ host จริงของคำขอ (จาก header) เป็นหลัก เพื่อให้ทำงานได้ทั้ง localhost, Docker
 * และ Railway โดยไม่ต้องตั้งค่าเพิ่ม (และรองรับ TRUSTED_ORIGINS สำหรับกรณีพิเศษ)
 */
export function isTrustedOrigin(request: Request): boolean {
  const requestHostValue = requestHost(request);
  if (!requestHostValue) return false;

  const allowed = new Set<string>([requestHostValue, ...trustedExtraHosts()]);

  const originHost = hostOf(request.headers.get('origin'));
  if (originHost) return allowed.has(originHost);

  // ไม่มี Origin → ลอง Referer (เฉพาะกรณีที่ตั้งใจจะรองรับ; ยัง fail closed ถ้าไม่มีอะไรเลย)
  const refererHost = hostOf(request.headers.get('referer'));
  if (refererHost) return allowed.has(refererHost);

  return false;
}
