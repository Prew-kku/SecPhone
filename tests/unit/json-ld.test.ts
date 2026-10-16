import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '@/lib/json-ld';

/**
 * Regression test สำหรับ JSON-LD injection (Task 1)
 *
 * ช่องโหว่เดิม: ใช้ JSON.stringify ตรง ๆ ใน dangerouslySetInnerHTML
 * ถ้าข้อมูลจาก DB มี "</script>" จะปิดแท็กแล้วแทรก HTML/JS ได้ (XSS)
 */
describe('serializeJsonLd — ป้องกัน script tag breakout', () => {
  it('escape </script> ที่ฝังในสตริง (สตริงที่ทำให้เกิดช่องโหว่จริง)', () => {
    const payload = { description: '</script><script>alert(1)</script>' };
    const out = serializeJsonLd(payload);

    // ต้องไม่มีลำดับอักขระที่ปิดแท็ก script ได้เลย
    expect(out).not.toContain('</script>');
    expect(out.toLowerCase()).not.toContain('</script');
    // "<" และ ">" ต้องถูก escape เป็น unicode
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u003e');
  });

  it('escape "<!--" ที่อาจเปิด HTML comment แล้วกลบ markup ที่เหลือ', () => {
    const out = serializeJsonLd({ x: '<!--' });
    expect(out).not.toContain('<!--');
    expect(out).toContain('\\u003c');
  });

  it('escape ampersand และ line separators ที่ทำให้ JS parser แตกบรรทัด', () => {
    const out = serializeJsonLd({ a: '&', b: '\u2028', c: '\u2029' });
    expect(out).toContain('\\u0026');
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
  });

  it('escape แบบครอบคลุม: </SCRIPT > ก็ต้องถูกกันด้วย', () => {
    const out = serializeJsonLd({ d: '</SCRIPT >' });
    expect(out.toLowerCase()).not.toContain('</script');
  });

  it('ยังเป็น JSON ที่ parse กลับได้ค่าเดิม (ไม่ทำข้อมูลเพี้ยน)', () => {
    const original = {
      name: 'iPhone 13 Pro </script>',
      description: 'สภาพดี <b>มาก</b> & ราคา 21,900',
      nested: { tag: '<script>', sep: '\u2028' },
      price: 21900,
      flag: true,
      nothing: null,
    };
    const out = serializeJsonLd(original);
    expect(JSON.parse(out)).toEqual(original);
  });

  it('ไม่แก้ข้อมูลปกติที่ไม่มีอักขระอันตราย (output ยังถูกต้อง)', () => {
    const payload = { '@type': 'Product', name: 'iPhone 14', price: 15900 };
    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });
});
