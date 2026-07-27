'use client';

import { euro } from '@/lib/format';
import type { Prodotto } from '@/lib/supabase/database.types';

export function GrigliaProdotti({
  prodotti,
  quantitaPerProdotto,
  onAggiungi,
}: {
  prodotti: Prodotto[];
  quantitaPerProdotto: Map<string, number>;
  onAggiungi: (prodotto: Prodotto) => void;
}) {
  if (prodotti.length === 0) {
    return (
      <p className="rounded-2xl border border-bordo bg-superficie px-4 py-8 text-center text-sm text-testo-debole">
        Nessun prodotto.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {prodotti.map((prodotto) => {
        const nelCarrello = quantitaPerProdotto.get(prodotto.id) ?? 0;
        return (
          <li key={prodotto.id}>
            <button
              type="button"
              onClick={() => onAggiungi(prodotto)}
              className="relative flex h-full w-full flex-col justify-between gap-3 rounded-2xl border border-bordo bg-superficie px-3 py-3 text-left transition active:scale-[0.97] active:bg-superficie-alta"
            >
              <span className="line-clamp-2 text-sm leading-snug font-medium">{prodotto.nome}</span>
              <span className="numeri text-lg font-semibold text-accento">
                {euro(prodotto.prezzo)}
              </span>

              {nelCarrello > 0 ? (
                <span className="numeri absolute -top-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full bg-accento text-sm font-bold text-fondo">
                  {nelCarrello}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
