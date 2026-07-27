'use client';

import type { Categoria, Prodotto } from '@/lib/supabase/database.types';
import { useState } from 'react';

export interface ValoriProdotto {
  nome: string;
  categoria_id: string | null;
  prezzo: number;
  disponibile: boolean;
  ordine: number;
}

export function ModuloProdotto({
  prodotto,
  categorie,
  inCorso,
  onSalva,
  onElimina,
  onChiudi,
}: {
  prodotto: Prodotto | null;
  categorie: Categoria[];
  inCorso: boolean;
  onSalva: (valori: ValoriProdotto) => Promise<void>;
  onElimina?: () => Promise<void>;
  onChiudi: () => void;
}) {
  const [nome, setNome] = useState(prodotto?.nome ?? '');
  const [categoriaId, setCategoriaId] = useState<string>(prodotto?.categoria_id ?? '');
  const [prezzo, setPrezzo] = useState<number | ''>(prodotto ? Number(prodotto.prezzo) : '');
  const [disponibile, setDisponibile] = useState(prodotto?.disponibile ?? true);
  const [ordine, setOrdine] = useState<number>(prodotto?.ordine ?? 0);
  const [errore, setErrore] = useState<string | null>(null);
  const [confermaElimina, setConfermaElimina] = useState(false);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    if (nome.trim() === '') {
      setErrore('Il nome è obbligatorio');
      return;
    }
    if (prezzo === '' || Number(prezzo) < 0) {
      setErrore('Indica un prezzo valido');
      return;
    }

    try {
      await onSalva({
        nome: nome.trim(),
        categoria_id: categoriaId === '' ? null : categoriaId,
        prezzo: Number(prezzo),
        disponibile,
        ordine: Number(ordine) || 0,
      });
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={prodotto ? 'Modifica prodotto' : 'Nuovo prodotto'}
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60"
    >
      <button type="button" aria-label="Chiudi" className="flex-1" onClick={onChiudi} />

      <form
        onSubmit={salva}
        className="flex max-h-[92dvh] flex-col gap-3 overflow-y-auto rounded-t-3xl border-t border-bordo bg-superficie px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {prodotto ? 'Modifica prodotto' : 'Nuovo prodotto'}
          </h2>
          <button type="button" onClick={onChiudi} className="text-sm text-testo-debole">
            Chiudi
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-testo-debole">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 outline-none focus:border-accento"
          />
        </label>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm text-testo-debole">Prezzo</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={prezzo}
              onChange={(e) => setPrezzo(e.target.value === '' ? '' : Number(e.target.value))}
              className="numeri min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 outline-none focus:border-accento"
            />
          </label>

          <label className="flex w-28 flex-col gap-1.5">
            <span className="text-sm text-testo-debole">Ordine</span>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              value={ordine}
              onChange={(e) => setOrdine(Number(e.target.value))}
              className="numeri min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 outline-none focus:border-accento"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-testo-debole">Categoria</span>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 outline-none focus:border-accento"
          >
            <option value="">Senza categoria</option>
            {categorie.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setDisponibile(!disponibile)}
          aria-pressed={disponibile}
          className={`flex min-h-14 items-center justify-between rounded-xl border px-4 ${
            disponibile ? 'border-positivo text-positivo' : 'border-bordo text-testo-debole'
          }`}
        >
          <span className="font-medium">{disponibile ? 'Disponibile' : 'Esaurito'}</span>
          <span
            aria-hidden
            className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
              disponibile ? 'bg-positivo' : 'bg-bordo'
            }`}
          >
            <span
              className={`size-5 rounded-full bg-fondo transition ${disponibile ? 'translate-x-5' : ''}`}
            />
          </span>
        </button>

        {errore ? (
          <p role="alert" className="text-sm text-attenzione">
            {errore}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={inCorso}
          className="min-h-14 rounded-xl bg-accento font-semibold text-fondo disabled:opacity-40"
        >
          {inCorso ? 'Salvo…' : 'Salva'}
        </button>

        {prodotto && onElimina ? (
          confermaElimina ? (
            <div className="flex flex-col gap-2 rounded-xl border border-attenzione px-3 py-3">
              <p className="text-sm">
                Eliminare “{prodotto.nome}”? Le vendite passate restano intatte: nome e prezzo sono
                congelati nelle righe.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfermaElimina(false)}
                  className="min-h-12 flex-1 rounded-xl border border-bordo"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => void onElimina()}
                  className="min-h-12 flex-1 rounded-xl bg-attenzione font-semibold text-fondo"
                >
                  Elimina
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfermaElimina(true)}
              className="min-h-11 text-sm text-attenzione"
            >
              Elimina prodotto
            </button>
          )
        ) : null}
      </form>
    </div>
  );
}
