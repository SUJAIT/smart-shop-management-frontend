'use client';
import { tmap, tr } from '@/lib/lang';
import { useQuery, useQueryClient as useQueryClientLite } from '@tanstack/react-query';
import { Plus, Smartphone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, Field, ListSkeleton, PageHeader, Pager, ProviderMark } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { ApiError, api, apiPaged, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/hooks';
import { MFS_PROVIDERS, MFS_TX_LABEL } from '@/lib/labels';
import { enqueue } from '@/lib/offline';
import type { Row } from '@/lib/types';
import { addDaysInput, fmtDateTime, taka, toPaisa, uuid } from '@/lib/utils';

const DEBIT = ['send_money', 'e_balance_add'];
const TX_HELP: Record<string, string> = tmap({
  balance_in: 'You added e-balance to your SR account. Your balance goes up.',
  send_money: 'You sent money to a customer and take cash from them. Your balance goes down.',
  e_balance_add: 'You put e-balance on a customer’s number and take cash. Your balance goes down.',
  cash_out: 'A customer takes cash from you and you receive e-balance. Your balance goes up.',
});

export default function MfsPage() {
  const { isOwner } = useAuth();
  const [entry, setEntry] = useState(false);
  const [acc, setAcc] = useState(false);
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState('');
  const [type, setType] = useState('');

  const { data: accounts, isLoading } = useQuery({ queryKey: ['mfs', 'accounts'], queryFn: () => api<{ accounts: Row[]; totalsByProvider: Record<string, number> }>('/mfs/accounts') });
  const { data: today } = useQuery({ queryKey: ['mfs', 'today'], queryFn: () => api<{ today: Row[] }>('/mfs/summary/today') });
  const { data: tx, isLoading: txLoading } = useQuery({ queryKey: ['mfs', 'tx', provider, type, page], queryFn: () => apiPaged<Row>('/mfs/transactions', { provider, type, page, limit: 20 }) });

  const del = useAct((id: string) => api(`/mfs/accounts/${id}`, { method: 'DELETE' }), { ok: tr("SR account removed"), keys: ['mfs'] });
  const accs = accounts?.accounts ?? [];
  const totals = accounts?.totalsByProvider ?? {};

  return (
    <>
      <PageHeader
        title={tr("MFS")}
        description={tr("bKash, Nagad, Rocket and Upay: your e-balance and every customer entry.")}
        actions={<Button onClick={() => (accs.length ? setEntry(true) : toast.info(tr("Add an SR account first")))}><Plus />{tr("New entry")}</Button>}
      />

      {isLoading ? <ListSkeleton rows={2} /> : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MFS_PROVIDERS.filter((p) => totals[p] !== undefined).map((p) => (
            <Card key={p}><CardContent className="flex items-center gap-3"><ProviderMark k={p} name={p} size={36} /><div><p className="text-[13px] capitalize text-muted-foreground">{p} {tr("e-balance")}</p><p className="num text-lg font-semibold">{taka(totals[p])}</p></div></CardContent></Card>
          ))}
          {Object.keys(totals).length === 0 && <Card className="sm:col-span-2 lg:col-span-4"><EmptyState icon={<Smartphone />} title={tr("No SR account yet")} hint={tr("Turn on bKash, Nagad, Rocket or Upay in Categories, then add the SR account and its opening e-balance.")} action={isOwner && <Button onClick={() => setAcc(true)}>{tr("Add SR account")}</Button>} /></Card>}
        </div>
      )}

      <Tabs defaultValue="entries">
        <TabsList><TabsTrigger value="entries">{tr("Entries")}</TabsTrigger><TabsTrigger value="today">{tr("Today")}</TabsTrigger><TabsTrigger value="accounts">{tr("SR accounts")}</TabsTrigger></TabsList>

        <TabsContent value="entries" className="pt-4">
          <Card>
            <div className="flex flex-wrap gap-2 border-b p-3">
              <Select className="w-40" value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} aria-label={tr("Provider")}><option value="">{tr("All providers")}</option>{MFS_PROVIDERS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}</Select>
              <Select className="w-56" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label={tr("Entry type")}><option value="">{tr("All types")}</option>{Object.entries(MFS_TX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            </div>
            {txLoading ? <ListSkeleton /> : !tx?.data.length ? <EmptyState title={tr("No entries yet")} hint={tr("Cash outs, send money and e-balance adds you record show up here.")} /> : (
              <Table>
                <THead><TR><TH>{tr("When")}</TH><TH>{tr("Provider")}</TH><TH>{tr("Type")}</TH><TH>{tr("Customer")}</TH><TH className="text-right">{tr("Amount")}</TH>{isOwner && <TH className="text-right">{tr("Profit")}</TH>}<TH className="text-right">{tr("Balance after")}</TH></TR></THead>
                <TBody>{tx.data.map((t) => (
                  <TR key={t._id}>
                    <TD className="whitespace-nowrap text-muted-foreground">{fmtDateTime(t.doneAt)}</TD>
                    <TD><span className="flex items-center gap-2 capitalize"><ProviderMark k={t.provider} name={t.provider} size={20} />{t.provider}</span></TD>
                    <TD>{MFS_TX_LABEL[t.type]}{t.dueAmount > 0 && <Badge tone="warning" className="ml-2">{taka(t.dueAmount)} {tr("due")}</Badge>}</TD>
                    <TD>{t.customerName || (t.customerNumber ? (t.customerNumber.length === 4 ? `•••• ${t.customerNumber}` : t.customerNumber) : '-')}</TD>
                    <TD className="num text-right font-medium">{taka(t.amount)}</TD>
                    {isOwner && <TD className="num text-right">{taka(t.profit)}</TD>}
                    <TD className="num text-right text-muted-foreground">{taka(t.balanceAfter)}</TD>
                  </TR>
                ))}</TBody>
              </Table>
            )}
            <Pager meta={tx?.meta} onPage={setPage} />
          </Card>
        </TabsContent>

        <TabsContent value="today" className="pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {MFS_PROVIDERS.map((p) => {
              const rows = (today?.today ?? []).filter((r) => r.provider === p);
              if (!rows.length) return null;
              return (
                <Card key={p}>
                  <CardHeader><CardTitle className="flex items-center gap-2 capitalize"><ProviderMark k={p} name={p} size={22} />{p} {tr("today")}</CardTitle></CardHeader>
                  <CardContent className="pt-3"><ul className="divide-y">{rows.map((r) => (
                    <li key={r.type} className="flex items-center justify-between py-2 text-sm"><span>{MFS_TX_LABEL[r.type]} <span className="text-muted-foreground">× {r.count}</span></span><span className="num font-medium">{taka(r.amount)}{isOwner && r.profit > 0 && <span className="ml-2 text-success">+{taka(r.profit)}</span>}</span></li>
                  ))}</ul></CardContent>
                </Card>
              );
            })}
            {!(today?.today ?? []).length && <Card className="md:col-span-2"><EmptyState title={tr("Nothing recorded today")} /></Card>}
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="pt-4">
          <Card>
            <CardHeader><CardTitle>{tr("SR accounts")}</CardTitle>{isOwner && <Button size="sm" onClick={() => setAcc(true)}><Plus />{tr("Add SR")}</Button>}</CardHeader>
            <CardContent className="pt-3">
              {accs.length === 0 ? <p className="text-sm text-muted-foreground">{tr("Nothing here yet.")}</p> : (
                <ul className="divide-y">{accs.map((a) => (
                  <li key={a._id} className="flex items-center gap-3 py-3">
                    <ProviderMark k={a.provider} name={a.provider} />
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium capitalize">{a.provider} {tr("· SR")} {a.srName}</p><p className="text-xs text-muted-foreground">{a.srNumber}</p></div>
                    <p className="num font-semibold">{taka(a.balance)}</p>
                    {isOwner && <Button size="icon" variant="ghost" aria-label={tr('Remove {name}', { name: a.srName })} onClick={() => confirm(tr('Remove SR {name}? Past entries stay in your records.', { name: a.srName })) && del.mutate(a._id)}><Trash2 className="text-danger" /></Button>}
                  </li>
                ))}</ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EntryDialog open={entry} onClose={() => setEntry(false)} accounts={accs.filter((a) => a.isActive)} isOwner={isOwner} />
      <AccountDialog open={acc} onClose={() => setAcc(false)} />
    </>
  );
}

function EntryDialog({ open, onClose, accounts, isOwner }: { open: boolean; onClose: () => void; accounts: Row[]; isOwner: boolean }) {
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState('cash_out');
  const [amount, setAmount] = useState('');
  const [profit, setProfit] = useState('');
  const [num, setNum] = useState('');
  const [name, setName] = useState('');
  const [paid, setPaid] = useState('');
  const [due, setDue] = useState(addDaysInput(3));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const debit = DEBIT.includes(type);
  const receivable = (toPaisa(amount) ?? 0) + (toPaisa(profit) ?? 0);
  const paidP = paid === '' ? receivable : toPaisa(paid) ?? 0;
  const owes = debit ? Math.max(0, receivable - paidP) : 0;
  const acct = accounts.find((a) => a._id === (accountId || accounts[0]?._id));

  const submit = async () => {
    const amt = toPaisa(amount);
    if (!amt) return toast.error(tr("Enter the amount"));
    if (type !== 'balance_in' && !/^(\d{4}|01[3-9]\d{8})$/.test(num)) return toast.error(tr("Enter the last 4 digits or the full 11-digit number"));
    if (owes > 0 && !due) return toast.error(tr("Pick the date the customer will pay"));
    const payload = {
      accountId: acct!._id, type, amount: amt, profit: toPaisa(profit) ?? 0,
      customerNumber: num || undefined, customerName: name.trim() || undefined,
      paidAmount: owes > 0 ? paidP : undefined, dueDate: owes > 0 ? new Date(due).toISOString() : undefined, note: note.trim() || undefined,
    };
    const clientId = uuid();
    setBusy(true);
    const queue = async () => {
      await enqueue({ clientId, entity: 'mfs_transaction', createdAt: new Date().toISOString(), payload, label: `${MFS_TX_LABEL[type]} ${taka(amt)}` });
      toast.success(tr("Saved on this phone. It will upload when you are online."));
    };
    try {
      if (!navigator.onLine) await queue();
      else { await api('/mfs/transactions', { method: 'POST', body: { ...payload, clientId } }); toast.success(tr("Entry saved")); }
      onClose(); setAmount(''); setProfit(''); setNum(''); setName(''); setPaid(''); setNote('');
      void qcInvalidate();
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) { await queue(); onClose(); } else toast.error(errMsg(e));
    } finally { setBusy(false); }
  };
  const qc = useQueryClientLite();
  const qcInvalidate = () => qc.invalidateQueries({ queryKey: ['mfs'] }).then(() => qc.invalidateQueries({ queryKey: ['dues'] }));

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={tr("New MFS entry")} description={TX_HELP[type]}
      footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} onClick={submit}>{tr("Save entry")}</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("SR account")}><Select value={accountId || accounts[0]?._id} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a._id} value={a._id}>{a.provider[0].toUpperCase() + a.provider.slice(1)} · {a.srName} · {taka(a.balance)}</option>)}</Select></Field>
          <Field label={tr("What happened")}><Select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(MFS_TX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("Amount (৳)")}><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus /></Field>
          {type !== 'balance_in' && isOwner && <Field label={tr("Your charge / profit (৳)")}><Input value={profit} onChange={(e) => setProfit(e.target.value)} inputMode="decimal" placeholder="0" /></Field>}
        </div>
        {type !== 'balance_in' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("Customer number")} hint={tr("Last 4 digits or the full number")}><Input value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" /></Field>
            <Field label={tr("Customer name (optional)")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          </div>
        )}
        {debit && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{tr("Cash to take")}</span><span className="num font-semibold">{taka(receivable)}</span></div>
            <Field label={tr("Customer gave (৳)")} hint={tr("Leave empty if paid in full.")}><Input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" placeholder={String(receivable / 100)} /></Field>
            {owes > 0 && <Field label={tr('Customer will pay {a} by', { a: taka(owes) })}><Input type="date" value={due} min={addDaysInput(0)} onChange={(e) => setDue(e.target.value)} /></Field>}
          </div>
        )}
        <Field label={tr("Note (optional)")}><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [provider, setProvider] = useState('');
  const [sr, setSr] = useState('');
  const [phone, setPhone] = useState('');
  const [bal, setBal] = useState('');
  const { data: tree = [] } = useQuery({ queryKey: ['categories', 'tree'], queryFn: () => api<Row[]>('/categories', { query: { tree: true } }), enabled: open });
  const enabled = ((tree.find((c) => c.productType === 'mfs')?.children ?? []) as Row[]).filter((c) => c.isEnabled);
  const save = useAct(() => api('/mfs/accounts', { method: 'POST', body: { provider: provider || enabled[0]?.logoKey, srName: sr.trim(), srNumber: phone.trim() || undefined, balance: toPaisa(bal) ?? 0 } }), {
    ok: tr("SR account added"), keys: ['mfs'], onOk: () => { onClose(); setSr(''); setPhone(''); setBal(''); },
  });
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={tr("Add SR account")} description={tr("Add the SR once. You only change the balance after that.")} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={save.isPending} disabled={!sr.trim() || !enabled.length} onClick={() => save.mutate(undefined)}>{tr("Add")}</Button></>}>
      <div className="space-y-3">
        {!enabled.length && <p className="rounded-md bg-warning/10 p-3 text-sm">{tr("Turn on bKash, Nagad, Rocket or Upay in Categories first.")}</p>}
        <Field label={tr("Provider")}><Select value={provider || enabled[0]?.logoKey || ''} onChange={(e) => setProvider(e.target.value)}>{enabled.map((c) => <option key={c._id} value={c.logoKey}>{c.name}</option>)}</Select></Field>
        <Field label={tr("SR name")}><Input value={sr} onChange={(e) => setSr(e.target.value)} /></Field>
        <Field label={tr("SR number (optional)")}><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
        <Field label={tr("E-balance you have now (৳)")}><Input value={bal} onChange={(e) => setBal(e.target.value)} inputMode="decimal" placeholder="100000" /></Field>
      </div>
    </Modal>
  );
}

