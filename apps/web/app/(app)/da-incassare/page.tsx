'use client';

import { euro, ora } from '@/lib/format';
import {
  useAnnullaVendita,
  useIncassaVendita,
  useVenditeDaIncassare,
  useVenditeRealtime,
} from '@/lib/hooks/use-vendite';
import { useAuth } from '@/lib/providers/auth-provider';
import type { Vendita } from '@/lib/supabase/database.types';
import { useState } from 'react';
import { FoglioIncasso } from './_components/foglio-incasso';

export default function DaIncassarePage() {
  const { eTitolare } = useAuth();
  const { data: vendite = [], isLoading } = useVenditeDaIncassare();
  const incassa = useIncassaVendita();
  const annulla = useAnnullaVendita();
  const [apertaId, setApertaId] = useState<string | null>(null);

  useVenditeRealtime();

  const aperta = vendite.find((v) => v.id === apertaId) ?? null;
  const totaleSospeso = vendite.reduce((somma, v) => somma + Number(v.totale_righe), 0);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Da incassare</h1>
        {vendite.length > 0 ? (
          <span className="numeri text-sm text-testo-debole">
            {vendite.length} · {euro(totaleSospeso)}
          </span>
        ) : null}
      </header>

      {!eTitolare ? (
        <p className="text-xs text-testo-debole">
          Vedi solo le vendite che hai battuto tu.
        </p>
      ) : null}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-testo-debole">Carico…</p>
      ) : vendite.length === 0 ? (
        <p className="rounded-2xl border border-bordo bg-superficie px-4 py-10 text-center text-sm text-testo-debole">
          Non c’è niente da incassare.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {vendite.map((vendita) => (
            <li key={vendita.id}>
              <RigaSospeso vendita={vendita} onApri={() => setApertaId(vendita.id)} />
            </li>
          ))}
        </ul>
      )}

      {aperta ? (
        <FoglioIncasso
          vendita={aperta}
          eTitolare={eTitolare}
          invioInCorso={incassa.isPending || annulla.isPending}
          onIncassa={async (input) => {
            await incassa.mutateAsync({ venditaId: aperta.id, ...input });
            setApertaId(null);
          }}
          onAnnulla={async (motivo) => {
            await annulla.mutateAsync({ venditaId: aperta.id, motivo });
            setApertaId(null);
          }}
          onChiudi={() => setApertaId(null)}
        />
      ) : null}
    </div>
  );
}

function RigaSospeso({ vendita, onApri }: { vendita: Vendita; onApri: () => void }) {
  const riepilogo = vendita.righe
    .map((riga) => `${riga.quantita}× ${riga.nome_prodotto}`)
    .join(', ');

  return (
    <button
      type="button"
      onClick={onApri}
      className="flex w-full items-center gap-3 rounded-2xl border border-bordo bg-superficie px-3 py-3 text-left active:scale-[0.99] active:bg-superficie-alta"
    >
      <span className="numeri flex size-14 shrink-0 items-center justify-center rounded-xl bg-accento text-2xl font-bold text-fondo">
        {vendita.numero}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm">{riepilogo}</span>
        <span className="text-xs text-testo-debole">
          {ora(vendita.created_at)} · {vendita.battuta_da_nome}
          {vendita.stato_stampa === 'error' ? (
            <span className="text-attenzione"> · stampa fallita</span>
          ) : null}
        </span>
      </span>

      <span className="numeri shrink-0 text-lg font-semibold">{euro(vendita.totale_righe)}</span>
    </button>
  );
}
