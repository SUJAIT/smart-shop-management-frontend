'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Ban, CreditCard, Info } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fmtDateTime } from '@/lib/utils';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';

/** Simple alerts pop up once; hard alerts stay as a banner until the super admin resolves them or the bill is paid. */
export function AlertCenter() {
  const { data } = useQuery({ queryKey: ['alerts'], queryFn: () => api<{ simple: Row[]; hard: Row[] }>('/notifications/alerts'), refetchInterval: 60_000, staleTime: 0 });
  const [queue, setQueue] = useState<Row[]>([]);

  // the server marks a simple alert as seen when it hands it over, so keep it here until the user closes it
  useEffect(() => {
    if (!data?.simple.length) return;
    setQueue((q) => [...q, ...data.simple.filter((s) => !q.some((x) => x._id === s._id))]);
  }, [data]);

  const current = queue[0];
  return (
    <>
      {data?.hard.map((h) => (
        <div key={h._id} className="mb-3 flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-danger">{h.title}</p>
            <p className="mt-0.5">{h.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tr("You can still view everything. Adding, editing and deleting are paused.")}</p>
          </div>
          {h.tag === 'billing' && (
            <Button asChild size="sm" variant="danger">
              <Link href="/billing">{tr("Pay now")}</Link>
            </Button>
          )}
        </div>
      ))}
      <Modal
        open={!!current}
        onOpenChange={(o) => !o && setQueue((q) => q.slice(1))}
        title={current?.title ?? ''}
        size="sm"
        footer={<Button onClick={() => setQueue((q) => q.slice(1))}>{tr("Got it")}</Button>}
      >
        <div className="flex gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-sm">{current?.message}</p>
        </div>
      </Modal>
    </>
  );
}

export function SubscriptionBanner() {
  const { me, isOwner } = useAuth();
  const s = me?.subscription;
  if (!s) return null;
  if (s.status === 'expired') {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" role="status">
        <CreditCard className="size-4 text-warning" />
        <p className="min-w-0 flex-1">{tr("Your subscription has ended. You can look at your data, but you cannot add or change anything.")}</p>
        {isOwner && <Button asChild size="sm"><Link href="/billing">{tr("Renew now")}</Link></Button>}
      </div>
    );
  }
  if (s.daysLeft <= 3) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
        <CreditCard className="size-4 text-primary" />
        <p className="min-w-0 flex-1">
          {s.status === 'trial' ? tr("Your free trial") : tr("Your plan")} {tr("ends in")} {s.daysLeft} {s.daysLeft === 1 ? tr("day") : tr("days")}.
        </p>
        {isOwner && <Button asChild size="sm" variant="outline"><Link href="/billing">{tr("See plans")}</Link></Button>}
      </div>
    );
  }
  return null;
}

/** Shown instead of the page while the super admin has this shop restricted (e.g. 24 hours). Chat and billing stay open. */
export function RestrictedScreen({ message, until }: { message?: string; until?: string }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-6 text-center">
      <Ban className="mx-auto size-10 text-danger" />
      <h1 className="mt-3 text-lg font-semibold">{tr("Your account is paused")}</h1>
      <p className="mt-2 text-sm">{message || 'Your account is temporarily restricted.'}</p>
      {until && <p className="mt-2 text-xs text-muted-foreground">{tr("Access returns on")} {fmtDateTime(until)}.</p>}
      <div className="mt-5 flex justify-center gap-2">
        <Button asChild><Link href="/chat">{tr("Talk to support")}</Link></Button>
        <Button asChild variant="outline"><Link href="/billing">{tr("Billing")}</Link></Button>
      </div>
    </div>
  );
}

/** First-time question: should buying stock be deducted from your capital? */
export function CapitalPopup() {
  const { isOwner } = useAuth();
  const path = usePathname();
  const { data, refetch } = useQuery({ queryKey: ['shop'], queryFn: () => api<{ shop: Row }>('/shop'), enabled: isOwner });
  const [later, setLater] = useState(false);
  useEffect(() => { setLater(sessionStorage.getItem('capital-later') === '1'); }, []);
  const answer = useAct((enabled: boolean) => api('/shop/capital-tracking', { method: 'PATCH', body: { enabled } }), {
    ok: tr("Saved. You can change this in Settings."),
    onOk: () => void refetch(),
  });
  const needs = isOwner && data?.shop.settings?.capitalTracking === null && ['/products', '/dashboard', '/capital'].some((p) => path.startsWith(p));
  return (
    <Modal
      open={!!needs && !later}
      onOpenChange={(o) => {
        if (!o) {
          sessionStorage.setItem('capital-later', '1');
          setLater(true);
        }
      }}
      title={tr("Track your capital?")}
      description={tr("Decide how product purchases are counted.")}
      footer={
        <>
          <Button variant="ghost" onClick={() => { sessionStorage.setItem('capital-later', '1'); setLater(true); }}>{tr("Ask me later")}</Button>
          <Button variant="outline" loading={answer.isPending} onClick={() => answer.mutate(false)}>{tr("No, skip capital")}</Button>
          <Button loading={answer.isPending} onClick={() => answer.mutate(true)}>{tr("Yes, track it")}</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>{tr("If you say yes, the cost of every product you buy is taken out of your capital. You will see:")}</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>{tr("how much capital is left after buying stock")}</li>
          <li>{tr("the value of the stock still on your shelves")}</li>
          <li>{tr("which sector earns you the most profit")}</li>
        </ul>
        <p>{tr("Add your capital first on the Capital page, then add products.")}</p>
      </div>
    </Modal>
  );
}
