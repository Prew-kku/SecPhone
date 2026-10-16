import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getUploadRoot, isInsideRoot, resolveRealpathOrNull } from '@/lib/storage/upload-dir';
import { isUploadedImageFilename, resolveImageSrc } from '@/lib/storage/paths';

const VALID = 'devices/abc123/8f14e45f-ceea-467a-9d1a-2b3c4d5e6f70.webp';

describe('storage path allowlist (Task 2)', () => {
  it('รับชื่อไฟล์ที่ตรงรูปแบบเท่านั้น', () => {
    expect(isUploadedImageFilename(VALID)).toBe(true);
    expect(resolveImageSrc(VALID)).toBe(`/api/images/${VALID}`);
  });

  it('ปฏิเสธ path traversal ทุกรูปแบบ', () => {
    for (const bad of [
      'devices/abc123/../../../etc/passwd',
      '../secrets.webp',
      'devices/../devices/x.webp',
      '/etc/passwd',
      'devices\\abc\\x.webp',
      'devices/abc123/not-a-uuid.webp',
      'devices/abc123/x.svg',
      'devices/abc123/x.webp.exe',
      '',
      'devices//x.webp',
    ]) {
      expect(isUploadedImageFilename(bad), `ควรปฏิเสธ: ${bad}`).toBe(false);
      expect(resolveImageSrc(bad)).toBeNull();
    }
  });

  it('ปฏิเสธ id เครื่องที่มีอักขระอันตราย', () => {
    expect(isUploadedImageFilename('devices/ABC/8f14e45f-ceea-467a-9d1a-2b3c4d5e6f70.webp')).toBe(false);
    expect(isUploadedImageFilename('devices/..%2f/8f14e45f-ceea-467a-9d1a-2b3c4d5e6f70.webp')).toBe(false);
  });
});

describe('isInsideRoot — containment', () => {
  it('ยอมรับ path ที่อยู่ใต้ root', () => {
    expect(isInsideRoot('/app/uploads', '/app/uploads/devices/a/x.webp')).toBe(true);
    expect(isInsideRoot('/app/uploads', '/app/uploads')).toBe(true);
  });

  it('ปฏิเสธ sibling directory ที่ชื่อขึ้นต้นเหมือนกัน (prefix attack)', () => {
    // "/app/uploads-evil" ต้องไม่ถือว่าอยู่ใน "/app/uploads"
    expect(isInsideRoot('/app/uploads', '/app/uploads-evil/x.webp')).toBe(false);
    expect(isInsideRoot('/app/uploads', '/etc/passwd')).toBe(false);
  });

  it('ตามสัญญา: caller ต้อง normalize ด้วย path.resolve ก่อนเรียก (traversal ถูกตัดทิ้ง)', () => {
    // isInsideRoot เทียบแบบสตริงล้วน จึงต้องส่ง path ที่ resolve แล้ว
    // เมื่อ resolve แล้ว traversal จะถูกยุบและ containment check ทำงานถูกต้อง
    const escaped = path.resolve('/app/uploads', '../../etc/passwd');
    expect(escaped).toBe('/etc/passwd');
    expect(isInsideRoot('/app/uploads', escaped)).toBe(false);

    const contained = path.resolve('/app/uploads', 'devices/abc/x.webp');
    expect(isInsideRoot('/app/uploads', contained)).toBe(true);
  });
});

describe('realpath containment — กัน symlink หนีออกนอก root (Task 2)', () => {
  let base: string;
  let root: string;
  let outside: string;

  beforeEach(() => {
    base = mkdtempSync(path.join(tmpdir(), 'sp-test-'));
    root = path.join(base, 'uploads');
    outside = path.join(base, 'outside');
    mkdirSync(path.join(root, 'devices', 'abc123'), { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(path.join(outside, 'secret.webp'), 'SECRET');
    process.env.UPLOAD_DIR = root;
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  it('ไฟล์ปกติใต้ root ผ่านการตรวจ', () => {
    const f = path.join(root, 'devices', 'abc123', 'a.webp');
    writeFileSync(f, 'IMG');
    const real = resolveRealpathOrNull(f);
    expect(real).not.toBeNull();
    expect(isInsideRoot(resolveRealpathOrNull(root)!, real!)).toBe(true);
  });

  it('symlink ที่ชี้ไปนอก root ต้องถูกปฏิเสธ', () => {
    const link = path.join(root, 'devices', 'abc123', 'evil.webp');
    symlinkSync(path.join(outside, 'secret.webp'), link);

    const rootReal = resolveRealpathOrNull(root)!;
    const linkReal = resolveRealpathOrNull(link);
    expect(linkReal).not.toBeNull();
    // realpath ชี้ไปนอก root → containment check ต้อง fail
    expect(isInsideRoot(rootReal, linkReal!)).toBe(false);
  });

  it('symlink ที่ชี้ไปไฟล์ใน root ยังใช้ได้ (ไม่บล็อกเกินจำเป็น)', () => {
    const target = path.join(root, 'devices', 'abc123', 'real.webp');
    writeFileSync(target, 'IMG');
    const link = path.join(root, 'devices', 'abc123', 'alias.webp');
    symlinkSync(target, link);

    const rootReal = resolveRealpathOrNull(root)!;
    const linkReal = resolveRealpathOrNull(link)!;
    expect(isInsideRoot(rootReal, linkReal)).toBe(true);
  });

  it('getUploadRoot ใช้ค่า UPLOAD_DIR ที่ตั้งไว้', () => {
    expect(getUploadRoot()).toBe(path.resolve(root));
  });
});
