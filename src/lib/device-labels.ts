import type { ConditionGrade, DeviceStatus } from '@prisma/client';

/** ป้ายกำกับเกรดสภาพ (แสดงเป็นภาษาไทย) */
export const CONDITION_LABELS: Record<ConditionGrade, string> = {
  A: 'เกรด A · สภาพดีมาก',
  B: 'เกรด B · สภาพดี',
  C: 'เกรด C · สภาพใช้งานได้',
};

export const CONDITION_SHORT_LABELS: Record<ConditionGrade, string> = {
  A: 'เกรด A',
  B: 'เกรด B',
  C: 'เกรด C',
};

export function conditionLabel(grade: ConditionGrade): string {
  return CONDITION_LABELS[grade];
}

/** ป้ายกำกับสถานะสินค้า */
export const STATUS_LABELS: Record<DeviceStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  AVAILABLE: 'พร้อมขาย',
  SOLD: 'ขายแล้ว',
  ARCHIVED: 'เก็บถาวร',
};

/** สถานะที่แสดงต่อสาธารณะได้ (Phase 2 — catalog/detail) */
export const PUBLIC_STATUSES: DeviceStatus[] = ['AVAILABLE', 'SOLD'];

/** แสดงตัวเครื่องในหน้า public ได้หรือไม่ */
export function isPubliclyVisible(status: DeviceStatus): boolean {
  return PUBLIC_STATUSES.includes(status);
}
