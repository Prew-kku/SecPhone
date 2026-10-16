'use client';

import { useState } from 'react';
import { SafeImage } from '@/components/common/safe-image';
import { cn } from '@/lib/utils';
import { PLACEHOLDER_PHONE } from '@/lib/storage/paths';

type GalleryImage = { src: string; alt: string };

/**
 * แกลเลอรีรูปสินค้า: รูปหลัก + thumbnail
 * เมื่อไม่มีรูปจริง จะแสดง placeholder พร้อมข้อความบอกชัดเจน
 */
export function DeviceGallery({
  images,
  alt,
  tint,
}: {
  images: GalleryImage[];
  alt: string;
  tint?: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = images.length > 0;
  const active = hasImages ? images[Math.min(activeIndex, images.length - 1)] : null;

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <SafeImage
          src={active?.src ?? null}
          alt={active?.alt ?? alt}
          tint={tint}
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        {!hasImages ? (
          <p className="absolute inset-x-0 bottom-0 bg-white/85 py-2 text-center text-xs text-slate-500">
            ยังไม่มีรูปสินค้าจริง — ภาพนี้เป็นภาพประกอบเท่านั้น
          </p>
        ) : null}
      </div>

      {hasImages && images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="รูปสินค้าทั้งหมด">
          {images.map((image, index) => (
            <li key={`${image.src}-${index}`}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`ดูรูปที่ ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={cn(
                  'aspect-square w-full overflow-hidden rounded-md border bg-slate-50 transition-colors',
                  index === activeIndex
                    ? 'border-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <SafeImage
                  src={image.src}
                  alt={image.alt}
                  tint={tint}
                  fallbackSrc={PLACEHOLDER_PHONE}
                  sizes="80px"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
