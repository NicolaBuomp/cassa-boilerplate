'use client';

import {
  useAggiornaCategoria,
  useCategorie,
  useCreaCategoria,
  useEliminaCategoria,
  useProdotti,
} from '@/lib/hooks/use-catalogo';
import { useAuth } from '@/lib/providers/auth-provider';
import Link from 'next/link';
import { useState } from 'react';
import { SoloTitolare } from '../../_components/solo-titolare';

export default function CategoriePage() {
  const { eTitolare } = useAuth();
  const { data: categorie = [], isLoading } = useCategorie();
  const { data: prodotti = [] } = useProdotti();
  const crea = useCreaCategoria();
  const aggiorna = useAggiornaCategoria();
  const elimina = useEliminaCategoria();

  const [nuova, setNuova] = useState('');
  const [errore, setErrore] = useState<string | null>(null);

  if (!eTitolare) return <SoloTitolare />;

  async function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    if (nuova.trim() === '') return;

    try {
      // In coda alle esistenti: l'ordine conta perché decide dove sta il tasto
      // nella griglia di battitura.
      const ordine = (categorie.at(-1)?.ordine ?? 0) + 10;
      await crea.mutateAsync({ nome: nuova.trim(), ordine });
      setNuova('');
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Non sono riuscito a creare la categoria');
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Categorie</h1>
        <Link href="/catalogo" className="text-sm text-testo-debole underline">
          Catalogo
        </Link>
      </header>

      <p className="text-xs text-testo-debole">
        L’ordine decide la posizione nella griglia di battitura: metti in cima quello che si vende
        di più.
      </p>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-testo-debole">Carico…</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {categorie.map((categoria) => {
            const quanti = prodotti.filter((p) => p.categoria_id === categoria.id).length;
            return (
              <li
                key={categoria.id}
                className="flex items-center gap-2 rounded-xl border border-bordo bg-superficie px-3 py-2.5"
              >
                <input
                  defaultValue={categoria.nome}
                  aria-label={`Nome della categoria ${categoria.nome}`}
                  onBlur={(e) => {
                    const nome = e.target.value.trim();
                    if (nome && nome !== categoria.nome) {
                      aggiorna.mutate({ id: categoria.id, nome });
                    }
                  }}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 outline-none focus:border-accento"
                />
                <input
                  type="number"
                  step="1"
                  defaultValue={categoria.ordine}
                  aria-label={`Ordine della categoria ${categoria.nome}`}
                  onBlur={(e) => {
                    const ordine = Number(e.target.value);
                    if (ordine !== categoria.ordine) {
                      aggiorna.mutate({ id: categoria.id, ordine });
                    }
                  }}
                  className="numeri min-h-11 w-16 rounded-lg border border-bordo bg-superficie-alta px-2 text-center outline-none focus:border-accento"
                />
                <button
                  type="button"
                  onClick={() => elimina.mutate(categoria.id)}
                  className="min-h-11 px-2 text-xs text-attenzione"
                  title={
                    quanti > 0
                      ? `${quanti} prodotti resteranno senza categoria`
                      : 'Elimina la categoria'
                  }
                >
                  Elimina
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={aggiungi} className="mt-4 flex gap-2">
        <input
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          placeholder="Nuova categoria"
          aria-label="Nome della nuova categoria"
          className="min-h-12 flex-1 rounded-xl border border-bordo bg-superficie px-4 outline-none focus:border-accento"
        />
        <button
          type="submit"
          disabled={crea.isPending || nuova.trim() === ''}
          className="min-h-12 rounded-xl bg-accento px-5 font-semibold text-fondo disabled:opacity-40"
        >
          Aggiungi
        </button>
      </form>

      {errore ? (
        <p role="alert" className="text-sm text-attenzione">
          {errore}
        </p>
      ) : null}
    </div>
  );
}
