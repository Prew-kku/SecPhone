import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { isUploadedImageFilename } from '@/lib/storage/paths';
import { getUploadRoot, isInsideRoot } from '@/lib/storage/upload-dir';

export const dynamic = 'force-dynamic';

/** 404 ไม่ควรถูก cache — ไฟล์อาจถูกอัปโหลดภายหลังด้วย path เดิม */
const NOT_FOUND_HEADERS = { 'Cache-Control': 'no-store' } as const;

function notFound() {
  return new NextResponse('Not Found', { status: 404, headers: NOT_FOUND_HEADERS });
}

/**
 * GET /api/images/devices/<deviceId>/<uuid>.webp
 *
 * ชั้นการป้องกัน (เรียงตามลำดับ):
 * 1. allowlist regex — ปฏิเสธทุก path ที่ไม่ตรงรูปแบบ devices/<id>/<uuid-v4>.webp
 * 2. ปฏิเสธอักขระอันตราย (`..`, `\`, absolute, null byte, segment ว่าง)
 * 3. string containment — path ที่ resolve แล้วต้องอยู่ใต้ upload root
 * 4. realpath containment — กัน symlink ที่ชี้/AWOL ออกนอก root (ทั้งไฟล์และโฟลเดอร์)
 * 5. ต้องเป็น regular file จริง (ไม่ใช่ symlink/device/fifo) และมีขนาด > 0
 * 6. 404 แบบ no-store และไม่เปิดเผย path จริง
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = (segments ?? []).join('/');

  // ชั้น 1 + 2: allowlist รูปแบบไฟล์ก่อนแตะระบบไฟล์
  if (
    !relative ||
    relative.includes('..') ||
    relative.includes('\\') ||
    relative.includes('\0') ||
    relative.startsWith('/') ||
    (segments ?? []).some((segment) => segment === '' || segment === '.' || segment === '..') ||
    !isUploadedImageFilename(relative)
  ) {
    return notFound();
  }

  const root = getUploadRoot();
  const absolute = path.resolve(root, relative);

  // ชั้น 3: containment เชิงสตริง (ก่อนแตะ FS)
  if (!isInsideRoot(root, absolute)) return notFound();

  try {
    // ชั้น 4: realpath ของ root และไฟล์ ต้องอยู่ใต้ root เดียวกันจริง
    //          ถ้าไฟล์เป็น symlink ที่ชี้ไปนอก root → ปฏิเสธ
    const [rootReal, fileReal] = await Promise.all([realpath(root), realpath(absolute)]);
    if (!isInsideRoot(rootReal, fileReal)) return notFound();

    // ชั้น 5: ต้องเป็น regular file (ตัด symlink/device/socket/fifo) และมีข้อมูลจริง
    const info = await stat(fileReal);
    if (!info.isFile() || info.size === 0) return notFound();

    const stream = Readable.toWeb(createReadStream(fileReal)) as ReadableStream;
    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(info.size),
        // ไฟล์ immutable (ชื่อเป็น uuid) → cache ได้นาน
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return notFound();
  }
}
