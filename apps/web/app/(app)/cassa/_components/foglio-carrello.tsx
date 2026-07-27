'use client';

import type { RigaCarrello } from '@/lib/cassa/carrello';
import { euro } from '@/lib/format';

export function FoglioCarrello({
  righe,
  totale,
  invioInCorso,
  puoBattere,
  errore,
  onCambiaQuantita,
  onRimuovi,
  onBatti,
  onChiudi,
}: {
  righe: RigaCarrello[];
  totale: number;
  invioInCorso: boolean;
  puoBattere: boolean;
  errore: string | null;
  onCambiaQuantita: (prodottoId: string, delta: number) => void;
  onRimuovi: (prodottoId: string) => void;
  onBatti: () => void;
  onChiudi: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Carrello"
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60"
    >
      {/* Tocco fuori = chiudi. Nessun contenuto, solo area di uscita. */}
      <button type="button" aria-label="Chiudi carrello" className="flex-1" onClick={onChiudi} />

      <div className="flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-bordo bg-superficie">
        <div className="flex items-center justify-between border-b border-bordo px-4 py-3">
          <h2 className="text-base font-semibold">Carrello</h2>
          <button type="button" onClick={onChiudi} className="text-sm text-testo-debole">
            Chiudi
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {righe.length === 0 ? (
            <p className="py-10 text-center text-sm text-testo-debole">Carrello vuoto.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {righe.map((riga) => (
                <li
                  key={riga.prodottoId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-bordo bg-superficie-alta px-3 py-2.5"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{riga.nome}</span>
                    <span className="numeri text-xs text-testo-debole">
                      {euro(riga.prezzo)} · {euro(riga.prezzo * riga.quantita)}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Togli un ${riga.nome}`}
                      onClick={() => onCambiaQuantita(riga.prodottoId, -1)}
                      className="size-10 rounded-lg border border-bordo text-xl leading-none active:scale-95"
                    >
                      −
                    </button>
                    <span className="numeri w-7 text-center font-semibold">{riga.quantita}</span>
                    <button
                      type="button"
                      aria-label={`Aggiungi un ${riga.nome}`}
                      onClick={() => onCambiaQuantita(riga.prodottoId, 1)}
                      className="size-10 rounded-lg border border-bordo text-xl leading-none active:scale-95"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => onRimuovi(riga.prodottoId)}
                      className="ml-1 px-1 text-xs text-attenzione"
                    >
                      Togli
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-bordo px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {errore ? (
            <p role="alert" className="text-sm text-attenzione">
              {errore}
            </p>
          ) : null}

          {/* Nessuna scelta di pagamento qui: la Vendita nasce da pagare (ADR 0002). */}
          <button
            type="button"
            onClick={onBatti}
            disabled={!puoBattere}
            className="flex min-h-14 items-center justify-between rounded-xl bg-accento px-4 text-base font-semibold text-fondo active:scale-[0.99] disabled:opacity-40"
          >
            <span>{invioInCorso ? 'Invio…' : 'Batti e stampa'}</span>
            <span className="numeri">{euro(totale)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
