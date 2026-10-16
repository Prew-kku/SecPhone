/**
 * In-memory sliding-window rate limiter สำหรับการ login
 *
 * ⚠️ ข้อจำกัดที่ต้องเข้าใจ (สำคัญสำหรับ production บน Railway)
 * ------------------------------------------------------------------
 * 1. สถานะเก็บใน **หน่วยความจำของ process** เท่านั้น
 * 2. Railway อาจรันหลาย instance / restart บ่อย → แต่ละ instance มีตัวนับแยกกัน
 *    และตัวนับหายเมื่อ restart หรือ redeploy
 * 3. ดังนั้นตัวนับนี้ **ไม่ใช่การป้องกันแบบ distributed** — ผู้โจมตีที่กระจายคำขอ
 *    ไปหลาย instance จะถูกจำกัดได้ไม่ครบตามที่ตั้งใจ
 * 4. มันยังมีคุณค่าในฐานะ "ชั้นชะลอ" (defense-in-depth) ต่อ brute-force จาก
 *    แหล่งเดียว และเป็นด่านแรกก่อนเสียค่า bcrypt compare
 *
 * ทางแก้ระยะยาว (นอกขอบเขต Phase 3): ใช้ Redis/Upstash หรือ rate limit ที่ edge
 * ถ้าต้องการการรับประกันแบบ distributed จริง
 *
 * เราไม่กล่าวอ้างว่ามันให้การป้องกันแบบ distributed
 */

export type RateLimitConfig = {
  /** จำนวนครั้งสูงสุดที่อนุญาตในหน้าต่างเวลา */
  limit: number;
  /** ความยาวหน้าต่างเวลา (มิลลิวินาที) */
  windowMs: number;
};

/** 5 ครั้ง / 15 นาที ตาม PLAN §7.5 */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
};

type Bucket = {
  /** เวลาที่คำขอที่ยังนับอยู่ (timestamp ms) เรียงจากเก่าไปใหม่ */
  hits: number[];
};

const buckets = new Map<string, Bucket>();

/** เก็บกวาด bucket ที่ว่างแล้วไม่ให้ Map โตไม่จำกัด (เรียกเป็นครั้งคราว) */
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** วินาทีที่ต้องรอ (เฉพาะเมื่อถูกบล็อก) — ใช้กับ header Retry-After */
  retryAfterSeconds: number;
};

/**
 * ตรวจและบันทึกความพยายามหนึ่งครั้ง
 *
 * @param key โดยทั่วไปคือ `${ip}:${email}` เพื่อไม่ให้การยิงอีเมลหนึ่งกระทบผู้ใช้อื่นทั้งระบบ
 * @param now เวลาปัจจุบัน (ฉีดได้เพื่อให้เทสต์ deterministic)
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = LOGIN_RATE_LIMIT,
  now: number = Date.now(),
): RateLimitResult {
  const windowStart = now - config.windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };

  // ตัด hit ที่หลุดหน้าต่างเวลาแล้ว
  const hits = bucket.hits.filter((timestamp) => timestamp > windowStart);

  if (hits.length >= config.limit) {
    const oldest = hits[0];
    const retryAfterMs = oldest + config.windowMs - now;
    // เก็บ state ที่ตัดแล้วเพื่อไม่ให้หน่วยความจำโต
    bucket.hits = hits;
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  hits.push(now);
  bucket.hits = hits;
  buckets.set(key, bucket);
  sweepIfNeeded(now, config);

  return {
    allowed: true,
    remaining: Math.max(0, config.limit - hits.length),
    retryAfterSeconds: 0,
  };
}

/** ล้าง bucket ที่ไม่มีความเคลื่อนไหวในหน้าต่างเวลาแล้ว (กัน memory leak) */
function sweepIfNeeded(now: number, config: RateLimitConfig): void {
  if (buckets.size <= MAX_TRACKED_KEYS) return;
  const windowStart = now - config.windowMs;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.every((timestamp) => timestamp <= windowStart)) {
      buckets.delete(key);
    }
  }
}

/** ล้างสถานะทั้งหมด — ใช้ในเทสต์เท่านั้น */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * ดึง IP ของผู้เรียกจาก header ที่ proxy ตั้งให้
 * Railway ตั้ง x-forwarded-for; ตัวซ้ายสุดคือ client จริง (เชื่อได้เฉพาะเมื่อมี proxy ที่เชื่อถือได้)
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
