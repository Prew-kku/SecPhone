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
  uploadImagesAction,
  type ActionResult,
} from '@/app/admin/(protected)/actions';
import { cn } from '@/lib/utils';

/** จำนวนไฟล์สูงสุดต่อการอัปโหลดหนึ่งครั้ง (ต้องตรงกับฝั่ง server) */
const MAX_FILES = 10;

type Props = {
  deviceId: string;
  images: AdminDeviceImage[];
};

/**
 * จัดการรูปสินค้า: อัปโหลดหลายรูป, ตั้งรูปหลัก, เรียงลำดับ, ลบ
 *
 * ทุกการกระทำเรียก server action ที่ตรวจ requireAdmin() เอง
 * UI ไม่ได้ทำหน้าที่เป็นชั้นความปลอดภัย — แค่สะท้อนผลลัพธ์
 */
export function ImageUploader({ deviceId, images }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) router.refresh();
    });
  }

  function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = formData.getAll('images').filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      setFeedback({ ok: false, error: 'กรุณาเลือกรูปอย่างน้อย 1 รูป' });
      return;
    }
    if (files.length > MAX_FILES) {
      setFeedback({ ok: false, error: `อัปโหลดได้ครั้งละไม่เกิน ${MAX_FILES} รูป` });
      return;
    }

    run(() => uploadImagesAction(deviceId, formData));
    form.reset();
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
            เพิ่มรูป (JPEG, PNG, WebP · สูงสุด {MAX_FILES} รูปต่อครั้ง)
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
        </div>
        <Button type="submit" disabled={pending}>
          <Upload className="h-4 w-4" aria-hidden />
          {pending ? 'กำลังอัปโหลด…' : 'อัปโหลด'}
        </Button>
      </form>
    </section>
  );
}
