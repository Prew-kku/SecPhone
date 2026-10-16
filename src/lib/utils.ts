import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** รวม class ของ Tailwind โดยให้ค่าที่อยู่หลังสุดชนะเมื่อชนกัน */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
