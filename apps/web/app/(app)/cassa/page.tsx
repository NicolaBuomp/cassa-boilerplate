'use client';

import {
  aggiungiRiga,
  cambiaQuantita,
  pezziCarrello,
  puoBattere as puoBattereCarrello,
  righePerRpc,
  rimuoviRiga,
  totaleCarrello,
  type RigaCarrello,
} from '@/lib/cassa/carrello';
import { euro } from '@/lib/format';
import { useCategorie, useProdotti } from '@/lib/hooks/use-catalogo';
import { useCreaVendita } from '@/lib/hooks/use-vendite';
import type { Prodotto } from '@/lib/supabase/database.types';
import { useMemo, useState } from 'react';
import { FoglioCarrello } from './_components/foglio-carrello';
import { GrigliaProdotti } from './_components/griglia-prodotti';
import { NumeroAssegnato } from './_components/numero-assegnato';

export default function CassaPage() {
  const { data: prodotti = [], isLoading } = useProdotti();
  const { data: categorie = [] } = useCategorie();
  const creaVendita = useCreaVendita();

  const [righe, setRighe] = useState<RigaCarrello[]>([]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [carrelloAperto, setCarrelloAperto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [confermata, setConfermata] = useState<{ numero: number; totale: number } | null>(null);

  // L'id di richiesta resta stabile finché il carrello non viene svuotato: se
  // la rete fa perdere la risposta, un secondo invio non crea una seconda
  // vendita (idempotenza lato RPC).
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const disponibili = useMemo(() => prodotti.filter((p) => p.disponibile), [prodotti]);

  const visibili = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();
    return disponibili.filter((p) => {
      if (categoriaId && p.categoria_id !== categoriaId) return false;
      if (termine && !p.nome.toLowerCase().includes(termine)) return false;
      return true;
    });
  }, [disponibili, categoriaId, ricerca]);

  const quantitaPerProdotto = useMemo(
    () => new Map(righe.map((riga) => [riga.prodottoId, riga.quantita])),
    [righe],
  );

  const totale = totaleCarrello(righe);
  const pezzi = pezziCarrello(righe);
  const invioInCorso = creaVendita.isPending;

  function aggiungi(prodotto: Prodotto) {
    setErrore(null);
    const nuove = aggiungiRiga(righe, {
      prodottoId: prodotto.id,
      nome: prodotto.nome,
      prezzo: Number(prodotto.prezzo),
    });
    if (!nuove) {
      setErrore(`Hai raggiunto il massimo per ${prodotto.nome}`);
      return;
    }
    setRighe(nuove);
  }

  async function batti() {
    if (!puoBattereCarrello(righe, invioInCorso)) return;
    setErrore(null);

    try {
      const creata = await creaVendita.mutateAsync({
        righe: righePerRpc(righe),
        requestId,
      });

      setConfermata({ numero: creata.numero, totale });
      setRighe([]);
      setCarrelloAperto(false);
      setRequestId(crypto.randomUUID());
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Non sono riuscito a registrare la vendita');
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      <input
        type="search"
        value={ricerca}
        onChange={(e) => setRicerca(e.target.value)}
        placeholder="Cerca un prodotto"
        aria-label="Cerca un prodotto"
        className="min-h-12 rounded-xl border border-bordo bg-superficie px-4 outline-none focus:border-accento"
      />

      {categorie.length > 0 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <ChipCategoria
            attiva={categoriaId === null}
            onClick={() => setCategoriaId(null)}
            etichetta="Tutti"
          />
          {categorie.map((categoria) => (
            <ChipCategoria
              key={categoria.id}
              attiva={categoriaId === categoria.id}
              onClick={() => setCategoriaId(categoria.id)}
              etichetta={categoria.nome}
            />
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-testo-debole">Carico il catalogo…</p>
      ) : (
        <GrigliaProdotti
          prodotti={visibili}
          quantitaPerProdotto={quantitaPerProdotto}
          onAggiungi={aggiungi}
        />
      )}

      {errore && !carrelloAperto ? (
        <p role="alert" className="text-sm text-attenzione">
          {errore}
        </p>
      ) : null}

      {/* Spazio per non far coprire l'ultima riga dalla barra del carrello. */}
      {righe.length > 0 ? <div className="h-20" aria-hidden /> : null}

      {righe.length > 0 ? (
        <button
          type="button"
          onClick={() => setCarrelloAperto(true)}
          className="fixed inset-x-0 bottom-14 z-20 mx-auto flex max-w-2xl items-center justify-between gap-3 border-t border-accento-scuro bg-accento px-4 py-3.5 text-fondo"
        >
          <span className="numeri flex size-8 items-center justify-center rounded-full bg-fondo/15 font-bold">
            {pezzi}
          </span>
          <span className="font-semibold">Vedi carrello</span>
          <span className="numeri font-bold">{euro(totale)}</span>
        </button>
      ) : null}

      {carrelloAperto ? (
        <FoglioCarrello
          righe={righe}
          totale={totale}
          invioInCorso={invioInCorso}
          puoBattere={puoBattereCarrello(righe, invioInCorso)}
          errore={errore}
          onCambiaQuantita={(id, delta) => setRighe(cambiaQuantita(righe, id, delta))}
          onRimuovi={(id) => setRighe(rimuoviRiga(righe, id))}
          onBatti={batti}
          onChiudi={() => setCarrelloAperto(false)}
        />
      ) : null}

      {confermata ? (
        <NumeroAssegnato
          numero={confermata.numero}
          totale={confermata.totale}
          onChiudi={() => setConfermata(null)}
        />
      ) : null}
    </div>
  );
}

function ChipCategoria({
  attiva,
  etichetta,
  onClick,
}: {
  attiva: boolean;
  etichetta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attiva}
      className={`min-h-10 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap ${
        attiva
          ? 'border-accento bg-accento text-fondo font-semibold'
          : 'border-bordo text-testo-debole'
      }`}
    >
      {etichetta}
    </button>
  );
}
