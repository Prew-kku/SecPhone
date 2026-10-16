'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { DeviceStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/auth/guard';
import {
  DeviceMutationError,
  changeDeviceStatus,
  createDevice,
  deleteDeviceImage,
  reorderDeviceImages,
  setDeviceFeatured,
  setPrimaryDeviceImage,
  softDeleteDevice,
  updateDevice,
} from '@/lib/mutations/devices';
import {
  deleteImageSchema,
  deviceFieldsSchema,
  featureToggleSchema,
  fieldErrors,
  reorderImagesSchema,
  setPrimaryImageSchema,
  statusChangeSchema,
} from '@/lib/validation/device';

/**
 * Server actions สำหรับ admin — **ทุกตัวเรียก requireAdmin() เป็นบรรทัดแรกเสมอ**
 *
 * Server actions ของ Next.js มี origin check ในตัว (กัน CSRF) แต่ **ไม่มี** authorization
 * ดังนั้น guard จึงต้องอยู่ในทุก action และต้องตรวจฝั่ง server เท่านั้น
 *
 * รูปแบบผลลัพธ์: `ActionResult` แบบ discriminated union เพื่อให้ฟอร์มแสดง error ได้
 */

export type ActionResult =
  | { ok: true; message?: string; deviceId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * ดึงค่าเฉพาะ field ที่เรารู้จักจาก FormData (allowlist) — กัน mass assignment
 * ไม่ใช้ Object.fromEntries(formData) แล้วส่งต่อทั้งก้อน
 */
function pickFormValues(formData: FormData): Record<string, unknown> {
  const keys = [
    'brandId',
    'newBrandName',
    'modelId',
    'newModelName',
    'storageGb',
    'ramGb',
    'color',
    'priceThb',
    'conditionGrade',
    'batteryHealthPct',
    'cosmeticDefects',
    'repairHistory',
    'accessories',
    'warrantyInfo',
    'description',
    'status',
    'isFeatured',
  ] as const;

  const values: Record<string, unknown> = {};
  for (const key of keys) {
    const raw = formData.get(key);
    values[key] = typeof raw === 'string' ? raw : undefined;
  }
  return values;
}

function revalidateDeviceViews(deviceId?: string) {
  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/phones');
  if (deviceId) revalidatePath(`/admin/phones/${deviceId}/edit`);
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export async function createDeviceAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = deviceFieldsSchema.safeParse(pickFormValues(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'กรุณาตรวจสอบข้อมูลที่กรอก',
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    const device = await createDevice(parsed.data, admin.id);
    revalidateDeviceViews(device.id);
    return { ok: true, message: 'สร้างสินค้าสำเร็จ', deviceId: device.id };
  } catch (error) {
    if (error instanceof DeviceMutationError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    console.error('[admin] createDevice ล้มเหลว', error instanceof Error ? error.message : error);
    return { ok: false, error: 'เกิดข้อผิดพลาดในการสร้างสินค้า' };
  }
}

/* ------------------------------------------------------------------ */
/* Update                                                              */
/* ------------------------------------------------------------------ */

export async function updateDeviceAction(deviceId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  if (!/^[a-z0-9]{1,64}$/i.test(deviceId)) {
    return { ok: false, error: 'รหัสสินค้าไม่ถูกต้อง' };
  }

  const parsed = deviceFieldsSchema.safeParse(pickFormValues(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'กรุณาตรวจสอบข้อมูลที่กรอก',
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await updateDevice(deviceId, parsed.data);
    revalidateDeviceViews(deviceId);
    return { ok: true, message: 'บันทึกการแก้ไขสำเร็จ', deviceId };
  } catch (error) {
    if (error instanceof DeviceMutationError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    console.error('[admin] updateDevice ล้มเหลว', error instanceof Error ? error.message : error);
    return { ok: false, error: 'เกิดข้อผิดพลาดในการบันทึก' };
  }
}

/* ------------------------------------------------------------------ */
/* Status / featured / delete                                          */
/* ------------------------------------------------------------------ */

export async function changeStatusAction(deviceId: string, status: DeviceStatus): Promise<ActionResult> {
  await requireAdmin();

  const parsed = statusChangeSchema.safeParse({ deviceId, status });
  if (!parsed.success) return { ok: false, error: 'ข้อมูลสถานะไม่ถูกต้อง' };

  try {
    await changeDeviceStatus(parsed.data.deviceId, parsed.data.status);
    revalidateDeviceViews(parsed.data.deviceId);
    return { ok: true, message: 'เปลี่ยนสถานะสำเร็จ' };
  } catch (error) {
    if (error instanceof DeviceMutationError) return { ok: false, error: error.message };
    console.error('[admin] changeStatus ล้มเหลว', error instanceof Error ? error.message : error);
    return { ok: false, error: 'เปลี่ยนสถานะไม่สำเร็จ' };
  }
}

export async function toggleFeaturedAction(deviceId: string, isFeatured: boolean): Promise<ActionResult> {
  await requireAdmin();

  const parsed = featureToggleSchema.safeParse({ deviceId, isFeatured });
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  try {
    await setDeviceFeatured(parsed.data.deviceId, parsed.data.isFeatured);
    revalidateDeviceViews(parsed.data.deviceId);
    return { ok: true, message: parsed.data.isFeatured ? 'ตั้งเป็นสินค้าแนะนำแล้ว' : 'ยกเลิกสินค้าแนะนำแล้ว' };
  } catch (error) {
    if (error instanceof DeviceMutationError) return { ok: false, error: error.message };
    console.error('[admin] toggleFeatured ล้มเหลว', error instanceof Error ? error.message : error);
    return { ok: false, error: 'ปรับสถานะแนะนำไม่สำเร็จ' };
  }
}

export async function softDeleteDeviceAction(deviceId: string): Promise<ActionResult> {
  await requireAdmin();

  if (!/^[a-z0-9]{1,64}$/i.test(deviceId)) {
    return { ok: false, error: 'รหัสสินค้าไม่ถูกต้อง' };
  }

  try {
    await softDeleteDevice(deviceId);
    revalidateDeviceViews(deviceId);
    return { ok: true, message: 'เก็บสินค้าเข้ากรุแล้ว' };
  } catch (error) {
    if (error instanceof DeviceMutationError) return { ok: false, error: error.message };
    console.error('[admin] softDelete ล้มเหลว', error instanceof Error ? error.message : error);
    return { ok: false, error: 'เก็บสินค้าไม่สำเร็จ' };
  }
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

/**
 * หมายเหตุ: การอัปโหลดรูป **ไม่ใช่** server action อีกต่อไป
 * เพราะ server action ของ Next.js จำกัด body ~1 MB ซึ่งเล็กกว่าขนาดไฟล์ที่รองรับ
 * (สูงสุด 8 MB) เราใช้ Route Handler `POST /api/admin/devices/[id]/images`
 * ที่อ่านสตรีมแบบจำกัดขนาดแทน (ดู `src/lib/http/limited-body.ts`)
 * การลบ/ตั้งรูปหลัก/เรียงลำดับ ยังเป็น action ด้านล่างตามเดิม
 */

export async function deleteImageAction(deviceId: string, imageId: string): Promise<ActionResult> {
  await requireAdmin();

  const parsed = deleteImageSchema.safeParse({ deviceId, imageId });
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  try {
    await deleteDeviceImage(parsed.data.deviceId, parsed.data.imageId);
    revalidateDeviceViews(parsed.data.deviceId);
    return { ok: true, message: 'ลบรูปสำเร็จ' };
  } catch (error) {
    if (error instanceof DeviceMutationError) return { ok: false, error: error.message };
    console.error('[admin] deleteImage ล้มเหลว', error instanceof Error ? error.message : error);
    return { ok: false, error: 'ลบรูปไม่สำเร็จ' };
  }
}

export async function setPrimaryImageAction(deviceId: string, imageId: string): Promise<ActionResult> {
  await requireAdmin();

  const parsed = setPrimaryImageSchema.safeParse({ deviceId, imageId });
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };

  try {
    await setPrimaryDeviceImage(parsed.data.deviceId, parsed.data.imageId);
    revalidateDeviceViews(parsed.data.deviceId);
    return { ok: true, message: 'ตั้งเป็นรูปหลักแล้ว' };
  } catch (error) {
    if (error instanceof DeviceMutationError) return { ok: false, error: error.message };
    console.error('[admin] setPrimaryImage ล้มเหลว', error instanceof Error ? error.message : error);
    return { ok: false, error: 'ตั้งรูปหลักไม่สำเร็จ' };
  }
}

export async function reorderImagesAction(deviceId: string, orderedIds: string[]): Promise<ActionResult> {
  await requireAdmin();

  const parsed = reorderImagesSchema.safeParse({ deviceId, orderedIds });
  if (!parsed.success) return { ok: false, error: 'ข้อมูลลำดับรูปไม่ถูกต้อง' };

  try {
    await reorderDeviceImages(parsed.data.deviceId, parsed.data.orderedIds);
    revalidateDeviceViews(parsed.data.deviceId);
    return { ok: true, message: 'จัดลำดับรูปสำเร็จ' };
  } catch (error) {
    if (error instanceof DeviceMutationError) return { ok: false, error: error.message };
    console.error('[admin] reorderImages ล้มเหลว', error instanceof Error ? error.message : error);
    return { ok: false, error: 'จัดลำดับรูปไม่สำเร็จ' };
  }
}

/* ------------------------------------------------------------------ */
/* Logout (server action)                                              */
/* ------------------------------------------------------------------ */

/**
 * logout ผ่าน server action — ล้าง cookie ฝั่ง server แล้ว redirect
 * (มี route handler POST /api/auth/logout ด้วย; action นี้สะดวกกับฟอร์มใน UI)
 */
export async function logoutAction(): Promise<void> {
  const { cookies } = await import('next/headers');
  const { SESSION_COOKIE_NAME } = await import('@/lib/auth/session');
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  redirect('/admin/login');
}
