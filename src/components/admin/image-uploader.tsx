'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AdminDeviceImage } from '@/lib/queries/admin-devices';
import {
  deleteImageAction,
  reorderImagesAction,
  setPrimaryImageAction,
  type ActionResult,
} from '@/app/admin/(protected)/actions';
import { cn } from '@/lib/utils';

/** จำนวนไฟล์สูงสุดต่อการอัปโหลดหนึ่งชุด (ทยอยส่งทีละไฟล์) */
const MAX_FILES = 10;

type Props = {
  deviceId: string;
  images: AdminDeviceImage[];
};

/**
 * จัดการรูปสินค้า: อัปโหลดหลายรูป, ตั้งรูปหลัก, เรียงลำดับ, ลบ
 *
 * การอัปโหลดใช้ Route Handler `POST /api/admin/devices/[id]/images`
 * **ทีละไฟล์** เพื่อหลบขีดจำกัด body ~1 MB ของ Server Action และคุมหน่วยความจำ
 * (Server Action ไม่สามารถส่งไฟล์ 8 MB ได้จริง)
 *
 * การกระทำอื่น (ลบ/ตั้งรูปหลัก/เรียง) ยังเป็น server action ที่เรียก requireAdmin() เอง
 * UI ไม่ได้ทำหน้าที่เป็นชั้นความปลอดภัย — แค่สะท้อนผลลัพธ์
 */
export function ImageUploader({ deviceId, images }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) router.refresh();
    });
  }

  /** ส่งรูปทีละไฟล์ไปที่ route handler */
  async function uploadFiles(files: File[]): Promise<{ added: number; failures: string[] }> {
    let added = 0;
    const failures: string[] = [];

    for (let index = 0; index < files.length; index += 1) {
      setProgress(`กำลังอัปโหลด ${index + 1}/${files.length}…`);
      const body = new FormData();
      body.append('file', files[index]);

      try {
        const response = await fetch(`/api/admin/devices/${encodeURIComponent(deviceId)}/images`, {
          method: 'POST',
          body,
        });
        if (response.ok) {
          added += 1;
        } else {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          failures.push(data.error ?? `รูปที่ ${index + 1} ถูกปฏิเสธ`);
        }
      } catch {
        failures.push(`รูปที่ ${index + 1} อัปโหลดไม่สำเร็จ`);
      }
    }
    return { added, failures };
  }

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = formData
      .getAll('images')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      setFeedback({ ok: false, error: 'กรุณาเลือกรูปอย่างน้อย 1 รูป' });
      return;
    }
    if (files.length > MAX_FILES) {
      setFeedback({ ok: false, error: `อัปโหลดได้ครั้งละไม่เกิน ${MAX_FILES} รูป` });
      return;
    }

    setFeedback(null);
    setUploading(true);
    try {
      const result = await uploadFiles(files);
      if (result.added === 0) {
        setFeedback({ ok: false, error: result.failures[0] ?? 'อัปโหลดไม่สำเร็จ' });
      } else {
        setFeedback({
          ok: true,
          message:
            result.failures.length > 0
              ? `อัปโหลด ${result.added} รูปสำเร็จ (${result.failures.length} รูปถูกปฏิเสธ)`
              : `อัปโหลด ${result.added} รูปสำเร็จ`,
        });
        router.refresh();
      }
    } finally {
      setUploading(false);
      setProgress(null);
      form.reset();
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderImagesAction(deviceId, next.map((image) => image.id)));
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-900">รูปสินค้า</h2>
        <span className="text-xs text-slate-500">{images.length} รูป</span>
      </div>

      {feedback ? (
        <p
          role="alert"
          className={cn(
            'rounded-md px-3 py-2 text-sm',
            feedback.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
          )}
        >
          {feedback.ok ? feedback.message ?? 'สำเร็จ' : feedback.error}
        </p>
      ) : null}

      {/* รายการรูปปัจจุบัน */}
      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6 text-center text-sm text-slate-500">
          ยังไม่มีรูป — หน้าเว็บจะแสดงรูปตัวอย่างแทน
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <div className="relative aspect-square bg-slate-100">
                {image.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.src}
                    alt={image.altText ?? `รูปที่ ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    รูปไม่พร้อมใช้
                  </div>
                )}
                {image.isPrimary ? (
                  <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    รูปหลัก
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex">
                  <button
                    type="button"
                    aria-label="เลื่อนรูปขึ้นก่อน"
                    disabled={pending || index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="เลื่อนรูปไปทีหลัง"
                    disabled={pending || index === images.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="flex">
                  {!image.isPrimary ? (
                    <button
                      type="button"
                      aria-label="ตั้งเป็นรูปหลัก"
                      disabled={pending}
                      onClick={() => run(() => setPrimaryImageAction(deviceId, image.id))}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Star className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label="ลบรูป"
                    disabled={pending}
                    onClick={() => {
                      if (confirm('ต้องการลบรูปนี้หรือไม่?')) {
                        run(() => deleteImageAction(deviceId, image.id));
                      }
                    }}
                    className="rounded p-1 text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* อัปโหลด */}
      <form onSubmit={onUpload} className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        <div className="flex-1">
          <label htmlFor="images" className="mb-1.5 block text-sm font-medium text-slate-700">
            เพิ่มรูป (JPEG, PNG, WebP · สูงสุด {MAX_FILES} รูปต่อครั้ง · ไม่เกิน 8 MB/รูป)
          </label>
          <Input
            ref={inputRef}
            id="images"
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="h-auto py-2"
          />
          {progress ? (
            <p className="mt-1.5 text-xs text-slate-500" aria-live="polite">
              {progress}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending || uploading}>
          <Upload className="h-4 w-4" aria-hidden />
          {uploading ? 'กำลังอัปโหลด…' : 'อัปโหลด'}
        </Button>
      </form>
    </section>
  );
}
