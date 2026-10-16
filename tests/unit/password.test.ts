import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, burnTimeWithDummyCompare } from '@/lib/auth/password';

describe('password — bcryptjs', () => {
  it('hash แล้ว verify ผ่านด้วยรหัสเดิม', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('ปฏิเสธรหัสผ่านที่ผิด', async () => {
    const hash = await hashPassword('สวัสดี-รหัส-ผ่าน-123456');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('hash เดียวกันให้ผลต่างกัน (salt ต่างกัน)', async () => {
    const a = await hashPassword('same-password-123');
    const b = await hashPassword('same-password-123');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password-123', a)).toBe(true);
    expect(await verifyPassword('same-password-123', b)).toBe(true);
  });

  it('verify กับ hash ที่ผิดรูปแบบคืน false (ไม่ throw)', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });

  it('dummy compare คืน false เสมอ', async () => {
    expect(await burnTimeWithDummyCompare('anything')).toBe(false);
  });
});
