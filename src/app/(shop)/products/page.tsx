'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { History, Package, PackagePlus, Pencil, Plus, Printer, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ConfirmNameDialog, EmptyState, Field, ListSkeleton, PageHeader, Pager, SearchBox } from '@/components/common';
import { ProductDetails } from '@/components/products/product-details';
import { ProductForm } from '@/components/products/product-form';
import { HistoryDialog, StockDialog } from '@/components/products/stock-dialogs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api, apiPaged, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct, useDebounced } from '@/lib/hooks';
import { PRODUCT_TYPE_LABEL, catName } from '@/lib/labels';
import { printLabels } from '@/lib/print';
import { useBarcodeScanner } from '@/lib/scanner';
import type { Row } from '@/lib/types';
import { cn, num, taka, thumb } from '@/lib/utils';

interface Summary {
  categories: { _id: string; name: string; inStock: number; outOfStock: number; subs: { _id: string; name: string; inStock: number; outOfStock: number }[] }[];
  totals: { inStock: number; outOfStock: number };
}
type LabelTarget = { ids: string[]; title: string } | { all: true } | null;

/** One tappable filter pill with a small count. */
function Chip({ active, onClick, children, count, tone }: { active: boolean; onClick: () => void; children: ReactNode; count?: number; tone?: 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active ? (tone === 'danger' ? 'border-danger bg-danger text-white' : 'border-primary bg-primary text-primary-foreground') : tone === 'danger' ? 'border-danger/40 text-danger hover:bg-danger/10' : 'bg-card hover:bg-muted',
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn('num grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold', active ? 'bg-white/25' : tone === 'danger' ? 'bg-danger/15' : 'bg-muted text-muted-foreground')}>{num(count)}</span>
      )}
    </button>
  );
}

export default function ProductsPage() {
  const { can } = useAuth();
  const canSeeCost = can('product.view', 'product.create', 'product.update', 'stock.restock');
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [catId, setCatId] = useState('');
  const [subId, setSubId] = useState('');
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; edit?: Row | null }>({ open: false });
  const [stock, setStock] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [labels, setLabels] = useState<LabelTarget>(null);
  const [detail, setDetail] = useState<Row | null>(null);

  // scan a product's barcode to jump straight to it
  useBarcodeScanner((code) => { setMode('in'); setCatId(''); setSubId(''); setSearch(code); setPage(1); });

  useEffect(() => { setLow(new URLSearchParams(window.location.search).get('lowStock') === 'true'); }, []);

  const { data: sum } = useQuery({ queryKey: ['products', 'summary'], queryFn: () => api<Summary>('/products/summary') });
  const cats = sum?.categories ?? [];
  const cat = cats.find((c) => c._id === catId);
  const outCount = sum?.totals.outOfStock ?? 0;

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'list', dq, mode, catId, subId, low, page],
    queryFn: () =>
      apiPaged<Row>('/products', {
        search: dq,
        stock: mode,
        categoryId: mode === 'in' ? catId : undefined,
        subCategoryId: mode === 'in' ? subId : undefined,
        lowStock: mode === 'in' && low ? true : undefined,
        sort: mode === 'in' ? undefined : 'name',
        page,
        limit: 20,
      }),
  });
  const remove = useAct((v: { id: string; confirmName: string }) => api(`/products/${v.id}`, { method: 'DELETE', body: { confirmName: v.confirmName } }), {
    ok: tr('Product deleted'), keys: ['products', 'dashboard', 'capital'], onOk: () => setDel(null),
  });
  const rows = data?.data ?? [];

  const pick = (m: 'in' | 'out', c = '', s = '') => { setMode(m); setCatId(c); setSubId(s); setPage(1); };
  const filtered = !!(dq || catId || low);

  return (
    <>
      <PageHeader
        title={tr('Products')}
        description={tr('Everything you sell, with stock and prices.')}
        actions={<>
          {can('barcode.print') && <Button variant="outline" onClick={() => setLabels({ all: true })}><Printer />{tr('Print all barcodes')}</Button>}
          {can('product.create') && <Button onClick={() => setForm({ open: true })}><Plus />{tr('Add product')}</Button>}
        </>}
      />

      <Card>
        {/* top: Stock out first, then every category that has products */}
        <div className="border-b">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3" role="group" aria-label={tr('Categories')}>
            <Chip active={mode === 'out'} tone="danger" count={outCount} onClick={() => pick('out')}>{tr('Stock out')}</Chip>
            <Chip active={mode === 'in' && !catId} count={sum?.totals.inStock} onClick={() => pick('in')}>{tr('All in stock')}</Chip>
            {cats.map((c) => (
              <Chip key={c._id} active={mode === 'in' && catId === c._id} count={c.inStock} onClick={() => pick('in', c._id)}>{catName(c.name)}</Chip>
            ))}
          </div>
          {mode === 'in' && cat && cat.subs.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto border-t bg-muted/30 px-3 py-2.5" role="group" aria-label={tr('Sub categories')}>
              <Chip active={!subId} count={cat.inStock} onClick={() => pick('in', cat._id)}>{tr('All {name}', { name: catName(cat.name) })}</Chip>
              {cat.subs.map((s) => (
                <Chip key={s._id} active={subId === s._id} count={s.inStock} onClick={() => pick('in', cat._id, s._id)}>{catName(s.name)}</Chip>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={tr('Name, model or barcode')} />
          {mode === 'in' && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[rgb(var(--primary))]" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} />{tr('Low stock only')}</label>
          )}
          {mode === 'out' && <span className="text-sm text-muted-foreground">{tr('Products with no stock left. Add stock to sell them again.')}</span>}
        </div>

        {isLoading ? <ListSkeleton /> : rows.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={mode === 'out' ? (dq ? tr('No product matches') : tr('Nothing is out of stock')) : filtered ? tr('No product matches') : tr('No products yet')}
            hint={mode === 'out' ? tr('Every product still has stock.') : filtered ? tr('Nothing in stock here. Try another category, or look at Stock out.') : tr('Create a category, then add your first product.')}
            action={mode === 'in' && !filtered && can('product.create') && <Button onClick={() => setForm({ open: true })}><Plus />{tr('Add product')}</Button>}
          />
        ) : (
          <Table>
            <THead><TR>
              <TH>{tr('Product')}</TH><TH>{tr('Type')}</TH><TH className="text-right">{tr('Stock')}</TH><TH className="text-right">{tr('Price')}</TH>{canSeeCost && <TH className="text-right">{tr('Cost')}</TH>}<TH />
            </TR></THead>
            <TBody>
              {rows.map((p) => {
                const isLow = p.stock <= p.lowStockAlert;
                return (
                  <TR key={p._id} className="cursor-pointer" onClick={() => setDetail(p)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={thumb(p.images[0].url, 80)} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Package className="size-4" /></span>}
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium">{p.name}{p.warranty?.enabled && <ShieldCheck className="size-3.5 shrink-0 text-success" aria-label={tr('Warranty')} />}</p>
                          <p className="truncate text-xs text-muted-foreground">{[p.brand, p.model, p.barcode].filter(Boolean).join(' · ') || (p.card?.kind ? tr('{kind} card', { kind: p.card.kind }) : '')}</p>
                        </div>
                      </div>
                    </TD>
                    <TD><Badge>{PRODUCT_TYPE_LABEL[p.productType]}</Badge>{p.supplier?.name && <p className="mt-0.5 text-xs text-muted-foreground">{p.supplier.name} · {p.supplier.supplierSharePct}%</p>}</TD>
                    <TD className="num text-right"><Badge tone={p.stock <= 0 ? 'danger' : isLow ? 'warning' : 'neutral'}>{p.stock <= 0 ? tr('Out') : p.stock}{p.stock > 0 && p.unit === 'tk' ? tr(' tk') : ''}</Badge></TD>
                    <TD className="num text-right font-medium">{taka(p.salePrice)}</TD>
                    {canSeeCost && <TD className="num text-right text-muted-foreground">{taka(p.purchasePrice)}</TD>}
                    <TD onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        {can('stock.restock') && <Button size="icon" variant="ghost" onClick={() => setStock(p)} aria-label={tr('Add stock to {name}', { name: p.name })}><PackagePlus /></Button>}
                        {can('barcode.print') && p.barcode && <Button size="icon" variant="ghost" onClick={() => setLabels({ ids: [p._id], title: p.name })} aria-label={tr('Print barcode for {name}', { name: p.name })}><Printer /></Button>}
                        {can('product.view', 'stock.restock') && <Button size="icon" variant="ghost" onClick={() => setHistory(p)} aria-label={tr('History of {name}', { name: p.name })}><History /></Button>}
                        {can('product.update') && <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, edit: p })} aria-label={tr('Edit {name}', { name: p.name })}><Pencil /></Button>}
                        {can('product.delete') && <Button size="icon" variant="ghost" onClick={() => setDel(p)} aria-label={tr('Delete {name}', { name: p.name })}><Trash2 className="text-danger" /></Button>}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </Card>

      <ProductDetails
        product={detail}
        canSeeCost={canSeeCost}
        onClose={() => setDetail(null)}
        onEdit={can('product.update') ? (p) => { setDetail(null); setForm({ open: true, edit: p }); } : undefined}
        onStock={can('stock.restock') ? (p) => { setDetail(null); setStock(p); } : undefined}
        onHistory={can('product.view', 'stock.restock') ? (p) => { setDetail(null); setHistory(p); } : undefined}
      />
      <ProductForm open={form.open} edit={form.edit} canSeeCost={canSeeCost} onClose={() => setForm({ open: false })} />
      <StockDialog product={stock} canSeeCost={canSeeCost} onClose={() => setStock(null)} />
      <HistoryDialog product={history} onClose={() => setHistory(null)} />
      <LabelDialog target={labels} view={mode === 'in' ? { catId, subId, name: cat?.subs.find((s) => s._id === subId)?.name ?? cat?.name } : undefined} onClose={() => setLabels(null)} />
      <ConfirmNameDialog
        open={!!del} onOpenChange={(o) => !o && setDel(null)} name={del?.name ?? ''} title={tr('Delete “{name}”?', { name: del?.name })}
        description={tr('The product disappears from your shop and from selling. Sales already made stay in your records.')} loading={remove.isPending}
        onConfirm={(confirmName) => del && remove.mutate({ id: del._id, confirmName })}
      />
    </>
  );
}

/** One product's label, or every barcode in the shop (all, or just the category you are looking at). */
function LabelDialog({ target, view, onClose }: { target: LabelTarget; view?: { catId: string; subId: string; name?: string }; onClose: () => void }) {
  const [copies, setCopies] = useState('1');
  const [price, setPrice] = useState(true);
  const [inStock, setInStock] = useState(true);
  const [scope, setScope] = useState<'all' | 'view'>('all');
  const bulk = !!target && 'all' in target;
  const canView = !!view?.catId;
  useEffect(() => { if (target) setScope(canView ? 'view' : 'all'); }, [target, canView]);

  const print = useAct(
    async () => {
      const base = { copies: Math.max(1, parseInt(copies, 10) || 1), includePrice: price };
      const body = !target ? base
        : 'ids' in target ? { ...base, ids: target.ids }
        : scope === 'view' && view?.subId ? { ...base, subCategoryId: view.subId, inStockOnly: inStock }
        : scope === 'view' && view?.catId ? { ...base, categoryId: view.catId, inStockOnly: inStock }
        : { ...base, all: true, inStockOnly: inStock };
      const labels = await api<Row[]>('/products/barcodes', { method: 'POST', body });
      if (!labels.length) throw new Error('These products have no barcode');
      printLabels(labels as never, taka);
      return labels.length;
    },
    { ok: (n: number) => tr('{n} barcode labels ready to print', { n }), onOk: onClose },
  );
  return (
    <Modal
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={bulk ? tr('Print all barcodes') : tr('Print barcode labels')}
      description={bulk ? tr('Prints one label for every product that has a barcode.') : target && 'title' in target ? target.title : undefined}
      size="sm"
      footer={<><Button variant="outline" onClick={onClose}>{tr('Cancel')}</Button><Button loading={print.isPending} onClick={() => print.mutate(undefined, { onError: (e) => toast.error(errMsg(e)) })}><Printer />{tr('Print')}</Button></>}
    >
      <div className="space-y-3">
        {bulk && canView && (
          <fieldset className="space-y-2">
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', scope === 'view' && 'border-primary bg-primary/5')}>
              <input type="radio" name="scope" className="mt-0.5 accent-[rgb(var(--primary))]" checked={scope === 'view'} onChange={() => setScope('view')} />
              <span><b>{view?.name}</b><span className="block text-[13px] text-muted-foreground">{tr('Only the category you are looking at')}</span></span>
            </label>
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', scope === 'all' && 'border-primary bg-primary/5')}>
              <input type="radio" name="scope" className="mt-0.5 accent-[rgb(var(--primary))]" checked={scope === 'all'} onChange={() => setScope('all')} />
              <span><b>{tr('Everything')}</b><span className="block text-[13px] text-muted-foreground">{tr('Every product in the shop')}</span></span>
            </label>
          </fieldset>
        )}
        <Field label={tr('Copies of each label')}><Input value={copies} onChange={(e) => setCopies(e.target.value)} inputMode="numeric" className="max-w-28" /></Field>
        {bulk && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[rgb(var(--primary))]" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />{tr('Only products that are in stock')}</label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[rgb(var(--primary))]" checked={price} onChange={(e) => setPrice(e.target.checked)} />{tr('Show selling price on the label')}</label>
      </div>
    </Modal>
  );
}
