import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth/guard';
import { isTrustedOrigin } from '@/lib/auth/origin';
import { UPLOAD_RATE_LIMIT, checkRateLimit } from '@/lib/auth/rate-limit';
import { readFormDataWithLimit, RequestTooLargeError } from '@/lib/http/limited-body';
import { addDeviceImages, DeviceMutationError } from '@/lib/mutations/devices';
import { maxRequestBytes, maxUploadBytes } from '@/lib/storage/upload';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/**
 * POST /api/admin/devices/[id]/images
 *
 * อัปโหลดรูปผ่าน Route Handler (ไม่ใช่ Server Action) ด้วยเหตุผลด้านขนาดคำขอ:
 *  - Server Action ของ Next.js จำกัด body ~1 MB ซึ่งเล็กกว่าที่โฆษณาไว้ (สูงสุด 8 MB/รูป)
 *  - Route Handler อ่านสตรีมเองได้ → จำกัดขนาดได้ชัดเจน (ดู `readFormDataWithLimit`)
 *
 * รับ **หนึ่งไฟล์ต่อ request** เพื่อให้หน่วยความจำถูกจำกัด (ไม่รับ 10 × 8 MB ก้อนเดียว)
 * ฝั่ง client จึงทยอยส่งทีละไฟล์
 *
 * ลำดับความปลอดภัย:
 *  1. ตรวจ Origin (กัน CSRF — route handler ไม่มีให้เองเหมือน server action)
 *  2. ตรวจเซสชัน (`getCurrentAdmin` — ตรวจ JWT + สถานะบัญชี)
 *  3. จำกัดขนาดร่างกายคำขอ **ก่อน** parse (fail closed)
 *  4. ตรวจชนิดไฟล์จาก magic bytes + ประมวลผลด้วย sharp ใน `addDeviceImages`
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 1) CSRF/origin
  if (!isTrustedOrigin(request)) {
    return jsonError('คำขอไม่ถูกต้อง', 403);
  }

  // 2) authentication — route handler ของ Next.js ไม่ได้ผ่าน layout guard
  const admin = await getCurrentAdmin();
  if (!admin) {
    return jsonError('ต้องเข้าสู่ระบบก่อน', 401);
  }

  const { id } = await params;

  // 2b) rate limit ต่อผู้ดูแล — กันการยิงอัปโหลดถี่ผิดปกติ (defense-in-depth)
  const rate = checkRateLimit(`upload:${admin.id}`, UPLOAD_RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'อัปโหลดบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  // รูปแบบ id ของ device (cuid) — ตรวจก่อนแตะ DB
  if (!/^[a-z0-9]{1,64}$/i.test(id)) {
    return jsonError('รหัสสินค้าไม่ถูกต้อง', 400);
  }

  // 3) อ่าน body ให้จำกัดขนาด (หนึ่งไฟล์ + overhead)
  let formData: FormData;
  try {
    formData = await readFormDataWithLimit(request, maxRequestBytes());
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return jsonError(`ขนาดรูปต้องไม่เกิน ${Math.floor(maxUploadBytes() / (1024 * 1024))} MB`, 413);
    }
    return jsonError('อ่านข้อมูลอัปโหลดไม่สำเร็จ', 400);
  }

  const files = formData
    .getAll('file')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) return jsonError('กรุณาเลือกรูป', 400);
  if (files.length > 1) return jsonError('อัปโหลดได้ครั้งละ 1 รูป', 400);

  const file = files[0];
  if (file.size > maxUploadBytes()) {
    return jsonError(`ขนาดรูปต้องไม่เกิน ${Math.floor(maxUploadBytes() / (1024 * 1024))} MB`, 413);
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await addDeviceImages(id, [buffer]);

    if (result.added === 0) {
      return jsonError(result.failures[0] ?? 'อัปโหลดไม่สำเร็จ', 400);
    }
    return NextResponse.json({ ok: true, added: result.added }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof DeviceMutationError) return jsonError(error.message, 400);
    console.error('[admin] upload route ล้มเหลว', error instanceof Error ? error.message : error);
    return jsonError('อัปโหลดรูปไม่สำเร็จ', 500);
  }
}
