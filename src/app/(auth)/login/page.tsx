'use client';
import { tr } from '@/lib/lang';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login, me, loading } = useAuth();
  const router = useRouter();
  const [identifier, setId] = useState('');
  const [password, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && me) router.replace('/');
  }, [me, loading, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const m = await login(identifier.trim(), password);
      router.replace(m.user.role === 'super_admin' || m.user.role === 'admin_staff' ? '/admin' : m.user.role === 'shop_owner' ? '/dashboard' : '/sell');
    } catch (err) {
      const msg = errMsg(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{tr("Log in")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr("Use the email or phone number you registered with.")}</p>
      </div>
      <Field label={tr("Email or phone")}>
        <Input value={identifier} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder={tr("01XXXXXXXXX or you@shop.com")} required autoFocus />
      </Field>
      <Field label={tr("Password")}>
        <Input type="password" value={password} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
      </Field>
      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy}>{tr("Log in")}</Button>
      <p className="text-center text-sm text-muted-foreground">
        {tr("New shop?")} <Link href="/register" className="font-medium text-primary hover:underline">{tr("Create an account")}</Link>
      </p>
    </form>
  );
}
