/**
 * การตรวจ Origin/Referer สำหรับคำขอที่เปลี่ยนสถานะ (CSRF protection)
 *
 * Server Actions ของ Next.js มี origin check ให้เอง แต่ **route handler ไม่มี**
 * ดังนั้น route handler ที่เป็น mutation (เช่น login/logout/upload) ต้องตรวจเอง — PLAN §7.5
 *
 * ⚠️ บทเรียนความปลอดภัย (สำคัญ)
 * ------------------------------------------------------------------
 * การเทียบ Origin กับ "host ที่คำขอบอกเอง" มีความเสี่ยงถ้าเราเชื่อ header ที่ปลอมได้
 * โดยเฉพาะ `X-Forwarded-Host` ซึ่ง JavaScript ฝั่งเบราว์เซอร์ตั้งได้ (ถ้าไม่ติด CORS preflight)
 * ผู้โจมตีที่ตั้งทั้ง `X-Forwarded-Host: evil.com` และ `Origin: https://evil.com`
 * จะทำให้สองฝั่งตรงกัน → bypass ได้
 *
 * กลยุทธ์ที่ใช้:
 *  1. **allowlist จากค่าที่เชื่อถือได้ก่อน**: `SITE_URL` และ `TRUSTED_ORIGINS`
 *     - entry ที่มี scheme (เช่น `https://shop.example.com`) → เทียบแบบเต็ม (scheme+host)
 *     - entry ที่เป็น host เปล่า → เทียบเฉพาะ host
 *  2. ถ้าไม่ได้ตั้งค่าอะไรเลย → ใช้ `Host` header (เบราว์เซอร์ตั้งเอง ปลอมด้วย JS ไม่ได้)
 *  3. `X-Forwarded-Host` **ไม่ถูกเชื่อโดยปริยาย** — ใช้เฉพาะเมื่อตั้ง `TRUST_PROXY_HEADERS=true`
 *     (แสดงว่าอยู่หลัง reverse proxy ที่เชื่อถือได้ซึ่งเขียน header นี้ทับ)
 *  4. ไม่มี Origin → ยอมรับเฉพาะเมื่อ Referer ตรง (fail closed ถ้าไม่มีทั้งคู่)
 */

/** อ่านค่าจาก env แบบ trim (คืน '' เมื่อไม่ตั้ง) */
function envValue(name: string): string {
  return process.env[name]?.trim() ?? '';
}

/** true เมื่อได้รับอนุญาตให้เชื่อ header ของ reverse proxy (เช่น Railway) */
export function trustProxyHeaders(): boolean {
  return envValue('TRUST_PROXY_HEADERS').toLowerCase() === 'true';
}

/**
 * รายการ origin/host ที่อนุญาตจาก env
 * - `SITE_URL` — URL สาธารณะของเว็บ (แนะนำให้ตั้งใน production)
 * - `TRUSTED_ORIGINS` — เพิ่มเติมได้หลายค่า คั่นด้วย comma (รับทั้ง URL เต็มและ host เปล่า)
 */
function configuredAllowlist(): string[] {
  const raw = [envValue('SITE_URL'), envValue('TRUSTED_ORIGINS')].filter(Boolean).join(',');
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** ดึง host จากค่า URL (คืน null เมื่อ parse ไม่ได้) */
function hostOf(urlLike: string | null): string | null {
  if (!urlLike) return null;
  try {
    return new URL(urlLike).host.toLowerCase();
  } catch {
    return null;
  }
}

/** ดึง origin เต็ม (scheme://host) จากค่า URL (คืน null เมื่อ parse ไม่ได้) */
function originOf(urlLike: string | null): string | null {
  if (!urlLike) return null;
  try {
    const parsed = new URL(urlLike);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * host ที่คำขอถูกส่งมาถึง (ตามที่เบราว์เซอร์/proxy ระบุ)
 *
 * ลำดับ:
 *  1. ถ้า trust proxy → `X-Forwarded-Host` (proxy เขียนทับด้วย host สาธารณะ)
 *  2. `Host` header (เบราว์เซอร์ตั้งเอง ปลอมด้วย JS ไม่ได้)
 *  3. host จาก `request.url`
 */
function requestHost(request: Request): string | null {
  if (trustProxyHeaders()) {
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    if (forwardedHost) return forwardedHost.toLowerCase();
  }

  const hostHeader = request.headers.get('host')?.trim();
  if (hostHeader) return hostHeader.toLowerCase();

  return hostOf(request.url);
}

/**
 * ตรวจว่าคำขอมาจาก origin ที่เชื่อถือได้
 *
 * ลำดับการตรวจ:
 *  1. allowlist จาก `SITE_URL` / `TRUSTED_ORIGINS` (ถ้าตั้งไว้) — เทียบแบบเต็มถ้ามี scheme
 *  2. host ของคำขอเอง (`Host`) เทียบกับ Origin/Referer
 *
 * @returns true เมื่อผ่าน; false (fail closed) เมื่อไม่มีข้อมูลหรือไม่ตรง
 */
export function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  const candidateHost = hostOf(origin) ?? hostOf(referer);
  const candidateOrigin = originOf(origin) ?? originOf(referer);

  // ไม่มีทั้ง Origin และ Referer → ปฏิเสธ
  if (!candidateHost || !candidateOrigin) return false;

  // 1) allowlist ที่ตั้งค่าไว้อย่างชัดเจน
  for (const entry of configuredAllowlist()) {
    if (entry.includes('://')) {
      if (entry === candidateOrigin) return true;
    } else if (entry === candidateHost) {
      return true;
    }
  }

  // 2) เทียบกับ host ของคำขอเอง (Host header ปลอมด้วย JS ไม่ได้)
  const requestHostValue = requestHost(request);
  if (requestHostValue && requestHostValue === candidateHost) return true;

  return false;
}
