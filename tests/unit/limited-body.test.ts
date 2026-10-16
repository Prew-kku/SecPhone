import { describe, expect, it } from 'vitest';
import {
  readBodyWithLimit,
  readFormDataWithLimit,
  toArrayBuffer,
  RequestTooLargeError,
} from '@/lib/http/limited-body';
import { maxRequestBytes, maxUploadBytes } from '@/lib/storage/upload';

/**
 * Bounded body reader (issue #2)
 *
 * พิสูจน์ว่าการอ่าน body ถูกจำกัดขนาดจริง และปฏิเสธเมื่อเกินเพดาน
 * (กันหน่วยความจำบานปลาย — ไม่รับ multipart ก้อนใหญ่ผิดปกติ)
 */

function requestWith(body: Uint8Array, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/x', {
    method: 'POST',
    body: new Blob([toArrayBuffer(body)]),
    headers,
  });
}

describe('readBodyWithLimit', () => {
  it('อ่าน body ที่เล็กกว่าเพดานได้ครบ', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const out = await readBodyWithLimit(requestWith(data), 1024);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
  });

  it('ปฏิเสธเมื่อ Content-Length เกินเพดาน (ก่อนอ่านสตรีม)', async () => {
    const data = new Uint8Array(2048);
    const req = new Request('http://localhost/api/x', {
      method: 'POST',
      body: new Blob([toArrayBuffer(data)]),
    });
    await expect(readBodyWithLimit(req, 1024)).rejects.toBeInstanceOf(RequestTooLargeError);
  });

  it('ปฏิเสธเมื่อ body เกินเพดานแม้ไม่บอก Content-Length', async () => {
    // stream แบบ pull-based ที่ไม่ประกาศ content-length
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 3) {
          controller.close();
          return;
        }
        sent += 1;
        controller.enqueue(new Uint8Array(600));
      },
    });
    const req = new Request('http://localhost/api/x', {
      method: 'POST',
      body: stream,
      // @ts-expect-error duplex จำเป็นเมื่อส่ง ReadableStream เป็น body
      duplex: 'half',
    });
    await expect(readBodyWithLimit(req, 1000)).rejects.toBeInstanceOf(RequestTooLargeError);
  });

  it('เพดาน request ใหญ่กว่าขนาดไฟล์ (มี overhead ให้ multipart)', () => {
    expect(maxRequestBytes()).toBeGreaterThan(maxUploadBytes());
  });
});

describe('readFormDataWithLimit', () => {
  it('parse multipart ที่เล็กกว่าเพดานได้', async () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([9, 9, 9])], { type: 'image/webp' }), 'a.webp');
    const req = new Request('http://localhost/api/x', { method: 'POST', body: form });

    const parsed = await readFormDataWithLimit(req, maxRequestBytes());
    const file = parsed.get('file');
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('a.webp');
  });

  it('ปฏิเสธ multipart ที่เกินเพดาน', async () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(4096)], { type: 'image/webp' }), 'big.webp');
    const req = new Request('http://localhost/api/x', { method: 'POST', body: form });

    await expect(readFormDataWithLimit(req, 1024)).rejects.toBeInstanceOf(RequestTooLargeError);
  });
});
