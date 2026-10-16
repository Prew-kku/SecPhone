'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * ช่องค้นหาสินค้าของ admin — อัปเดต query param `q` บน URL
 * (ใช้ URL เป็น source of truth เพื่อให้แชร์/รีเฟรชแล้วได้ผลเดิม)
 */
export function AdminSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const trimmed = value.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    router.push(`/admin${params.size > 0 ? `?${params.toString()}` : ''}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2" role="search">
      <label htmlFor="admin-search" className="sr-only">
        ค้นหาสินค้า
      </label>
      <Input
        id="admin-search"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="ค้นหาจากรุ่น แบรนด์ สี หรือ SKU"
        className="max-w-md"
      />
      <Button type="submit" variant="outline">
        <Search className="h-4 w-4" aria-hidden />
        ค้นหา
      </Button>
    </form>
  );
}
