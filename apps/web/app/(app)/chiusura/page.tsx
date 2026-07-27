'use client';

import { dataOra, euro } from '@/lib/format';
import { useChiusure } from '@/lib/hooks/use-report';
import { useChiudiCassa, useVenditeSessione } from '@/lib/hooks/use-vendite';
import { useAuth } from '@/lib/providers/auth-provider';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SoloTitolare } from '../_components/solo-titolare';

export default function ChiusuraPage() {
  const { eTitolare } = useAuth();
  const { data: vendite = [], isLoading } = useVenditeSessione();
  const { data: chiusure = [] } = useChiusure();
  const chiudi = useChiudiCassa();

  const [note, setNote] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [conferma, setConferma] = useState(false);

  const riepilogo = useMemo(() => {
    const pagate = vendite.filter((v) => v.stato === 'pagata');
    const sospese = vendite.filter((v) => v.stato === 'da_pagare');
    return {
      sospese,
      contanti: pagate
        .filter((v) => v.metodo_pagamento === 'contanti')
        .reduce((s, v) => s + Number(v.totale), 0),
      pos: pagate
        .filter((v) => v.metodo_pagamento === 'pos')
        .reduce((s, v) => s + Number(v.totale), 0),
      sconti: pagate.reduce((s, v) => s + Number(v.sconto), 0),
      pagate: pagate.length,
      annullate: vendite.filter((v) => v.stato === 'annullata').length,
    };
  }, [vendite]);

  if (!eTitolare) return <SoloTitolare />;

  const bloccata = riepilogo.sospese.length > 0;
  const totale = riepilogo.contanti + riepilogo.pos;

  async function esegui() {
    setErrore(null);
    try {
      await chiudi.mutateAsync(note.trim() || undefined);
      setNote('');
      setConferma(false);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Chiusura non riuscita');
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="text-xl font-semibold">Chiusura</h1>

      <p className="text-xs text-testo-debole">
        La chiusura conta solo ciò che è passato dall’app. Non è una quadratura di cassa: non
        chiede il fondo né il contante contato.
      </p>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-testo-debole">Carico…</p>
      ) : (
        <>
          <dl className="flex flex-col gap-px overflow-hidden rounded-2xl border border-bordo bg-bordo">
            <Voce etichetta="Contanti" valore={euro(riepilogo.contanti)} />
            <Voce etichetta="Carta / POS" valore={euro(riepilogo.pos)} />
            {riepilogo.sconti > 0 ? (
              <Voce etichetta="Sconti applicati" valore={`−${euro(riepilogo.sconti)}`} />
            ) : null}
            <Voce etichetta="Vendite incassate" valore={String(riepilogo.pagate)} />
            {riepilogo.annullate > 0 ? (
              <Voce etichetta="Annullate" valore={String(riepilogo.annullate)} />
            ) : null}
            <Voce etichetta="Totale" valore={euro(totale)} forte />
          </dl>

          {bloccata ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-accento bg-accento/10 px-4 py-4">
              <p className="font-medium">
                Non puoi chiudere: {riepilogo.sospese.length} vendite sono ancora da pagare.
              </p>
              <p className="numeri text-sm text-testo-debole">
                Numeri: {riepilogo.sospese.map((v) => v.numero).join(', ')}
              </p>
              <p className="text-sm text-testo-debole">
                Incassale, oppure annullale indicando il motivo.
              </p>
              <Link
                href="/da-incassare"
                className="mt-1 flex min-h-12 items-center justify-center rounded-xl bg-accento font-semibold text-fondo"
              >
                Vai a “Da incassare”
              </Link>
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-testo-debole">Note (facoltative)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-12 rounded-xl border border-bordo bg-superficie px-3 outline-none focus:border-accento"
                />
              </label>

              {errore ? (
                <p role="alert" className="text-sm text-attenzione">
                  {errore}
                </p>
              ) : null}

              {conferma ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-attenzione px-4 py-4">
                  <p className="text-sm">
                    La chiusura non si può riaprire, e la numerazione delle vendite riparte da 1.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConferma(false)}
                      className="min-h-12 flex-1 rounded-xl border border-bordo"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={esegui}
                      disabled={chiudi.isPending}
                      className="min-h-12 flex-1 rounded-xl bg-accento font-semibold text-fondo disabled:opacity-40"
                    >
                      {chiudi.isPending ? 'Chiudo…' : 'Chiudi'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConferma(true)}
                  disabled={vendite.length === 0}
                  className="min-h-14 rounded-xl bg-accento font-semibold text-fondo disabled:opacity-40"
                >
                  {vendite.length === 0 ? 'Nessuna vendita da chiudere' : 'Chiudi la cassa'}
                </button>
              )}
            </>
          )}
        </>
      )}

      {chiusure.length > 0 ? (
        <section className="mt-4 flex flex-col gap-2">
          <h2 className="text-sm tracking-wide text-testo-debole uppercase">Chiusure precedenti</h2>
          <ul className="flex flex-col gap-1.5">
            {chiusure.map((chiusura) => (
              <li
                key={chiusura.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-bordo bg-superficie px-3 py-2.5"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="numeri text-sm font-medium">#{chiusura.numero}</span>
                  <span className="text-xs text-testo-debole">
                    {dataOra(chiusura.chiusa_at)} · {chiusura.numero_vendite} vendite
                  </span>
                </span>
                <span className="numeri font-semibold">{euro(chiusura.totale)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Voce({
  etichetta,
  valore,
  forte = false,
}: {
  etichetta: string;
  valore: string;
  forte?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 bg-superficie px-4 py-3 ${
        forte ? 'font-semibold' : ''
      }`}
    >
      <dt className={forte ? '' : 'text-sm text-testo-debole'}>{etichetta}</dt>
      <dd className={`numeri ${forte ? 'text-xl' : ''}`}>{valore}</dd>
    </div>
  );
}
