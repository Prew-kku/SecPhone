import { describe, expect, it } from 'vitest';
import { isSafeInternalPath, safeRedirectPath, loginSchema } from '@/lib/validation/auth';
import { detectImageType } from '@/lib/storage/upload';
import {
  deviceFieldsSchema,
  fieldErrors,
  statusChangeSchema,
  reorderImagesSchema,
} from '@/lib/validation/device';

describe('open redirect protection', () => {
  it('ยอมรับ path ภายใน', () => {
    expect(isSafeInternalPath('/admin')).toBe(true);
    expect(isSafeInternalPath('/admin/phones/new')).toBe(true);
    expect(isSafeInternalPath('/phones?q=iphone')).toBe(true);
  });

  it('ปฏิเสธ protocol-relative และ absolute URL', () => {
    expect(isSafeInternalPath('//evil.com')).toBe(false);
    expect(isSafeInternalPath('https://evil.com')).toBe(false);
    expect(isSafeInternalPath('http://evil.com/admin')).toBe(false);
    expect(isSafeInternalPath('javascript:alert(1)')).toBe(false);
  });

  it('ปฏิเสธ backslash และ control characters', () => {
    expect(isSafeInternalPath('/\\evil.com')).toBe(false);
    expect(isSafeInternalPath('/ad\nmin')).toBe(false);
    expect(isSafeInternalPath('/ad\u0000min')).toBe(false);
  });

  it('ปฏิเสธค่าว่าง/ไม่ขึ้นต้นด้วย /', () => {
    expect(isSafeInternalPath('')).toBe(false);
    expect(isSafeInternalPath(undefined)).toBe(false);
    expect(isSafeInternalPath('admin')).toBe(false);
  });

  it('safeRedirectPath ใช้ fallback เมื่อค่าไม่ปลอดภัย', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/admin');
    expect(safeRedirectPath('https://evil.com')).toBe('/admin');
    expect(safeRedirectPath('/admin/phones/new')).toBe('/admin/phones/new');
  });
});

describe('loginSchema', () => {
  it('normalize อีเมลเป็นตัวพิมพ์เล็กและ trim', () => {
    const parsed = loginSchema.safeParse({ email: '  Admin@Example.COM ', password: 'x' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('admin@example.com');
  });

  it('ปฏิเสธอีเมลผิดรูปแบบ', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('ปฏิเสธรหัสผ่านว่าง', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('deviceFieldsSchema', () => {
  const validBase = {
    newBrandName: 'Apple',
    newModelName: 'iPhone 15',
    storageGb: '256',
    color: 'ดำ',
    priceThb: '21900',
    conditionGrade: 'A',
    description: 'เครื่องสภาพดี',
    status: 'AVAILABLE',
  };

  it('ผ่านเมื่อข้อมูลครบ และ coerce ตัวเลขได้', () => {
    const parsed = deviceFieldsSchema.safeParse(validBase);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.storageGb).toBe(256);
      expect(parsed.data.priceThb).toBe(21900);
      expect(parsed.data.isFeatured).toBe(false);
      expect(parsed.data.ramGb).toBeUndefined();
    }
  });

  it('ปฏิเสธราคาติดลบ', () => {
    const parsed = deviceFieldsSchema.safeParse({ ...validBase, priceThb: '-5' });
    expect(parsed.success).toBe(false);
  });

  it('ปฏิเสธราคาที่ไม่ใช่จำนวนเต็ม', () => {
    const parsed = deviceFieldsSchema.safeParse({ ...validBase, priceThb: '199.99' });
    expect(parsed.success).toBe(false);
  });

  it('ปฏิเสธเกรดสภาพที่ไม่ถูกต้อง', () => {
    const parsed = deviceFieldsSchema.safeParse({ ...validBase, conditionGrade: 'D' });
    expect(parsed.success).toBe(false);
  });

  it('ปฏิเสธเมื่อไม่ระบุแบรนด์ทั้งแบบ id และชื่อใหม่', () => {
    const rest = { ...validBase } as Record<string, unknown>;
    delete rest.newBrandName;
    const parsed = deviceFieldsSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
  });

  it('ปฏิเสธเมื่อระบุทั้ง brandId และ newBrandName พร้อมกัน', () => {
    const parsed = deviceFieldsSchema.safeParse({ ...validBase, brandId: 'abc123' });
    expect(parsed.success).toBe(false);
  });

  it('สตริงว่างของ field เสริม → undefined (ไม่เก็บค่าว่าง)', () => {
    const parsed = deviceFieldsSchema.safeParse({ ...validBase, cosmeticDefects: '  ', ramGb: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cosmeticDefects).toBeUndefined();
      expect(parsed.data.ramGb).toBeUndefined();
    }
  });

  it('checkbox "on" → true', () => {
    const parsed = deviceFieldsSchema.safeParse({ ...validBase, isFeatured: 'on' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.isFeatured).toBe(true);
  });

  it('select ที่ยังไม่เลือก (brandId="") + สร้างแบรนด์ใหม่ → ผ่าน (regression: E2E create)', () => {
    // ฟอร์มส่ง brandId="" เสมอเมื่อ <select> ไม่ถูกเลือก ต้องไม่ทำให้ validation ล้ม
    const parsed = deviceFieldsSchema.safeParse({ ...validBase, brandId: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.brandId).toBeUndefined();
      expect(parsed.data.newBrandName).toBe('Apple');
    }
  });

  it('select ที่ยังไม่เลือกทั้งแบรนด์และรุ่น ("" ทั้งคู่) → ยังต้องล้มเหลว', () => {
    const parsed = deviceFieldsSchema.safeParse({
      ...validBase,
      brandId: '',
      newBrandName: '',
      modelId: '',
      newModelName: '',
    });
    expect(parsed.success).toBe(false);
  });

  it('fieldErrors สร้าง map ตาม field', () => {
    const parsed = deviceFieldsSchema.safeParse({ ...validBase, priceThb: '-1' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error);
      expect(errors.priceThb).toBeTruthy();
    }
  });
});

describe('schemas ขนาดเล็ก', () => {
  it('statusChangeSchema รับเฉพาะสถานะที่ถูกต้อง', () => {
    expect(statusChangeSchema.safeParse({ deviceId: 'abc', status: 'SOLD' }).success).toBe(true);
    expect(statusChangeSchema.safeParse({ deviceId: 'abc', status: 'FOO' }).success).toBe(false);
  });

  it('reorderImagesSchema ต้องมีอย่างน้อย 1 id', () => {
    expect(reorderImagesSchema.safeParse({ deviceId: 'abc', orderedIds: [] }).success).toBe(false);
    expect(reorderImagesSchema.safeParse({ deviceId: 'abc', orderedIds: ['x'] }).success).toBe(true);
  });
});

describe('detectImageType — magic bytes', () => {
  it('ตรวจ JPEG ได้', () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      'jpeg',
    );
  });

  it('ตรวจ PNG ได้', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectImageType(png)).toBe('png');
  });

  it('ตรวจ WebP ได้', () => {
    const bytes = new Uint8Array(12);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(detectImageType(bytes)).toBe('webp');
  });

  it('ปฏิเสธไฟล์ text/HTML ที่อ้างว่าเป็นรูป', () => {
    const text = new TextEncoder().encode('this is not an image at all');
    expect(detectImageType(text)).toBeNull();
  });

  it('ปฏิเสธไฟล์สั้นเกินไป', () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });

  it('ปฏิเสธ GIF (ไม่อยู่ใน allowlist)', () => {
    const gif = new Uint8Array(12);
    gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // GIF89a
    expect(detectImageType(gif)).toBeNull();
  });
});
