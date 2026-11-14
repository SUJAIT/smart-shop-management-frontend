'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, Package, Phone, ShieldCheck, Undo2, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EmptyState, Field, Kpi, ListSkeleton, PageHeader, Pager, SearchBox } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api, apiPaged } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct, useDebounced } from '@/lib/hooks';
import { CLAIM_KIND_LABEL, warrantyText } from '@/lib/labels';
import type { Row } from '@/lib/types';
import { cn, fmtDate, fmtDateTime, num, thumb } from '@/lib/utils';
import { imeiList } from '@/lib/imei';

interface Cat { _id: string; name: string; products: number; inStock: number; outOfStock: number; units: number; sold: number; claimed: number; returnRate: number; subs: (Omit<Cat, 'subs' | '_id'> & { _id: string | null })[] }
interface Overview { kpis: Record<string, number>; categories: Cat[] }

const rateTone = (r: number) => (r < 3 ? 'success' : r < 8 ? 'warning' : 'danger');
const rateColor = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' } as const;
const rateText = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' } as const;

/** Share of sold units that came back, as a small bar. */
function RateBar({ rate, sold }: { rate: number; sold: number }) {
  if (!sold) return <span className="text-xs text-muted-foreground">{tr('Nothing sold yet')}</span>;
  const t = rateTone(rate);
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', rateColor[t])} style={{ width: `${Math.max(rate > 0 ? 4 : 0, Math.min(100, rate * 4))}%` }} /></span>
      <span className={cn('num w-12 text-right text-xs font-semibold', rateText[t])}>{rate}%</span>
    </div>
  );
}

/** In stock vs out of stock products as one two-colour bar. */
function StockBar({ inStock, out }: { inStock: number; out: number }) {
  const total = inStock + out;
  if (!total) return null;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${inStock} ${tr('in stock')}, ${out} ${tr('out of stock')}`}>
      <span className="bg-success" style={{ width: `${(inStock / total) * 100}%` }} />
      <span className="bg-danger" style={{ width: `${(out / total) * 100}%` }} />
    </div>
  );
}

const Mini = ({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) => (
  <div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className={cn('num text-sm font-semibold', tone)}>{value}</p></div>
);

export default function WarrantyPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('overview');
  const [pf, setPf] = useState({ cat: '', sub: '', stock: '' });
  const [recordsProduct, setRecordsProduct] = useState<Row | null>(null);

  const { data: ov, isLoading } = useQuery({ queryKey: ['warranty', 'overview'], queryFn: () => api<Overview>('/warranty/overview'), enabled: can('warranty.manage') });
  if (!can('warranty.manage')) return <EmptyState icon={<ShieldCheck />} title={tr('You do not have access to Warranty')} hint={tr('Ask the shop owner to allow it.')} />;

  const openProducts = (cat = '', sub = '', stock = '') => { setPf({ cat, sub, stock }); setTab('products'); };
  const k = ov?.kpis;

  return (
    <>
      <PageHeader title={tr('Warranty')} description={tr('Every product that carries a warranty, who bought it, and how many come back.')} />

      <Card className="mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">
          <CardContent><Kpi label={tr('Warranty products')} value={num(k?.warrantyProducts)} sub={`${num(k?.inStock)} ${tr('in stock')} · ${num(k?.outOfStock)} ${tr('out')}`} /></CardContent>
          <CardContent><Kpi label={tr('Customers covered now')} value={num(k?.activeWarranties)} tone={undefined} sub={k?.expiringSoon ? tr('{n} end within 30 days', { n: k.expiringSoon }) : tr('None ending soon')} /></CardContent>
          <CardContent><Kpi label={tr('Sold with warranty')} value={num(k?.soldUnits)} sub={`${num(k?.claims)} ${tr('claims')}`} /></CardContent>
          <CardContent>
            <Kpi label={tr('Return rate')} value={`${k?.returnRate ?? 0}%`} tone={k?.soldUnits ? rateTone(k.returnRate) : undefined} sub={k?.soldUnits ? tr('{a} of {b} came back', { a: num(k.claimedUnits), b: num(k.soldUnits) }) : tr('No sales yet')} />
          </CardContent>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-scrollbar">
          <TabsTrigger value="overview">{tr('Overview')}</TabsTrigger>
          <TabsTrigger value="products">{tr('Products')}</TabsTrigger>
          <TabsTrigger value="customers">{tr('Customers')}</TabsTrigger>
          <TabsTrigger value="claims">{tr('Claims')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          {isLoading ? <ListSkeleton rows={3} /> : !ov?.categories.length ? (
            <Card><EmptyState icon={<ShieldCheck />} title={tr('No warranty products yet')} hint={tr('When you add a product, switch on Warranty. It is on by default.')} /></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div className="space-y-3">{ov.categories.map((c) => <CategoryCard key={c._id} c={c} onOpen={openProducts} />)}</div>
              <div className="space-y-4"><WatchList onOpen={() => setTab('products')} /><EndingSoon onAll={() => setTab('customers')} /></div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="pt-4"><ProductsTab ov={ov} pf={pf} setPf={setPf} onCustomers={(p) => { setRecordsProduct(p); setTab('customers'); }} /></TabsContent>
        <TabsContent value="customers" className="pt-4"><CustomersTab product={recordsProduct} clear={() => setRecordsProduct(null)} /></TabsContent>
        <TabsContent value="claims" className="pt-4"><ClaimsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function CategoryCard({ c, onOpen }: { c: Cat; onOpen: (cat?: string, sub?: string, stock?: string) => void }) {
  const [open, setOpen] = useState(false);
  const t = rateTone(c.returnRate);
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{c.name}</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">{tr('{n} products', { n: c.products })}</p>
        </div>
        {c.sold > 0 && <Badge tone={t}>{tr('Return rate')} {c.returnRate}%</Badge>}
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        <StockBar inStock={c.inStock} out={c.outOfStock} />
        <div className="grid grid-cols-4 gap-3">
          <Mini label={tr('In stock')} value={c.inStock} tone="text-success" />
          <Mini label={tr('Out of stock')} value={c.outOfStock} tone={c.outOfStock ? 'text-danger' : undefined} />
          <Mini label={tr('Sold')} value={num(c.sold)} />
          <Mini label={tr('Claims')} value={num(c.claimed)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpen(c._id)}>{tr('See products')}</Button>
          {c.outOfStock > 0 && <Button size="sm" variant="ghost" className="text-danger" onClick={() => onOpen(c._id, '', 'out')}>{tr('{n} out of stock', { n: c.outOfStock })}</Button>}
          {c.subs.length > 1 && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {tr('Sub categories')}<ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
            </Button>
          )}
        </div>
        {open && (
          <ul className="divide-y rounded-lg border">
            {c.subs.map((s) => (
              <li key={s._id ?? 'general'} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                <span className="truncate font-medium">{s.name}</span>
                <Button size="sm" variant="ghost" onClick={() => onOpen(c._id, s._id ?? '')}>{tr('View')}</Button>
                <span className="num col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                  <span><b className="text-success">{s.inStock}</b> {tr('in stock')}</span>
                  <span><b className={s.outOfStock ? 'text-danger' : ''}>{s.outOfStock}</b> {tr('out')}</span>
                  <span>{num(s.sold)} {tr('sold')}</span>
                  {s.sold > 0 && <span className={rateText[rateTone(s.returnRate)]}>{s.returnRate}% {tr('returned')}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Products that come back the most, so the owner can spot a weak supplier or model. */
function WatchList({ onOpen }: { onOpen: () => void }) {
  const { data } = useQuery({ queryKey: ['warranty', 'watch'], queryFn: () => apiPaged<Row>('/warranty/products', { limit: 100 }) });
  const list = useMemo(() => (data?.data ?? []).filter((p) => p.claimed > 0).sort((a, b) => b.returnRate - a.returnRate).slice(0, 5), [data]);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Undo2 className="size-4 text-warning" />{tr('Comes back most')}</CardTitle></CardHeader>
      <CardContent className="pt-3">
        {list.length === 0 ? <p className="text-sm text-muted-foreground">{tr('No claims yet. Good news.')}</p> : (
          <ul className="space-y-3">{list.map((p) => (
            <li key={p._id} className="space-y-1">
              <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{p.name}</span><span className="num shrink-0 text-xs text-muted-foreground">{p.claimed}/{p.sold}</span></div>
              <RateBar rate={p.returnRate} sold={p.sold} />
            </li>
          ))}</ul>
        )}
        {list.length > 0 && <Button size="sm" variant="ghost" className="mt-2" onClick={onOpen}>{tr('All products')}</Button>}
      </CardContent>
    </Card>
  );
}

function EndingSoon({ onAll }: { onAll: () => void }) {
  const { data } = useQuery({ queryKey: ['warranty', 'ending'], queryFn: () => apiPaged<Row>('/warranty/records', { state: 'expiring', sort: 'endsAt', limit: 5 }) });
  const rows = data?.data ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" />{tr('Ending in 30 days')}</CardTitle></CardHeader>
      <CardContent className="pt-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{tr('No warranty ends in the next 30 days.')}</p> : (
          <ul className="divide-y">{rows.map((w) => (
            <li key={w._id} className="py-2 text-sm">
              <p className="truncate font-medium">{w.productName}</p>
              <p className="flex justify-between gap-2 text-[13px] text-muted-foreground"><span className="truncate">{w.customer?.name || w.customer?.phone || tr('Walk-in')}</span><span className="shrink-0">{fmtDate(w.endsAt)}</span></p>
            </li>
          ))}</ul>
        )}
        {rows.length > 0 && <Button size="sm" variant="ghost" className="mt-2" onClick={onAll}>{tr('All customers')}</Button>}
      </CardContent>
    </Card>
  );
}

function ProductsTab({ ov, pf, setPf, onCustomers }: { ov?: Overview; pf: { cat: string; sub: string; stock: string }; setPf: (v: { cat: string; sub: string; stock: string }) => void; onCustomers: (p: Row) => void }) {
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [pf.cat, pf.sub, pf.stock]);
  const cat = ov?.categories.find((c) => c._id === pf.cat);
  const names = useMemo(() => {
    const m: Record<string, string> = {};
    ov?.categories.forEach((c) => { m[c._id] = c.name; c.subs.forEach((s) => { if (s._id) m[s._id] = s.name; }); });
    return m;
  }, [ov]);
  const { data, isLoading } = useQuery({
    queryKey: ['warranty', 'products', dq, pf, page],
    queryFn: () => apiPaged<Row>('/warranty/products', { search: dq, categoryId: pf.cat, subCategoryId: pf.sub, stock: pf.stock, page, limit: 20 }),
  });
  const seg = (v: string, label: string) => (
    <button type="button" aria-pressed={pf.stock === v} onClick={() => setPf({ ...pf, stock: v })} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', pf.stock === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{label}</button>
  );
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={tr('Name, model or barcode')} />
        <Select className="w-44" value={pf.cat} onChange={(e) => setPf({ ...pf, cat: e.target.value, sub: '' })} aria-label={tr('Category')}>
          <option value="">{tr('All categories')}</option>
          {ov?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
        {cat && cat.subs.length > 1 && (
          <Select className="w-44" value={pf.sub} onChange={(e) => setPf({ ...pf, sub: e.target.value })} aria-label={tr('Sub category')}>
            <option value="">{tr('All sub categories')}</option>
            {cat.subs.filter((s) => s._id).map((s) => <option key={s._id!} value={s._id!}>{s.name}</option>)}
          </Select>
        )}
        <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label={tr('Stock')}>{seg('', tr('All'))}{seg('in', tr('In stock'))}{seg('out', tr('Out of stock'))}</div>
      </div>
      {isLoading ? <ListSkeleton /> : !data?.data.length ? <EmptyState icon={<Package />} title={tr('No warranty products here')} hint={tr('Try another category or clear the filters.')} /> : (
        <Table>
          <THead><TR><TH>{tr('Product')}</TH><TH>{tr('Category')}</TH><TH className="text-right">{tr('Stock')}</TH><TH>{tr('Warranty')}</TH><TH className="text-right">{tr('Sold')}</TH><TH className="text-right">{tr('Claims')}</TH><TH>{tr('Return rate')}</TH><TH /></TR></THead>
          <TBody>{data.data.map((p) => (
            <TR key={p._id}>
              <TD>
                <div className="flex items-center gap-3">
                  {p.images?.[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={thumb(p.images[0].url, 80)} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Package className="size-4" /></span>}
                  <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="truncate text-xs text-muted-foreground">{[p.brand, p.model].filter(Boolean).join(' · ')}</p></div>
                </div>
              </TD>
              <TD className="text-muted-foreground">{[names[p.categoryId], p.subCategoryId && names[p.subCategoryId]].filter(Boolean).join(' › ') || '-'}</TD>
              <TD className="num text-right"><Badge tone={p.stock <= 0 ? 'danger' : p.stock <= (p.lowStockAlert ?? 0) ? 'warning' : 'success'}>{p.stock <= 0 ? tr('Out') : p.stock}</Badge></TD>
              <TD className="text-[13px]">{warrantyText(p.warranty)}</TD>
              <TD className="num text-right">{num(p.sold)}</TD>
              <TD className="num text-right">{num(p.claimed)}</TD>
              <TD><RateBar rate={p.returnRate} sold={p.sold} /></TD>
              <TD className="text-right"><Button size="sm" variant="outline" onClick={() => onCustomers(p)}><Users />{tr('Customers')}</Button></TD>
            </TR>
          ))}</TBody>
        </Table>
      )}
      <Pager meta={data?.meta} onPage={setPage} />
    </Card>
  );
}

const STATE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { active: 'success', expiring: 'warning', expired: 'danger', void: 'neutral' };
const stateLabel = (s: string) => ({ active: tr('Covered'), expiring: tr('Ending soon'), expired: tr('Ended'), void: tr('Sale cancelled') }[s] ?? s);

function CustomersTab({ product, clear }: { product: Row | null; clear: () => void }) {
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [claim, setClaim] = useState<Row | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['warranty', 'records', dq, state, product?._id, page],
    queryFn: () => apiPaged<Row>('/warranty/records', { search: dq, state, productId: product?._id, page, limit: 20 }),
  });
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={tr('Customer name, phone, invoice or barcode')} />
        <Select className="w-52" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} aria-label={tr('Show')}>
          <option value="">{tr('All')}</option><option value="active">{tr('Covered now')}</option><option value="expiring">{tr('Ending in 30 days')}</option><option value="expired">{tr('Ended')}</option><option value="claimed">{tr('With claims')}</option>
        </Select>
        {product && <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{product.name}<X className="size-3.5" /></button>}
      </div>
      {isLoading ? <ListSkeleton /> : !data?.data.length ? <EmptyState icon={<Users />} title={tr('No warranty records')} hint={tr('When you sell a warranty product, it appears here with the customer.')} /> : (
        <Table>
          <THead><TR><TH>{tr('Customer')}</TH><TH>{tr('Product')}</TH><TH>{tr('Bought')}</TH><TH>{tr('Ends')}</TH><TH className="text-right">{tr('Claims used')}</TH><TH /></TR></THead>
          <TBody>{data.data.map((w) => (
            <TR key={w._id}>
              <TD>
                <p className="font-medium">{w.customer?.name || <span className="text-muted-foreground">{tr('No name saved')}</span>}</p>
                {w.customer?.phone ? <a href={`tel:${w.customer.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Phone className="size-3" />{w.customer.phone}</a> : <p className="text-xs text-muted-foreground">{tr('No phone saved')}</p>}
              </TD>
              <TD><p className="font-medium">{w.productName}{w.quantity > 1 ? ` × ${w.quantity}` : ''}</p><p className="text-xs text-muted-foreground">{w.invoiceNo}{w.barcode ? ` · ${w.barcode}` : ''}{w.imei1 || w.imei2 ? ` · IMEI ${imeiList(w)}` : ''}</p></TD>
              <TD className="whitespace-nowrap text-muted-foreground">{fmtDate(w.startsAt)}</TD>
              <TD className="whitespace-nowrap">{fmtDate(w.endsAt)} <Badge tone={STATE_TONE[w.state]} className="ml-1">{stateLabel(w.state)}</Badge></TD>
              <TD className="num text-right">{w.claims.length}/{w.maxClaims * w.quantity}</TD>
              <TD className="text-right">{w.state !== 'void' && w.state !== 'expired' && w.claimsLeft > 0 ? <Button size="sm" onClick={() => setClaim(w)}>{tr('Register claim')}</Button> : null}</TD>
            </TR>
          ))}</TBody>
        </Table>
      )}
      <Pager meta={data?.meta} onPage={setPage} />
      <ClaimDialog record={claim} onClose={() => setClaim(null)} />
    </Card>
  );
}

function ClaimDialog({ record: w, onClose }: { record: Row | null; onClose: () => void }) {
  const [kind, setKind] = useState('repair');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  useEffect(() => { if (w) { setKind('repair'); setQty('1'); setNote(''); } }, [w]);
  const save = useAct(() => api(`/warranty/records/${w!._id}/claims`, { method: 'POST', body: { kind, quantity: Math.max(1, parseInt(qty, 10) || 1), note: note.trim() || undefined } }), {
    ok: tr('Claim registered'), keys: ['warranty'], onOk: onClose,
  });
  return (
    <Modal
      open={!!w}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={tr('Register claim')}
      description={w ? `${w.productName} · ${w.customer?.name || w.customer?.phone || tr('Walk-in')}` : ''}
      footer={<><Button variant="outline" onClick={onClose}>{tr('Cancel')}</Button><Button loading={save.isPending} onClick={() => save.mutate(undefined)}>{tr('Save claim')}</Button></>}
    >
      <div className="space-y-3">
        <div role="radiogroup" aria-label={tr('What does the customer want?')} className="grid gap-2">
          {Object.entries(CLAIM_KIND_LABEL).map(([k, label]) => (
            <label key={k} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium', kind === k && 'border-primary bg-primary/5')}>
              <input type="radio" name="claimkind" className="accent-[rgb(var(--primary))]" checked={kind === k} onChange={() => setKind(k)} />{label}
            </label>
          ))}
        </div>
        {w && w.quantity > 1 && <Field label={tr('How many pieces?')} hint={tr('{n} were sold on this invoice', { n: w.quantity })}><Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="max-w-28" /></Field>}
        <Field label={tr('What is wrong? (optional)')}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('Example: Not charging')} /></Field>
        {w && <p className="text-xs text-muted-foreground">{tr('{n} claim(s) left on this warranty', { n: w.claimsLeft })}</p>}
      </div>
    </Modal>
  );
}

function ClaimsTab() {
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['warranty', 'claims', kind, page], queryFn: () => apiPaged<Row>('/warranty/claims', { kind, page, limit: 20 }) });
  const tone: Record<string, 'primary' | 'warning' | 'danger'> = { repair: 'primary', replace: 'warning', refund: 'danger' };
  return (
    <Card>
      <div className="flex flex-wrap gap-2 border-b p-3">
        <Select className="w-52" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} aria-label={tr('Type')}>
          <option value="">{tr('All claims')}</option>
          {Object.entries(CLAIM_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {isLoading ? <ListSkeleton /> : !data?.data.length ? <EmptyState icon={<Undo2 />} title={tr('No claims yet')} hint={tr('Claims you register for customers are listed here.')} /> : (
        <Table>
          <THead><TR><TH>{tr('When')}</TH><TH>{tr('Product')}</TH><TH>{tr('Customer')}</TH><TH>{tr('Type')}</TH><TH>{tr('Note')}</TH><TH>{tr('By')}</TH></TR></THead>
          <TBody>{data.data.map((c) => (
            <TR key={c.claimId}>
              <TD className="whitespace-nowrap text-muted-foreground">{fmtDateTime(c.at)}</TD>
              <TD><p className="font-medium">{c.productName}</p><p className="text-xs text-muted-foreground">{c.invoiceNo}</p></TD>
              <TD>{c.customer?.name || c.customer?.phone || <span className="text-muted-foreground">{tr('Walk-in')}</span>}</TD>
              <TD><Badge tone={tone[c.kind]}>{CLAIM_KIND_LABEL[c.kind]}{c.quantity > 1 ? ` × ${c.quantity}` : ''}</Badge></TD>
              <TD className="text-muted-foreground">{c.note}</TD>
              <TD className="text-muted-foreground">{c.byName}</TD>
            </TR>
          ))}</TBody>
        </Table>
      )}
      <Pager meta={data?.meta} onPage={setPage} />
    </Card>
  );
}
