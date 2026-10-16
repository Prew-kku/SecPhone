import { z } from 'zod';

/**
 * Zod schemas สำหรับ Device (create/update)
 *
 * หลักการ:
 * - ราคาเป็น **จำนวนเต็มบาท** (ไม่ใช้ float) ตาม PLAN §5.4
 * - enum ต้องตรงกับ Prisma (ConditionGrade, DeviceStatus)
 * - ใช้ allowlist ของ field เท่านั้น → กัน mass assignment (ห้าม spread req.body ลง prisma)
 * - ค่าที่มาจาก FormData เป็น string ทั้งหมด จึง coerce อย่างระมัดระวัง
 */

export const CONDITION_VALUES = ['A', 'B', 'C'] as const;
export const STATUS_VALUES = ['DRAFT', 'AVAILABLE', 'SOLD', 'ARCHIVED'] as const;

/** ตัวเลขจากฟอร์ม: สตริงว่าง/ไม่ใช่ตัวเลข → undefined (ให้ optional ทำงาน) */
const optionalInt = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number(), z.undefined(), z.null()])
    .transform((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'number') return value;
      const trimmed = value.trim();
      if (trimmed === '') return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .pipe(
      z
        .number({ invalid_type_error: `${label}ต้องเป็นตัวเลข` })
        .int(`${label}ต้องเป็นจำนวนเต็ม`)
        .min(min, `${label}ต้องไม่น้อยกว่า ${min}`)
        .max(max, `${label}ต้องไม่เกิน ${max}`)
        .optional(),
    );

const requiredInt = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => {
      const trimmed = typeof value === 'string' ? value.trim() : value;
      if (trimmed === '') return Number.NaN;
      return typeof trimmed === 'number' ? trimmed : Number(trimmed);
    })
    .pipe(
      z
        .number({ invalid_type_error: `${label}ต้องเป็นตัวเลข` })
        .int(`${label}ต้องเป็นจำนวนเต็ม`)
        .min(min, `${label}ต้องไม่น้อยกว่า ${min}`)
        .max(max, `${label}ต้องไม่เกิน ${max}`),
    );

/** ข้อความไม่บังคับ: trim แล้วสตริงว่าง → undefined (ไม่เก็บค่าว่างลง DB) */
const optionalText = (max: number) =>
  z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => {
      const trimmed = (value ?? '').trim();
      return trimmed === '' ? undefined : trimmed;
    })
    .pipe(z.string().max(max, `ข้อความยาวเกิน ${max} ตัวอักษร`).optional());

const requiredText = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label}จำเป็นต้องกรอก` })
    .trim()
    .min(min, min === 1 ? `${label}จำเป็นต้องกรอก` : `${label}ต้องยาวอย่างน้อย ${min} ตัวอักษร`)
    .max(max, `${label}ยาวเกิน ${max} ตัวอักษร`);

/** ค่า id ของแบรนด์/รุ่น: cuid ที่ Prisma สร้าง (ตัวอักษร+ตัวเลข)
 *  สตริงว่างจาก <select> ที่ยังไม่เลือก → undefined (ไม่ใช่ค่าผิดรูปแบบ) */
const cuidLike = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? undefined : trimmed;
  })
  .pipe(z.string().regex(/^[a-z0-9]{1,64}$/i, 'รหัสอ้างอิงไม่ถูกต้อง').optional());

/** id ที่ต้องมีเสมอ (เช่น deviceId ที่มาจาก route param) */
const cuidRequired = z
  .string()
  .trim()
  .regex(/^[a-z0-9]{1,64}$/i, 'รหัสอ้างอิงไม่ถูกต้อง');

/** boolean จากฟอร์ม: รองรับ "on"/"true"/"1" และ boolean จริง */
const checkboxBoolean = z
  .union([z.string(), z.boolean(), z.undefined(), z.null()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    const normalized = (value ?? '').trim().toLowerCase();
    return normalized === 'on' || normalized === 'true' || normalized === '1';
  });

/**
 * ฟิลด์แบรนด์/รุ่น: ต้องเลือกของเดิม (id) **หรือ** สร้างใหม่ (ชื่อ)
 * ไม่บังคับว่า "ทั้งคู่" และห้ามปล่อยว่างทั้งคู่
 */
const brandFields = z.object({
  brandId: cuidLike.optional(),
  newBrandName: optionalText(60),
});

const modelFields = z.object({
  modelId: cuidLike.optional(),
  newModelName: optionalText(80),
});

/**
 * schema กลางที่ create/update ใช้ร่วมกัน
 * `.strict()` ไม่ได้ใช้เพราะเราดึงเฉพาะ field ที่รู้จักอยู่แล้ว (allowlist ตอนอ่าน FormData)
 */
export const deviceFieldsSchema = z
  .object({
    storageGb: requiredInt(1, 4096, 'ความจุ'),
    ramGb: optionalInt(1, 1024, 'RAM'),
    color: requiredText(1, 40, 'สี'),
    priceThb: requiredInt(0, 10_000_000, 'ราคา'),
    conditionGrade: z.enum(CONDITION_VALUES, {
      errorMap: () => ({ message: 'เกรดสภาพต้องเป็น A, B หรือ C' }),
    }),
    batteryHealthPct: optionalInt(1, 100, 'สุขภาพแบตเตอรี่'),
    cosmeticDefects: optionalText(2000),
    repairHistory: optionalText(2000),
    accessories: optionalText(1000),
    warrantyInfo: optionalText(1000),
    description: requiredText(1, 5000, 'รายละเอียด'),
    status: z.enum(STATUS_VALUES, {
      errorMap: () => ({ message: 'สถานะไม่ถูกต้อง' }),
    }),
    isFeatured: checkboxBoolean,
  })
  .merge(brandFields)
  .merge(modelFields)
  .superRefine((value, ctx) => {
    if (!value.brandId && !value.newBrandName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['brandId'],
        message: 'กรุณาเลือกแบรนด์หรือระบุชื่อแบรนด์ใหม่',
      });
    }
    if (value.brandId && value.newBrandName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newBrandName'],
        message: 'เลือกแบรนด์ที่มีอยู่แล้วหรือสร้างใหม่ อย่างใดอย่างหนึ่ง',
      });
    }
    if (!value.modelId && !value.newModelName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modelId'],
        message: 'กรุณาเลือกรุ่นหรือระบุชื่อรุ่นใหม่',
      });
    }
    if (value.modelId && value.newModelName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newModelName'],
        message: 'เลือกหนึ่งในสอง: รุ่นที่มีอยู่แล้ว หรือรุ่นใหม่',
      });
    }
  });

export type DeviceFields = z.output<typeof deviceFieldsSchema>;

/** schema สำหรับการเปลี่ยนสถานะอย่างเดียว */
export const statusChangeSchema = z.object({
  deviceId: cuidRequired,
  status: z.enum(STATUS_VALUES),
});

/** schema สำหรับสลับ isFeatured */
export const featureToggleSchema = z.object({
  deviceId: cuidRequired,
  isFeatured: checkboxBoolean,
});

/** schema สำหรับลบรูป */
export const deleteImageSchema = z.object({
  deviceId: cuidRequired,
  imageId: cuidRequired,
});

/** schema สำหรับตั้งรูปหลัก */
export const setPrimaryImageSchema = z.object({
  deviceId: cuidRequired,
  imageId: cuidRequired,
});

/** schema สำหรับจัดลำดับรูป (imageId เรียงตามที่ต้องการ) */
export const reorderImagesSchema = z.object({
  deviceId: cuidRequired,
  orderedIds: z.array(cuidRequired).min(1).max(50),
});

/** แปลง error ของ Zod เป็น map { field: message } สำหรับแสดงใกล้ field */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
