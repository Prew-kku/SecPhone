/**
 * serializeJsonLd — แปลง object เป็นสตริง JSON ที่ปลอดภัยสำหรับฝังใน <script type="application/ld+json">
 *
 * เหตุผลด้านความปลอดภัย:
 * ถ้าใช้ JSON.stringify ตรง ๆ แล้วข้อมูลจากฐานข้อมูลมีสตริง "</script>" หรือ "<!--"
 * จะสามารถปิดแท็ก script แล้วแทรก HTML/JS ได้ (XSS ผ่าน structured data)
 *
 * มาตรการ:
 * 1. escape อักขระที่ทำให้เกิดการปิดแท็กหรือ comment: < > & เป็น \u003c \u003e \u0026
 *    (ใช้ Unicode escape ซึ่งยังเป็น JSON ที่ถูกต้อง และ JSON.parse อ่านกลับได้ค่าเดิม)
 * 2. escape U+2028 / U+2029 ซึ่งเป็น line separator ที่ทำให้ JS parser แตกบรรทัด
 * 3. กัน "</script" แบบ case-insensitive ผ่านการ escape "<" ทั้งหมดแล้ว
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
