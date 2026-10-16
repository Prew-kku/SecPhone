'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

type LoginFormProps = {
  /** ปลายทางหลัง login สำเร็จ (ผ่านการตรวจจาก server แล้ว) */
  next: string;
};

/**
 * ฟอร์มเข้าสู่ระบบ — เรียก POST /api/auth/login เอง
 *
 * ใช้ fetch แทน server action เพื่อให้ route handler เป็นจุดเดียวที่ตั้ง cookie
 * และทดสอบได้ตรงไปตรงมา (route handler ตรวจ Origin เอง)
 */
export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next }),
      });

      if (response.ok) {
        // ใช้ replace เพื่อไม่ให้ปุ่ม back กลับมาหน้า login ที่ล็อกอินแล้ว
        router.replace(next);
        router.refresh();
        return;
      }

      // อ่านข้อความจาก server (เป็นข้อความกลาง ๆ อยู่แล้ว) — ไม่เปิดเผยรายละเอียดเพิ่ม
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'เข้าสู่ระบบไม่สำเร็จ');
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="email">อีเมลผู้ดูแล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div>
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          aria-invalid={error ? true : undefined}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </Button>
    </form>
  );
}
