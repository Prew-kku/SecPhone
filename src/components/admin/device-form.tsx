'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { STATUS_LABELS } from '@/lib/device-labels';
import { STATUS_VALUES } from '@/lib/validation/device';
import type { BrandOption } from '@/lib/queries/admin-devices';
import { createDeviceAction, updateDeviceAction, type ActionResult } from '@/app/admin/(protected)/actions';

/**
 * ฟอร์มสร้าง/แก้ไขสินค้า
 *
 * - ใช้ uncontrolled inputs + FormData → ส่งให้ server action (ลด state ที่ต้อง sync)
 * - รองรับ "เลือกแบรนด์/รุ่นที่มีอยู่" หรือ "สร้างใหม่" (สลับด้วย radio)
 * - แสดง error ที่ได้จาก server ใกล้ field (fieldErrors)
 * - การตรวจสอบสิทธิ์/validation จริงอยู่ฝั่ง server ทั้งหมด
 */

type Mode = 'create' | 'edit';

export type DeviceFormValues = {
  brandId?: string;
  modelId?: string;
  storageGb?: number;
  ramGb?: number | null;
  color?: string;
  priceThb?: number;
  conditionGrade?: 'A' | 'B' | 'C';
  batteryHealthPct?: number | null;
  cosmeticDefects?: string | null;
  repairHistory?: string | null;
  accessories?: string | null;
  warrantyInfo?: string | null;
  description?: string;
  status?: (typeof STATUS_VALUES)[number];
  isFeatured?: boolean;
};

type DeviceFormProps = {
  mode: Mode;
  brands: BrandOption[];
  /** ต้องระบุเมื่อ mode = 'edit' */
  deviceId?: string;
  initial?: DeviceFormValues;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-rose-600">
      {message}
    </p>
  );
}

export function DeviceForm({ mode, brands, deviceId, initial }: DeviceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  // โหมดเลือกแบรนด์/รุ่น
  const [brandMode, setBrandMode] = useState<'existing' | 'new'>(
    initial?.brandId ? 'existing' : brands.length > 0 ? 'existing' : 'new',
  );
  const [modelMode, setModelMode] = useState<'existing' | 'new'>(
    initial?.modelId ? 'existing' : 'new',
  );
  const [selectedBrandId, setSelectedBrandId] = useState(initial?.brandId ?? '');

  const modelsForBrand = useMemo(() => {
    const brand = brands.find((item) => item.id === selectedBrandId);
    return brand?.models ?? [];
  }, [brands, selectedBrandId]);

  const fieldErrors = result && !result.ok ? result.fieldErrors ?? {} : {};

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);

    startTransition(async () => {
      const actionResult =
        mode === 'create'
          ? await createDeviceAction(formData)
          : await updateDeviceAction(deviceId!, formData);

      setResult(actionResult);

      if (actionResult.ok) {
        if (mode === 'create' && actionResult.deviceId) {
          router.push(`/admin/phones/${actionResult.deviceId}/edit`);
        } else {
          router.refresh();
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {result && !result.ok ? (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {result.error}
        </p>
      ) : null}
      {result && result.ok && result.message ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {result.message}
        </p>
      ) : null}

      {/* ---------- แบรนด์ / รุ่น ---------- */}
      <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-medium text-slate-900">แบรนด์และรุ่น</legend>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="brandMode"
              checked={brandMode === 'existing'}
              onChange={() => setBrandMode('existing')}
            />
            เลือกแบรนด์ที่มีอยู่
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="brandMode"
              checked={brandMode === 'new'}
              onChange={() => setBrandMode('new')}
            />
            สร้างแบรนด์ใหม่
          </label>
        </div>

        {brandMode === 'existing' ? (
          <div>
            <Label htmlFor="brandId">แบรนด์</Label>
            <Select
              id="brandId"
              name="brandId"
              value={selectedBrandId}
              onChange={(event) => setSelectedBrandId(event.target.value)}
            >
              <option value="">— เลือกแบรนด์ —</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
            <FieldError message={fieldErrors.brandId} />
          </div>
        ) : (
          <div>
            <Label htmlFor="newBrandName">ชื่อแบรนด์ใหม่</Label>
            <Input id="newBrandName" name="newBrandName" maxLength={60} />
            <FieldError message={fieldErrors.newBrandName} />
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="modelMode"
              checked={modelMode === 'existing'}
              onChange={() => setModelMode('existing')}
            />
            เลือกรุ่นที่มีอยู่
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="modelMode"
              checked={modelMode === 'new'}
              onChange={() => setModelMode('new')}
            />
            สร้างรุ่นใหม่
          </label>
        </div>

        {modelMode === 'existing' ? (
          <div>
            <Label htmlFor="modelId">รุ่น</Label>
            <Select
              id="modelId"
              name="modelId"
              defaultValue={initial?.modelId ?? ''}
              disabled={!selectedBrandId}
            >
              <option value="">
                {selectedBrandId ? '— เลือกรุ่น —' : 'เลือกแบรนด์ก่อน'}
              </option>
              {modelsForBrand.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
            <FieldError message={fieldErrors.modelId} />
          </div>
        ) : (
          <div>
            <Label htmlFor="newModelName">ชื่อรุ่นใหม่</Label>
            <Input id="newModelName" name="newModelName" maxLength={80} />
            <FieldError message={fieldErrors.newModelName} />
          </div>
        )}
      </fieldset>

      {/* ---------- สเปก ---------- */}
      <fieldset className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium text-slate-900">สเปกและราคา</legend>

        <div>
          <Label htmlFor="storageGb">ความจุ (GB) *</Label>
          <Input
            id="storageGb"
            name="storageGb"
            type="number"
            inputMode="numeric"
            min={1}
            max={4096}
            required
            defaultValue={initial?.storageGb ?? ''}
          />
          <FieldError message={fieldErrors.storageGb} />
        </div>

        <div>
          <Label htmlFor="ramGb">RAM (GB)</Label>
          <Input
            id="ramGb"
            name="ramGb"
            type="number"
            inputMode="numeric"
            min={1}
            max={1024}
            defaultValue={initial?.ramGb ?? ''}
          />
          <FieldError message={fieldErrors.ramGb} />
        </div>

        <div>
          <Label htmlFor="color">สี *</Label>
          <Input id="color" name="color" maxLength={40} required defaultValue={initial?.color ?? ''} />
          <FieldError message={fieldErrors.color} />
        </div>

        <div>
          <Label htmlFor="priceThb">ราคา (บาท) *</Label>
          <Input
            id="priceThb"
            name="priceThb"
            type="number"
            inputMode="numeric"
            min={0}
            max={10_000_000}
            required
            defaultValue={initial?.priceThb ?? ''}
          />
          <FieldError message={fieldErrors.priceThb} />
        </div>

        <div>
          <Label htmlFor="conditionGrade">เกรดสภาพ *</Label>
          <Select
            id="conditionGrade"
            name="conditionGrade"
            required
            defaultValue={initial?.conditionGrade ?? 'A'}
          >
            <option value="A">เกรด A</option>
            <option value="B">เกรด B</option>
            <option value="C">เกรด C</option>
          </Select>
          <FieldError message={fieldErrors.conditionGrade} />
        </div>

        <div>
          <Label htmlFor="batteryHealthPct">สุขภาพแบตเตอรี่ (%)</Label>
          <Input
            id="batteryHealthPct"
            name="batteryHealthPct"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            defaultValue={initial?.batteryHealthPct ?? ''}
          />
          <FieldError message={fieldErrors.batteryHealthPct} />
        </div>
      </fieldset>

      {/* ---------- รายละเอียด ---------- */}
      <fieldset className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-medium text-slate-900">รายละเอียดสภาพ</legend>

        <div>
          <Label htmlFor="description">รายละเอียดสินค้า *</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            maxLength={5000}
            required
            defaultValue={initial?.description ?? ''}
          />
          <FieldError message={fieldErrors.description} />
        </div>

        <div>
          <Label htmlFor="cosmeticDefects">ตำหนิภายนอก</Label>
          <Textarea
            id="cosmeticDefects"
            name="cosmeticDefects"
            rows={2}
            maxLength={2000}
            defaultValue={initial?.cosmeticDefects ?? ''}
          />
          <FieldError message={fieldErrors.cosmeticDefects} />
        </div>

        <div>
          <Label htmlFor="repairHistory">ประวัติซ่อม</Label>
          <Textarea
            id="repairHistory"
            name="repairHistory"
            rows={2}
            maxLength={2000}
            defaultValue={initial?.repairHistory ?? ''}
          />
          <FieldError message={fieldErrors.repairHistory} />
        </div>

        <div>
          <Label htmlFor="accessories">อุปกรณ์ที่ให้มา</Label>
          <Input
            id="accessories"
            name="accessories"
            maxLength={1000}
            defaultValue={initial?.accessories ?? ''}
          />
          <FieldError message={fieldErrors.accessories} />
        </div>

        <div>
          <Label htmlFor="warrantyInfo">การรับประกัน</Label>
          <Input
            id="warrantyInfo"
            name="warrantyInfo"
            maxLength={1000}
            defaultValue={initial?.warrantyInfo ?? ''}
          />
          <FieldError message={fieldErrors.warrantyInfo} />
        </div>
      </fieldset>

      {/* ---------- สถานะ ---------- */}
      <fieldset className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium text-slate-900">การเผยแพร่</legend>

        <div>
          <Label htmlFor="status">สถานะ *</Label>
          <Select id="status" name="status" required defaultValue={initial?.status ?? 'DRAFT'}>
            {STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
          <FieldError message={fieldErrors.status} />
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isFeatured" defaultChecked={initial?.isFeatured ?? false} />
            แสดงเป็นสินค้าแนะนำในหน้าแรก
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'กำลังบันทึก…' : mode === 'create' ? 'สร้างสินค้า' : 'บันทึกการแก้ไข'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push('/admin')}
          disabled={pending}
        >
          กลับไปหน้ารวม
        </Button>
      </div>
    </form>
  );
}
