'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Input, Select, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAct } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fromPaisa, taka, toPaisa } from '@/lib/utils';
import { catName } from '@/lib/labels';
import { cleanImei, imeiClash, imeiState } from '@/lib/imei';
import { ImeiRows, ImeiSection } from './imei-fields';

const blank = {
  categoryId: '', subCategoryId: '', name: '', brand: '', model: '', description: '',
  salePrice: '', purchasePrice: '', pieces: '1', ownBarcode: true, boxes: '', piecesPerBox: '', loose: '',
  lowStockAlert: '', barcode: '', supplierName: '', supplierPhone: '', share: '',
  kind: 'mb', dataMB: '', minutes: '', cardPrice: '', validityDays: '', opStock: '',
  // warranty is ON by default for new products
  wOn: true, wKind: 'warranty', wValue: '1', wUnit: 'year', wClaims: '1', wNote: '',
  imei1: '', imei2: '', // phones only
};

/** One form for creating and editing. Only category + name are required; everything else is optional. */
export function ProductForm({ open, onClose, edit, canSeeCost }: { open: boolean; onClose: () => void; edit?: Row | null; canSeeCost: boolean }) {
  const [f, setF] = useState(blank);
  const [files, setFiles] = useState<File[]>([]);
  const [removeImages, setRemoveImages] = useState<string[]>([]);
  const set = (k: keyof typeof blank, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const input = (k: keyof typeof blank) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value) });

  const { data: tree = [] } = useQuery({ queryKey: ['categories', 'enabled-tree'], queryFn: () => api<Row[]>('/categories', { query: { tree: true, enabled: true } }), enabled: open });
  const cats = useMemo(() => tree.filter((c) => c.productType !== 'mfs'), [tree]);
  const cat = cats.find((c) => c._id === f.categoryId);
  const subs: Row[] = cat?.children ?? [];
  const sub = subs.find((s) => s._id === f.subCategoryId);
  const type: string | undefined = edit?.productType ?? cat?.productType;
  const hasBarcode = type === 'physical' || type === 'bulk' || type === 'supplier';

  // IMEI: for phones in the Mobile Phone category and in every sub category of it (Android, Button, iOS, or your own).
  // Recommended, never required. One phone = up to 2 IMEI numbers, each the full 15 digits or just the last 4.
  const { data: allTree = [] } = useQuery({ queryKey: ['categories', 'tree'], queryFn: () => api<Row[]>('/categories', { query: { tree: true } }), enabled: open });
  const allSubs = useMemo(() => allTree.flatMap((c) => (c.children ?? []) as Row[]), [allTree]);
  const isMobile = edit
    ? allTree.find((c) => c._id === edit.categoryId)?.systemKey === 'mobile' || allSubs.find((s) => s._id === edit.subCategoryId)?.systemKey === 'mobile' || !!(edit.imei1 || edit.imei2)
    : cat?.systemKey === 'mobile' || sub?.systemKey === 'mobile';
  const nPieces = Math.max(1, Math.min(200, parseInt(f.pieces, 10) || 1));
  const singleImei = !!isMobile && (!!edit || nPieces === 1);
  const perPhone = !!isMobile && !edit && nPieces > 1 && f.ownBarcode; // adding several phones: one IMEI pair for each
  const [rows, setRows] = useState<string[][]>([]);
  const setRow = (i: number, k: 0 | 1, v: string) => setRows((r) => { const next = [...r]; const row = [...(next[i] ?? ['', ''])]; row[k] = cleanImei(v); next[i] = row; return next; });

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setRemoveImages([]);
    setRows([]);
    if (!edit) return setF(blank);
    setF({
      ...blank,
      categoryId: edit.categoryId, subCategoryId: edit.subCategoryId ?? '', name: edit.name, brand: edit.brand ?? '', model: edit.model ?? '', description: edit.description ?? '',
      salePrice: fromPaisa(edit.salePrice), purchasePrice: fromPaisa(edit.purchasePrice), lowStockAlert: String(edit.lowStockAlert ?? ''), barcode: edit.barcode ?? '',
      piecesPerBox: edit.piecesPerBox ? String(edit.piecesPerBox) : '',
      supplierName: edit.supplier?.name ?? '', supplierPhone: edit.supplier?.phone ?? '', share: edit.supplier ? String(edit.supplier.supplierSharePct) : '',
      kind: edit.card?.kind ?? 'mb', dataMB: edit.card?.dataMB ? String(edit.card.dataMB) : '', minutes: edit.card?.minutes ? String(edit.card.minutes) : '',
      cardPrice: fromPaisa(edit.card?.cardPrice), validityDays: edit.card?.validityDays ? String(edit.card.validityDays) : '',
      wOn: !!edit.warranty?.enabled, wKind: edit.warranty?.kind ?? 'warranty', wValue: String(edit.warranty?.durationValue ?? 1), wUnit: edit.warranty?.durationUnit ?? 'year',
      wClaims: String(edit.warranty?.maxClaims ?? 1), wNote: edit.warranty?.note ?? '',
      imei1: edit.imei1 ?? '', imei2: edit.imei2 ?? '',
    });
  }, [open, edit]);

  // pick up the supplier split from the category or sub category when it changes
  useEffect(() => {
    if (edit || type !== 'supplier') return;
    const pct = sub?.profitShare?.supplierPct ?? cat?.profitShare?.supplierPct;
    setF((s) => ({ ...s, share: pct !== undefined ? String(pct) : s.share || '50', supplierName: sub?.supplier?.name ?? cat?.supplier?.name ?? s.supplierName, supplierPhone: sub?.supplier?.phone ?? cat?.supplier?.phone ?? s.supplierPhone }));
  }, [cat, sub, type, edit]);

  const save = useAct(
    () => {
      const body: Row = {
        name: f.name.trim(), brand: f.brand.trim() || undefined, model: f.model.trim() || undefined, description: f.description.trim() || undefined,
        salePrice: toPaisa(f.salePrice), purchasePrice: toPaisa(f.purchasePrice),
        lowStockAlert: f.lowStockAlert !== '' ? Math.max(0, parseInt(f.lowStockAlert, 10) || 0) : undefined,
        barcode: hasBarcode && f.barcode.trim() ? f.barcode.trim() : undefined,
      };
      if (type === 'supplier') {
        body.supplier = { name: f.supplierName.trim() || undefined, phone: f.supplierPhone.trim() || undefined };
        if (f.share !== '') body.supplierSharePct = Math.min(100, Math.max(0, Number(f.share) || 0));
      }
      if (type !== 'operator') {
        body.warranty = f.wOn
          ? { enabled: true, kind: f.wKind, durationValue: Math.max(1, parseInt(f.wValue, 10) || 1), durationUnit: f.wUnit, maxClaims: Math.max(1, parseInt(f.wClaims, 10) || 1), note: f.wNote.trim() || undefined }
          : { enabled: false };
      }
      if (type === 'operator') {
        body.card = { kind: f.kind, dataMB: Number(f.dataMB) || undefined, minutes: Number(f.minutes) || undefined, cardPrice: toPaisa(f.cardPrice), validityDays: parseInt(f.validityDays, 10) || undefined };
      }
      if (isMobile) {
        if (edit) { body.imei1 = f.imei1.trim() || null; body.imei2 = f.imei2.trim() || null; } // null clears it
        else if (nPieces === 1) { body.imei1 = f.imei1.trim() || undefined; body.imei2 = f.imei2.trim() || undefined; }
        else if (perPhone) {
          const list = Array.from({ length: nPieces }, (_, i) => ({ imei1: rows[i]?.[0]?.trim() || undefined, imei2: rows[i]?.[1]?.trim() || undefined }));
          if (list.some((r) => r.imei1 || r.imei2)) body.imeis = list;
        }
      }
      if (edit) {
        if (type === 'bulk' && f.piecesPerBox) body.piecesPerBox = parseInt(f.piecesPerBox, 10);
        return api(`/products/${edit._id}`, { method: 'PATCH', body: { ...body, removeImages: removeImages.length ? removeImages : undefined }, files: files.length ? files : undefined });
      }
      body.categoryId = f.categoryId;
      if (f.subCategoryId) body.subCategoryId = f.subCategoryId;
      if (type === 'operator') body.stock = parseInt(f.opStock, 10) || 0;
      else if (type === 'bulk') {
        const boxes = parseInt(f.boxes, 10);
        if (boxes) { body.boxes = boxes; body.piecesPerBox = parseInt(f.piecesPerBox, 10) || undefined; }
        body.stock = parseInt(f.loose, 10) || 0;
      } else {
        const n = Math.max(1, Math.min(200, parseInt(f.pieces, 10) || 1));
        if (n > 1 && f.ownBarcode) body.quantity = n;
        else body.stock = n;
      }
      return api('/products', { method: 'POST', body, files: type === 'operator' || !files.length ? undefined : files });
    },
    { ok: (r: any) => (edit ? tr('Product saved') : Array.isArray(r) ? tr('{n} products created', { n: r.length }) : tr('Product added')), keys: ['products', 'categories', 'dashboard', 'capital'], onOk: onClose },
  );

  const [warnPrice, setWarnPrice] = useState(false);
  const [warnImei, setWarnImei] = useState(0); // how many phones have no IMEI (0 = no warning)
  const [priceErr, setPriceErr] = useState(false);
  useEffect(() => { if (!open) { setWarnPrice(false); setWarnImei(0); setPriceErr(false); } }, [open]);

  const submit = (skip: { price?: boolean; imei?: boolean } = {}) => {
    setPriceErr(false);
    if (!edit && !f.categoryId) return toast.error(tr("Choose a category first"));
    if (!edit && type === 'operator' && !f.subCategoryId) return toast.error(tr("Choose the operator (Robi, Airtel…)"));
    if (!f.name.trim()) return toast.error(tr("Give the product a name"));
    // IMEI is optional, but what is typed must be 15 digits or the last 4 digits
    const phones: string[][] = singleImei ? [[f.imei1, f.imei2]] : perPhone && nPieces <= 30 ? Array.from({ length: nPieces }, (_, i) => [rows[i]?.[0] ?? '', rows[i]?.[1] ?? '']) : [];
    const typed = phones.flat().map((x) => x.trim()).filter(Boolean);
    if (typed.some((x) => imeiState(x) === 'partial')) return toast.error(tr("IMEI must be 15 digits, or just the last 4 digits"));
    // no number may repeat: not IMEI 1 vs IMEI 2, not phone vs phone (the same 4 digits, or 4 digits that end a full IMEI, count as the same)
    const all = phones.flatMap(([a, b], phone) => [a, b].map((x) => x.trim()).filter(Boolean).map((v) => ({ v, phone })));
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (imeiClash(all[i].v, all[j].v)) return toast.error(all[i].phone === all[j].phone ? tr("IMEI 1 and IMEI 2 must be different") : tr("The same IMEI number is entered twice"));
      }
    }
    if (!edit && type === 'bulk' && f.boxes && !f.piecesPerBox) return toast.error(tr("How many pieces are in each box?"));
    // buying price is required when adding: profit, capital and stock value all depend on it
    if (!edit && canSeeCost && !((toPaisa(f.purchasePrice) ?? 0) > 0)) {
      setPriceErr(true);
      return toast.error(tr("Add the buying price first"));
    }
    // IMEI is recommended: warn once if it is missing (when editing, only if an IMEI that was there has been removed)
    const missing = phones.filter(([a, b]) => !a.trim() && !b.trim()).length;
    if (!skip.imei && isMobile && missing > 0 && (!edit || !!(edit.imei1 || edit.imei2))) return setWarnImei(missing);
    // selling price can wait, but we ask once so it is not forgotten
    if (!skip.price && !((toPaisa(f.salePrice) ?? 0) > 0)) return setWarnPrice(true);
    save.mutate(undefined);
  };

  const existingImages: Row[] = edit?.images ?? [];
  const boxesTotal = (parseInt(f.boxes, 10) || 0) * (parseInt(f.piecesPerBox, 10) || 0) + (parseInt(f.loose, 10) || 0);
  const recharge = type === 'operator' && f.kind === 'recharge';

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={edit ? tr('Edit {name}', { name: edit.name }) : tr("Add product")}
      description={edit ? tr("Stock is changed with Add stock, so the history stays correct.") : tr("Only the category and the name are needed. Fill the rest if you have it.")}
      footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={save.isPending} onClick={() => submit()}>{edit ? tr("Save changes") : tr("Add product")}</Button></>}
    >
      <div className="space-y-4">
        {!edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("Category")}>
              <Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value, subCategoryId: '' })}>
                <option value="">{tr("Choose…")}</option>
                {cats.map((c) => <option key={c._id} value={c._id}>{catName(c.name)}</option>)}
              </Select>
            </Field>
            <Field label={type === 'operator' ? tr("Operator") : tr("Sub category (optional)")}>
              <Select value={f.subCategoryId} onChange={(e) => set('subCategoryId', e.target.value)} disabled={!cat}>
                <option value="">{type === 'operator' ? tr("Choose…") : tr("None")}</option>
                {subs.map((s) => <option key={s._id} value={s._id}>{catName(s.name)}</option>)}
              </Select>
            </Field>
            {cat && cats.length > 0 && subs.length === 0 && type === 'operator' && <p className="text-sm text-warning sm:col-span-2">{tr("Turn on an operator in Categories first.")}</p>}
          </div>
        )}

        {(edit || type) && (
          <>
            <Field label={tr("Name")}><Input {...input('name')} placeholder={type === 'operator' ? tr("1.5GB 7 days") : tr("Oppo 33W Max Book charger")} /></Field>
            {type !== 'operator' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tr("Brand (optional)")}><Input {...input('brand')} /></Field>
                <Field label={tr("Model (optional)")}><Input {...input('model')} /></Field>
              </div>
            )}

            {type === 'operator' && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">{tr("Card details")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={tr("Kind")}><Select {...input('kind')}><option value="mb">{tr("Internet (MB / GB)")}</option><option value="minute">{tr("Minutes")}</option><option value="combo">{tr("Combo pack")}</option><option value="recharge">{tr("Recharge balance")}</option></Select></Field>
                  {f.kind !== 'recharge' && <Field label={tr("Card price (৳)")}><Input {...input('cardPrice')} inputMode="decimal" /></Field>}
                  {(f.kind === 'mb' || f.kind === 'combo') && <Field label={tr("Data (MB)")} hint={tr("1 GB = 1024 MB")}><Input {...input('dataMB')} inputMode="numeric" /></Field>}
                  {(f.kind === 'minute' || f.kind === 'combo') && <Field label={tr("Minutes")}><Input {...input('minutes')} inputMode="numeric" /></Field>}
                  {f.kind !== 'recharge' && <Field label={tr("Valid for (days)")}><Input {...input('validityDays')} inputMode="numeric" /></Field>}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {canSeeCost && (
                <Field label={`${recharge ? tr('Buy price per ৳1 (৳)') : tr('Buying price (৳)')}${edit ? '' : ' *'}`} hint={priceErr ? tr("Required. Enter what you paid for it.") : recharge ? tr("Example: 0.98") : undefined}>
                  <Input {...input('purchasePrice')} inputMode="decimal" aria-invalid={priceErr} className={priceErr ? 'border-danger ring-1 ring-danger' : ''} />
                </Field>
              )}
              <Field label={recharge ? tr("Sell price per ৳1 (৳)") : tr("Selling price (৳)")} hint={recharge ? tr("Example: 1") : undefined}><Input {...input('salePrice')} inputMode="decimal" /></Field>
              <Field label={tr("Low-stock warning at")}><Input {...input('lowStockAlert')} inputMode="numeric" placeholder={tr("Shop default")} /></Field>
            </div>

            {!edit && (type === 'physical' || type === 'supplier') && (
              <div className="space-y-2 rounded-lg border p-3">
                <Field label={tr("How many pieces are you adding?")}><Input {...input('pieces')} inputMode="numeric" className="max-w-32" /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[rgb(var(--primary))]" checked={f.ownBarcode} onChange={(e) => set('ownBarcode', e.target.checked)} />{tr("Give every piece its own barcode")}</label>
              </div>
            )}
            {singleImei && <ImeiSection imei1={f.imei1} imei2={f.imei2} onChange={(k, v) => set(k, v)} ignoreId={edit?._id} />}
            {perPhone && <ImeiRows count={nPieces} rows={rows} onChange={setRow} />}
            {!edit && type === 'bulk' && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={tr("Boxes")}><Input {...input('boxes')} inputMode="numeric" /></Field>
                  <Field label={tr("Pieces in each box")}><Input {...input('piecesPerBox')} inputMode="numeric" /></Field>
                  <Field label={tr("Loose pieces")}><Input {...input('loose')} inputMode="numeric" /></Field>
                </div>
                <p className="num text-[13px] text-muted-foreground">{tr("Stock added:")} {boxesTotal} {tr("pieces")}</p>
              </div>
            )}
            {edit && type === 'bulk' && <Field label={tr("Pieces in each box")}><Input {...input('piecesPerBox')} inputMode="numeric" className="max-w-32" /></Field>}
            {!edit && type === 'operator' && <Field label={recharge ? tr("Recharge balance in stock (taka)") : tr("Cards in stock")}><Input {...input('opStock')} inputMode="numeric" className="max-w-40" /></Field>}

            {type === 'supplier' && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">{tr("Supplier")}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={tr("Name")}><Input {...input('supplierName')} /></Field>
                  <Field label={tr("Phone")}><Input {...input('supplierPhone')} inputMode="tel" /></Field>
                  <Field label={tr("Supplier’s profit share (%)")}><Input {...input('share')} inputMode="decimal" /></Field>
                </div>
                <p className="text-[13px] text-muted-foreground">{tr("You keep")} {100 - (Number(f.share) || 0)}{tr("% of the profit on each sale. Example: sell at")} {taka(110000)}{tr(", bought at")} {taka(100000)} {tr("→ profit")} {taka(10000)}.</p>
              </div>
            )}

            {hasBarcode && <Field label={edit ? tr("Barcode") : tr("Own barcode (optional)")} hint={edit ? tr("You can change it. It must be different from other products.") : tr("Leave empty and we make one for you.")}><Input {...input('barcode')} /></Field>}
            <Field label={tr("Details (optional)")}><Textarea {...input('description')} rows={2} /></Field>

            {type !== 'operator' && (
              <div className={cn('rounded-lg border p-3', f.wOn && 'border-success/40 bg-success/5')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{tr("Warranty")}</p>
                    <p className="text-[13px] text-muted-foreground">{tr("Customers can come back for repair or replacement within this time.")}</p>
                  </div>
                  <Switch checked={f.wOn} onCheckedChange={(v) => set('wOn', v)} aria-label={tr("Warranty")} />
                </div>
                {f.wOn && (
                  <div className="mt-3 space-y-3">
                    <div role="group" aria-label={tr("Warranty or guarantee")} className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-1">
                      {(['warranty', 'guarantee'] as const).map((k) => (
                        <button key={k} type="button" aria-pressed={f.wKind === k} onClick={() => set('wKind', k)} className={cn('rounded-md py-2 text-sm font-medium', f.wKind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                          {k === 'warranty' ? tr("Warranty") : tr("Guarantee")}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label={tr("How long")}><Input {...input('wValue')} inputMode="numeric" /></Field>
                      <Field label={tr("Unit")}>
                        <Select {...input('wUnit')}><option value="day">{tr("days")}</option><option value="month">{tr("months")}</option><option value="year">{tr("years")}</option></Select>
                      </Field>
                      <Field label={tr("Accepted how many times")} hint={tr("1 = accepted one time")}><Input {...input('wClaims')} inputMode="numeric" /></Field>
                    </div>
                    <Field label={tr("Warranty note (optional)")}><Input {...input('wNote')} placeholder={tr("Example: Not valid for water damage")} /></Field>
                  </div>
                )}
              </div>
            )}

            {type !== 'operator' && (
              <Field label={tr("Pictures (optional)")}>
                {existingImages.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {existingImages.filter((i) => !removeImages.includes(i.publicId)).map((i) => (
                      <div key={i.publicId} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.url} alt="" className="size-16 rounded-md border object-cover" />
                        <button type="button" onClick={() => setRemoveImages((r) => [...r, i.publicId])} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-danger text-xs text-white" aria-label={tr("Remove picture")}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <Input type="file" accept="image/*" multiple className="h-auto py-2" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))} />
              </Field>
            )}
          </>
        )}
      </div>
      <Modal
        open={warnImei > 0}
        onOpenChange={(o) => !o && setWarnImei(0)}
        size="sm"
        title={tr("No IMEI added")}
        description={tr("Adding the IMEI is recommended. It helps you find this phone later for warranty and service.")}
        footer={
          <>
            <Button variant="outline" onClick={() => setWarnImei(0)}>{tr("Go back and add")}</Button>
            <Button loading={save.isPending} onClick={() => { setWarnImei(0); submit({ imei: true }); }}>{tr("Save without IMEI")}</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{warnImei > 1 ? tr("Phones without an IMEI: {n}", { n: warnImei }) : tr("This phone has no IMEI yet.")} {tr("You can add it any time from Products → Edit.")}</p>
      </Modal>
      <Modal
        open={warnPrice}
        onOpenChange={setWarnPrice}
        size="sm"
        title={tr("You are not adding a selling price")}
        description={tr("Without a selling price this product cannot be sold from the Sell page until you set one.")}
        footer={
          <>
            <Button variant="outline" onClick={() => setWarnPrice(false)}>{tr("Go back and add")}</Button>
            <Button loading={save.isPending} onClick={() => { setWarnPrice(false); submit({ price: true, imei: true }); }}>{tr("Save without price")}</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{tr("You can add it any time from Products → Edit.")}</p>
      </Modal>
    </Modal>
  );
}
