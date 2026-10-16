import { describe, expect, it } from 'vitest';
import {
  UnsafeTestDatabaseError,
  assertSafeDatabaseName,
  assertSafeTestDatabaseUrl,
  classifyTestDatabaseUrl,
} from '../integration/db-safety';

/**
 * Regression tests สำหรับความปลอดภัยของฐานข้อมูลทดสอบ (issue #1)
 *
 * พิสูจน์ว่า URL ที่ไม่ปลอดภัย (production/Railway/ชื่อ DB ปกติ) ถูกปฏิเสธ
 * และตรวจชื่อฐานข้อมูลจริง ไม่ใช่แค่ "URL มีคำว่า test"
 */

describe('classifyTestDatabaseUrl — ยอมรับฐานข้อมูลทดสอบที่ชัดเจน', () => {
  it('ชื่อ secondphone_test → ปลอดภัย', () => {
    expect(classifyTestDatabaseUrl('postgresql://u:p@localhost:55432/secondphone_test')).toMatchObject({
      safe: true,
      database: 'secondphone_test',
    });
  });

  it('ชื่อ testdb (ไม่มีตัวคั่น) → ไม่ปลอดภัยแบบ fail-closed (กำกวม)', () => {
    expect(classifyTestDatabaseUrl('postgresql://u:p@127.0.0.1:5432/testdb').safe).toBe(false);
  });

  it('ชื่อ testdb → ปลอดภัยเมื่อระบุ TEST_DATABASE_NAME ชัดเจน', () => {
    expect(
      classifyTestDatabaseUrl('postgresql://u:p@127.0.0.1:5432/testdb', { allowName: 'testdb' }).safe,
    ).toBe(true);
  });

  it('ชื่อ my_test_db → ปลอดภัย (token คั่นด้วย _)', () => {
    expect(classifyTestDatabaseUrl('postgresql://u:p@localhost/my_test_db').safe).toBe(true);
  });

  it('ชื่อที่มี test ติดกันแบบไม่คั่น (contest) → ไม่ปลอดภัย', () => {
    expect(classifyTestDatabaseUrl('postgresql://u:p@localhost/contest').safe).toBe(false);
  });
});

describe('classifyTestDatabaseUrl — ปฏิเสธ production/Railway', () => {
  const unsafe = [
    ['ไม่มี URL', undefined],
    ['ชื่อ secondphone (แอปจริง)', 'postgresql://u:p@localhost:5432/secondphone'],
    ['ชื่อ postgres มาตรฐาน', 'postgresql://u:p@localhost:5432/postgres'],
    ['ชื่อ production', 'postgresql://u:p@localhost/production'],
    ['ชื่อ railway', 'postgresql://u:p@localhost/railway'],
    ['host ของ Railway', 'postgresql://u:p@containers-us-west-1.railway.app:5432/secondphone_test'],
    ['host มี .prod.', 'postgresql://u:p@db.prod.example.com/secondphone_test'],
    ['ชื่อธรรมดาไม่มีคำว่า test', 'postgresql://u:p@localhost/secondphone_store'],
  ] as const;

  for (const [label, url] of unsafe) {
    it(`${label} → ไม่ปลอดภัย`, () => {
      const verdict = classifyTestDatabaseUrl(url);
      expect(verdict.safe).toBe(false);
      expect(verdict.reason).toBeTruthy();
    });
  }

  it('URL ที่ parse ไม่ได้ → ไม่ปลอดภัย', () => {
    expect(classifyTestDatabaseUrl('not-a-url').safe).toBe(false);
  });

  it('โปรโตคอลที่ไม่ใช่ Postgres → ไม่ปลอดภัย', () => {
    expect(classifyTestDatabaseUrl('mysql://u:p@localhost/testdb').safe).toBe(false);
  });
});

describe('TEST_DATABASE_NAME — ต้องตรงเป๊ะเมื่อระบุ', () => {
  it('ตรงกับชื่อที่อนุญาต → ปลอดภัย', () => {
    expect(
      classifyTestDatabaseUrl('postgresql://u:p@localhost/secondphone_int', {
        allowName: 'secondphone_int',
      }).safe,
    ).toBe(true);
  });

  it('ไม่ตรงกับชื่อที่อนุญาต → ไม่ปลอดภัย แม้ชื่อจะมีคำว่า test', () => {
    expect(
      classifyTestDatabaseUrl('postgresql://u:p@localhost/some_other_test', {
        allowName: 'secondphone_int',
      }).safe,
    ).toBe(false);
  });

  it('allowName ไม่สามารถ override ชื่อที่สงวนไว้ได้', () => {
    expect(
      classifyTestDatabaseUrl('postgresql://u:p@localhost/secondphone', {
        allowName: 'secondphone',
      }).safe,
    ).toBe(false);
  });
});

describe('assertSafeTestDatabaseUrl / assertSafeDatabaseName — fail closed', () => {
  it('throw UnsafeTestDatabaseError สำหรับ production URL', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://u:p@localhost/secondphone'),
    ).toThrow(UnsafeTestDatabaseError);
  });

  it('throw สำหรับชื่อ DB จริงที่เป็น production', () => {
    expect(() => assertSafeDatabaseName('secondphone')).toThrow(UnsafeTestDatabaseError);
  });

  it('ไม่ throw สำหรับชื่อ DB ทดสอบ', () => {
    expect(() => assertSafeDatabaseName('secondphone_test')).not.toThrow();
  });

  it('throw เมื่อไม่มี URL', () => {
    expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(UnsafeTestDatabaseError);
  });
});
