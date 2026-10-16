import { afterEach, describe, expect, it } from 'vitest';
import {
  LOGIN_RATE_LIMIT,
  checkRateLimit,
  clientIpFromHeaders,
  resetRateLimits,
} from '@/lib/auth/rate-limit';

afterEach(() => resetRateLimits());

describe('rate limit — sliding window', () => {
  it('อนุญาต 5 ครั้งแรก แล้วบล็อกครั้งที่ 6 (ตาม PLAN §7.5)', () => {
    const now = 1_000_000;
    for (let i = 1; i <= 5; i += 1) {
      const result = checkRateLimit('ip:a', LOGIN_RATE_LIMIT, now);
      expect(result.allowed, `ครั้งที่ ${i} ควรผ่าน`).toBe(true);
    }
    const blocked = checkRateLimit('ip:a', LOGIN_RATE_LIMIT, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('คีย์ต่างกันมีตัวนับแยกกัน (อีเมลหนึ่งไม่บล็อกอีกอีเมล)', () => {
    const now = 2_000_000;
    for (let i = 0; i < 5; i += 1) checkRateLimit('ip:userA', LOGIN_RATE_LIMIT, now);
    expect(checkRateLimit('ip:userA', LOGIN_RATE_LIMIT, now).allowed).toBe(false);
    expect(checkRateLimit('ip:userB', LOGIN_RATE_LIMIT, now).allowed).toBe(true);
  });

  it('หลังพ้นหน้าต่างเวลากลับมาอนุญาตได้อีก', () => {
    const start = 3_000_000;
    for (let i = 0; i < 5; i += 1) checkRateLimit('ip:c', LOGIN_RATE_LIMIT, start);
    expect(checkRateLimit('ip:c', LOGIN_RATE_LIMIT, start).allowed).toBe(false);
    // เกินหน้าต่างไปแล้ว
    const later = start + LOGIN_RATE_LIMIT.windowMs + 1;
    expect(checkRateLimit('ip:c', LOGIN_RATE_LIMIT, later).allowed).toBe(true);
  });

  it('remaining ลดลงตามจำนวนครั้งที่ใช้', () => {
    const now = 4_000_000;
    expect(checkRateLimit('ip:d', LOGIN_RATE_LIMIT, now).remaining).toBe(4);
    expect(checkRateLimit('ip:d', LOGIN_RATE_LIMIT, now).remaining).toBe(3);
  });
});

describe('clientIpFromHeaders', () => {
  it('ไม่ trust proxy → ใช้ค่าขวาสุด (ลดการปลอมจากไคลเอนต์)', () => {
    delete process.env.TRUST_PROXY_HEADERS;
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(clientIpFromHeaders(headers)).toBe('10.0.0.1');
  });

  it('trust proxy → ใช้ค่าซ้ายสุด (client จริงตามที่ proxy ระบุ)', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    try {
      const headers = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
      expect(clientIpFromHeaders(headers)).toBe('203.0.113.5');
    } finally {
      delete process.env.TRUST_PROXY_HEADERS;
    }
  });

  it('fallback ไป x-real-ip', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('ไม่มี header เลย → unknown', () => {
    expect(clientIpFromHeaders(new Headers())).toBe('unknown');
  });
});
