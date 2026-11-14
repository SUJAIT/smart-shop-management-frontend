'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
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
import { EMPLOYEE_PERM_LABEL } from '@/lib/labels';
import type { Row } from '@/lib/types';
import { fmtDateTime } from '@/lib/utils';

export default function EmployeesPage() {
  const { isOwner } = useAuth();
  const { data: list, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => api<Row[]>('/employees'), enabled: isOwner });
  const { data: perms } = useQuery({ queryKey: ['employees', 'perms'], queryFn: () => api<{ all: string[]; default: string[] }>('/employees/permissions'), enabled: isOwner });
  const [form, setForm] = useState<{ open: boolean; edit?: Row }>({ open: false });
  const del = useAct((id: string) => api(`/employees/${id}`, { method: 'DELETE' }), { ok: tr("Employee removed"), keys: ['employees'] });
  const block = useAct((v: { id: string; status: string }) => api(`/employees/${v.id}`, { method: 'PATCH', body: { status: v.status } }), { ok: tr("Saved"), keys: ['employees'] });
  if (!isOwner) return <EmptyState title={tr("Only the owner manages employees")} />;

  return (
    <>
      <PageHeader title={tr("Employees")} description={tr("Employees can sell by default. Give them more only if you trust them with it.")} actions={<Button onClick={() => setForm({ open: true })}><Plus />{tr("Add employee")}</Button>} />
      <Card>
        {isLoading ? <ListSkeleton rows={3} /> : !list?.length ? <EmptyState icon={<Users />} title={tr("No employees yet")} hint={tr("Add someone to sell at your counter without showing them your profit.")} action={<Button onClick={() => setForm({ open: true })}>{tr("Add employee")}</Button>} /> : (
          <Table>
            <THead><TR><TH>{tr("Name")}</TH><TH>{tr("Login")}</TH><TH>{tr("Can do")}</TH><TH>{tr("Last login")}</TH><TH /></TR></THead>
            <TBody>{list.map((u) => (
              <TR key={u._id}>
                <TD className="font-medium">{u.name} {u.status === 'blocked' && <Badge tone="danger" className="ml-1">{tr("Blocked")}</Badge>}</TD>
                <TD className="text-muted-foreground">{u.phone || u.email}</TD>
                <TD className="max-w-xs"><div className="flex flex-wrap gap-1">{(u.permissions as string[]).map((p) => <Badge key={p}>{EMPLOYEE_PERM_LABEL[p] ?? p}</Badge>)}</div></TD>
                <TD className="whitespace-nowrap text-muted-foreground">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : tr("Never")}</TD>
                <TD><div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" aria-label={tr("Edit")} onClick={() => setForm({ open: true, edit: u })}><Pencil /></Button>
                  <Button size="sm" variant="outline" onClick={() => block.mutate({ id: u._id, status: u.status === 'active' ? 'blocked' : 'active' })}>{u.status === 'active' ? tr("Block") : tr("Unblock")}</Button>
                  <Button size="icon" variant="ghost" aria-label={tr("Delete")} onClick={() => confirm(tr('Remove {name}?', { name: u.name })) && del.mutate(u._id)}><Trash2 className="text-danger" /></Button>
                </div></TD>
              </TR>
            ))}</TBody>
          </Table>
        )}
      </Card>
      <EmployeeForm state={form} all={perms?.all ?? []} onClose={() => setForm({ open: false })} />
    </>
  );
}

function EmployeeForm({ state, all, onClose }: { state: { open: boolean; edit?: Row }; all: string[]; onClose: () => void }) {
  const { edit } = state;
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' });
  const [sel, setSel] = useState<string[]>(['sale.create']);
  useEffect(() => {
    if (!state.open) return;
    setF({ name: edit?.name ?? '', phone: edit?.phone ?? '', email: edit?.email ?? '', password: '' });
    setSel(edit?.permissions ?? ['sale.create']);
  }, [state.open, edit]);
  const save = useAct(
    () => {
      const body: Row = { name: f.name.trim(), permissions: sel, phone: f.phone.trim() || undefined };
      if (f.password) body.password = f.password;
      if (edit) return api(`/employees/${edit._id}`, { method: 'PATCH', body });
      return api('/employees', { method: 'POST', body: { ...body, email: f.email.trim() || undefined } });
    },
    { ok: edit ? tr("Employee saved") : tr("Employee added"), keys: ['employees'], onOk: onClose },
  );
  const toggle = (p: string) => p !== 'sale.create' && setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  return (
    <Modal open={state.open} onOpenChange={(o) => !o && onClose()} size="lg" title={edit ? tr('Edit {name}', { name: edit.name }) : tr("Add employee")} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={save.isPending} disabled={!f.name.trim() || (!edit && (f.password.length < 8 || (!f.phone && !f.email)))} onClick={() => save.mutate(undefined)}>{tr("Save")}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("Name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
          <Field label={tr("Mobile number")}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
          {!edit && <Field label={tr("Email (optional)")}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>}
          <Field label={edit ? tr("New password (leave empty to keep)") : tr("Password")} hint={tr("At least 8 characters")}><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">{tr("What this person can do")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {all.map((p) => (
              <label key={p} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-[rgb(var(--primary))]" checked={sel.includes(p)} disabled={p === 'sale.create'} onChange={() => toggle(p)} />
                <span>{EMPLOYEE_PERM_LABEL[p] ?? p}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tr("Employees never see the dashboard, capital or your profit.")}</p>
        </fieldset>
      </div>
    </Modal>
  );
}
