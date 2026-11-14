'use client';
import { tr } from '@/lib/lang';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: '', shopName: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register({ ...f, name: f.name.trim(), shopName: f.shopName.trim(), email: f.email.trim() });
      toast.success(tr("Your shop is ready. Your free trial has started."));
      router.replace('/dashboard');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{tr("Open your shop")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr("Free trial included. No card needed.")}</p>
      </div>
      <Field label={tr("Your name")}><Input value={f.name} onChange={set('name')} required minLength={2} autoComplete="name" /></Field>
      <Field label={tr("Shop name")}><Input value={f.shopName} onChange={set('shopName')} required minLength={2} /></Field>
      <Field label={tr("Email")}><Input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></Field>
      <Field label={tr("Mobile number")} hint={tr("Bangladeshi number, like 01712345678")}><Input value={f.phone} onChange={set('phone')} required inputMode="tel" pattern="^(\+?88)?01[3-9]\d{8}$" autoComplete="tel" /></Field>
      <Field label={tr("Password")} hint={tr("At least 8 characters")}><Input type="password" value={f.password} onChange={set('password')} required minLength={8} autoComplete="new-password" /></Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>{tr("Create shop")}</Button>
      <p className="text-center text-sm text-muted-foreground">
        {tr("Already registered?")} <Link href="/login" className="font-medium text-primary hover:underline">{tr("Log in")}</Link>
      </p>
    </form>
  );
}
