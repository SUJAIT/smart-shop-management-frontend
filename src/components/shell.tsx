'use client';
import { tr } from '@/lib/lang';
import { LanguageSwitch } from '@/lib/i18n';
import { Bell, LogOut, MessageCircle, Moon, MoreHorizontal, Sun, WifiOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth, useSocketEvent } from '@/lib/auth';
import { cn, initials, thumb } from '@/lib/utils';
import { Button } from './ui/button';

const ROLE_LABEL: Record<string, string> = { super_admin: 'Super admin', admin_staff: 'Staff', shop_owner: 'Shop owner', employee: 'Employee' };

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  show?: boolean;
  /** shown in the phone's bottom bar */
  primary?: boolean;
}

/** The default logo. Replaced by the shop's own logo after the owner uploads one in Settings. */
const DefaultMark = ({ size }: { size: number }) => (
  <span className="grid shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground" style={{ width: size, height: size }} aria-hidden>
    <svg viewBox="0 0 64 64" style={{ width: size * 0.62, height: size * 0.62 }}><path d="M20 40a16 16 0 0 1 24 0M25 34a9 9 0 0 1 14 0" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="32" cy="46" r="3.5" fill="rgb(var(--meter))" /></svg>
  </span>
);
function Brand({ size = 32 }: { size?: number }) {
  const { me } = useAuth();
  const url = me?.shop?.logo?.url as string | undefined;
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={thumb(url, size * 3)} alt="" className="shrink-0 rounded-lg border bg-card object-cover" style={{ width: size, height: size }} /> : <DefaultMark size={size} />;
}

/** Browser tab: "Page · Shop name", and the shop's logo as the tab icon. Re-applied if the router rewrites the title. */
function useBrowserTab(title: string, icon?: string) {
  useEffect(() => {
    const apply = () => { if (document.title !== title) document.title = title; };
    apply();
    const el = document.querySelector('title');
    const mo = el ? new MutationObserver(apply) : null;
    if (el && mo) mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo?.disconnect();
  }, [title]);
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = icon ? (thumb(icon, 64) ?? icon) : '/icon.svg';
  }, [icon]);
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return (
    <Button variant="ghost" size="icon" aria-label={tr("Toggle dark mode")} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      {mounted && resolvedTheme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

function HeaderIcons({ chatHref, bellHref, shopSide, adminSide }: { chatHref: string; bellHref?: string; shopSide?: boolean; adminSide?: boolean }) {
  const { isOwner } = useAuth();
  const { data: unread, refetch } = useQuery({ queryKey: ['notifications', 'unread'], queryFn: () => api<{ unread: number }>('/notifications/unread-count'), enabled: !!shopSide, refetchInterval: 60_000 });
  const { data: conv, refetch: refetchConv } = useQuery({ queryKey: ['chat', 'unread'], queryFn: () => api<{ unreadForShop: number }>('/chat/conversation'), enabled: !!shopSide, refetchInterval: 60_000 });
  const { data: adminChat, refetch: refetchAdmin } = useQuery({
    queryKey: ['chat', 'admin-unread'],
    queryFn: () => api<{ unreadChats: number }>('/super-admin/dashboard'),
    enabled: !!adminSide,
    refetchInterval: 60_000,
  });
  useSocketEvent('notification:new', () => void refetch());
  useSocketEvent('chat:message', () => {
    void refetchConv();
    void refetchAdmin();
  });
  const chatCount = shopSide ? conv?.unreadForShop : adminChat?.unreadChats;
  void isOwner;
  const Badge = ({ n }: { n?: number }) => (n ? <span className="num absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{n > 99 ? '99+' : n}</span> : null);
  return (
    <>
      {bellHref && (
        <Button asChild variant="ghost" size="icon" className="relative" aria-label={tr("Notifications")}>
          <Link href={bellHref}>
            <Bell />
            <Badge n={unread?.unread} />
          </Link>
        </Button>
      )}
      <Button asChild variant="ghost" size="icon" className="relative" aria-label={tr("Live chat")}>
        <Link href={chatHref}>
          <MessageCircle />
          <Badge n={chatCount} />
        </Link>
      </Button>
    </>
  );
}

export function AppShell({
  nav,
  area,
  children,
  extraHeader,
  chatHref,
  bellHref,
}: {
  nav: NavItem[];
  area: 'shop' | 'admin';
  children: ReactNode;
  extraHeader?: ReactNode;
  chatHref: string;
  bellHref?: string;
}) {
  const { me, logout } = useAuth();
  const path = usePathname();
  const [more, setMore] = useState(false);
  const items = nav.filter((n) => n.show !== false);
  const bottom = items.filter((n) => n.primary).slice(0, 4);
  const active = (href: string) => path === href || (href !== '/admin' && path.startsWith(`${href}/`));
  const shopName = (me?.shop?.name as string | undefined) ?? 'Telecom Shop';
  const brandName = area === 'admin' ? tr('Control room') : shopName;
  const roleLabel = tr(ROLE_LABEL[me?.user.role ?? ''] ?? '');
  const here = items.find((n) => active(n.href));
  useBrowserTab(here ? `${here.label} · ${brandName}` : brandName, area === 'shop' ? (me?.shop?.logo?.url as string | undefined) : undefined);

  useEffect(() => setMore(false), [path]);

  const NavLinks = () => (
    <nav className="space-y-0.5">
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            active(n.href) && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
          )}
          aria-current={active(n.href) ? 'page' : undefined}
        >
          <n.icon className="size-[18px]" />
          {n.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Brand size={36} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{brandName}</p>
            <p className="text-xs text-muted-foreground">{area === 'admin' ? tr('Super admin') : `${tr('Shop')} #${me?.shop?.code ?? ''}`}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <NavLinks />
        </div>
        <div className="border-t p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold">{initials(me?.user.name)}</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{me?.user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label={tr('Log out')} onClick={() => void logout()}>
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-card/95 px-3 backdrop-blur sm:px-5" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          {/* phone: logo + shop name, like an app title bar */}
          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <Brand size={32} />
            <p className="max-w-[40vw] truncate text-[15px] font-semibold">{brandName}</p>
          </div>
          <div className="ml-2 flex flex-1 items-center gap-2 overflow-hidden">{extraHeader}</div>
          <HeaderIcons chatHref={chatHref} bellHref={bellHref} shopSide={area === 'shop'} adminSide={area === 'admin'} />
          <LanguageSwitch className="mr-1 hidden lg:inline-flex" />
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-3 pb-28 pt-4 sm:px-5 sm:pt-5 lg:pb-10">{children}</main>

        {/* phone bottom bar */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t bg-card/95 px-1 backdrop-blur lg:hidden" aria-label={tr('Main menu')}>
          {bottom.map((n) => (
            <Link key={n.href} href={n.href} className={cn('flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted-foreground', active(n.href) && 'text-primary')}>
              <span className={cn('grid h-7 w-14 place-items-center rounded-full transition-colors', active(n.href) && 'bg-primary/10')}>
                <n.icon className="size-[22px]" />
              </span>
              {n.label}
            </Link>
          ))}
          <button onClick={() => setMore(true)} className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted-foreground" aria-label={tr('More')}>
            <span className="grid h-7 w-14 place-items-center rounded-full"><MoreHorizontal className="size-[22px]" /></span>
            {tr('More')}
          </button>
        </nav>
      </div>

      {/* phone: "More" opens an app-style sheet with every page as a big tile */}
      {more && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-in bg-black/50 fade-in-0" onClick={() => setMore(false)} />
          <div className="safe-bottom absolute inset-x-0 bottom-0 animate-in rounded-t-2xl border-t bg-card shadow-xl slide-in-from-bottom">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-input" aria-hidden />
            <div className="flex items-center gap-3 px-4 pb-1 pt-3">
              <Brand size={40} />
              <div className="min-w-0 leading-tight">
                <p className="truncate font-semibold">{brandName}</p>
                <p className="truncate text-xs text-muted-foreground">{me?.user.name} · <span>{roleLabel}</span></p>
              </div>
            </div>
            <div className="grid max-h-[60dvh] grid-cols-3 gap-2 overflow-y-auto p-4">
              {items.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setMore(false)} className={cn('flex flex-col items-center gap-1.5 rounded-xl border bg-background px-2 py-3 text-center text-xs font-medium', active(n.href) && 'border-primary bg-primary/10 text-primary')}>
                  <n.icon className="size-6" />
                  <span className="leading-tight">{n.label}</span>
                </Link>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 px-4 pb-3">
              <span className="text-sm text-muted-foreground">{tr('Language')}</span>
              <LanguageSwitch />
            </div>
            <div className="px-4 pb-4">
              <Button variant="outline" className="w-full" onClick={() => void logout()}><LogOut />{tr('Log out')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function OfflineChip({ online, pending }: { online: boolean; pending: number }) {
  if (online && !pending) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', online ? 'bg-warning/15 text-warning' : 'bg-danger/10 text-danger')}>
      <WifiOff className="size-3.5" />
      {online ? tr('Syncing {n} saved', { n: pending }) : pending ? tr('Offline · {n} saved', { n: pending }) : tr('Offline')}
    </span>
  );
}
