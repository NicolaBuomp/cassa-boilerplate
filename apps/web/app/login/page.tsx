'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);

    const { error } = await signIn(email.trim(), password);

    if (error) {
      setErrore('Email o password non corretti');
      setInCorso(false);
      return;
    }
    router.replace('/cassa');
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Roxy</h1>
        <p className="mt-1 text-sm text-testo-debole">Cassa</p>

        <form onSubmit={invia} className="mt-10 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-testo-debole">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 rounded-xl border border-bordo bg-superficie px-4 outline-none focus:border-accento"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-testo-debole">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-12 rounded-xl border border-bordo bg-superficie px-4 outline-none focus:border-accento"
            />
          </label>

          {errore ? (
            <p role="alert" className="text-sm text-attenzione">
              {errore}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={inCorso}
            className="mt-2 min-h-12 rounded-xl bg-accento font-semibold text-fondo disabled:opacity-50"
          >
            {inCorso ? 'Accesso…' : 'Entra'}
          </button>
        </form>
      </div>
    </main>
  );
}
