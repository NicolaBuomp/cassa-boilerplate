'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import Link from 'next/link';
import { SoloTitolare } from '../_components/solo-titolare';

const VOCI = [
  { href: '/catalogo', titolo: 'Catalogo', sottotitolo: 'Prodotti, prezzi, disponibilità' },
  { href: '/chiusura', titolo: 'Chiusura', sottotitolo: 'Chiudi la sessione di cassa' },
  { href: '/report', titolo: 'Report', sottotitolo: 'Venduto, andamento, cassieri' },
  { href: '/utenti', titolo: 'Utenti', sottotitolo: 'Ruoli e accessi' },
];

export default function AltroPage() {
  const { eTitolare, profilo, signOut } = useAuth();

  if (!eTitolare) return <SoloTitolare />;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="text-xl font-semibold">Altro</h1>

      <ul className="flex flex-col gap-2">
        {VOCI.map((voce) => (
          <li key={voce.href}>
            <Link
              href={voce.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-bordo bg-superficie px-4 py-4"
            >
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{voce.titolo}</span>
                <span className="text-xs text-testo-debole">{voce.sottotitolo}</span>
              </span>
              <span aria-hidden className="text-testo-debole">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-3 border-t border-bordo pt-6">
        <p className="text-sm text-testo-debole">
          {profilo?.nome} · {profilo?.ruolo === 'titolare' ? 'Titolare' : 'Cassiere'}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-12 rounded-xl border border-bordo font-medium"
        >
          Esci
        </button>
      </div>
    </div>
  );
}
