'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, Field, ListSkeleton, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/hooks';
import { STAFF_PERM_LABEL } from '@/lib/labels';
import type { Row } from '@/lib/types';

export default function StaffPage() {
  const { me } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'staff'], queryFn: () => api<Row[]>('/super-admin/staff'), enabled: me?.user.role === 'super_admin' });
  const [form, setForm] = useState<{ open: boolean; edit?: Row }>({ open: false });
  const del = useAct((id: string) => api(`/super-admin/staff/${id}`, { method: 'DELETE' }), { ok: tr("Staff removed"), keys: ['admin'] });
  const flip = useAct((v: { id: string; status: string }) => api(`/super-admin/staff/${v.id}`, { method: 'PATCH', body: { status: v.status } }), { ok: tr("Saved"), keys: ['admin'] });
  if (me?.user.role !== 'super_admin') return <EmptyState title={tr("Only the super admin manages staff")} />;
  return (
    <>
      <PageHeader title={tr("Staff")} description={tr("People who help you run the control room, with only the access you give.")} actions={<Button onClick={() => setForm({ open: true })}><Plus />{tr("Add staff")}</Button>} />
      <Card>
        {isLoading ? <ListSkeleton rows={3} /> : !data?.length ? <EmptyState title={tr("No staff yet")} /> : (
          <Table><THead><TR><TH>{tr("Name")}</TH><TH>{tr("Email")}</TH><TH>{tr("Access")}</TH><TH /></TR></THead>
            <TBody>{data.map((u) => (
              <TR key={u._id}><TD className="font-medium">{u.name}{u.status === 'blocked' && <Badge tone="danger" className="ml-2">{tr("Blocked")}</Badge>}</TD><TD className="text-muted-foreground">{u.email}</TD>
                <TD><div className="flex flex-wrap gap-1">{(u.permissions as string[]).map((p) => <Badge key={p}>{STAFF_PERM_LABEL[p] ?? p}</Badge>)}</div></TD>
                <TD><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label={tr("Edit")} onClick={() => setForm({ open: true, edit: u })}><Pencil /></Button><Button size="sm" variant="outline" onClick={() => flip.mutate({ id: u._id, status: u.status === 'active' ? 'blocked' : 'active' })}>{u.status === 'active' ? tr("Block") : tr("Unblock")}</Button><Button size="icon" variant="ghost" aria-label={tr("Delete")} onClick={() => confirm(tr('Remove {name}?', { name: u.name })) && del.mutate(u._id)}><Trash2 className="text-danger" /></Button></div></TD></TR>
            ))}</TBody></Table>
        )}
      </Card>
      <StaffForm state={form} onClose={() => setForm({ open: false })} />
    </>
  );
}

function StaffForm({ state, onClose }: { state: { open: boolean; edit?: Row }; onClose: () => void }) {
  const { edit } = state;
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (state.open) { setF({ name: edit?.name ?? '', email: edit?.email ?? '', phone: edit?.phone ?? '', password: '' }); setSel(edit?.permissions ?? []); } }, [state.open, edit]);
  const save = useAct(
    () => edit
      ? api(`/super-admin/staff/${edit._id}`, { method: 'PATCH', body: { name: f.name.trim(), permissions: sel, password: f.password || undefined } })
      : api('/super-admin/staff', { method: 'POST', body: { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || undefined, password: f.password, permissions: sel } }),
    { ok: tr("Staff saved"), keys: ['admin'], onOk: onClose },
  );
  return (
    <Modal open={state.open} onOpenChange={(o) => !o && onClose()} size="lg" title={edit ? tr('Edit {name}', { name: edit.name }) : tr("Add staff")} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={save.isPending} disabled={!f.name.trim() || (!edit && (!f.email || f.password.length < 8))} onClick={() => save.mutate(undefined)}>{tr("Save")}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("Name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          {!edit && <Field label={tr("Email")}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>}
          {!edit && <Field label={tr("Phone (optional)")}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>}
          <Field label={edit ? tr("New password (optional)") : tr("Password")}><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
        </div>
        <fieldset><legend className="mb-2 text-[13px] font-medium">{tr("Access")}</legend><div className="grid gap-2 sm:grid-cols-2">{Object.entries(STAFF_PERM_LABEL).map(([k, v]) => (
          <label key={k} className="flex items-center gap-2 rounded-md border p-2.5 text-sm"><input type="checkbox" className="size-4 accent-[rgb(var(--primary))]" checked={sel.includes(k)} onChange={() => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))} />{v}</label>
        ))}</div></fieldset>
      </div>
    </Modal>
  );
}
