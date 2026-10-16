'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { PLACEHOLDER_PHONE, demoTintFor } from '@/lib/storage/paths';

type SafeImageProps = {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  /** สีของเครื่อง (ข้อความไทย) — ใช้ทำ placeholder สีเฉพาะเมื่อไม่มีรูปจริง */
  tint?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/** สร้าง placeholder SVG แบบ data URI ที่มีสีพื้นตามสีเครื่อง */
function tintedPlaceholder(tint: string): string {
  const background = demoTintFor(tint);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img"><rect width="400" height="400" fill="${background}"/><g fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.55"><rect x="150" y="96" width="100" height="208" rx="18"/><line x1="186" y1="120" x2="214" y2="120"/><line x1="186" y1="272" x2="214" y2="272"/></g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * <img> ที่ถอยไปใช้ placeholder อัตโนมัติเมื่อไม่มี src หรือโหลดไม่สำเร็จ
 * ใช้ <img> แทน next/image เพราะรูปมาจาก /api/images (runtime) และ public SVG
 */
export function SafeImage({
  src,
  alt,
  fallbackSrc = PLACEHOLDER_PHONE,
  tint,
  className,
  sizes,
  priority,
}: SafeImageProps) {
  const [errored, setErrored] = useState(false);
  const tintFallback = useMemo(
    () => (tint ? tintedPlaceholder(tint) : fallbackSrc),
    [tint, fallbackSrc],
  );
  const resolved = !src || errored ? tintFallback : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setErrored(true)}
      className={cn('h-full w-full object-cover', className)}
    />
  );
}
