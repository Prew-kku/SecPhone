/**
 * อ่าน request body แบบจำกัดขนาด (bounded)
 *
 * ทำไมต้องมี: `request.formData()` และ `request.arrayBuffer()` ของ Web standard
 * จะอ่านทั้ง body เข้าหน่วยความจำโดยไม่มีการจำกัด — คำขอที่ใหญ่ผิดปกติจึงทำให้
 * หน่วยความจำบานปลายได้
 *
 * helper นี้อ่านสตรีมทีละ chunk และ **หยุดทันที** เมื่อเกินเพดาน (fail closed)
 * ทำให้หน่วยความจำถูกจำกัดไว้ที่ `limit` bytes เสมอ
 */

export class RequestTooLargeError extends Error {
  constructor() {
    super('ขนาดคำขอใหญ่เกินกำหนด');
    this.name = 'RequestTooLargeError';
  }
}

/**
 * อ่าน body ทั้งหมดโดยไม่เกิน `limit` bytes — throw `RequestTooLargeError` ถ้าเกิน
 *
 * ถ้ามี `Content-Length` ที่เกินเพดานอยู่แล้ว จะปฏิเสธก่อนอ่านสตรีม (เร็วและประหยัด)
 */
export async function readBodyWithLimit(request: Request, limit: number): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared) {
    const size = Number(declared);
    if (Number.isFinite(size) && size > limit) throw new RequestTooLargeError();
  }

  const body = request.body;
  if (!body) return new Uint8Array(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        throw new RequestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * อ่าน multipart/form-data โดยจำกัดขนาดก่อน แล้วให้ Web API parse จาก bytes ที่คัดมา
 *
 * หมายเหตุ: parse จาก bytes ที่จำกัดแล้วเท่านั้น — ไม่มีการอ่านซ้ำจาก request
 * (สตรีมของ request ถูก consume ไปแล้วข้างต้น)
 */
export async function readFormDataWithLimit(request: Request, limit: number): Promise<FormData> {
  const bytes = await readBodyWithLimit(request, limit);
  const contentType = request.headers.get('content-type') ?? '';
  const buffered = new Response(new Blob([toArrayBuffer(bytes)]), {
    headers: { 'Content-Type': contentType },
  });
  return buffered.formData();
}

/** คัดลอก Uint8Array เป็น ArrayBuffer ที่เป็นเจ้าของเอง (ให้เข้ากับ BodyInit) */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
