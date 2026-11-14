'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, SOCKET_URL, api, getAccessToken, refreshSession, setAccessToken, setRefreshToken } from './api';
import type { Me } from './types';

interface AuthState {
  me: Me | null;
  loading: boolean;
  socket: Socket | null;
  isAdmin: boolean;
  isOwner: boolean;
  can: (...perms: string[]) => boolean;
  login: (identifier: string, password: string) => Promise<Me>;
  register: (b: { name: string; shopName: string; email: string; phone: string; password: string }) => Promise<Me>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

// the last known profile, so the shop can still open and sell when the internet or the server is down
const ME_KEY = 'me-cache-v1';
const readMe = (): Me | null => {
  try { return JSON.parse(localStorage.getItem(ME_KEY) ?? 'null'); } catch { return null; }
};
const writeMe = (m: Me | null) => {
  try { if (m) localStorage.setItem(ME_KEY, JSON.stringify(m)); else localStorage.removeItem(ME_KEY); } catch { /* ignore */ }
};
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const qc = useQueryClient();
  const sockRef = useRef<Socket | null>(null);

  const reload = useCallback(async () => {
    try {
      const m = await api<Me>('/auth/me');
      setMe(m);
      writeMe(m);
    } catch (e) {
      // only a real "not allowed" logs the user out; a slow or unreachable server must not
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setMe(null);
        writeMe(null);
      }
    }
  }, []);

  // restore the session when the page is opened or reloaded
  useEffect(() => {
    (async () => {
      const r = await refreshSession();
      if (r === 'ok') await reload();
      else if (r === 'offline') {
        const cached = readMe();
        if (cached) setMe(cached); // keep working offline; it reconnects by itself later
      } else writeMe(null);
      setLoading(false);
    })();
  }, [reload]);

  // back online after working offline: get a fresh access token
  useEffect(() => {
    const back = async () => {
      if (getAccessToken()) return;
      if ((await refreshSession()) === 'ok') await reload();
    };
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, [reload]);

  // keep the 1h access token fresh
  useEffect(() => {
    if (!me) return;
    const t = setInterval(() => void refreshSession(), 40 * 60 * 1000);
    return () => clearInterval(t);
  }, [me]);

  // usage meter heartbeat: counts the minutes a shop is really using the app
  useEffect(() => {
    if (!me?.user.shopId) return;
    const beat = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void api('/usage/heartbeat', { method: 'POST' }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, 60_000);
    return () => clearInterval(t);
  }, [me?.user.shopId]);

  // realtime connection (chat, alerts, block/restrict pushes)
  const userId = me?.user._id;
  useEffect(() => {
    if (!userId) return;
    const s = io(SOCKET_URL, { auth: (cb) => cb({ token: getAccessToken() }), withCredentials: true, transports: ['websocket', 'polling'] });
    sockRef.current = s;
    setSocket(s);
    const refresh = () => {
      void reload();
      void qc.invalidateQueries({ queryKey: ['alerts'] });
    };
    s.on('shop:status', refresh);
    s.on('alert:resolved', refresh);
    s.on('notification:new', () => {
      void qc.invalidateQueries({ queryKey: ['alerts'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => {
      s.disconnect();
      sockRef.current = null;
      setSocket(null);
    };
  }, [userId, reload, qc]);

  const login = useCallback(async (identifier: string, password: string) => {
    const r = await api<any>('/auth/login', { method: 'POST', body: { identifier, password }, noAuth: true });
    setAccessToken(r.accessToken);
    const next: Me = { user: r.user, shop: r.shop, subscription: r.subscription, restriction: r.restriction };
    setMe(next);
    writeMe(next);
    return next;
  }, []);

  const register = useCallback(async (b: Parameters<AuthState['register']>[0]) => {
    const r = await api<any>('/auth/register', { method: 'POST', body: b, noAuth: true });
    setAccessToken(r.accessToken);
    const next: Me = { user: r.user, shop: r.shop, subscription: r.subscription, restriction: null };
    setMe(next);
    writeMe(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setRefreshToken(null);
    writeMe(null);
    setMe(null);
    qc.clear();
  }, [qc]);

  const value = useMemo<AuthState>(() => {
    const role = me?.user.role;
    const isAdmin = role === 'super_admin' || role === 'admin_staff';
    const isOwner = role === 'shop_owner';
    return {
      me,
      loading,
      socket,
      isAdmin,
      isOwner,
      can: (...perms) => role === 'super_admin' || role === 'shop_owner' || perms.some((p) => me?.user.permissions.includes(p)),
      login,
      register,
      logout,
      reload,
    };
  }, [me, loading, socket, login, register, logout, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent<T = any>(event: string, handler: (payload: T) => void) {
  const { socket } = useAuth();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = (p: T) => ref.current(p);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}
