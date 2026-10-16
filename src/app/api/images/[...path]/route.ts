import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { isUploadedImageFilename } from '@/lib/storage/paths';
import { getUploadRoot, isInsideUploadRoot } from '@/lib/storage/upload-dir';

export const dynamic = 'force-dynamic';

/**
 * GET /api/images/devices/<deviceId>/<uuid>.webp
 *
 * - ตรวจรูปแบบ path ด้วย allowlist regex ก่อนแตะระบบไฟล์
 * - resolve อยู่ภายใน UPLOAD_DIR เท่านั้น (กัน path traversal/symlink)
 * - ไม่รั่ว path จริงในกรณี 404
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = (segments ?? []).join('/');

  if (
    !relative ||
    relative.includes('..') ||
    relative.startsWith('/') ||
    relative.includes('\\') ||
    !isUploadedImageFilename(relative)
  ) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const absolute = path.resolve(getUploadRoot(), relative);
  if (!isInsideUploadRoot(absolute)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const info = await stat(absolute);
    if (!info.isFile()) return new NextResponse('Not Found', { status: 404 });

    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(info.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
