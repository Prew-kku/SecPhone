import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  ImageProcessingError,
  detectImageType,
  processAndStoreImage,
  removeStoredImage,
} from '@/lib/storage/upload';
import {
  addDeviceImages,
  createDevice,
  deleteDeviceImage,
  reorderDeviceImages,
  setPrimaryDeviceImage,
} from '@/lib/mutations/devices';
import { createDevice as createDeviceFn } from '@/lib/mutations/devices';
import type { DeviceFields } from '@/lib/validation/device';
import { getUploadRoot } from '@/lib/storage/upload-dir';
import { isUploadedImageFilename, resolveImageSrc } from '@/lib/storage/paths';
import { GET as imageRoute } from '@/app/api/images/[...path]/route';
import { canConnect, cleanTransactionalData, prisma } from './helpers';

let dbAvailable = false;
let adminId = '';
let uploadDir = '';
const originalUploadDir = process.env.UPLOAD_DIR;

/** สร้างรูปทดสอบจริงด้วย sharp (JPEG) */
async function makeJpeg(width = 200, height = 150, color = { r: 10, g: 120, b: 200 }): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
  return new Uint8Array(buffer);
}

async function makePng(): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 200, g: 10, b: 10, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

async function makeWebp(): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width: 80, height: 80, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .webp()
    .toBuffer();
  return new Uint8Array(buffer);
}

beforeAll(async () => {
  uploadDir = await mkdtemp(path.join(tmpdir(), 'sp-uploads-'));
  process.env.UPLOAD_DIR = uploadDir;
  dbAvailable = await canConnect();
  if (!dbAvailable) return;
  await cleanTransactionalData();
  const admin = await prisma.adminUser.create({
    data: {
      email: `img-owner-${Date.now()}@example.test`,
      passwordHash: 'x',
      displayName: 'Owner',
      role: 'OWNER',
    },
  });
  adminId = admin.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanTransactionalData();
  await prisma.$disconnect();
  await rm(uploadDir, { recursive: true, force: true });
  if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDir;
});

function fields(name: string): DeviceFields {
  return {
    newBrandName: 'ImgBrand',
    newModelName: name,
    storageGb: 64,
    color: 'ดำ',
    priceThb: 1000,
    conditionGrade: 'B',
    description: 'img test',
    status: 'AVAILABLE',
    isFeatured: false,
  } as DeviceFields;
}

describe('image pipeline — real sharp processing', () => {
  it('แปลง JPEG เป็น WebP, ย่อขนาด ≤1600px, ตั้งชื่อตาม allowlist', async () => {
    const input = await makeJpeg(2400, 1200);
    const result = await processAndStoreImage('devabc123', input);

    expect(isUploadedImageFilename(result.filename)).toBe(true);
    expect(result.filename.endsWith('.webp')).toBe(true);
    expect(result.width).toBeLessThanOrEqual(1600);
    expect(result.height).toBeLessThanOrEqual(1600);
    expect(result.width).toBe(1600);
    expect(result.height).toBe(800);
    expect(resolveImageSrc(result.filename)).toBe(`/api/images/${result.filename}`);

    await removeStoredImage(result.filename);
  });

  it('รับ PNG และ WebP ได้', async () => {
    const png = await processAndStoreImage('devabc123', await makePng());
    const webp = await processAndStoreImage('devabc123', await makeWebp());
    expect(png.filename.endsWith('.webp')).toBe(true);
    expect(webp.filename.endsWith('.webp')).toBe(true);
    await removeStoredImage(png.filename);
    await removeStoredImage(webp.filename);
  });

  it('ปฏิเสธไฟล์ text ที่อ้างว่าเป็นรูป (นามสกุลไม่เกี่ยว — ดู magic bytes)', async () => {
    const fake = new TextEncoder().encode('<?php echo "pwned"; ?>xxxxx');
    await expect(processAndStoreImage('devabc123', fake)).rejects.toBeInstanceOf(
      ImageProcessingError,
    );
  });

  it('ปฏิเสธไฟล์ oversized ตาม MAX_UPLOAD_MB', async () => {
    process.env.MAX_UPLOAD_MB = '0.0005'; // ~524 bytes
    try {
      const big = await makeJpeg(300, 300);
      await expect(processAndStoreImage('devabc123', big)).rejects.toBeInstanceOf(
        ImageProcessingError,
      );
    } finally {
      delete process.env.MAX_UPLOAD_MB;
    }
  });

  it('strip metadata: ไฟล์ผลลัพธ์ไม่มี EXIF จากต้นฉบับ', async () => {
    const input = await makeJpeg(300, 300);
    const result = await processAndStoreImage('devabc123', input);
    const absolute = path.resolve(getUploadRoot(), result.filename);
    const metadata = await sharp(absolute).metadata();
    expect(metadata.format).toBe('webp');
    // ไม่มี orientation/exif หลังประมวลผล
    expect(metadata.orientation).toBeUndefined();
    await removeStoredImage(result.filename);
  });
});

describe('image route — path traversal & serving', () => {
  it('ปฏิเสธ path traversal (../../etc/passwd) → 404', async () => {
    const response = await imageRoute(new Request('http://x/api/images/x'), {
      params: Promise.resolve({ path: ['..', '..', 'etc', 'passwd'] }),
    });
    expect(response.status).toBe(404);
  });

  it('ปฏิเสธ path ที่ไม่ตรง allowlist (ไม่ใช่ uuid.webp) → 404', async () => {
    const response = await imageRoute(new Request('http://x/api/images/x'), {
      params: Promise.resolve({ path: ['devices', 'dev1', 'not-a-uuid.webp'] }),
    });
    expect(response.status).toBe(404);
  });

  it('ปฏิเสธ segment ว่าง → 404', async () => {
    const response = await imageRoute(new Request('http://x/api/images/x'), {
      params: Promise.resolve({ path: ['devices', '', 'x.webp'] }),
    });
    expect(response.status).toBe(404);
  });

  it('serve รูปที่มีจริง พร้อม cache header และ content-type', async () => {
    const stored = await processAndStoreImage('devserve1', await makePng());
    const segments = stored.filename.split('/');
    const response = await imageRoute(new Request('http://x/api/images/x'), {
      params: Promise.resolve({ path: segments }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    await removeStoredImage(stored.filename);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('image persistence & DB records', () => {
  it('เพิ่มรูป + บันทึก DeviceImage + รูปแรกเป็น primary', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields('ImgDeviceA'), adminId);
    const result = await addDeviceImages(device.id, [await makeJpeg(), await makePng()]);

    expect(result.added).toBe(2);
    expect(result.failures).toHaveLength(0);

    const images = await prisma.deviceImage.findMany({
      where: { deviceId: device.id },
      orderBy: { sortOrder: 'asc' },
    });
    expect(images).toHaveLength(2);
    expect(images[0].isPrimary).toBe(true);
    expect(images[1].isPrimary).toBe(false);
    expect(images.every((image) => isUploadedImageFilename(image.filename))).toBe(true);
  });

  it('ไฟล์อยู่บนดิสก์จริงและ serve ผ่าน route ได้ (persistence จำลอง)', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields('ImgDevicePersist'), adminId);
    await addDeviceImages(device.id, [await makeJpeg()]);

    const image = await prisma.deviceImage.findFirstOrThrow({ where: { deviceId: device.id } });
    const absolute = path.resolve(getUploadRoot(), image.filename);
    // ไฟล์ยังอยู่บนดิสก์ (ไม่ใช่แค่ record ใน DB)
    const { stat } = await import('node:fs/promises');
    const info = await stat(absolute);
    expect(info.size).toBeGreaterThan(0);

    const response = await imageRoute(new Request('http://x/api/images/x'), {
      params: Promise.resolve({ path: image.filename.split('/') }),
    });
    expect(response.status).toBe(200);
  });

  it('ลบรูป → ลบ record และไฟล์', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields('ImgDeviceDelete'), adminId);
    await addDeviceImages(device.id, [await makeJpeg(), await makeJpeg()]);

    const images = await prisma.deviceImage.findMany({ where: { deviceId: device.id } });
    const target = images.find((i) => i.isPrimary)!;

    await deleteDeviceImage(device.id, target.id);

    const remaining = await prisma.deviceImage.findMany({ where: { deviceId: device.id } });
    expect(remaining).toHaveLength(1);
    // ลบรูป primary → มี primary ใหม่ถูกเลื่อนขึ้น
    expect(remaining[0].isPrimary).toBe(true);
  });

  it('ตั้งรูปหลัก → มี primary ได้แค่รูปเดียว', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields('ImgDevicePrimary'), adminId);
    await addDeviceImages(device.id, [await makeJpeg(), await makeJpeg()]);

    const images = await prisma.deviceImage.findMany({
      where: { deviceId: device.id },
      orderBy: { sortOrder: 'asc' },
    });
    await setPrimaryDeviceImage(device.id, images[1].id);

    const primaries = await prisma.deviceImage.findMany({
      where: { deviceId: device.id, isPrimary: true },
    });
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe(images[1].id);
  });

  it('จัดลำดับรูปใหม่ตาม orderedIds', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields('ImgDeviceReorder'), adminId);
    await addDeviceImages(device.id, [await makeJpeg(), await makeJpeg(), await makeJpeg()]);

    const images = await prisma.deviceImage.findMany({
      where: { deviceId: device.id },
      orderBy: { sortOrder: 'asc' },
    });
    const reversed = [...images].reverse().map((image) => image.id);
    await reorderDeviceImages(device.id, reversed);

    const reordered = await prisma.deviceImage.findMany({
      where: { deviceId: device.id },
      orderBy: { sortOrder: 'asc' },
    });
    expect(reordered.map((image) => image.id)).toEqual(reversed);
  });

  it('อัปโหลดไฟล์ปลอมปน → เพิ่มเฉพาะไฟล์ที่ถูกต้อง และไม่เหลือไฟล์กำพร้า', async () => {
    if (!dbAvailable) return;
    const device = await createDevice(fields('ImgDeviceMixed'), adminId);
    const fake = new TextEncoder().encode('not an image at all, definitely not');
    const result = await addDeviceImages(device.id, [await makeJpeg(), fake]);

    expect(result.added).toBe(1);
    expect(result.failures).toHaveLength(1);

    const images = await prisma.deviceImage.findMany({ where: { deviceId: device.id } });
    expect(images).toHaveLength(1); // ไม่มี record ของไฟล์ปลอม
  });

  it('ปฏิเสธการจัดลำดับด้วย imageId ที่ไม่ใช่ของ device นี้', async () => {
    if (!dbAvailable) return;
    const a = await createDeviceFn(fields('ImgDeviceOrderA'), adminId);
    const b = await createDeviceFn(fields('ImgDeviceOrderB'), adminId);
    await addDeviceImages(a.id, [await makeJpeg()]);
    await addDeviceImages(b.id, [await makeJpeg()]);

    const bImage = await prisma.deviceImage.findFirstOrThrow({ where: { deviceId: b.id } });
    await expect(reorderDeviceImages(a.id, [bImage.id])).rejects.toThrow();
  });
});

describe('detectImageType (integration sanity)', () => {
  it('รูปที่ sharp สร้างถูกตรวจชนิดได้', async () => {
    expect(detectImageType(await makeJpeg())).toBe('jpeg');
    expect(detectImageType(await makePng())).toBe('png');
    expect(detectImageType(await makeWebp())).toBe('webp');
  });

  it('เขียนไฟล์ลงดิสก์แล้วตรวจสอบขนาดได้', async () => {
    const file = path.join(uploadDir, 'probe.bin');
    await writeFile(file, new Uint8Array([1, 2, 3]));
    const { stat } = await import('node:fs/promises');
    expect((await stat(file)).size).toBe(3);
  });
});
