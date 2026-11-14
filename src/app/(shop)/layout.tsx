'use client';
import { tr } from '@/lib/lang';
import { Banknote, CreditCard, FolderTree, HandCoins, Landmark, LayoutDashboard, Package, Receipt, Settings, ShieldCheck, ShoppingCart, Smartphone, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AppShell, OfflineChip, type NavItem } from '@/components/shell';
import { AlertCenter, CapitalPopup, RestrictedScreen, SubscriptionBanner } from '@/components/shop-status';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { flushQueue, getQueue, onQueueChange } from '@/lib/offline';

const OPEN_WHEN_RESTRICTED = ['/chat', '/notifications', '/billing'];

export default function ShopLayout({ children }: { children: ReactNode }) {
  const { me, loading, isAdmin, isOwner, can } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const online = useOnline();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/login');
    else if (isAdmin) router.replace('/admin');
  }, [me, loading, isAdmin, router]);

  // offline queue: count what is waiting and send it as soon as the internet is back
  useEffect(() => {
    const count = async () => setPending((await getQueue()).length);
    void count();
    const off = onQueueChange(() => void count());
    return off;
  }, []);
  useEffect(() => {
    if (!me) return;
    const run = async () => {
      if (!navigator.onLine) return;
      const r = await flushQueue();
      if (r.synced) toast.success(tr('{n} offline entries saved to the server', { n: r.synced }));
      if (r.failed) toast.error(tr('{n} offline entries could not be saved. Check Settings.', { n: r.failed }));
    };
    void run();
    const t = setInterval(run, 30_000);
    window.addEventListener('online', run);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', run);
    };
  }, [me]);

  if (loading || !me || isAdmin) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">{tr("Loading…")}</div>;

  const nav: NavItem[] = [
    { href: '/dashboard', label: tr("Dashboard"), icon: LayoutDashboard, show: isOwner, primary: true },
    { href: '/sell', label: tr("Sell"), icon: ShoppingCart, show: can('sale.create'), primary: true },
    { href: '/sales', label: tr("Sales"), icon: Receipt, show: can('sale.create') },
    { href: '/products', label: tr("Products"), icon: Package, show: can('sale.create', 'product.view', 'product.create'), primary: true },
    { href: '/categories', label: tr("Categories"), icon: FolderTree, show: can('category.manage') },
    { href: '/mfs', label: tr("MFS"), icon: Smartphone, show: can('mfs.use'), primary: true },
    { href: '/dues', label: tr("Dues"), icon: HandCoins, show: can('due.collect') },
    { href: '/warranty', label: tr("Warranty"), icon: ShieldCheck, show: can('warranty.manage') },
    { href: '/capital', label: tr("Capital"), icon: Landmark, show: isOwner },
    { href: '/employees', label: tr("Employees"), icon: Users, show: isOwner },
    { href: '/billing', label: tr("Plan & billing"), icon: CreditCard, show: isOwner },
    { href: '/settings', label: tr("Settings"), icon: Settings },
  ];

  const restricted = !!me.restriction?.active && !OPEN_WHEN_RESTRICTED.some((p) => path.startsWith(p));
  void Banknote;

  return (
    <AppShell nav={nav} area="shop" chatHref="/chat" bellHref="/notifications" extraHeader={<OfflineChip online={online} pending={pending} />}>
      <AlertCenter />
      <SubscriptionBanner />
      {restricted ? <RestrictedScreen message={me.restriction?.message} until={me.restriction?.until} /> : children}
      <CapitalPopup />
    </AppShell>
  );
}
