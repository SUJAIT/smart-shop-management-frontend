'use client';
import { tr } from '@/lib/lang';
import { useState } from 'react';
import { Field } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAct } from '@/lib/hooks';

export function AlertDialog({ open, shopId, onClose }: { open: boolean; shopId: string; onClose: () => void }) {
  const [level, setLevel] = useState('simple');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [billing, setBilling] = useState(false);
  const s = useAct(() => api('/super-admin/alerts', { method: 'POST', body: { shopId, level, title: title.trim(), message: message.trim(), tag: billing ? 'billing' : undefined } }), {
    ok: tr("Alert sent"), keys: ['admin'], onOk: () => { onClose(); setTitle(''); setMessage(''); },
  });
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={tr("Send alert")} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={s.isPending} disabled={title.trim().length < 2 || message.trim().length < 2} onClick={() => s.mutate(undefined)}>{tr("Send")}</Button></>}>
      <div className="space-y-3">
        <Field label={tr("Type")} hint={level === 'hard' ? tr("The shop can still look at data, but adding, editing and deleting stop until you resolve it or they pay.") : tr("Shown once as a pop-up.")}>
          <Select value={level} onChange={(e) => setLevel(e.target.value)}><option value="simple">{tr("Simple message")}</option><option value="hard">{tr("Hard alert (pause changes)")}</option></Select>
        </Field>
        <Field label={tr("Title")}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("Bill due")} /></Field>
        <Field label={tr("Message")}><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={tr("Please pay your monthly bill to keep using the app.")} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[rgb(var(--primary))]" checked={billing} onChange={(e) => setBilling(e.target.checked)} />{tr("This is a bill. Clear it automatically when they pay.")}</label>
      </div>
    </Modal>
  );
}
