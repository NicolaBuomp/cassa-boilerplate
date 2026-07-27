'use client';

import { dataOra, euro, quantita as fmtQuantita } from '@/lib/format';
import { useRistampaVendita, useStoricoVendite } from '@/lib/hooks/use-vendite';
import { useAuth } from '@/lib/providers/auth-provider';
import type { StatoVendita, Vendita } from '@/lib/supabase/database.types';
import { useMemo, useState } from 'react';
import { METODO_ETICHETTA, StatoVenditaBadge } from '../_components/stato-vendita';

const FILTRI: Array<{ valore: StatoVendita | 'tutte'; etichetta: string }> = [
  { valore: 'tutte', etichetta: 'Tutte' },
  { valore: 'da_pagare', etichetta: 'Da pagare' },
  { valore: 'pagata', etichetta: 'Pagate' },
  { valore: 'annullata', etichetta: 'Annullate' },
];

export default function VenditePage() {
  const { eTitolare } = useAuth();
  const { data: vendite = [], isLoading } = useStoricoVendite();
  const [filtro, setFiltro] = useState<StatoVendita | 'tutte'>('tutte');
  const [ricerca, setRicerca] = useState('');
  const [apertaId, setApertaId] = useState<string | null>(null);

  const visibili = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();
    return vendite.filter((v) => {
      if (filtro !== 'tutte' && v.stato !== filtro) return false;
      if (!termine) return true;
      if (String(v.numero) === termine) return true;
      return v.righe.some((r) => r.nome_prodotto.toLowerCase().includes(termine));
    });
  }, [vendite, filtro, ricerca]);

  const incassato = visibili
    .filter((v) => v.stato === 'pagata')
    .reduce((somma, v) => somma + Number(v.totale), 0);

  return (
    <div className="flex flex-col gap-3 pt-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{eTitolare ? 'Vendite' : 'Le mie vendite'}</h1>
        <span className="numeri text-sm text-testo-debole">{euro(incassato)}</span>
      </header>

      <input
        type="search"
        value={ricerca}
        onChange={(e) => setRicerca(e.target.value)}
        placeholder="Numero o prodotto"
        aria-label="Cerca per numero o prodotto"
        className="min-h-12 rounded-xl border border-bordo bg-superficie px-4 outline-none focus:border-accento"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTRI.map((f) => (
          <button
            key={f.valore}
            type="button"
            onClick={() => setFiltro(f.valore)}
            aria-pressed={filtro === f.valore}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap ${
              filtro === f.valore
                ? 'border-accento bg-accento font-semibold text-fondo'
                : 'border-bordo text-testo-debole'
            }`}
          >
            {f.etichetta}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-testo-debole">Carico…</p>
      ) : visibili.length === 0 ? (
        <p className="rounded-2xl border border-bordo bg-superficie px-4 py-10 text-center text-sm text-testo-debole">
          Nessuna vendita.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibili.map((vendita) => (
            <li key={vendita.id}>
              <SchedaVendita
                vendita={vendita}
                aperta={apertaId === vendita.id}
                onToggle={() => setApertaId(apertaId === vendita.id ? null : vendita.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SchedaVendita({
  vendita,
  aperta,
  onToggle,
}: {
  vendita: Vendita;
  aperta: boolean;
  onToggle: () => void;
}) {
  const ristampa = useRistampaVendita();

  return (
    <div className="rounded-2xl border border-bordo bg-superficie">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aperta}
        className="flex w-full items-center gap-3 px-3 py-3 text-left"
      >
        <span className="numeri flex size-11 shrink-0 items-center justify-center rounded-lg border border-bordo text-lg font-semibold">
          {vendita.numero}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <StatoVenditaBadge stato={vendita.stato} />
            {vendita.metodo_pagamento ? (
              <span className="text-xs text-testo-debole">
                {METODO_ETICHETTA[vendita.metodo_pagamento]}
              </span>
            ) : null}
          </span>
          <span className="text-xs text-testo-debole">
            {dataOra(vendita.created_at)} · {vendita.battuta_da_nome}
          </span>
        </span>

        <span className="numeri shrink-0 font-semibold">{euro(vendita.totale)}</span>
      </button>

      {aperta ? (
        <div className="border-t border-bordo px-3 py-3">
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

          {Number(vendita.sconto) > 0 ? (
            <p className="mt-2 flex justify-between text-sm text-accento">
              <span>Sconto{vendita.sconto_motivo ? ` · ${vendita.sconto_motivo}` : ''}</span>
              <span className="numeri">−{euro(vendita.sconto)}</span>
            </p>
          ) : null}

          {vendita.resto !== null ? (
            <p className="mt-2 flex justify-between text-sm text-testo-debole">
              <span>Ricevuto {euro(vendita.contante_ricevuto)} · resto</span>
              <span className="numeri">{euro(vendita.resto)}</span>
            </p>
          ) : null}

          {vendita.stato === 'annullata' ? (
            <p className="mt-2 text-sm text-attenzione">
              Annullata: {vendita.annullamento_motivo}
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-testo-debole">
              {vendita.stato_stampa === 'error'
                ? 'Stampa fallita'
                : vendita.stato_stampa === 'printed'
                  ? 'Stampato'
                  : 'Stampa in coda'}
            </span>
            <button
              type="button"
              onClick={() => ristampa.mutate(vendita.id)}
              disabled={ristampa.isPending}
              className="min-h-10 rounded-lg border border-bordo px-4 text-sm disabled:opacity-50"
            >
              {ristampa.isPending ? 'Invio…' : 'Ristampa'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
