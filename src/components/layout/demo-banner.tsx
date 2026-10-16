import { Info } from 'lucide-react';

/**
 * แบนเนอร์แจ้งว่าเนื้อหาเป็นข้อมูลสาธิต (Task 12)
 *
 * แสดงเฉพาะเมื่อ DEMO_MODE ไม่ใช่ "false" — เพื่อไม่ให้เว็บกล่าวอ้างว่า
 * ตรวจสภาพ/รับประกันจริง ทั้งที่ข้อมูลเป็นตัวอย่างที่สร้างขึ้น
 * เมื่อขึ้นใช้งานจริงกับข้อมูลที่ยืนยันแล้ว ให้ตั้ง DEMO_MODE="false"
 */
export function DemoBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-6xl items-start gap-2.5 px-4 py-2.5 text-xs leading-relaxed text-amber-900 sm:px-6">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="font-semibold">เว็บสาธิต:</strong>{' '}
          สินค้า ราคา สภาพ และการรับประกันที่แสดงเป็นข้อมูลตัวอย่างสำหรับการสาธิตระบบ
          ไม่ใช่สินค้าจริงและไม่ใช่ข้อเสนอขาย — โปรดตรวจสอบกับร้านก่อนตัดสินใจทุกครั้ง
        </p>
      </div>
    </div>
  );
}
