'use client';
import { tmap, tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { FolderTree, Pencil, Plus, Smartphone, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmNameDialog, EmptyState, Field, PageHeader, ProviderMark } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/hooks';
import { PRODUCT_TYPE_LABEL, SECTORS, SECTOR_LABEL, catName, sectorOf } from '@/lib/labels';
import type { Row } from '@/lib/types';

const TYPE_HELP: Record<string, string> = tmap({
  physical: 'Phones, chargers, batteries. Each piece is counted on its own and gets its own barcode.',
  bulk: 'Glass packets, cables, OTG. Bought by the box or pack and sold one by one.',
  supplier: 'Goods from a supplier. The profit is shared between you and the supplier.',
});

interface FormState { open: boolean; edit?: Row; parent?: Row }

export default function CategoriesPage() {
  const { can } = useAuth();
  const manage = can('category.manage');
  const { data: tree, isLoading } = useQuery({ queryKey: ['categories', 'tree'], queryFn: () => api<Row[]>('/categories', { query: { tree: true } }) });
  const [form, setForm] = useState<FormState>({ open: false });
  const [del, setDel] = useState<Row | null>(null);

  const toggle = useAct(({ id, isEnabled }: { id: string; isEnabled: boolean }) => api(`/categories/${id}/enabled`, { method: 'PATCH', body: { isEnabled } }), { keys: ['categories'] });
  const sectorSave = useAct(({ id, capitalSector }: { id: string; capitalSector: string }) => api(`/categories/${id}`, { method: 'PATCH', body: { capitalSector } }), { ok: tr("Saved"), keys: ['categories', 'capital', 'dashboard'] });
  const remove = useAct((v: { id: string; confirmName: string }) => api(`/categories/${v.id}`, { method: 'DELETE', body: { confirmName: v.confirmName } }), {
    ok: (r: Row) => tr('Deleted {c} categories and {p} products', { c: r.deletedCategories, p: r.deletedProducts }),
    keys: ['categories', 'products', 'dashboard'],
    onOk: () => setDel(null),
  });

  const mine = (tree ?? []).filter((c) => !c.isSystem);
  const mobile = (tree ?? []).find((c) => c.systemKey === 'mobile');
  const system = (tree ?? []).filter((c) => c.isSystem && c.systemKey !== 'mobile');

  return (
    <>
      <PageHeader
        title={tr("Categories")}
        description={tr("Make a category first, then sub categories, then add products inside them. Example: Charger → Phone charger.")}
        actions={manage && <Button onClick={() => setForm({ open: true })}><Plus />{tr("New category")}</Button>}
      />

      {isLoading ? <Skeleton className="h-40" /> : (
        <div className="space-y-6">
          {mobile && (
            <section>
              <Card>
                <CardHeader>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Smartphone className="size-5" /></span>
                    <div className="min-w-0">
                      <CardTitle>{tr("Mobile Phone")}</CardTitle>
                      <p className="mt-1 text-[13px] text-muted-foreground">{tr("Phones with IMEI numbers. Turn it on to start adding phones.")}</p>
                    </div>
                  </div>
                  <Switch checked={mobile.isEnabled} disabled={!manage || toggle.isPending} onCheckedChange={(v) => toggle.mutate({ id: mobile._id, isEnabled: v })} aria-label={tr("Mobile Phone on or off")} />
                </CardHeader>
                <CardContent className="space-y-3">
                  {!mobile.isEnabled && <p className="rounded-md bg-muted p-3 text-sm">{tr("Mobile Phone is off. Turn it on to add phones.")}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <label htmlFor="mobile-sector" className="text-muted-foreground">{tr("Capital sector")}</label>
                    <Select id="mobile-sector" className="w-auto min-w-44" value={sectorOf(mobile)} disabled={!manage || sectorSave.isPending} onChange={(e) => sectorSave.mutate({ id: mobile._id, capitalSector: e.target.value })}>
                      {SECTORS.map((k) => <option key={k} value={k}>{SECTOR_LABEL[k]}</option>)}
                    </Select>
                  </div>
                  <ul className="divide-y rounded-md border">
                    {(mobile.children as Row[]).map((s) => (
                      <li key={s._id} className="flex items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{catName(s.name)}{s.isSystem && <Badge className="ml-2">{tr("Ready-made")}</Badge>}</span>
                        {manage && !s.isSystem && (
                          <span className="flex shrink-0">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => setForm({ open: true, edit: s, parent: mobile })} aria-label={tr('Edit {name}', { name: s.name })}><Pencil /></Button>
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => setDel(s)} aria-label={tr('Delete {name}', { name: s.name })}><Trash2 className="text-danger" /></Button>
                          </span>
                        )}
                        <Switch checked={s.isEnabled} disabled={!manage || toggle.isPending} onCheckedChange={(v) => toggle.mutate({ id: s._id, isEnabled: v })} aria-label={tr('{name} on or off', { name: catName(s.name) })} />
                      </li>
                    ))}
                  </ul>
                  <p className="text-[13px] text-muted-foreground">{tr("Do not sell Android phones? Turn that one off, and add your own by brand, like Oppo or Vivo.")}</p>
                  {manage && <Button size="sm" variant="outline" onClick={() => setForm({ open: true, parent: mobile })}><Plus />{tr("Add sub category")}</Button>}
                </CardContent>
              </Card>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{tr("Your categories")}</h2>
            {mine.length === 0 ? (
              <Card><EmptyState icon={<FolderTree />} title={tr("No categories yet")} hint={tr("Start with something like Charger, Phone, Cable or Cover.")} action={manage && <Button onClick={() => setForm({ open: true })}><Plus />{tr("Create your first category")}</Button>} /></Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {mine.map((c) => (
                  <Card key={c._id}>
                    <CardHeader>
                      <div className="min-w-0">
                        <CardTitle className="flex flex-wrap items-center gap-2">{c.name}<Badge tone="primary">{PRODUCT_TYPE_LABEL[c.productType]}</Badge><Badge>{SECTOR_LABEL[sectorOf(c)]}</Badge></CardTitle>
                        {c.productType === 'supplier' && <p className="num mt-1 text-[13px] text-muted-foreground">{tr("You keep")} {c.profitShare?.shopPct ?? 50}{tr("% · Supplier")} {c.profitShare?.supplierPct ?? 50}%{c.supplier?.name ? ` · ${c.supplier.name}` : ''}</p>}
                        {c.description && <p className="mt-1 text-[13px] text-muted-foreground">{c.description}</p>}
                      </div>
                      {manage && (
                        <div className="flex shrink-0 gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, edit: c })} aria-label={tr('Edit {name}', { name: c.name })}><Pencil /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDel(c)} aria-label={tr('Delete {name}', { name: c.name })}><Trash2 className="text-danger" /></Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ul className="divide-y rounded-md border">
                        {(c.children as Row[]).length === 0 && <li className="px-3 py-2.5 text-sm text-muted-foreground">{tr("No sub categories")}</li>}
                        {(c.children as Row[]).map((s) => (
                          <li key={s._id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span className="min-w-0 truncate">{s.name}{s.supplier?.name && <span className="text-muted-foreground"> · {s.supplier.name}</span>}{s.capitalSector && s.capitalSector !== sectorOf(c) && <Badge className="ml-2">{SECTOR_LABEL[s.capitalSector]}</Badge>}</span>
                            {manage && (
                              <span className="flex shrink-0">
                                <Button size="icon" variant="ghost" className="size-8" onClick={() => setForm({ open: true, edit: s, parent: c })} aria-label={tr('Edit {name}', { name: s.name })}><Pencil /></Button>
                                <Button size="icon" variant="ghost" className="size-8" onClick={() => setDel(s)} aria-label={tr('Delete {name}', { name: s.name })}><Trash2 className="text-danger" /></Button>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {manage && <Button size="sm" variant="outline" className="mt-3" onClick={() => setForm({ open: true, parent: c })}><Plus />{tr("Add sub category")}</Button>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold text-muted-foreground">{tr("MFS and mobile operators")}</h2>
            <p className="mb-2 text-[13px] text-muted-foreground">{tr("These are ready-made. Turn on the ones your shop uses.")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {system.map((c) => (
                <Card key={c._id}>
                  <CardHeader><CardTitle>{c.name === 'MFS' ? tr("Mobile banking (MFS)") : tr("Mobile operators")}</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {(c.children as Row[]).map((s) => (
                        <li key={s._id} className="flex items-center gap-3 py-2.5">
                          <ProviderMark k={s.logoKey} name={s.name} />
                          <span className="flex-1 text-sm font-medium">{s.name}</span>
                          <Switch checked={s.isEnabled} disabled={!manage || toggle.isPending} onCheckedChange={(v) => toggle.mutate({ id: s._id, isEnabled: v })} aria-label={tr('{name} on or off', { name: s.name })} />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}

      <CategoryForm state={form} onClose={() => setForm({ open: false })} />
      <ConfirmNameDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        name={del?.name ?? ''}
        title={tr('Delete “{name}”?', { name: del?.name })}
        description={del?.parentId ? tr("All products in this sub category are deleted too.") : tr("All sub categories and all products inside are deleted too. This cannot be undone from the app.")}
        loading={remove.isPending}
        onConfirm={(confirmName) => del && remove.mutate({ id: del._id, confirmName })}
      />
    </>
  );
}

function CategoryForm({ state, onClose }: { state: FormState; onClose: () => void }) {
  const { edit, parent } = state;
  const isSub = !!parent;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'physical' | 'bulk' | 'supplier'>('physical');
  const [share, setShare] = useState('50');
  const [sup, setSup] = useState({ name: '', phone: '', address: '' });
  const [file, setFile] = useState<File | null>(null);
  const [applyAll, setApplyAll] = useState(false);
  const [sector, setSector] = useState(''); // capital sector; empty on a sub category = same as the parent
  const [sectorTouched, setSectorTouched] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    setName(edit?.name ?? '');
    setDescription(edit?.description ?? '');
    setType(edit?.productType ?? 'physical');
    setShare(String(edit?.profitShare?.supplierPct ?? parent?.profitShare?.supplierPct ?? 50));
    setSup({ name: edit?.supplier?.name ?? '', phone: edit?.supplier?.phone ?? '', address: edit?.supplier?.address ?? '' });
    setFile(null);
    setApplyAll(false);
    setSectorTouched(false);
    setSector(edit ? (edit.capitalSector ?? (parent ? '' : sectorOf(edit))) : parent ? '' : 'physical');
  }, [state.open, edit, parent]);

  const effectiveType = isSub ? parent!.productType : type;
  const save = useAct(
    () => {
      const body: Row = { name: name.trim(), description: description.trim() || undefined };
      if (effectiveType === 'supplier') {
        body.supplier = { name: sup.name.trim() || undefined, phone: sup.phone.trim() || undefined, address: sup.address.trim() || undefined };
        body.supplierSharePct = Math.min(100, Math.max(0, Number(share) || 0));
      }
      if (edit || !isSub) body.capitalSector = sector; // sub category: '' = same as the parent
      else if (sector) body.capitalSector = sector;
      const files = file ? [file] : undefined;
      if (edit) return api(`/categories/${edit._id}`, { method: 'PATCH', body: { ...body, applyToProducts: applyAll || undefined }, files, fileField: 'image' });
      if (isSub) body.parentId = parent!._id;
      else body.productType = type;
      return api('/categories', { method: 'POST', body, files, fileField: 'image' });
    },
    { ok: edit ? tr("Category saved") : tr("Category created"), keys: ['categories'], onOk: onClose },
  );

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      title={edit ? tr('Edit {name}', { name: edit.name }) : isSub ? tr('New sub category in {name}', { name: parent!.name }) : tr("New category")}
      footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate(undefined)}>{tr("Save")}</Button></>}
    >
      <div className="space-y-4">
        {!isSub && !edit && (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-[13px] font-medium">{tr("What kind of products go in it?")}</legend>
            {(['physical', 'bulk', 'supplier'] as const).map((t) => (
              <label key={t} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${type === t ? 'border-primary bg-primary/5' : ''}`}>
                <input type="radio" name="ptype" className="mt-1 accent-[rgb(var(--primary))]" checked={type === t} onChange={() => { setType(t); if (!sectorTouched) setSector(t); }} />
                <span><span className="block text-sm font-medium">{PRODUCT_TYPE_LABEL[t]}</span><span className="block text-[13px] text-muted-foreground">{TYPE_HELP[t]}</span></span>
              </label>
            ))}
          </fieldset>
        )}
        <Field label={isSub ? tr("Sub category name") : tr("Category name")}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isSub ? (parent?.systemKey === 'mobile' ? tr("Oppo") : tr("Phone charger")) : tr("Charger")} autoFocus /></Field>
        {isSub && parent?.systemKey === 'mobile' && <p className="-mt-2 text-[13px] text-muted-foreground">{tr("Phones added here get the IMEI option too.")}</p>}
        <Field label={tr("Capital sector")} hint={tr("The money worth of products in this category is counted in this sector of “Split your capital by sector”.")}>
          <Select value={sector} onChange={(e) => { setSector(e.target.value); setSectorTouched(true); }}>
            {isSub && <option value="">{tr('Same as {name} ({sector})', { name: parent!.name, sector: SECTOR_LABEL[sectorOf(parent)] })}</option>}
            {SECTORS.map((k) => <option key={k} value={k}>{SECTOR_LABEL[k]}</option>)}
          </Select>
        </Field>
        <Field label={tr("Note (optional)")}><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
        {effectiveType === 'supplier' && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">{tr("Supplier and profit split")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tr("Supplier name (optional)")}><Input value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} /></Field>
              <Field label={tr("Supplier phone (optional)")}><Input value={sup.phone} onChange={(e) => setSup({ ...sup, phone: e.target.value })} inputMode="tel" /></Field>
            </div>
            <Field label={tr("Supplier’s share of profit (%)")} hint={tr('You keep {pct}%. Example: a ৳1,000 phone sold for ৳1,100 has ৳100 profit; at 50% each of you gets ৳50.', { pct: 100 - (Number(share) || 0) })}>
              <Input value={share} onChange={(e) => setShare(e.target.value)} inputMode="decimal" className="max-w-32" />
            </Field>
            {edit && !edit.parentId && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="size-4 accent-[rgb(var(--primary))]" />{tr("Also change the split on products already added")}</label>
            )}
          </div>
        )}
        <Field label={tr("Picture (optional)")}><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-auto py-2" /></Field>
      </div>
    </Modal>
  );
}
