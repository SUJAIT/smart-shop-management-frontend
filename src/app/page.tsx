'use client';
import { tr } from '@/lib/lang';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { me, loading, isAdmin } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    router.replace(!me ? '/login' : isAdmin ? '/admin' : me.user.role === 'shop_owner' ? '/dashboard' : '/sell');
  }, [me, loading, isAdmin, router]);
  return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">{tr("Loading…")}</div>;
}
