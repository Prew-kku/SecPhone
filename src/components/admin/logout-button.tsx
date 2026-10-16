'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** ปุ่มออกจากระบบ — เรียก POST /api/auth/logout แล้วกลับไปหน้า login */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onLogout} disabled={busy}>
      <LogOut className="h-4 w-4" aria-hidden />
      {busy ? 'กำลังออก…' : 'ออกจากระบบ'}
    </Button>
  );
}
