'use client';

import { euro, ora } from '@/lib/format';
import { useVenditeRealtime, useVenditeSessione } from '@/lib/hooks/use-vendite';
import { useAuth } from '@/lib/providers/auth-provider';
import { useMemo } from 'react';
import { METODO_ETICHETTA, StatoVenditaBadge } from '../_components/stato-vendita';
import { SoloTitolare } from '../_components/solo-titolare';

export default function PlanciaPage() {
  const { eTitolare } = useAuth();
  const { data: vendite = [], isLoading } = useVenditeSessione();

  // La Plancia esiste per essere guardata mentre il locale gira: senza realtime
  // sarebbe una fotografia vecchia.
  useVenditeRealtime(eTitolare);

  const totali = useMemo(() => {
    const pagate = vendite.filter((v) => v.stato === 'pagata');
    return {
      daPagare: vendite.filter((v) => v.stato === 'da_pagare'),
      contanti: pagate
        .filter((v) => v.metodo_pagamento === 'contanti')
        .reduce((s, v) => s + Number(v.totale), 0),
      pos: pagate
        .filter((v) => v.metodo_pagamento === 'pos')
        .reduce((s, v) => s + Number(v.totale), 0),
      annullate: vendite.filter((v) => v.stato === 'annullata').length,
    };
  }, [vendite]);

  if (!eTitolare) return <SoloTitolare />;

  const sospeso = totali.daPagare.reduce((s, v) => s + Number(v.totale_righe), 0);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="text-xl font-semibold">Plancia</h1>

      <div className="grid grid-cols-2 gap-2">
        <Riquadro etichetta="Contanti" valore={euro(totali.contanti)} />
        <Riquadro etichetta="Carta" valore={euro(totali.pos)} />
        <Riquadro
          etichetta={`Da incassare (${totali.daPagare.length})`}
          valore={euro(sospeso)}
          evidenzia={totali.daPagare.length > 0}
        />
        <Riquadro etichetta="Totale incassato" valore={euro(totali.contanti + totali.pos)} />
      </div>

      {totali.annullate > 0 ? (
        <p className="text-xs text-testo-debole">
          {totali.annullate} vendite annullate in questa sessione.
        </p>
      ) : null}

      <h2 className="mt-2 text-sm tracking-wide text-testo-debole uppercase">
        Sessione aperta ({vendite.length})
      </h2>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-testo-debole">Carico…</p>
      ) : vendite.length === 0 ? (
        <p className="rounded-2xl border border-bordo bg-superficie px-4 py-10 text-center text-sm text-testo-debole">
          Nessuna vendita in questa sessione.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {vendite.map((vendita) => (
            <li
              key={vendita.id}
              className="flex items-center gap-3 rounded-xl border border-bordo bg-superficie px-3 py-2.5"
            >
              <span className="numeri w-9 shrink-0 text-lg font-semibold">{vendita.numero}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <StatoVenditaBadge stato={vendita.stato} />
                  {vendita.metodo_pagamento ? (
                    <span className="text-xs text-testo-debole">
                      {METODO_ETICHETTA[vendita.metodo_pagamento]}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-xs text-testo-debole">
                  {ora(vendita.created_at)} · {vendita.battuta_da_nome}
                </span>
              </span>
              <span className="numeri shrink-0 font-semibold">{euro(vendita.totale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Riquadro({
  etichetta,
  valore,
  evidenzia = false,
}: {
  etichetta: string;
  valore: string;
  evidenzia?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border px-3 py-3 ${
        evidenzia ? 'border-accento bg-accento/10' : 'border-bordo bg-superficie'
      }`}
    >
      <span className="text-xs text-testo-debole">{etichetta}</span>
      <span className="numeri text-xl font-semibold">{valore}</span>
    </div>
  );
}
