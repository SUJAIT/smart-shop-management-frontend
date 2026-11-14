'use client';
import { tr } from '@/lib/lang';
import { Banknote, Gauge, Layers, Megaphone, MessageCircle, Store, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell, type NavItem } from '@/components/shell';
import { useAuth } from '@/lib/auth';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { me, loading, isAdmin, can } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/login');
    else if (!isAdmin) router.replace('/');
  }, [me, loading, isAdmin, router]);
  if (loading || !me || !isAdmin) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">{tr("Loading…")}</div>;

  const nav: NavItem[] = [
    { href: '/admin', label: tr("Overview"), icon: Gauge, primary: true },
    { href: '/admin/shops', label: tr("Shops"), icon: Store, show: can('shop.view'), primary: true },
    { href: '/admin/chat', label: tr("Chat"), icon: MessageCircle, show: can('chat.reply'), primary: true },
    { href: '/admin/alerts', label: tr("Alerts"), icon: Megaphone, show: can('alert.send'), primary: true },
    { href: '/admin/plans', label: tr("Plans"), icon: Layers, show: can('plan.manage', 'billing.view') },
    { href: '/admin/payments', label: tr("Payments"), icon: Banknote, show: can('billing.view') },
    { href: '/admin/staff', label: tr("Staff"), icon: UserCog, show: me.user.role === 'super_admin' },
  ];
  return <AppShell nav={nav} area="admin" chatHref="/admin/chat">{children}</AppShell>;
}
