'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { ChatThread } from '@/components/chat';
import { EmptyState, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { apiPaged } from '@/lib/api';
import { useSocketEvent } from '@/lib/auth';
import type { Row } from '@/lib/types';
import { cn, fmtDateTime, initials } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminChat() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<Row | null>(null);
  const { data } = useQuery({ queryKey: ['chat', 'conversations'], queryFn: () => apiPaged<Row>('/chat/admin/conversations', { limit: 100 }) });
  useSocketEvent('chat:message', () => void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] }));
  const convs = data?.data ?? [];
  return (
    <>
      <PageHeader title={tr("Chat")} description={tr("Every shop that has written to you, newest first.")} />
      <div className="grid h-[calc(100dvh-14rem)] min-h-[440px] gap-3 lg:grid-cols-[320px_1fr]">
        <div className={cn('overflow-y-auto rounded-lg border bg-card', sel && 'hidden lg:block')}>
          {convs.length === 0 ? <EmptyState icon={<MessageCircle />} title={tr("No chats yet")} /> : (
            <ul className="divide-y">{convs.map((c) => (
              <li key={c._id}><button onClick={() => setSel(c)} className={cn('flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50', sel?._id === c._id && 'bg-primary/5')}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">{initials(c.shopId?.name)}</span>
                <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="truncate text-sm font-medium">{c.shopId?.name}</span><span className="shrink-0 text-[11px] text-muted-foreground">{fmtDateTime(c.lastMessageAt)}</span></span><span className="block truncate text-[13px] text-muted-foreground">{c.lastMessage}</span></span>
                {c.unreadForAdmin > 0 && <span className="num grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{c.unreadForAdmin}</span>}
              </button></li>
            ))}</ul>
          )}
        </div>
        <div className={cn('flex min-h-0 flex-col', !sel && 'hidden lg:flex')}>
          {sel ? (<>
            <div className="mb-2 flex items-center gap-2 lg:hidden"><Button size="icon" variant="ghost" onClick={() => setSel(null)} aria-label={tr("Back")}><ArrowLeft /></Button><span className="font-medium">{sel.shopId?.name}</span></div>
            <ChatThread key={sel.shopId?._id} shopId={sel.shopId?._id} className="min-h-0 flex-1" />
          </>) : <div className="grid flex-1 place-items-center rounded-lg border bg-card text-sm text-muted-foreground">{tr("Pick a chat")}</div>}
        </div>
      </div>
    </>
  );
}
