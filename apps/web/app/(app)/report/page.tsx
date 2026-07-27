'use client';

import { euro, quantita as fmtQuantita } from '@/lib/format';
import {
  useIncassiPerGiorno,
  useRiepilogoCassieri,
  useVendutoPerProdotto,
  type Periodo,
} from '@/lib/hooks/use-report';
import { useAuth } from '@/lib/providers/auth-provider';
import { useMemo, useState } from 'react';
import { SoloTitolare } from '../_components/solo-titolare';

type Scheda = 'prodotti' | 'andamento' | 'cassieri';

function isoGiorno(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodoDaGiorni(giorni: number): Periodo {
  const a = new Date();
  const da = new Date();
  da.setDate(da.getDate() - (giorni - 1));
  return { da: isoGiorno(da), a: isoGiorno(a) };
}

const INTERVALLI = [
  { giorni: 1, etichetta: 'Oggi' },
  { giorni: 7, etichetta: '7 giorni' },
  { giorni: 30, etichetta: '30 giorni' },
  { giorni: 90, etichetta: '90 giorni' },
];

export default function ReportPage() {
  const { eTitolare } = useAuth();
  const [giorni, setGiorni] = useState(7);
  const [scheda, setScheda] = useState<Scheda>('prodotti');

  const periodo = useMemo(() => periodoDaGiorni(giorni), [giorni]);

  if (!eTitolare) return <SoloTitolare />;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <h1 className="text-xl font-semibold">Report</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {INTERVALLI.map((i) => (
          <button
            key={i.giorni}
            type="button"
            onClick={() => setGiorni(i.giorni)}
            aria-pressed={giorni === i.giorni}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap ${
              giorni === i.giorni
                ? 'border-accento bg-accento font-semibold text-fondo'
                : 'border-bordo text-testo-debole'
            }`}
          >
            {i.etichetta}
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl border border-bordo p-1">
        {(
          [
            ['prodotti', 'Prodotti'],
            ['andamento', 'Andamento'],
            ['cassieri', 'Cassieri'],
          ] as Array<[Scheda, string]>
        ).map(([valore, etichetta]) => (
          <button
            key={valore}
            type="button"
            onClick={() => setScheda(valore)}
            aria-pressed={scheda === valore}
            className={`min-h-11 flex-1 rounded-lg text-sm ${
              scheda === valore ? 'bg-superficie-alta font-semibold' : 'text-testo-debole'
            }`}
          >
            {etichetta}
          </button>
        ))}
      </div>

      {scheda === 'prodotti' ? <SchedaProdotti periodo={periodo} /> : null}
      {scheda === 'andamento' ? <SchedaAndamento periodo={periodo} /> : null}
      {scheda === 'cassieri' ? <SchedaCassieri periodo={periodo} /> : null}
    </div>
  );
}

function SchedaProdotti({ periodo }: { periodo: Periodo }) {
  const { data = [], isLoading } = useVendutoPerProdotto(periodo);
  const [perQuantita, setPerQuantita] = useState(false);

  const righe = useMemo(
    () => [...data].sort((a, b) => (perQuantita ? b.quantita - a.quantita : b.incasso - a.incasso)),
    [data, perQuantita],
  );
  const massimo = righe[0] ? (perQuantita ? righe[0].quantita : righe[0].incasso) : 0;

  if (isLoading) return <Caricamento />;
  if (righe.length === 0) return <Vuoto />;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setPerQuantita(!perQuantita)}
        className="self-end text-xs text-testo-debole underline"
      >
        Ordina per {perQuantita ? 'incasso' : 'quantità'}
      </button>

      <ul className="flex flex-col gap-1.5">
        {righe.map((riga) => {
          const valore = perQuantita ? riga.quantita : riga.incasso;
          const larghezza = massimo > 0 ? Math.max((valore / massimo) * 100, 2) : 0;
          return (
            <li
              key={riga.nome}
              className="relative overflow-hidden rounded-xl border border-bordo bg-superficie"
            >
              {/* La barra è di fondo: si legge il rapporto senza leggere i numeri. */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 bg-accento/15"
                style={{ width: `${larghezza}%` }}
              />
              <div className="relative flex items-baseline justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0 truncate text-sm">{riga.nome}</span>
                <span className="numeri shrink-0 text-sm">
                  <span className="font-semibold">{fmtQuantita(riga.quantita)}</span>
                  <span className="text-testo-debole"> · {euro(riga.incasso)}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SchedaAndamento({ periodo }: { periodo: Periodo }) {
  const { data = [], isLoading } = useIncassiPerGiorno(periodo);

  const perGiorno = useMemo(() => {
    const mappa = new Map<string, number>();
    for (const riga of data) {
      mappa.set(riga.giorno, (mappa.get(riga.giorno) ?? 0) + Number(riga.incasso));
    }
    return [...mappa.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const perOra = useMemo(() => {
    const mappa = new Map<number, number>();
    for (const riga of data) {
      mappa.set(riga.ora, (mappa.get(riga.ora) ?? 0) + Number(riga.incasso));
    }
    return [...mappa.entries()].sort(([a], [b]) => a - b);
  }, [data]);

  if (isLoading) return <Caricamento />;
  if (perGiorno.length === 0) return <Vuoto />;

  const maxGiorno = Math.max(...perGiorno.map(([, v]) => v));
  const maxOra = Math.max(...perOra.map(([, v]) => v));

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-xs tracking-wide text-testo-debole uppercase">Per giorno</h2>
        <ul className="flex flex-col gap-1">
          {perGiorno.map(([giorno, valore]) => (
            <li key={giorno} className="flex items-center gap-2">
              <span className="numeri w-14 shrink-0 text-xs text-testo-debole">
                {giorno.slice(8)}/{giorno.slice(5, 7)}
              </span>
              <span className="h-6 flex-1 overflow-hidden rounded bg-superficie">
                <span
                  className="block h-full rounded bg-accento"
                  style={{ width: `${Math.max((valore / maxGiorno) * 100, 1)}%` }}
                />
              </span>
              <span className="numeri w-20 shrink-0 text-right text-xs">{euro(valore)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs tracking-wide text-testo-debole uppercase">Per fascia oraria</h2>
        <ul className="flex flex-col gap-1">
          {perOra.map(([ora, valore]) => (
            <li key={ora} className="flex items-center gap-2">
              <span className="numeri w-14 shrink-0 text-xs text-testo-debole">
                {String(ora).padStart(2, '0')}:00
              </span>
              <span className="h-6 flex-1 overflow-hidden rounded bg-superficie">
                <span
                  className="block h-full rounded bg-positivo"
                  style={{ width: `${Math.max((valore / maxOra) * 100, 1)}%` }}
                />
              </span>
              <span className="numeri w-20 shrink-0 text-right text-xs">{euro(valore)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SchedaCassieri({ periodo }: { periodo: Periodo }) {
  const { data = [], isLoading } = useRiepilogoCassieri(periodo);

  if (isLoading) return <Caricamento />;
  if (data.length === 0) return <Vuoto />;

  return (
    <ul className="flex flex-col gap-1.5">
      {data.map((riga) => (
        <li
          key={riga.nome}
          className="flex items-center justify-between gap-3 rounded-xl border border-bordo bg-superficie px-3 py-3"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{riga.nome}</span>
            <span className="numeri text-xs text-testo-debole">
              {riga.pagate} incassate · {riga.battute} battute
              {riga.annullate > 0 ? ` · ${riga.annullate} annullate` : ''}
            </span>
          </span>
          <span className="numeri shrink-0 font-semibold">{euro(riga.incasso)}</span>
        </li>
      ))}
    </ul>
  );
}

const Caricamento = () => (
  <p className="py-12 text-center text-sm text-testo-debole">Carico…</p>
);

const Vuoto = () => (
  <p className="rounded-2xl border border-bordo bg-superficie px-4 py-10 text-center text-sm text-testo-debole">
    Nessun dato in questo periodo.
  </p>
);
