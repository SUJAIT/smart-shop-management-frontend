'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errMsg } from './api';

/** A button action: runs the request, shows a success / error toast, refreshes the listed queries. */
export function useAct<V, R = any>(
  fn: (v: V) => Promise<R>,
  o: { ok?: string | ((r: R) => string); keys?: string[]; onOk?: (r: R, v: V) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      if (o.ok) toast.success(typeof o.ok === 'function' ? o.ok(r) : o.ok);
      (o.keys ?? []).forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      o.onOk?.(r, v);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
