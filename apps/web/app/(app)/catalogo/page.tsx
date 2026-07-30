'use client';

import { euro } from '@/lib/format';
import { attivita } from '@/lib/attivita';
import {
  useAggiornaProdotto,
  useCategorie,
  useCreaProdotto,
  useEliminaProdotto,
  useProdotti,
} from '@/lib/hooks/use-catalogo';
import { useAuth } from '@/lib/providers/auth-provider';
import type { Prodotto } from '@/lib/supabase/database.types';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SoloTitolare } from '../_components/solo-titolare';
import { ModuloProdotto } from './_components/modulo-prodotto';

type Modale = { tipo: 'nuovo' } | { tipo: 'modifica'; prodotto: Prodotto } | null;

export default function CatalogoPage() {
  const { eTitolare } = useAuth();
  const { data: prodotti = [], isLoading } = useProdotti();
  const { data: categorie = [] } = useCategorie();
  const crea = useCreaProdotto();
  const aggiorna = useAggiornaProdotto();
  const elimina = useEliminaProdotto();

  const [modale, setModale] = useState<Modale>(null);
  const [ricerca, setRicerca] = useState('');

  const perCategoria = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();
    const filtrati = termine
      ? prodotti.filter((p) => p.nome.toLowerCase().includes(termine))
      : prodotti;

    const gruppi = categorie.map((categoria) => ({
      categoria: categoria.nome,
      prodotti: filtrati.filter((p) => p.categoria_id === categoria.id),
    }));

    const orfani = filtrati.filter((p) => !p.categoria_id);
    if (orfani.length > 0) gruppi.push({ categoria: 'Senza categoria', prodotti: orfani });

    return gruppi.filter((g) => g.prodotti.length > 0);
  }, [prodotti, categorie, ricerca]);

  if (!eTitolare) return <SoloTitolare />;

  const inCorso = crea.isPending || aggiorna.isPending || elimina.isPending;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Catalogo</h1>
        <Link href="/catalogo/categorie" className="text-sm text-testo-debole underline">
          Categorie
        </Link>
      </header>

      <p className="text-xs text-testo-debole">
        Un prodotto “esaurito” sparisce dalla battitura ma resta nei report.{' '}
        {attivita.moduli.inventario
          ? 'La quantità e i movimenti si gestiscono nell’Inventario.'
          : 'Questa Attività non tiene giacenze.'}
      </p>

      <input
        type="search"
        value={ricerca}
        onChange={(e) => setRicerca(e.target.value)}
        placeholder="Cerca un prodotto"
        aria-label="Cerca un prodotto"
        className="min-h-12 rounded-xl border border-bordo bg-superficie px-4 outline-none focus:border-accento"
      />

      {isLoading ? (
        <p className="py-12 text-center text-sm text-testo-debole">Carico…</p>
      ) : perCategoria.length === 0 ? (
        <p className="rounded-2xl border border-bordo bg-superficie px-4 py-10 text-center text-sm text-testo-debole">
          Nessun prodotto.
        </p>
      ) : (
        perCategoria.map((gruppo) => (
          <section key={gruppo.categoria} className="flex flex-col gap-1.5">
            <h2 className="mt-2 text-xs tracking-wide text-testo-debole uppercase">
              {gruppo.categoria}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {gruppo.prodotti.map((prodotto) => (
                <li key={prodotto.id}>
                  <button
                    type="button"
                    onClick={() => setModale({ tipo: 'modifica', prodotto })}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-bordo bg-superficie px-3 py-3 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className={`size-2.5 shrink-0 rounded-full ${
                          prodotto.disponibile ? 'bg-positivo' : 'bg-bordo'
                        }`}
                      />
                      <span
                        className={`truncate text-sm ${
                          prodotto.disponibile ? '' : 'text-testo-debole line-through'
                        }`}
                      >
                        {prodotto.nome}
                      </span>
                    </span>
                    <span className="numeri shrink-0 font-semibold">{euro(prodotto.prezzo)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <button
        type="button"
        onClick={() => setModale({ tipo: 'nuovo' })}
        className="mt-4 min-h-14 rounded-xl bg-accento font-semibold text-fondo"
      >
        Nuovo prodotto
      </button>

      {modale ? (
        <ModuloProdotto
          prodotto={modale.tipo === 'modifica' ? modale.prodotto : null}
          categorie={categorie}
          inCorso={inCorso}
          onSalva={async (valori) => {
            if (modale.tipo === 'modifica') {
              await aggiorna.mutateAsync({ id: modale.prodotto.id, ...valori });
            } else {
              await crea.mutateAsync(valori);
            }
            setModale(null);
          }}
          onElimina={
            modale.tipo === 'modifica'
              ? async () => {
                  await elimina.mutateAsync(modale.prodotto.id);
                  setModale(null);
                }
              : undefined
          }
          onChiudi={() => setModale(null)}
        />
      ) : null}
    </div>
  );
}
