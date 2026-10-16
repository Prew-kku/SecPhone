import { afterEach, describe, expect, it } from 'vitest';
import { getSiteUrl } from '@/lib/site-url';

const ORIGINAL = {
  SITE_URL: process.env.SITE_URL,
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
};

afterEach(() => {
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function set(siteUrl?: string, railwayDomain?: string) {
  if (siteUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = siteUrl;
  if (railwayDomain === undefined) delete process.env.RAILWAY_PUBLIC_DOMAIN;
  else process.env.RAILWAY_PUBLIC_DOMAIN = railwayDomain;
}

describe('getSiteUrl — Railway compatibility (Task 7)', () => {
  it('ใช้ SITE_URL เมื่อตั้งเป็น URL เต็ม', () => {
    set('https://shop.example.com');
    expect(getSiteUrl()).toBe('https://shop.example.com');
  });

  it('ตัด "/" ปิดท้ายออก เพื่อไม่ให้เกิด // เมื่อต่อ path', () => {
    set('https://shop.example.com/');
    expect(getSiteUrl()).toBe('https://shop.example.com');
  });

  it('ใช้ RAILWAY_PUBLIC_DOMAIN และเติม https:// ให้อัตโนมัติ', () => {
    set(undefined, 'myapp-production.up.railway.app');
    expect(getSiteUrl()).toBe('https://myapp-production.up.railway.app');
  });

  it('SITE_URL มาก่อน RAILWAY_PUBLIC_DOMAIN', () => {
    set('https://custom.example.com', 'ignored.up.railway.app');
    expect(getSiteUrl()).toBe('https://custom.example.com');
  });

  it('fallback เป็น localhost เมื่อไม่มีค่าใดเลย', () => {
    set(undefined, undefined);
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });

  it('ไม่ throw เมื่อค่าที่ให้มา parse ไม่ได้ (กันหน้าล่มทั้งหน้า)', () => {
    set('not a url at all :::', undefined);
    expect(() => getSiteUrl()).not.toThrow();
  });

  it('ปฏิเสธ scheme ที่ไม่ใช่ http/https แล้ว fallback', () => {
    set('javascript:alert(1)', undefined);
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });

  it('ค่าที่เป็นช่องว่างถือว่าไม่ได้ตั้ง', () => {
    set('   ', undefined);
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });
});
