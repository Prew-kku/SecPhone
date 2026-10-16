const thbFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  currencyDisplay: 'symbol',
  maximumFractionDigits: 0,
});

/** ราคาเป็นจำนวนเต็มบาท → "฿21,900" (สกุลเงินจาก Intl ไม่ hardcode) */
export function formatTHB(amount: number): string {
  if (!Number.isFinite(amount)) return '-';
  return thbFormatter.format(Math.round(amount));
}

/** จำนวนเต็ม → "256 GB" */
export function formatStorage(gb: number): string {
  return `${gb} GB`;
}

/** วันที่ → "28 ก.ย. 2026" (เขตเวลาไทย) */
export function formatThaiDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}
