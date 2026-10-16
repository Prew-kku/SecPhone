import { describe, expect, it } from 'vitest';
import { buildSkuBase, randomSkuSuffix, uniqueSku, uniqueSlug, slugify } from '@/lib/slug';
import { isTrustedOrigin } from '@/lib/auth/origin';
import { isInsideRoot } from '@/lib/storage/upload-dir';

describe('slugify / uniqueSlug', () => {
  it('สร้าง slug จากข้อความละติน', () => {
    expect(slugify('iPhone 15 Pro Max')).toBe('iphone-15-pro-max');
  });

  it('ข้อความไทยล้วน → สตริงว่าง (ต้องมี fallback)', () => {
    expect(slugify('มือสอง')).toBe('');
  });

  it('uniqueSlug เติม suffix เมื่อชน', () => {
    const taken = new Set(['apple', 'apple-2']);
    expect(uniqueSlug('apple', (c) => taken.has(c))).toBe('apple-3');
  });

  it('uniqueSlug ใช้ base เดิมเมื่อไม่ชน', () => {
    expect(uniqueSlug('samsung', () => false)).toBe('samsung');
  });

  it('uniqueSlug ของข้อความไทยล้วนใช้ fallback "item"', () => {
    expect(uniqueSlug('มือสอง', () => false)).toBe('item');
  });
});

describe('SKU generation', () => {
  it('buildSkuBase รวมแบรนด์/รุ่น/ความจุ/สี เป็นตัวใหญ่', () => {
    const base = buildSkuBase('Apple', 'iPhone 13 Pro', 256, 'ทอง');
    expect(base).toContain('APPLE');
    expect(base).toContain('IPHONE-13-PRO');
    expect(base).toContain('256');
  });

  it('randomSkuSuffix ให้ 4 ตัวจากชุดที่ปลอดภัยต่อการอ่าน', () => {
    const suffix = randomSkuSuffix();
    expect(suffix).toMatch(/^[A-Z0-9]{4}$/);
    // ไม่มีตัวอักษร/เลขที่สับสน (I, O, 0, 1)
    expect(suffix).not.toMatch(/[IO01]/);
  });

  it('uniqueSku หลบเลี่ยงค่าที่ชนกัน', () => {
    const taken = new Set<string>();
    const first = uniqueSku('APPLE-IPHONE-256-DAM', (c) => taken.has(c));
    taken.add(first);
    const second = uniqueSku('APPLE-IPHONE-256-DAM', (c) => taken.has(c));
    expect(second).not.toBe(first);
    expect(second.startsWith('APPLE-IPHONE-256-DAM')).toBe(true);
  });
});

describe('isTrustedOrigin — CSRF origin check', () => {
  it('ยอมรับเมื่อ Origin ตรงกับ host ของคำขอ', () => {
    const request = new Request('https://shop.example.com/api/auth/login', {
      headers: { origin: 'https://shop.example.com' },
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it('ปฏิเสธ Origin ที่ต่างจาก host', () => {
    const request = new Request('https://shop.example.com/api/auth/login', {
      headers: { origin: 'https://evil.example.com' },
    });
    expect(isTrustedOrigin(request)).toBe(false);
  });

  it('ยอมรับ Referer เมื่อไม่มี Origin', () => {
    const request = new Request('https://shop.example.com/api/auth/login', {
      headers: { referer: 'https://shop.example.com/admin/login' },
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it('ปฏิเสธเมื่อไม่มีทั้ง Origin และ Referer (fail closed)', () => {
    const request = new Request('https://shop.example.com/api/auth/login');
    expect(isTrustedOrigin(request)).toBe(false);
  });

  it('รองรับ host ที่อนุญาตผ่าน TRUSTED_ORIGINS', () => {
    process.env.TRUSTED_ORIGINS = 'proxy.example.com';
    const request = new Request('https://internal:3000/api/auth/login', {
      headers: { origin: 'https://proxy.example.com' },
    });
    expect(isTrustedOrigin(request)).toBe(true);
    delete process.env.TRUSTED_ORIGINS;
  });

  it('ใช้ host จาก header แทน request.url (เคส container ที่ url เป็น 0.0.0.0)', () => {
    // ใน container request.url อาจเป็น http://0.0.0.0:3000 แต่ไคลเอนต์เรียก localhost
    const request = new Request('http://0.0.0.0:3000/api/auth/login', {
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it('ยังปฏิเสธ Origin ที่ไม่ตรงกับ host ที่ส่งมา', () => {
    const request = new Request('http://0.0.0.0:3000/api/auth/login', {
      headers: { host: 'localhost:3000', origin: 'http://evil.example.com' },
    });
    expect(isTrustedOrigin(request)).toBe(false);
  });

  it('Railway: ใช้ Host สาธารณะที่ proxy ส่งมา (ไม่ต้องตั้งอะไรเพิ่ม)', () => {
    const request = new Request('http://0.0.0.0:3000/api/auth/login', {
      headers: {
        host: 'secphone-production.up.railway.app',
        origin: 'https://secphone-production.up.railway.app',
      },
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it('ไม่เชื่อ X-Forwarded-Host โดยปริยาย (กัน header spoofing)', () => {
    // ผู้โจมตีตั้ง X-Forwarded-Host + Origin ให้ตรงกัน แต่ Host จริงไม่ตรง → ต้องปฏิเสธ
    const request = new Request('http://0.0.0.0:3000/api/auth/login', {
      headers: {
        host: 'secphone-production.up.railway.app',
        'x-forwarded-host': 'evil.example.com',
        origin: 'https://evil.example.com',
      },
    });
    expect(isTrustedOrigin(request)).toBe(false);
  });

  it('เชื่อ X-Forwarded-Host เฉพาะเมื่อตั้ง TRUST_PROXY_HEADERS=true', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    try {
      const request = new Request('http://0.0.0.0:3000/api/auth/login', {
        headers: {
          host: '0.0.0.0:3000',
          'x-forwarded-host': 'secphone-production.up.railway.app',
          origin: 'https://secphone-production.up.railway.app',
        },
      });
      expect(isTrustedOrigin(request)).toBe(true);
    } finally {
      delete process.env.TRUST_PROXY_HEADERS;
    }
  });

  it('SITE_URL: เทียบแบบเต็ม (scheme+host) เมื่อตั้งไว้', () => {
    process.env.SITE_URL = 'https://shop.example.com';
    try {
      // Host header ภายในไม่ตรง แต่ SITE_URL ตรง → ผ่าน
      const request = new Request('http://0.0.0.0:3000/api/auth/login', {
        headers: { host: '0.0.0.0:3000', origin: 'https://shop.example.com' },
      });
      expect(isTrustedOrigin(request)).toBe(true);

      // scheme ไม่ตรง (http vs https) → ไม่ผ่าน
      const wrongScheme = new Request('http://0.0.0.0:3000/api/auth/login', {
        headers: { host: '0.0.0.0:3000', origin: 'http://shop.example.com' },
      });
      expect(isTrustedOrigin(wrongScheme)).toBe(false);
    } finally {
      delete process.env.SITE_URL;
    }
  });

  it('TRUSTED_ORIGINS แบบ URL เต็ม → เทียบ scheme+host', () => {
    process.env.TRUSTED_ORIGINS = 'https://preview.example.com';
    try {
      const ok = new Request('http://0.0.0.0:3000/api/auth/login', {
        headers: { host: '0.0.0.0:3000', origin: 'https://preview.example.com' },
      });
      expect(isTrustedOrigin(ok)).toBe(true);

      const bad = new Request('http://0.0.0.0:3000/api/auth/login', {
        headers: { host: '0.0.0.0:3000', origin: 'https://evil.example.com' },
      });
      expect(isTrustedOrigin(bad)).toBe(false);
    } finally {
      delete process.env.TRUSTED_ORIGINS;
    }
  });
});

describe('isInsideRoot — path containment', () => {
  it('ยอมรับ path ใต้ root', () => {
    expect(isInsideRoot('/app/uploads', '/app/uploads/devices/x/y.webp')).toBe(true);
  });

  it('ปฏิเสธ path นอก root', () => {
    expect(isInsideRoot('/app/uploads', '/app/uploads-evil/y.webp')).toBe(false);
    expect(isInsideRoot('/app/uploads', '/etc/passwd')).toBe(false);
  });

  it('ยอมรับ root เอง', () => {
    expect(isInsideRoot('/app/uploads', '/app/uploads')).toBe(true);
  });
});
