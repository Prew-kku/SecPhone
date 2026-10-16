import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getUploadRoot, isInsideRoot } from '@/lib/storage/upload-dir';

/**
 * Image processing pipeline (PLAN §8.3)
 *
 * ขั้นตอน:
 *  1. ตรวจ magic bytes ว่าเป็น JPEG/PNG/WebP จริง (ไม่เชื่อนามสกุลหรือ Content-Type)
 *  2. ให้ sharp หมุนตาม EXIF และประมวลผล (ย่อ ≤ 1600px, แปลง WebP, strip metadata)
 *  3. เขียนด้วยชื่อ UUID v4 ใต้ devices/<deviceId>/ เพื่อให้ผ่าน allowlist ของ /api/images
 *
 * ทุกอย่างที่เขียนลงดิสก์ถูกกำหนดชื่อเอง — ห้ามใช้ชื่อไฟล์จากผู้ใช้
 */

/** ขนาด upload สูงสุด (MB) จาก env — ค่าเริ่มต้น 8 ตาม PLAN */
export function maxUploadBytes(): number {
  const raw = Number(process.env.MAX_UPLOAD_MB);
  const mb = Number.isFinite(raw) && raw > 0 ? raw : 8;
  return Math.floor(mb * 1024 * 1024);
}

/** จำนวนไฟล์สูงสุดต่อสินค้าในการอัปโหลดหนึ่งชุด (แต่ละ request ส่งได้ทีละไฟล์) */
export const MAX_FILES_PER_REQUEST = 10;

/** เพดาน multipart overhead ต่อ request (boundary/headers/padding) */
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

/**
 * ขนาดร่างกาย request สูงสุดที่ยอมรับ (bytes)
 *
 * ออกแบบให้ **หนึ่ง request = หนึ่งไฟล์** เพื่อให้หน่วยความจำถูกจำกัด
 * (ไม่รับ 10 × 8 MB เป็นก้อนเดียว) — ค่า = เพดานไฟล์ + overhead
 */
export function maxRequestBytes(): number {
  return maxUploadBytes() + MULTIPART_OVERHEAD_BYTES;
}

/** ย่อด้านยาวสุดไม่เกิน 1600px */
const MAX_DIMENSION = 1600;

/** คุณภาพ WebP */
const WEBP_QUALITY = 82;

export type DetectedImageType = 'jpeg' | 'png' | 'webp';

/**
 * ตรวจชนิดไฟล์จาก magic bytes
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WebP: "RIFF" .... "WEBP"
 */
export function detectImageType(buffer: Uint8Array): DetectedImageType | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => buffer[index] === byte)) return 'png';

  const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
  const webp = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
  if (riff === 'RIFF' && webp === 'WEBP') return 'webp';

  return null;
}

export type ProcessedImage = {
  /** ชื่อไฟล์ relative ใต้ upload root เช่น devices/<id>/<uuid>.webp */
  filename: string;
  width: number;
  height: number;
  bytes: number;
};

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

/**
 * ประมวลผลและบันทึกรูปหนึ่งไฟล์
 *
 * @param deviceId ใช้เป็นชื่อโฟลเดอร์ (ต้องเป็น cuid แล้วเท่านั้น — ผู้เรียกต้องตรวจก่อน)
 * @throws ImageProcessingError เมื่อชนิด/ขนาดไม่ผ่าน หรือ sharp ล้มเหลว
 */
export async function processAndStoreImage(
  deviceId: string,
  input: Uint8Array,
): Promise<ProcessedImage> {
  if (input.length === 0) throw new ImageProcessingError('ไฟล์ว่างเปล่า');
  if (input.length > maxUploadBytes()) {
    throw new ImageProcessingError('ไฟล์มีขนาดใหญ่เกินกำหนด');
  }

  // ชั้นที่ 1: magic bytes — ปฏิเสธไฟล์ที่อ้างว่าเป็นรูปแต่ไม่ใช่
  const detected = detectImageType(input);
  if (!detected) {
    throw new ImageProcessingError('ไฟล์ต้องเป็น JPEG, PNG หรือ WebP เท่านั้น');
  }

  // ชั้นที่ 2: ประมวลผลด้วย sharp
  let output: Buffer;
  let width: number;
  let height: number;
  try {
    const pipeline = sharp(input, { failOn: 'error' })
      .rotate() // หมุนตาม EXIF orientation แล้ว normalize
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY });

    const result = await pipeline.toBuffer({ resolveWithObject: true });
    output = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch {
    // ไม่เปิดเผยรายละเอียดของ sharp ออกไป (อาจมีข้อมูล path/ไลบรารี)
    throw new ImageProcessingError('ไม่สามารถประมวลผลรูปภาพได้');
  }

  // ชั้นที่ 3: เขียนไฟล์ด้วยชื่อที่เราสร้างเอง
  const filename = `devices/${deviceId}/${randomUUID()}.webp`;
  const absolute = path.resolve(getUploadRoot(), filename);
  if (!isInsideRoot(getUploadRoot(), absolute)) {
    throw new ImageProcessingError('path ปลายทางไม่ถูกต้อง');
  }

  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, output);

  return { filename, width, height, bytes: output.byteLength };
}

/**
 * ลบไฟล์รูปตามชื่อ relative (ตรวจ containment ก่อนเสมอ)
 * ลบเฉพาะไฟล์ที่ตรง pattern ของเรา — ไม่รับ path จากผู้ใช้โดยตรง
 */
export async function removeStoredImage(filename: string): Promise<void> {
  const root = getUploadRoot();
  const absolute = path.resolve(root, filename);
  if (!isInsideRoot(root, absolute)) {
    throw new ImageProcessingError('path ที่จะลบไม่ถูกต้อง');
  }
  // force: true → ไม่ throw เมื่อไฟล์ไม่มีอยู่แล้ว (idempotent)
  await rm(absolute, { force: true });
}
