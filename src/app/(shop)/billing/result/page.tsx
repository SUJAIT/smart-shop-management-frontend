'use client';
import { tr } from '@/lib/lang';
import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function BillingResult() {
  const { reload } = useAuth();
  const [status, setStatus] = useState('');
  const [invoice, setInvoice] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setStatus(q.get('status') ?? 'failed');
    setInvoice(q.get('invoice') ?? '');
    if (q.get('status') === 'success') void reload();
  }, [reload]);

  // a payment can get stuck when the callback never arrives: ask the server to re-check with bKash
  const recheck = async () => {
    setChecking(true);
    try {
      const r = await api<{ outcome: string }>(`/payments/bkash/verify/${encodeURIComponent(invoice)}`, { method: 'POST' });
      setStatus(r.outcome);
      if (r.outcome === 'success') await reload();
    } finally { setChecking(false); }
  };
  const ok = status === 'success';
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-6 text-center">
      {ok ? <CheckCircle2 className="mx-auto size-12 text-success" /> : <XCircle className="mx-auto size-12 text-danger" />}
      <h1 className="mt-3 text-xl font-semibold">{ok ? tr("Payment received") : status === 'cancelled' ? tr("Payment cancelled") : tr("Payment did not go through")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{ok ? tr("Your plan is active. Thank you!") : tr("No money was taken, or it will be returned by bKash. If you did pay, check again below.")}</p>
      {invoice && <p className="mt-2 text-xs text-muted-foreground">{tr("Invoice")} {invoice}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <Button asChild><Link href="/dashboard">{tr("Go to dashboard")}</Link></Button>
        {!ok && invoice && <Button variant="outline" loading={checking} onClick={recheck}>{tr("I paid, check again")}</Button>}
      </div>
    </div>
  );
}
