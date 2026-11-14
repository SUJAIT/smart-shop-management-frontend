/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { del, get, set } from 'idb-keyval';
import { api } from './api';
import type { Row } from './types';

/**
 * Offline mode: sales / MFS entries made without internet wait in IndexedDB and are sent to
 * POST /sync/push when the connection returns. Each op has a client-made UUID, so resending is always safe.
 */
export interface QueuedOp {
  clientId: string;
  entity: 'sale' | 'mfs_transaction' | 'product';
  createdAt: string;
  payload: Record<string, unknown>;
  label: string;
}

const EVT = 'offline-queue-changed';
const changed = () => typeof window !== 'undefined' && window.dispatchEvent(new Event(EVT));
export const onQueueChange = (fn: () => void) => {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
};

export const getQueue = async () => (await get<QueuedOp[]>('queue')) ?? [];
export const getFailed = async () => (await get<(QueuedOp & { error: string })[]>('failed')) ?? [];
export const clearFailed = async () => {
  await del('failed');
  changed();
};

export const enqueue = async (op: QueuedOp) => {
  await set('queue', [...(await getQueue()), op]);
  changed();
};

let flushing = false;
/** Sends everything waiting. Returns how many were saved. Never throws on network errors. */
export const flushQueue = async (): Promise<{ synced: number; failed: number }> => {
  if (flushing) return { synced: 0, failed: 0 };
  flushing = true;
  try {
    const queue = await getQueue();
    if (!queue.length) return { synced: 0, failed: 0 };
    const batch = queue.slice(0, 200);
    const r = await api<{ results: Row[] }>('/sync/push', {
      method: 'POST',
      body: { operations: batch.map(({ label: _l, ...op }) => op) },
    });
    const byId = new Map(r.results.map((x) => [x.clientId as string, x]));
    const failedOps = batch.filter((o) => byId.get(o.clientId)?.status === 'failed').map((o) => ({ ...o, error: byId.get(o.clientId)?.error?.message ?? 'Failed' }));
    const doneIds = new Set(batch.filter((o) => byId.get(o.clientId)?.status !== undefined).map((o) => o.clientId));
    await set('queue', queue.filter((o) => !doneIds.has(o.clientId)));
    if (failedOps.length) await set('failed', [...(await getFailed()), ...failedOps]);
    changed();
    return { synced: r.results.filter((x) => x.status !== 'failed').length, failed: failedOps.length };
  } catch {
    return { synced: 0, failed: 0 }; // still offline: try again later
  } finally {
    flushing = false;
  }
};

// ----- product cache so the sell screen works with no internet -----
export const cacheProducts = async () => {
  const r = await api<{ products: Row[]; serverTime: string }>('/sync/pull');
  await set('products', r.products.filter((p) => !p.isDeleted && p.isActive));
};
export const cachedProducts = async () => (await get<Row[]>('products')) ?? [];
export const findCachedByBarcode = async (code: string) => (await cachedProducts()).find((p) => p.barcode === code);
export const searchCached = async (q: string) => {
  const t = q.toLowerCase();
  return (await cachedProducts()).filter((p) => [p.name, p.model, p.brand, p.barcode].some((x) => String(x ?? '').toLowerCase().includes(t))).slice(0, 30);
};
