'use client';
import { tr } from '@/lib/lang';
import { LanguageSwitch } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { Monitor, Moon, Sun, Store, Palette, ScanBarcode, ShieldCheck, RefreshCw, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { toast } from 'sonner';
import { Field, PageHeader } from '@/components/common';
import { ScannerTest } from '@/components/scanner-test';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/hooks';
import { clearFailed, getFailed } from '@/lib/offline';
import type { Row } from '@/lib/types';
import { cn, initials, thumb } from '@/lib/utils';

type Section = 'profile' | 'security' | 'appearance' | 'devices' | 'sync';

export default function SettingsPage() {
  const { me, logout } = useAuth();
  const [section, setSection] = useState<Section>('profile');
  const [failed, setFailed] = useState<Row[]>([]);

  useEffect(() => {
    const h = window.location.hash.replace('#', '') as Section;
    if (['profile', 'security', 'appearance', 'devices', 'sync'].includes(h)) setSection(h);
    void getFailed().then(setFailed);
  }, []);
  const go = (s: Section) => { setSection(s); history.replaceState(null, '', `#${s}`); };

  const nav = useMemo(() => {
    const items: { id: Section; label: string; hint: string; icon: ComponentType<{ className?: string }> }[] = [
      { id: 'profile', label: tr('Profile'), hint: me?.user.role === 'shop_owner' ? tr('You, your shop and logo') : tr('Your name and phone'), icon: UserRound },
      { id: 'security', label: tr('Security'), hint: tr('Password and devices'), icon: ShieldCheck },
      { id: 'appearance', label: tr('Appearance'), hint: tr('Language and theme'), icon: Palette },
      { id: 'devices', label: tr('Devices'), hint: tr('Barcode scanner and camera'), icon: ScanBarcode },
    ];
    if (failed.length) items.push({ id: 'sync', label: tr('Offline data'), hint: tr('Entries that could not be saved'), icon: RefreshCw });
    return items;
  }, [me?.user.role, failed.length]);

  return (
    <>
      <PageHeader title={tr('Settings')} />
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        {/* phones: pills across the top; computers: a menu on the left */}
        <nav aria-label={tr('Settings sections')} className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:flex-col md:gap-1 md:px-0">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => go(n.id)}
              aria-current={section === n.id ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-medium md:w-full md:rounded-lg md:border-transparent md:px-3 md:py-2.5 md:text-left',
                section === n.id ? 'border-primary bg-primary text-primary-foreground md:bg-primary/10 md:text-primary' : 'bg-card text-muted-foreground hover:text-foreground md:bg-transparent md:hover:bg-muted',
              )}
            >
              <n.icon className="size-4 shrink-0" />
              <span className="min-w-0"><span className="block">{n.label}</span><span className="hidden truncate text-xs font-normal opacity-70 md:block">{n.hint}</span></span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {section === 'profile' && <ProfileSection />}
          {section === 'security' && <SecuritySection onLogout={() => void logout()} />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'devices' && <ScannerTest />}
          {section === 'sync' && (
            <Card>
              <CardHeader><div><CardTitle>{tr('Offline entries that could not be saved')}</CardTitle><CardDescription>{tr('These were made without internet and the server refused them.')}</CardDescription></div></CardHeader>
              <CardContent className="space-y-3">
                <ul className="divide-y rounded-md border text-sm">{failed.map((x) => <li key={x.clientId} className="flex justify-between gap-3 px-3 py-2"><span>{x.label}</span><span className="text-danger">{x.error}</span></li>)}</ul>
                <Button variant="outline" onClick={async () => { await clearFailed(); setFailed([]); setSection('profile'); toast.success(tr('Cleared')); }}>{tr('Clear list')}</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function ProfileSection() {
  const { me, isOwner, reload } = useAuth();
  const { data, refetch } = useQuery({ queryKey: ['shop'], queryFn: () => api<{ shop: Row; limits: Row }>('/shop'), enabled: isOwner });
  const [you, setYou] = useState({ name: me?.user.name ?? '', phone: me?.user.phone ?? '' });
  const [f, setF] = useState({ name: '', phone: '', address: '', invoiceTitle: '', invoiceFooter: '', lowStockDefault: '5' });
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const current = (me?.shop?.logo?.url as string | undefined) ?? '';

  useEffect(() => {
    const s = data?.shop;
    if (s) setF({ name: s.name ?? '', phone: s.phone ?? '', address: s.address ?? '', invoiceTitle: s.settings?.invoiceTitle ?? '', invoiceFooter: s.settings?.invoiceFooter ?? '', lowStockDefault: String(s.settings?.lowStockDefault ?? 5) });
  }, [data]);
  useEffect(() => {
    if (!logo) return setPreview('');
    const u = URL.createObjectURL(logo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [logo]);

  const saveYou = useAct(() => api('/auth/me', { method: 'PATCH', body: { name: you.name.trim(), phone: you.phone.trim() || undefined } }), { ok: tr('Profile saved'), onOk: () => void reload() });
  const save = useAct(
    () => api('/shop', { method: 'PATCH', body: { name: f.name.trim(), phone: f.phone.trim() || undefined, address: f.address.trim(), invoiceTitle: f.invoiceTitle.trim(), invoiceFooter: f.invoiceFooter.trim(), lowStockDefault: parseInt(f.lowStockDefault, 10) || 0 }, files: logo ? [logo] : undefined, fileField: 'logo' }),
    { ok: tr('Shop saved'), onOk: () => { setLogo(null); void refetch(); void reload(); } },
  );
  const reset = useAct(() => api('/shop', { method: 'PATCH', body: { removeLogo: true } }), { ok: tr('Default logo is back'), onOk: () => { setLogo(null); void refetch(); void reload(); } });
  const track = useAct((enabled: boolean) => api('/shop/capital-tracking', { method: 'PATCH', body: { enabled } }), { ok: tr('Saved'), onOk: () => void refetch() });

  const shown = preview || (current ? thumb(current, 200) : '');
  return (
    <>
      <Card>
        <CardHeader><div><CardTitle>{tr('You')}</CardTitle><CardDescription>{tr('How you appear in the app.')}</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-base font-semibold">{initials(me?.user.name)}</span>
            <div className="min-w-0 text-sm"><p className="truncate font-medium">{me?.user.name}</p><p className="truncate text-muted-foreground">{me?.user.email || me?.user.phone}</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr('Your name')}><Input value={you.name} onChange={(e) => setYou({ ...you, name: e.target.value })} /></Field>
            <Field label={tr('Mobile number')}><Input value={you.phone} onChange={(e) => setYou({ ...you, phone: e.target.value })} inputMode="tel" /></Field>
          </div>
          <Button loading={saveYou.isPending} disabled={you.name.trim().length < 2} onClick={() => saveYou.mutate(undefined)}>{tr('Save profile')}</Button>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader><div><CardTitle>{tr('Shop')}</CardTitle><CardDescription>{tr('Your shop name and logo show at the top of the app, in the browser tab and on receipts.')}</CardDescription></div></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3 sm:col-span-2">
              {shown ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shown} alt={tr('Shop logo')} className="size-16 rounded-xl border bg-card object-cover" />
              ) : (
                <span className="grid size-16 place-items-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
                  <svg viewBox="0 0 64 64" className="size-10"><path d="M20 40a16 16 0 0 1 24 0M25 34a9 9 0 0 1 14 0" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="32" cy="46" r="3.5" fill="rgb(var(--meter))" /></svg>
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium">{current || logo ? tr('Your logo') : tr('Default logo')}</p>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted">
                    {tr('Choose logo')}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
                  </label>
                  {current && !logo && <Button variant="outline" loading={reset.isPending} onClick={() => reset.mutate(undefined)}>{tr('Use default logo')}</Button>}
                </div>
                {logo && <p className="text-xs text-muted-foreground">{tr('Press “Save shop” to use this logo.')}</p>}
              </div>
            </div>
            <Field label={tr('Shop name')}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label={tr('Phone')}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
            <Field label={tr('Address')} className="sm:col-span-2"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <Field label={tr('Invoice heading')} hint={tr('Printed at the top of receipts')}><Input value={f.invoiceTitle} onChange={(e) => setF({ ...f, invoiceTitle: e.target.value })} placeholder={tr('Invoice')} /></Field>
            <Field label={tr('Invoice footer')}><Input value={f.invoiceFooter} onChange={(e) => setF({ ...f, invoiceFooter: e.target.value })} placeholder={tr('Thank you for your purchase!')} /></Field>
            <Field label={tr('Warn when stock is at or below')} hint={tr('Used for new products')}><Input value={f.lowStockDefault} onChange={(e) => setF({ ...f, lowStockDefault: e.target.value })} inputMode="numeric" className="max-w-32" /></Field>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
              <div><p className="text-sm font-medium">{tr('Take bought stock out of capital')}</p><p className="text-[13px] text-muted-foreground">{tr('Shows what is left of your capital after buying products.')}</p></div>
              <Switch checked={data?.shop.settings?.capitalTracking === true} onCheckedChange={(v) => track.mutate(v)} aria-label={tr('Track capital')} />
            </div>
            <div className="sm:col-span-2"><Button loading={save.isPending} disabled={f.name.trim().length < 2} onClick={() => save.mutate(undefined)}><Store />{tr('Save shop')}</Button></div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SecuritySection({ onLogout }: { onLogout: () => void }) {
  const { me } = useAuth();
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '' });
  const change = useAct(() => api<Row>('/auth/change-password', { method: 'POST', body: pw }), {
    ok: tr('Password changed'), onOk: (r) => { if (r.accessToken) setAccessToken(r.accessToken); setPw({ oldPassword: '', newPassword: '' }); },
  });
  const all = useAct(() => api('/auth/logout-all', { method: 'POST' }), { ok: tr('Logged out from every device'), onOk: onLogout });
  return (
    <>
      <Card>
        <CardHeader><div><CardTitle>{tr('Password')}</CardTitle><CardDescription>{tr('Signed in as')} {me?.user.name}.</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          <Field label={tr('Current password')}><Input type="password" value={pw.oldPassword} onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })} autoComplete="current-password" /></Field>
          <Field label={tr('New password')} hint={tr('At least 8 characters')}><Input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
          <Button loading={change.isPending} disabled={!pw.oldPassword || pw.newPassword.length < 8} onClick={() => change.mutate(undefined)}>{tr('Change password')}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>{tr('Devices')}</CardTitle><CardDescription>{tr('Lost a phone, or left your account open somewhere? Log out of every device at once.')}</CardDescription></div></CardHeader>
        <CardContent><Button variant="outline" loading={all.isPending} onClick={() => all.mutate(undefined)}>{tr('Log out everywhere')}</Button></CardContent>
      </Card>
    </>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const opts = [
    { id: 'system', label: tr('Same as my device'), icon: Monitor },
    { id: 'light', label: tr('Light'), icon: Sun },
    { id: 'dark', label: tr('Dark'), icon: Moon },
  ];
  return (
    <>
      <Card>
        <CardHeader><div><CardTitle>{tr('Language')}</CardTitle><CardDescription>{tr('Choose the language of the app.')}</CardDescription></div></CardHeader>
        <CardContent><LanguageSwitch /></CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>{tr('Theme')}</CardTitle><CardDescription>{tr('Dark mode is easier on the eyes in a dim shop.')}</CardDescription></div></CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={tr('Theme')} className="grid grid-cols-3 gap-2">
            {opts.map((o) => {
              const on = mounted && theme === o.id;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setTheme(o.id)} className={cn('flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-sm font-medium', on ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:text-foreground')}>
                  <o.icon className="size-6" />
                  {o.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
