'use client';

import { calcolaResto, METODI, puoIncassare, scontoValido, totaleDaIncassare, type MetodoPagamento } from '@/lib/cassa/incasso';
import { euro, quantita as fmtQuantita } from '@/lib/format';
import type { Vendita } from '@/lib/supabase/database.types';
import { useState } from 'react';

const CONTANTI_RAPIDI = [5, 10, 20, 50];

export function FoglioIncasso({
  vendita,
  eTitolare,
  invioInCorso,
  onIncassa,
  onAnnulla,
  onChiudi,
}: {
  vendita: Vendita;
  eTitolare: boolean;
  invioInCorso: boolean;
  onIncassa: (input: {
    metodo: MetodoPagamento;
    contanteRicevuto?: number;
    sconto?: number;
    scontoMotivo?: string;
  }) => Promise<void>;
  onAnnulla: (motivo: string) => Promise<void>;
  onChiudi: () => void;
}) {
  const [metodo, setMetodo] = useState<MetodoPagamento>('contanti');
  const [contanteRicevuto, setContanteRicevuto] = useState<number | ''>('');
  const [sconto, setSconto] = useState<number | ''>('');
  const [scontoMotivo, setScontoMotivo] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [modoAnnulla, setModoAnnulla] = useState(false);
  const [motivoAnnulla, setMotivoAnnulla] = useState('');

  const totaleRighe = Number(vendita.totale_righe);
  const scontoNum = sconto === '' ? 0 : Number(sconto);
  const totale = totaleDaIncassare(totaleRighe, scontoNum);
  const resto = calcolaResto(metodo, contanteRicevuto, totale);
  const abilitato = puoIncassare(metodo, contanteRicevuto, totale, invioInCorso);

  async function incassa() {
    setErrore(null);

    const verifica = scontoValido(scontoNum, scontoMotivo, totaleRighe, eTitolare);
    if (!verifica.valido) {
      setErrore(verifica.errore);
      return;
    }

    try {
      await onIncassa({
        metodo,
        contanteRicevuto: contanteRicevuto === '' ? undefined : Number(contanteRicevuto),
        sconto: scontoNum > 0 ? scontoNum : undefined,
        scontoMotivo: scontoNum > 0 ? scontoMotivo.trim() : undefined,
      });
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Incasso non riuscito');
    }
  }

  async function annulla() {
    setErrore(null);
    if (motivoAnnulla.trim() === '') {
      setErrore('Indica il motivo dell’annullamento');
      return;
    }
    try {
      await onAnnulla(motivoAnnulla.trim());
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Annullamento non riuscito');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vendita numero ${vendita.numero}`}
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60"
    >
      <button type="button" aria-label="Chiudi" className="flex-1" onClick={onChiudi} />

      <div className="flex max-h-[92dvh] flex-col rounded-t-3xl border-t border-bordo bg-superficie">
        <div className="flex items-center justify-between border-b border-bordo px-4 py-3">
          <h2 className="flex items-baseline gap-2">
            <span className="text-sm text-testo-debole">Numero</span>
            <span className="numeri text-2xl font-bold text-accento">{vendita.numero}</span>
          </h2>
          <button type="button" onClick={onChiudi} className="text-sm text-testo-debole">
            Chiudi
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ul className="flex flex-col gap-1.5">
            {vendita.righe.map((riga) => (
              <li key={riga.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="numeri text-testo-debole">{fmtQuantita(riga.quantita)}×</span>{' '}
                  {riga.nome_prodotto}
                </span>
                <span className="numeri shrink-0 text-testo-debole">{euro(riga.totale_riga)}</span>
              </li>
            ))}
          </ul>

          {vendita.note ? (
            <p className="mt-3 text-sm text-testo-debole">Nota: {vendita.note}</p>
          ) : null}

          {eTitolare && !modoAnnulla ? (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-bordo px-3 py-3">
              <span className="text-xs tracking-wide text-testo-debole uppercase">
                Sconto (solo titolare)
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={sconto}
                  onChange={(e) => setSconto(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0,00"
                  aria-label="Importo dello sconto"
                  className="numeri w-28 min-h-11 rounded-lg border border-bordo bg-superficie-alta px-3 outline-none focus:border-accento"
                />
                <input
                  type="text"
                  value={scontoMotivo}
                  onChange={(e) => setScontoMotivo(e.target.value)}
                  placeholder="Motivo"
                  aria-label="Motivo dello sconto"
                  className="min-h-11 flex-1 rounded-lg border border-bordo bg-superficie-alta px-3 outline-none focus:border-accento"
                />
              </div>
            </div>
          ) : null}

          {modoAnnulla ? (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-attenzione px-3 py-3">
              <span className="text-xs tracking-wide text-attenzione uppercase">
                Annulla la vendita
              </span>
              <p className="text-xs text-testo-debole">
                La vendita resta registrata come annullata, con il motivo e chi l’ha annullata.
              </p>
              <input
                type="text"
                value={motivoAnnulla}
                onChange={(e) => setMotivoAnnulla(e.target.value)}
                placeholder="Motivo (obbligatorio)"
                aria-label="Motivo dell’annullamento"
                className="min-h-11 rounded-lg border border-bordo bg-superficie-alta px-3 outline-none focus:border-attenzione"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-bordo px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {errore ? (
            <p role="alert" className="text-sm text-attenzione">
              {errore}
            </p>
          ) : null}

          {modoAnnulla ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setModoAnnulla(false);
                  setErrore(null);
                }}
                className="min-h-14 flex-1 rounded-xl border border-bordo font-medium"
              >
                Indietro
              </button>
              <button
                type="button"
                onClick={annulla}
                disabled={invioInCorso}
                className="min-h-14 flex-1 rounded-xl bg-attenzione font-semibold text-fondo disabled:opacity-40"
              >
                {invioInCorso ? 'Annullo…' : 'Conferma annullo'}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {METODI.map((m) => (
                  <button
                    key={m.valore}
                    type="button"
                    onClick={() => setMetodo(m.valore)}
                    aria-pressed={metodo === m.valore}
                    className={`min-h-12 rounded-xl border text-sm font-semibold ${
                      metodo === m.valore
                        ? 'border-accento bg-accento text-fondo'
                        : 'border-bordo text-testo-debole'
                    }`}
                  >
                    {m.etichetta}
                  </button>
                ))}
              </div>

              {metodo === 'contanti' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {CONTANTI_RAPIDI.map((valore) => (
                      <button
                        key={valore}
                        type="button"
                        onClick={() => setContanteRicevuto(valore)}
                        className={`numeri min-h-11 flex-1 rounded-lg border text-sm ${
                          contanteRicevuto === valore
                            ? 'border-accento text-accento'
                            : 'border-bordo text-testo-debole'
                        }`}
                      >
                        {valore}€
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={contanteRicevuto}
                    onChange={(e) =>
                      setContanteRicevuto(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="Contante ricevuto"
                    aria-label="Contante ricevuto"
                    className="numeri min-h-12 rounded-lg border border-bordo bg-superficie-alta px-3 outline-none focus:border-accento"
                  />
                  {resto !== null && resto >= 0 ? (
                    <p className="flex items-baseline justify-between text-sm">
                      <span className="text-testo-debole">Resto</span>
                      <span className="numeri text-xl font-bold text-positivo">{euro(resto)}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={incassa}
                disabled={!abilitato}
                className="flex min-h-14 items-center justify-between rounded-xl bg-positivo px-4 text-base font-semibold text-fondo active:scale-[0.99] disabled:opacity-40"
              >
                <span>{invioInCorso ? 'Incasso…' : 'Incassa'}</span>
                <span className="numeri">{euro(totale)}</span>
              </button>

              {eTitolare ? (
                <button
                  type="button"
                  onClick={() => setModoAnnulla(true)}
                  className="min-h-11 text-sm text-attenzione"
                >
                  Annulla questa vendita
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
