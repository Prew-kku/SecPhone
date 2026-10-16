import { afterEach, describe, expect, it } from 'vitest';
import { isDemoMode } from '@/lib/site-config';

const ORIGINAL = process.env.DEMO_MODE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = ORIGINAL;
});

describe('isDemoMode — เปิดเป็นค่าเริ่มต้น (fail-safe)', () => {
  it('ค่าเริ่มต้นเป็น true เมื่อไม่ได้ตั้ง (ปลอดภัยกว่า: เตือนเสมอ)', () => {
    delete process.env.DEMO_MODE;
    expect(isDemoMode()).toBe(true);
  });

  it('ปิดได้เฉพาะค่าที่ชัดเจนว่าไม่', () => {
    for (const v of ['false', 'FALSE', '0', 'no', ' false ']) {
      process.env.DEMO_MODE = v;
      expect(isDemoMode(), `ควรปิดสำหรับ ${v}`).toBe(false);
    }
  });

  it('ค่าอื่น ๆ ถือว่าเปิด', () => {
    for (const v of ['true', 'TRUE', '1', 'yes', '', 'garbage']) {
      process.env.DEMO_MODE = v;
      expect(isDemoMode(), `ควรเปิดสำหรับ "${v}"`).toBe(true);
    }
  });
});
