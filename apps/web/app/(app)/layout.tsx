'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import { BottomNav } from './_components/bottom-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profilo, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-testo-debole">Caricamento…</div>
    );
  }

  // Un utente disattivato conserva la sessione ma non deve poter operare. È un
  // avviso, non una misura di sicurezza: quella è la RLS, che gli nega tutto.
  if (!profilo || !profilo.attivo) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-lg font-medium">Accesso non abilitato</p>
        <p className="text-sm text-testo-debole">
          Il tuo utente non è attivo. Chiedi al titolare di riattivarlo.
        </p>
        {/* Senza questo il telefono del banco resta bloccato su un account
            disattivato, e nessun altro può entrare a battere. */}
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 min-h-12 rounded-xl border border-bordo px-6 text-sm"
        >
          Esci
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">{children}</div>
      <BottomNav />
    </div>
  );
}
