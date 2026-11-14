'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, CreditCard, Minus, Package, Plus, Printer, ScanBarcode, ShieldCheck, ShoppingCart, Trash2, WifiOff, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CameraScanner } from '@/components/camera-scanner';
import { EmptyState, Field } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { ApiError, api, apiPaged, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { cacheProducts, enqueue, findCachedByBarcode, searchCached } from '@/lib/offline';
import { imeiList } from '@/lib/imei';
import { printInvoice } from '@/lib/print';
import { normalizeCode, useBarcodeScanner } from '@/lib/scanner';
import type { Row } from '@/lib/types';
import { addDaysInput, cn, fromPaisa, taka, thumb, toPaisa, uuid } from '@/lib/utils';

interface Line {
  product: Row;
  qty: number;
  price?: number; // paisa, only when the seller typed a different price
  priceStr?: string; // what is typed in the box
}

const looksLikeBarcode = (s: string) => /^[A-Za-z0-9-]{6,}$/.test(s);
const isTk = (p: Row) => p.unit === 'tk';
const hasWarranty = (p: Row) => !!p.warranty?.enabled;

// "Recently sold": the last products this device really sold, for one-tap selling
const RECENT_KEY = 'recent-sold-v1';
const loadRecent = (): Row[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
};
const saveRecent = (ps: Row[]) => {
  try {
    const keep = ps.map((p) => ({ _id: p._id, name: p.name, brand: p.brand, model: p.model, salePrice: p.salePrice, stock: p.stock, unit: p.unit, lowStockAlert: p.lowStockAlert, images: (p.images ?? []).slice(0, 1), warranty: p.warranty, barcode: p.barcode }));
    const merged = [...keep, ...loadRecent().filter((o) => !keep.some((k) => k._id === o._id))].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(merged));
  } catch { /* storage full or blocked: not important */ }
};

const Thumb = ({ p, size = 40 }: { p: Row; size?: number }) =>
  p.images?.[0] ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumb(p.images[0].url, size * 2)} alt="" loading="lazy" className="shrink-0 rounded-md border object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" style={{ width: size, height: size }}><Package className="size-4" /></span>
  );

export default function SellPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 250);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('');
  const [finalStr, setFinalStr] = useState<string | null>(null); // only while the seller types the final price
  const [credit, setCredit] = useState(false);
  const [paid, setPaid] = useState('');
  const [dueDate, setDueDate] = useState(addDaysInput(7));
  const [cust, setCust] = useState({ name: '', phone: '' });
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id?: string; invoiceNo?: string; total: number; due: number; saved: number; offline?: boolean } | null>(null);
  const [camera, setCamera] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [ask, setAsk] = useState(false); // warranty: customer details popup
  const [askCust, setAskCust] = useState({ name: '', phone: '' });
  const [recent, setRecent] = useState<Row[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const clientId = useRef(uuid());
  const canOverride = can('sale.override_price');

  useEffect(() => {
    if (navigator.onLine) void cacheProducts().catch(() => {}); // keep a copy on the device so selling works offline
    setRecent(loadRecent());
  }, []);
  useEffect(() => { searchRef.current?.focus(); }, [done]);

  // products are only listed while the seller searches or scans (no "all products" wall)
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['pos-products', dq],
    enabled: dq.length > 0,
    queryFn: async (): Promise<Row[]> => {
      if (!navigator.onLine) return searchCached(dq);
      try {
        const r = await apiPaged<Row>('/products', { search: dq, limit: 16, isActive: true });
        return r.data;
      } catch (e) {
        if (e instanceof ApiError && e.isNetwork) return searchCached(dq);
        throw e;
      }
    },
    staleTime: 5_000,
  });

  const add = useCallback((p: Row, qty = 1) => {
    if (!(p.salePrice > 0) && !canOverride) {
      toast.error(tr('“{name}” has no selling price. Set it in Products → Edit.', { name: p.name }));
      return;
    }
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product._id === p._id);
      const max = navigator.onLine ? p.stock : Infinity;
      if (i >= 0) {
        const next = [...ls];
        const nq = next[i].qty + qty;
        if (nq > max) {
          toast.error(tr('Only {n} of “{name}” in stock', { n: p.stock, name: p.name }));
          return ls;
        }
        next[i] = { ...next[i], qty: nq };
        return next;
      }
      if (p.stock <= 0 && navigator.onLine) {
        toast.error(tr('“{name}” is out of stock', { name: p.name }));
        return ls;
      }
      return [...ls, { product: p, qty }];
    });
  }, [canOverride]);

  const addRecent = async (p: Row) => {
    if (navigator.onLine) {
      try { return add(await api<Row>(`/products/${p._id}`)); } catch { /* use the saved copy */ }
    }
    add(p);
  };

  const byBarcode = async (code: string) => {
    try {
      const p = navigator.onLine ? await api<Row>(`/products/barcode/${encodeURIComponent(code)}`) : await findCachedByBarcode(code);
      if (!p) throw new Error('No product found for this barcode');
      add(p);
      setQ('');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) {
        const p = await findCachedByBarcode(code);
        if (p) { add(p); setQ(''); return true; }
      }
      toast.error(errMsg(e));
      return false;
    }
  };

  // USB / Bluetooth / wireless scanner: it types the code very fast and presses Enter. Works with nothing selected too.
  const clearSearch = useCallback(() => setQ(''), []);
  useBarcodeScanner((code) => { void byBarcode(code); }, { inputRef: searchRef, onConsumed: clearSearch });

  const onEnter = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const code = normalizeCode(q);
    if (looksLikeBarcode(code) && (await byBarcode(code))) return;
    if (results.length === 1) { add(results[0]); setQ(''); }
  };

  // ---- money: price you type -> discount shown; discount you type -> price changes; final price -> discount ----
  const unitOf = (l: Line) => l.price ?? l.product.salePrice;
  const sub = useMemo(() => lines.reduce((s, l) => s + unitOf(l) * l.qty, 0), [lines]);
  const listTotal = useMemo(() => lines.reduce((s, l) => s + l.product.salePrice * l.qty, 0), [lines]);
  const priceCut = useMemo(() => lines.reduce((s, l) => s + Math.max(0, l.product.salePrice - unitOf(l)) * l.qty, 0), [lines]);
  const disc = Math.min(toPaisa(discount) ?? 0, sub);
  const total = sub - disc;
  const given = priceCut + disc; // everything the customer saves
  const givenPct = listTotal > 0 ? Math.round((given / listTotal) * 1000) / 10 : 0;
  const paidP = credit ? Math.min(toPaisa(paid) ?? 0, total) : total;
  const due = credit ? total - paidP : 0;
  const warrantyInCart = lines.some((l) => hasWarranty(l.product));

  const setQty = (id: string, qty: number) => setLines((ls) => ls.map((l) => (l.product._id === id ? { ...l, qty: Math.max(1, Math.floor(qty) || 1) } : l)));
  const setPrice = (id: string, v: string) => setLines((ls) => ls.map((l) => (l.product._id === id ? { ...l, priceStr: v, price: toPaisa(v) } : l)));
  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.product._id !== id));
  const onFinal = (v: string) => {
    setFinalStr(v);
    const f = toPaisa(v);
    setDiscount(f === undefined ? '' : fromPaisa(Math.max(0, sub - f)) === '0' ? '' : fromPaisa(Math.max(0, sub - f)));
  };

  const reset = () => {
    setLines([]); setDiscount(''); setFinalStr(null); setCredit(false); setPaid(''); setCust({ name: '', phone: '' }); setNote(''); setMethod('cash'); setDueDate(addDaysInput(7));
    clientId.current = uuid();
    setCartOpen(false);
  };

  const checkout = async (opts: { cust?: { name: string; phone: string }; skipWarranty?: boolean } = {}) => {
    if (!lines.length) return;
    const c = opts.cust ?? cust;
    const hasCust = !!(c.name.trim() || c.phone.trim());
    if (due > 0 && !hasCust) return toast.error(tr('Add the customer’s name or phone for a credit sale'));
    // warranty products: customer details are kept for future service, so ask once when they are missing
    if (warrantyInCart && !opts.skipWarranty && (!c.name.trim() || !c.phone.trim())) {
      setAskCust({ name: c.name, phone: c.phone });
      setAsk(true);
      return;
    }
    const payload = {
      items: lines.map((l) => ({ productId: l.product._id, quantity: l.qty, ...(canOverride && l.price !== undefined ? { unitPrice: l.price } : {}) })),
      customer: hasCust ? { name: c.name.trim() || undefined, phone: c.phone.trim() || undefined } : undefined,
      discount: disc,
      paidAmount: due > 0 ? paidP : undefined,
      dueDate: due > 0 ? new Date(dueDate).toISOString() : undefined,
      paymentMethod: method,
      note: note.trim() || undefined,
    };
    const soldProducts = lines.map((l) => l.product);
    const saveOffline = async () => {
      await enqueue({ clientId: clientId.current, entity: 'sale', createdAt: new Date().toISOString(), payload, label: `Sale ${taka(total)}` });
      setDone({ total, due, saved: given, offline: true });
      saveRecent(soldProducts); setRecent(loadRecent());
      reset();
    };
    setBusy(true);
    try {
      if (!navigator.onLine) return await saveOffline();
      const sale = await api<Row>('/sales', { method: 'POST', body: { ...payload, clientId: clientId.current } });
      setDone({ id: sale._id, invoiceNo: sale.invoiceNo, total: sale.total, due: sale.dueAmount, saved: sale.totalDiscount ?? given });
      saveRecent(soldProducts); setRecent(loadRecent());
      reset();
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) await saveOffline();
      else toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const print = async (fmt: 'pos' | 'a4') => {
    try { if (done?.id) await printInvoice(done.id, fmt); } catch (e) { toast.error(errMsg(e)); }
  };

  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  // the cart is built once and shown beside the products on computers, and as a bottom sheet on phones
  const cartInner: ReactNode = (
    <>
      {lines.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">{tr('Scan or tap a product to start.')}</p>
      ) : (
        <ul className="divide-y">
          {lines.map((l) => {
            const list = l.product.salePrice;
            const unit = unitOf(l);
            const cut = Math.max(0, list - unit) * l.qty;
            const pct = list > 0 ? Math.round(((list - unit) / list) * 100) : 0;
            return (
              <li key={l.product._id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Thumb p={l.product} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{l.product.name}</p>
                      {(l.product.imei1 || l.product.imei2) && <p className="num mt-0.5 text-[11px] text-muted-foreground">IMEI {imeiList(l.product)}</p>}
                      {hasWarranty(l.product) && <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-success"><ShieldCheck className="size-3" />{tr('Warranty')}</p>}
                    </div>
                  </div>
                  <button onClick={() => remove(l.product._id)} className="p-1 text-muted-foreground hover:text-danger" aria-label={tr('Remove {name}', { name: l.product.name })}><Trash2 className="size-4" /></button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="size-9 sm:size-8" onClick={() => setQty(l.product._id, l.qty - 1)} aria-label={tr('Less')}><Minus /></Button>
                    <Input value={l.qty} onChange={(e) => setQty(l.product._id, Number(e.target.value))} inputMode="numeric" className="num h-9 w-14 px-1 text-center sm:h-8" aria-label={tr('Quantity')} />
                    <Button size="icon" variant="outline" className="size-9 sm:size-8" onClick={() => setQty(l.product._id, l.qty + 1)} aria-label={tr('More')}><Plus /></Button>
                    {isTk(l.product) && <span className="ml-1 text-xs text-muted-foreground">{tr('taka')}</span>}
                  </div>
                  <div className="text-right">
                    {canOverride ? (
                      <Input value={l.priceStr ?? String(unit / 100)} onChange={(e) => setPrice(l.product._id, e.target.value)} inputMode="decimal" className="num h-9 w-24 text-right sm:h-8" aria-label={tr('Selling price')} />
                    ) : (
                      <p className="num text-xs text-muted-foreground">{taka(list)} {tr('each')}</p>
                    )}
                    <p className="num mt-0.5 text-sm font-semibold">{taka(unit * l.qty)}</p>
                  </div>
                </div>
                {canOverride && list > 0 && unit !== list && (
                  <p className={cn('num text-right text-xs', unit < list ? 'font-medium text-success' : 'text-muted-foreground')}>
                    {unit < list ? tr('Normal price {a} · discount {b} ({p}%)', { a: taka(list), b: taka(cut), p: pct }) : tr('Above the normal price {a}', { a: taka(list) })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lines.length > 0 && (
        <div className="space-y-3 border-t bg-muted/30 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={tr('Discount (৳)')}>
              <Input value={discount} onChange={(e) => { setDiscount(e.target.value); setFinalStr(null); }} inputMode="decimal" placeholder="0" />
            </Field>
            <Field label={tr('Final price (৳)')}>
              <Input
                value={finalStr ?? fromPaisa(total)}
                onFocus={() => setFinalStr(fromPaisa(total))}
                onChange={(e) => onFinal(e.target.value)}
                onBlur={() => setFinalStr(null)}
                inputMode="decimal"
                aria-label={tr('Final price (৳)')}
              />
            </Field>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">{tr('Type a discount, or type the final price and the discount is worked out for you.')}</p>

          <div className="grid grid-cols-2 gap-2">
            <Field label={tr('Customer name')}><Input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} placeholder={due > 0 ? tr('Required for credit') : tr('Optional')} /></Field>
            <Field label={tr('Phone')}><Input value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} inputMode="tel" placeholder={tr('Optional')} /></Field>
          </div>
          {warrantyInCart && <p className="-mt-1 flex items-center gap-1.5 text-xs text-success"><ShieldCheck className="size-3.5" />{tr('A warranty product is in this sale. Customer details help with future service.')}</p>}

          <div role="group" aria-label={tr('How is it paid?')} className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-1">
            <button type="button" aria-pressed={!credit} onClick={() => setCredit(false)} className={cn('flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium', !credit ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><Wallet className="size-4" />{tr('Paid in full')}</button>
            <button type="button" aria-pressed={credit} onClick={() => setCredit(true)} className={cn('flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium', credit ? 'bg-warning text-white' : 'text-muted-foreground')}><CreditCard className="size-4" />{tr('On credit')}</button>
          </div>
          {credit && (
            <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label={tr('Paid now (৳)')}><Input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
                <Field label={tr('Pays the rest by')}><Input type="date" value={dueDate} min={addDaysInput(0)} onChange={(e) => setDueDate(e.target.value)} /></Field>
              </div>
              <p className="text-xs">{tr('{a} goes to Dues. You get a reminder the day before.', { a: taka(due) })}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label={tr('Payment')}><Select value={method} onChange={(e) => setMethod(e.target.value)}>{['cash', 'bkash', 'nagad', 'rocket', 'upay', 'card', 'other'].map((m) => <option key={m} value={m}>{tr(m[0].toUpperCase() + m.slice(1))}</option>)}</Select></Field>
            <Field label={tr('Note')}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('Optional')} /></Field>
          </div>
        </div>
      )}

      <div className="border-t px-4 py-3">
        <dl className="num space-y-1 text-sm">
          {given > 0 && <div className="flex justify-between text-muted-foreground"><dt>{tr('Normal price')}</dt><dd>{taka(listTotal)}</dd></div>}
          {given > 0 && (
            <div className="flex justify-between rounded-md bg-success/10 px-2 py-1 font-medium text-success">
              <dt>{tr('Discount given')}{givenPct > 0 ? ` (${givenPct}%)` : ''}</dt><dd>-{taka(given)}</dd>
            </div>
          )}
          {given === 0 && <div className="flex justify-between text-muted-foreground"><dt>{tr('Subtotal')}</dt><dd>{taka(sub)}</dd></div>}
          {due > 0 && <div className="flex justify-between text-warning"><dt>{tr('Due later')}</dt><dd>{taka(due)}</dd></div>}
          <div className="flex items-baseline justify-between pt-1 text-lg font-semibold"><dt>{tr('Total')}</dt><dd>{taka(total)}</dd></div>
        </dl>
        <Button size="lg" className="mt-3 w-full" disabled={!lines.length} loading={busy} onClick={() => void checkout()}>
          {due > 0 ? tr('Sell on credit · {a} now', { a: taka(paidP) }) : tr('Complete sale · {a}', { a: taka(total) })}
        </Button>
      </div>
    </>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <section className="min-w-0 space-y-3">
        <div className="sticky top-14 z-20 -mx-3 bg-background/95 px-3 pb-2 pt-1 backdrop-blur sm:-mx-5 sm:px-5 lg:static lg:m-0 lg:p-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-primary" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onEnter}
                placeholder={tr('Scan a barcode or search by name')}
                className="h-12 pl-11 text-base"
                aria-label={tr('Scan barcode or search product')}
                autoComplete="off"
              />
            </div>
            <Button variant="outline" className="h-12" onClick={() => setCamera(true)} aria-label={tr('Scan with camera')}><Camera /></Button>
          </div>
        </div>

        {dq.length === 0 ? (
          recent.length > 0 ? (
            <div>
              <p className="mb-2 text-[13px] text-muted-foreground">{tr('Recently sold')}</p>
              <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {recent.map((p) => (
                  <button key={p._id} onClick={() => void addRecent(p)} className="flex shrink-0 items-center gap-2 rounded-full border bg-card py-1.5 pl-1.5 pr-3 text-left text-sm hover:border-primary active:bg-primary/5">
                    <Thumb p={p} size={28} />
                    <span className="max-w-[9rem] truncate font-medium">{p.name}</span>
                    <span className="num text-xs text-muted-foreground">{taka(p.salePrice)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Card><EmptyState icon={<ScanBarcode />} title={tr('Ready to sell')} hint={tr('Scan a barcode or type a name to find a product.')} /></Card>
          )
        ) : isFetching && !results.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{tr('Looking…')}</p>
        ) : results.length === 0 ? (
          <Card><EmptyState title={tr('No product matches')} hint={tr('Check the spelling, or scan the barcode again.')} /></Card>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {results.map((p) => {
              const out = p.stock <= 0;
              return (
                <button
                  key={p._id}
                  onClick={() => add(p)}
                  className={cn('flex flex-col rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary active:bg-primary/5', out && 'opacity-60')}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-sm font-medium leading-snug">{p.name}</span>
                      {(p.model || p.brand) && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{[p.brand, p.model].filter(Boolean).join(' · ')}</span>}
                    </span>
                    <Thumb p={p} />
                  </span>
                  <span className="mt-auto flex items-end justify-between pt-2">
                    <span className="num text-[15px] font-semibold">{taka(p.salePrice)}{isTk(p) && <span className="text-xs font-normal text-muted-foreground"> {tr('/tk')}</span>}</span>
                    <span className="flex items-center gap-1.5">
                      {hasWarranty(p) && <ShieldCheck className="size-4 text-success" aria-label={tr('Warranty')} />}
                      <Badge tone={out ? 'danger' : p.stock <= (p.lowStockAlert ?? 0) ? 'warning' : 'neutral'}>{out ? tr('Out') : `${p.stock}${isTk(p) ? ' tk' : ''}`}</Badge>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* computers: cart beside the products */}
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-[15px] font-semibold">{tr('Current sale')}</h2>
            {lines.length > 0 && <button className="text-xs text-muted-foreground hover:text-danger" onClick={reset}>{tr('Clear')}</button>}
          </div>
          <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto">{cartInner}</div>
        </Card>
      </aside>

      {/* phones: a bar at the bottom opens the cart as a sheet */}
      {lines.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[4.75rem] z-20 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg lg:hidden"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <span className="flex items-center gap-2 text-sm"><ShoppingCart className="size-4" />{itemCount} {tr('items')}</span>
          <span className="num font-semibold">{taka(total)} {tr('· Checkout')}</span>
        </button>
      )}
      <div className="lg:hidden">
        <Modal open={cartOpen && lines.length > 0} onOpenChange={setCartOpen} title={tr('Current sale')} size="md">
          <div className="-mx-5 -my-4">{cartInner}</div>
        </Modal>
      </div>

      <CameraScanner open={camera} onOpenChange={setCamera} onCode={(c) => void byBarcode(c)} />

      {/* warranty product sold without customer details */}
      <Modal
        open={ask}
        onOpenChange={setAsk}
        size="sm"
        title={tr('Save customer details?')}
        footer={
          <>
            <Button variant="outline" onClick={() => { setAsk(false); setCartOpen(false); void checkout({ skipWarranty: true }); }}>{tr('Sell without details')}</Button>
            <Button
              disabled={!askCust.name.trim() && !askCust.phone.trim()}
              onClick={() => { setAsk(false); setCust(askCust); void checkout({ cust: askCust, skipWarranty: true }); }}
            >
              {tr('Save and sell')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-3 rounded-lg bg-success/10 p-3 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <p>{tr('Customer details will be saved for future warranty service and better management.')}</p>
          </div>
          <Field label={tr('Customer name')}><Input value={askCust.name} onChange={(e) => setAskCust({ ...askCust, name: e.target.value })} autoFocus /></Field>
          <Field label={tr('Phone')}><Input value={askCust.phone} onChange={(e) => setAskCust({ ...askCust, phone: e.target.value })} inputMode="tel" /></Field>
        </div>
      </Modal>

      <Modal
        open={!!done}
        onOpenChange={(o) => !o && setDone(null)}
        title={done?.offline ? tr('Saved on this phone') : tr('Sale complete')}
        size="sm"
        footer={
          <>
            {done?.id && (<>
              <Button variant="outline" onClick={() => print('pos')}><Printer />{tr('Receipt')}</Button>
              <Button variant="outline" onClick={() => print('a4')}><Printer />{tr('A4 invoice')}</Button>
            </>)}
            <Button onClick={() => setDone(null)}>{tr('New sale')}</Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          {done?.offline ? <WifiOff className="size-10 text-warning" /> : <CheckCircle2 className="size-10 text-success" />}
          <p className="num text-2xl font-semibold">{taka(done?.total)}</p>
          {done?.invoiceNo && <p className="text-sm text-muted-foreground">{done.invoiceNo}</p>}
          {!!done?.saved && <Badge tone="success">{tr('Customer saved {a}', { a: taka(done.saved) })}</Badge>}
          {done?.offline && <p className="text-sm text-muted-foreground">{tr('No internet. This sale is safe here and goes to the server by itself when you are back online.')}</p>}
          {!!done?.due && <Badge tone="warning">{taka(done.due)} {tr('still due')}</Badge>}
        </div>
      </Modal>
    </div>
  );
}
