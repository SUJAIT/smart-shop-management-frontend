'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { tr } from '@/lib/lang';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Mic, Paperclip, Send, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiPaged, errMsg, API_URL, getAccessToken } from '@/lib/api';
import { useAuth, useSocketEvent } from '@/lib/auth';
import type { Row } from '@/lib/types';
import { cn, fmtDateTime } from '@/lib/utils';

/** Live chat between a shop and the super admin. Text, photos, files and voice notes; realtime over Socket.IO. */
export function ChatThread({ shopId, className }: { shopId?: string; className?: string }) {
  const { me, socket, isAdmin } = useAuth();
  const qc = useQueryClient();
  const base = isAdmin ? `/chat/admin/${shopId}` : '/chat';
  const key = ['chat', 'messages', shopId ?? 'mine'];
  const { data } = useQuery({ queryKey: key, queryFn: () => apiPaged<Row>(`${base}/messages`, { limit: 60 }), enabled: !isAdmin || !!shopId });
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const msgs = [...(data?.data ?? [])].reverse();

  const markRead = () => void api(isAdmin ? `/chat/admin/${shopId}/read` : '/chat/read', { method: 'PATCH' }).then(() => qc.invalidateQueries({ queryKey: ['chat'] })).catch(() => {});
  useEffect(() => { if (!isAdmin || shopId) markRead(); }, [shopId, data?.data.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  useSocketEvent<Row>('chat:message', (m) => {
    const sid = String(m.shopId);
    if (isAdmin ? sid !== shopId : false) return void qc.invalidateQueries({ queryKey: ['chat'] });
    qc.setQueryData(key, (old: any) => (old && !old.data.some((x: Row) => x._id === m._id) ? { ...old, data: [m, ...old.data] } : old));
    void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
  });
  useSocketEvent<Row>('chat:typing', (t) => {
    if (isAdmin && t.shopId !== shopId) return;
    setTyping(true);
    setTimeout(() => setTyping(false), 2500);
  });

  const send = async (payload: Row) => {
    setBusy(true);
    try {
      const m = await api<Row>(`${base}/messages`, { method: 'POST', body: payload });
      qc.setQueryData(key, (old: any) => (old && !old.data.some((x: Row) => x._id === m._id) ? { ...old, data: [m, ...old.data] } : old));
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const upload = async (file: Blob, name: string) => {
    const fd = new FormData();
    fd.append('file', file, name);
    const res = await fetch(`${API_URL}${isAdmin ? '/chat/admin' : '/chat'}/upload`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${getAccessToken()}` }, credentials: 'include' });
    const j = await res.json();
    if (!res.ok) throw new Error(j.message);
    return j.data as { kind: string; file: Row };
  };
  const sendFile = async (file: Blob, name: string, extra: Row = {}) => {
    setBusy(true);
    try {
      const up = await upload(file, name);
      await send({ kind: up.kind, file: { ...up.file, name, ...extra } });
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    void send({ kind: 'text', text: t });
  };
  const onType = (v: string) => {
    setText(v);
    if (socket && Date.now() - lastTyping.current > 1500) { lastTyping.current = Date.now(); socket.emit('chat:typing', { shopId }); }
  };

  const toggleRec = async () => {
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const started = Date.now();
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        void sendFile(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), 'voice-note.webm', { durationSec: Math.round((Date.now() - started) / 1000) });
      };
      mr.start();
      setRec(mr);
    } catch { toast.error(tr("Microphone permission was denied")); }
  };

  return (
    <div className={cn('flex flex-col rounded-lg border bg-card', className)}>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{tr("No messages yet. Say hello.")}</p>}
        {msgs.map((m) => {
          const mine = isAdmin ? m.senderRole === 'super_admin' || m.senderRole === 'admin_staff' : String(m.shopId) === String(me?.user.shopId) && m.senderRole !== 'super_admin' && m.senderRole !== 'admin_staff';
          return (
            <div key={m._id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted')}>
                {!mine && <p className="mb-0.5 text-xs font-medium opacity-70">{m.senderName}</p>}
                {m.kind === 'image' && m.file && /* eslint-disable-next-line @next/next/no-img-element */ <a href={m.file.url} target="_blank" rel="noreferrer"><img src={m.file.url} alt={tr("Photo")} className="mb-1 max-h-60 rounded-lg" /></a>}
                {m.kind === 'voice' && m.file && <audio controls src={m.file.url} className="h-10 max-w-full" />}
                {m.kind === 'file' && m.file && <a href={m.file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline"><FileText className="size-4" />{m.file.name ?? 'File'}</a>}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                <p className={cn('mt-0.5 text-[11px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{fmtDateTime(m.createdAt)}{mine && m.readAt ? tr(" · Seen") : ''}</p>
              </div>
            </div>
          );
        })}
        {typing && <p className="text-xs text-muted-foreground">{tr("typing…")}</p>}
        <div ref={bottom} />
      </div>
      <div className="flex items-center gap-2 border-t p-3">
        <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendFile(f, f.name); e.target.value = ''; }} />
        <Button size="icon" variant="ghost" aria-label={tr("Attach file")} onClick={() => fileRef.current?.click()} disabled={busy}><Paperclip /></Button>
        <Input value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()} placeholder={rec ? tr("Recording… tap the square to send") : tr("Write a message")} disabled={!!rec} />
        <Button size="icon" variant={rec ? 'danger' : 'ghost'} aria-label={rec ? tr("Stop and send voice note") : tr("Record voice note")} onClick={() => void toggleRec()}>{rec ? <Square /> : <Mic />}</Button>
        <Button size="icon" aria-label={tr("Send")} onClick={submit} disabled={!text.trim() || busy}><Send /></Button>
      </div>
    </div>
  );
}
