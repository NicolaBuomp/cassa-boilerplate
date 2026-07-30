'use client';

import { attivita } from '@/lib/attivita';
import {
  useAggiornaProdotto,
  useCategorie,
  useCreaProdotto,
  useProdotti,
} from '@/lib/hooks/use-catalogo';
import {
  useInventario,
  useMovimentiInventario,
  useRegistraMovimento,
  useVendutoInventario,
} from '@/lib/hooks/use-inventario';
import { useAuth } from '@/lib/providers/auth-provider';
import type {
  InventarioProdotto,
  Prodotto,
  TipoMovimento,
} from '@/lib/supabase/database.types';
import { useMemo, useState } from 'react';
import { SoloTitolare } from '../_components/solo-titolare';

type Scheda = 'prodotti' | 'venduto' | 'movimenti';
type TipoManuale = Extract<TipoMovimento, 'carico' | 'scarico' | 'rettifica'>;

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const numero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
const dataOra = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' });

export default function InventarioPage() {
  const { eTitolare } = useAuth();
  const { data: righe = [], isLoading } = useInventario();
  const { data: movimenti = [] } = useMovimentiInventario();
  const { data: prodotti = [] } = useProdotti();
  const { data: categorie = [] } = useCategorie();
  const [scheda, setScheda] = useState<Scheda>('prodotti');
  const [ricerca, setRicerca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [da, setDa] = useState('');
  const [a, setA] = useState('');
  const [prodottoAperto, setProdottoAperto] = useState<Prodotto | null | undefined>(undefined);
  const [movimentoAperto, setMovimentoAperto] = useState<InventarioProdotto | null | undefined>(
    undefined,
  );
  const [storicoId, setStoricoId] = useState<string | null>(null);
  const { data: venduto = [], isLoading: caricaVenduto } = useVendutoInventario(da, a);

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return righe.filter(
      (r) =>
        (!q || r.nome.toLowerCase().includes(q) || r.sku?.toLowerCase().includes(q)) &&
        (!categoria || r.categoria_id === categoria),
    );
  }, [righe, ricerca, categoria]);

  const kpi = useMemo(
    () =>
      righe.reduce(
        (acc, r) => ({
          prodotti: acc.prodotti + (r.disponibile ? 1 : 0),
          costo: acc.costo + Number(r.valore_costo),
          vendita: acc.vendita + Number(r.valore_vendita),
          bassi: acc.bassi + (r.sotto_scorta ? 1 : 0),
        }),
        { prodotti: 0, costo: 0, vendita: 0, bassi: 0 },
      ),
    [righe],
  );

  if (!eTitolare) return <SoloTitolare />;
  if (!attivita.moduli.inventario) {
    return (
      <p className="mt-6 rounded-2xl border border-bordo bg-superficie p-5 text-sm text-testo-debole">
        Il modulo Inventario non è attivo per questa Attività.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-accento uppercase">Magazzino</p>
          <h1 className="mt-1 text-2xl font-semibold">Inventario</h1>
          <p className="mt-1 text-sm text-testo-debole">Prodotti, giacenze e movimenti.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMovimentoAperto(null)}
            className="min-h-11 rounded-xl border border-bordo px-3 text-sm font-medium"
          >
            Movimento
          </button>
          <button
            type="button"
            onClick={() => setProdottoAperto(null)}
            className="min-h-11 rounded-xl bg-accento px-3 text-sm font-semibold text-fondo"
          >
            + Prodotto
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi etichetta="Prodotti attivi" valore={String(kpi.prodotti)} />
        <Kpi etichetta="Valore magazzino" valore={euro.format(kpi.costo)} />
        <Kpi etichetta="Valore vendita" valore={euro.format(kpi.vendita)} />
        <Kpi
          etichetta="Margine potenziale"
          valore={euro.format(kpi.vendita - kpi.costo)}
          dettaglio={kpi.bassi ? `${kpi.bassi} sotto scorta` : 'Scorte regolari'}
          attenzione={kpi.bassi > 0}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-bordo bg-superficie">
        <nav className="grid grid-cols-3 border-b border-bordo p-1" aria-label="Sezioni inventario">
          {(['prodotti', 'venduto', 'movimenti'] as Scheda[]).map((voce) => (
            <button
              key={voce}
              type="button"
              onClick={() => setScheda(voce)}
              className={`min-h-11 rounded-xl text-sm font-medium capitalize ${
                scheda === voce ? 'bg-superficie-alta text-accento' : 'text-testo-debole'
              }`}
            >
              {voce}
            </button>
          ))}
        </nav>

        {scheda === 'prodotti' ? (
          <div className="flex flex-col gap-3 p-3">
            <div className="flex gap-2">
              <input
                type="search"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                placeholder="Cerca nome o SKU"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-bordo bg-superficie-alta px-3 outline-none focus:border-accento"
              />
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                aria-label="Filtra categoria"
                className="min-h-11 max-w-40 rounded-xl border border-bordo bg-superficie-alta px-2"
              >
                <option value="">Tutte</option>
                {categorie.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            {isLoading ? (
              <Vuoto testo="Caricamento prodotti…" />
            ) : visibili.length === 0 ? (
              <Vuoto testo="Nessun prodotto trovato." />
            ) : (
              <ul className="flex flex-col divide-y divide-bordo">
                {visibili.map((r) => (
                  <li key={r.prodotto_id} className="flex items-center gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => setStoricoId(r.prodotto_id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.nome}</span>
                        {r.sotto_scorta ? (
                          <span className="shrink-0 rounded-full bg-attenzione/15 px-2 py-0.5 text-[0.65rem] text-attenzione">
                            Scorta bassa
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-testo-debole">
                        {r.categoria_nome ?? 'Senza categoria'} · {euro.format(Number(r.prezzo))} ·{' '}
                        margine {euro.format(Number(r.prezzo) - Number(r.prezzo_acquisto))}
                      </span>
                    </button>
                    <span
                      className={`numeri text-right text-lg font-bold ${
                        Number(r.saldo) < 0 ? 'text-attenzione' : ''
                      }`}
                    >
                      {numero.format(Number(r.saldo))}
                      <small className="ml-1 text-xs font-normal text-testo-debole">{r.unita}</small>
                    </span>
                    <button
                      type="button"
                      aria-label={`Movimento ${r.nome}`}
                      onClick={() => setMovimentoAperto(r)}
                      className="min-h-10 rounded-lg border border-bordo px-2 text-sm"
                    >
                      ±
                    </button>
                    <button
                      type="button"
                      aria-label={`Modifica ${r.nome}`}
                      onClick={() =>
                        setProdottoAperto(prodotti.find((p) => p.id === r.prodotto_id) ?? null)
                      }
                      className="min-h-10 rounded-lg border border-bordo px-2 text-sm"
                    >
                      ⋯
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : scheda === 'venduto' ? (
          <div className="flex flex-col gap-3 p-3">
            <div className="grid grid-cols-2 gap-2">
              <CampoData etichetta="Dal" valore={da} onChange={setDa} />
              <CampoData etichetta="Al" valore={a} onChange={setA} />
            </div>
            {caricaVenduto ? (
              <Vuoto testo="Calcolo del venduto…" />
            ) : venduto.length === 0 ? (
              <Vuoto testo="Nessuna vendita nel periodo." />
            ) : (
              <ul className="divide-y divide-bordo">
                {venduto.map((r) => (
                  <li key={r.prodotto_id ?? r.nome_prodotto} className="flex py-3">
                    <span className="min-w-0 flex-1 truncate font-medium">{r.nome_prodotto}</span>
                    <span className="numeri mr-5">{numero.format(r.quantita)} venduti</span>
                    <span className="numeri font-semibold">{euro.format(r.incasso)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="p-3">
            {movimenti.length === 0 ? (
              <Vuoto testo="Nessun movimento registrato." />
            ) : (
              <ul className="divide-y divide-bordo">
                {movimenti.map((m) => {
                  const prodotto = righe.find((r) => r.prodotto_id === m.prodotto_id);
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {prodotto?.nome ?? 'Prodotto non disponibile'}
                        </span>
                        <span className="block truncate text-xs text-testo-debole">
                          {etichettaMovimento(m.tipo)} · {dataOra.format(new Date(m.created_at))}
                          {m.motivo ? ` · ${m.motivo}` : ''}
                        </span>
                      </span>
                      <span
                        className={`numeri font-bold ${
                          Number(m.quantita) < 0 ? 'text-attenzione' : 'text-positivo'
                        }`}
                      >
                        {Number(m.quantita) > 0 ? '+' : ''}
                        {numero.format(Number(m.quantita))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {prodottoAperto !== undefined ? (
        <ModuloProdottoInventario
          prodotto={prodottoAperto}
          categorie={categorie}
          onChiudi={() => setProdottoAperto(undefined)}
        />
      ) : null}
      {movimentoAperto !== undefined ? (
        <ModuloMovimento
          prodotti={righe}
          predefinito={movimentoAperto}
          onChiudi={() => setMovimentoAperto(undefined)}
        />
      ) : null}
      {storicoId ? (
        <ModuloStorico
          prodotto={righe.find((r) => r.prodotto_id === storicoId)}
          movimenti={movimenti.filter((m) => m.prodotto_id === storicoId)}
          onChiudi={() => setStoricoId(null)}
        />
      ) : null}
    </div>
  );
}

function Kpi({
  etichetta,
  valore,
  dettaglio,
  attenzione,
}: {
  etichetta: string;
  valore: string;
  dettaglio?: string;
  attenzione?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-bordo bg-superficie p-3">
      <p className="text-[0.68rem] font-semibold tracking-wide text-testo-debole uppercase">
        {etichetta}
      </p>
      <p className="numeri mt-2 text-lg font-bold">{valore}</p>
      {dettaglio ? (
        <p className={`mt-1 text-xs ${attenzione ? 'text-attenzione' : 'text-testo-debole'}`}>
          {dettaglio}
        </p>
      ) : null}
    </article>
  );
}

function CampoData({
  etichetta,
  valore,
  onChange,
}: {
  etichetta: string;
  valore: string;
  onChange: (valore: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-testo-debole">
      {etichetta}
      <input
        type="date"
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-xl border border-bordo bg-superficie-alta px-3 text-testo"
      />
    </label>
  );
}

function Vuoto({ testo }: { testo: string }) {
  return <p className="py-10 text-center text-sm text-testo-debole">{testo}</p>;
}

function GuscioModulo({
  titolo,
  onChiudi,
  children,
}: {
  titolo: string;
  onChiudi: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60">
      <button type="button" aria-label="Chiudi" className="flex-1" onClick={onChiudi} />
      <section className="max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t border-bordo bg-superficie p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{titolo}</h2>
          <button type="button" onClick={onChiudi} className="text-sm text-testo-debole">
            Chiudi
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function ModuloProdottoInventario({
  prodotto,
  categorie,
  onChiudi,
}: {
  prodotto: Prodotto | null;
  categorie: { id: string; nome: string }[];
  onChiudi: () => void;
}) {
  const crea = useCreaProdotto();
  const aggiorna = useAggiornaProdotto();
  const registra = useRegistraMovimento();
  const [nome, setNome] = useState(prodotto?.nome ?? '');
  const [categoriaId, setCategoriaId] = useState(prodotto?.categoria_id ?? '');
  const [sku, setSku] = useState(prodotto?.sku ?? '');
  const [unita, setUnita] = useState(prodotto?.unita ?? 'pz');
  const [prezzo, setPrezzo] = useState<number | ''>(prodotto ? Number(prodotto.prezzo) : '');
  const [costo, setCosto] = useState<number | ''>(
    prodotto ? Number(prodotto.prezzo_acquisto) : '',
  );
  const [minimo, setMinimo] = useState<number | ''>(
    prodotto ? Number(prodotto.scorta_minima) : 0,
  );
  const [disponibile, setDisponibile] = useState(prodotto?.disponibile ?? true);
  const [note, setNote] = useState(prodotto?.note ?? '');
  const [iniziale, setIniziale] = useState<number | ''>('');
  const [errore, setErrore] = useState<string | null>(null);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    if (!nome.trim() || prezzo === '' || costo === '' || minimo === '') {
      setErrore('Completa nome, prezzi e scorta minima.');
      return;
    }
    const dati = {
      nome: nome.trim(),
      categoria_id: categoriaId || null,
      sku: sku.trim() || null,
      unita,
      prezzo: Number(prezzo),
      prezzo_acquisto: Number(costo),
      scorta_minima: Number(minimo),
      traccia_giacenza: true,
      disponibile,
      note: note.trim() || null,
      ordine: prodotto?.ordine ?? 0,
    };
    try {
      const salvato = prodotto
        ? await aggiorna.mutateAsync({ id: prodotto.id, ...dati })
        : await crea.mutateAsync(dati);
      if (!prodotto && iniziale !== '' && Number(iniziale) > 0) {
        await registra.mutateAsync({
          prodottoId: salvato.id,
          tipo: 'carico',
          quantita: Number(iniziale),
          prezzoUnitario: Number(costo),
          motivo: 'Giacenza iniziale',
        });
      }
      onChiudi();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito');
    }
  }

  return (
    <GuscioModulo titolo={prodotto ? 'Modifica prodotto' : 'Nuovo prodotto'} onChiudi={onChiudi}>
      <form onSubmit={salva} className="grid grid-cols-2 gap-3">
        <CampoTesto etichetta="Nome" valore={nome} onChange={setNome} largo />
        <CampoTesto etichetta="SKU" valore={sku} onChange={setSku} />
        <label className="flex flex-col gap-1 text-sm text-testo-debole">
          Categoria
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 text-testo"
          >
            <option value="">Senza categoria</option>
            {categorie.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-testo-debole">
          Unità
          <select
            value={unita}
            onChange={(e) => setUnita(e.target.value)}
            className="min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 text-testo"
          >
            {['pz', 'bottiglia', 'lattina', 'bicchiere', 'litro', 'kg', 'confezione'].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <CampoNumero etichetta="Prezzo vendita" valore={prezzo} onChange={setPrezzo} decimale />
        <CampoNumero etichetta="Costo acquisto" valore={costo} onChange={setCosto} decimale />
        <CampoNumero etichetta="Scorta minima" valore={minimo} onChange={setMinimo} decimale />
        {!prodotto ? (
          <CampoNumero etichetta="Giacenza iniziale" valore={iniziale} onChange={setIniziale} decimale />
        ) : null}
        <CampoTesto etichetta="Note" valore={note} onChange={setNote} largo />
        <button
          type="button"
          onClick={() => setDisponibile(!disponibile)}
          aria-pressed={disponibile}
          className={`col-span-2 flex min-h-12 items-center justify-between rounded-xl border px-3 ${
            disponibile ? 'border-positivo text-positivo' : 'border-bordo text-testo-debole'
          }`}
        >
          <span className="font-medium">
            {disponibile ? 'Disponibile alla vendita' : 'Non disponibile alla vendita'}
          </span>
          <span>{disponibile ? 'Attivo' : 'Inattivo'}</span>
        </button>
        {errore ? <p className="col-span-2 text-sm text-attenzione">{errore}</p> : null}
        <button
          type="submit"
          disabled={crea.isPending || aggiorna.isPending || registra.isPending}
          className="col-span-2 min-h-14 rounded-xl bg-accento font-semibold text-fondo disabled:opacity-40"
        >
          Salva prodotto
        </button>
      </form>
    </GuscioModulo>
  );
}

function ModuloMovimento({
  prodotti,
  predefinito,
  onChiudi,
}: {
  prodotti: InventarioProdotto[];
  predefinito: InventarioProdotto | null;
  onChiudi: () => void;
}) {
  const registra = useRegistraMovimento();
  const [prodottoId, setProdottoId] = useState(predefinito?.prodotto_id ?? '');
  const [tipo, setTipo] = useState<TipoManuale>('carico');
  const [quantita, setQuantita] = useState<number | ''>('');
  const [prezzo, setPrezzo] = useState<number | ''>(predefinito?.prezzo_acquisto ?? '');
  const [motivo, setMotivo] = useState('');
  const [errore, setErrore] = useState<string | null>(null);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    if (!prodottoId || quantita === '' || Number(quantita) < 0 || !motivo.trim()) {
      setErrore('Seleziona prodotto, quantità e motivo.');
      return;
    }
    try {
      await registra.mutateAsync({
        prodottoId,
        tipo,
        quantita: Number(quantita),
        prezzoUnitario: prezzo === '' ? null : Number(prezzo),
        motivo: motivo.trim(),
      });
      onChiudi();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Movimento non riuscito');
    }
  }

  return (
    <GuscioModulo titolo="Registra movimento" onChiudi={onChiudi}>
      <form onSubmit={salva} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-testo-debole">
          Prodotto
          <select
            value={prodottoId}
            onChange={(e) => setProdottoId(e.target.value)}
            className="min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 text-testo"
          >
            <option value="">Seleziona</option>
            {prodotti.map((p) => (
              <option key={p.prodotto_id} value={p.prodotto_id}>
                {p.nome} · {numero.format(Number(p.saldo))} {p.unita}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['carico', 'scarico', 'rettifica'] as TipoManuale[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`min-h-11 rounded-xl border text-sm capitalize ${
                tipo === t ? 'border-accento text-accento' : 'border-bordo'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CampoNumero
            etichetta={tipo === 'rettifica' ? 'Nuova giacenza' : 'Quantità'}
            valore={quantita}
            onChange={setQuantita}
            decimale
          />
          <CampoNumero etichetta="Prezzo unitario" valore={prezzo} onChange={setPrezzo} decimale />
        </div>
        <CampoTesto
          etichetta="Motivo"
          valore={motivo}
          onChange={setMotivo}
          placeholder="Fornitore, rottura, conteggio…"
          largo
        />
        {errore ? <p className="text-sm text-attenzione">{errore}</p> : null}
        <button
          type="submit"
          disabled={registra.isPending}
          className="min-h-14 rounded-xl bg-accento font-semibold text-fondo disabled:opacity-40"
        >
          Registra movimento
        </button>
      </form>
    </GuscioModulo>
  );
}

function ModuloStorico({
  prodotto,
  movimenti,
  onChiudi,
}: {
  prodotto?: InventarioProdotto;
  movimenti: {
    id: string;
    tipo: TipoMovimento;
    quantita: number;
    motivo: string | null;
    created_at: string;
  }[];
  onChiudi: () => void;
}) {
  return (
    <GuscioModulo titolo={`Storico · ${prodotto?.nome ?? ''}`} onChiudi={onChiudi}>
      {movimenti.length === 0 ? (
        <Vuoto testo="Nessun movimento registrato." />
      ) : (
        <ul className="divide-y divide-bordo">
          {movimenti.map((m) => (
            <li key={m.id} className="flex gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{etichettaMovimento(m.tipo)}</span>
                <span className="block truncate text-xs text-testo-debole">
                  {dataOra.format(new Date(m.created_at))}
                  {m.motivo ? ` · ${m.motivo}` : ''}
                </span>
              </span>
              <span className="numeri font-bold">
                {Number(m.quantita) > 0 ? '+' : ''}
                {numero.format(Number(m.quantita))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </GuscioModulo>
  );
}

function CampoTesto({
  etichetta,
  valore,
  onChange,
  placeholder,
  largo,
}: {
  etichetta: string;
  valore: string;
  onChange: (valore: string) => void;
  placeholder?: string;
  largo?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-testo-debole ${largo ? 'col-span-2' : ''}`}>
      {etichetta}
      <input
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 text-testo outline-none focus:border-accento"
      />
    </label>
  );
}

function CampoNumero({
  etichetta,
  valore,
  onChange,
  decimale,
}: {
  etichetta: string;
  valore: number | '';
  onChange: (valore: number | '') => void;
  decimale?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-testo-debole">
      {etichetta}
      <input
        type="number"
        min={0}
        step={decimale ? '0.01' : '1'}
        inputMode="decimal"
        value={valore}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="numeri min-h-12 rounded-xl border border-bordo bg-superficie-alta px-3 text-testo outline-none focus:border-accento"
      />
    </label>
  );
}

function etichettaMovimento(tipo: TipoMovimento) {
  return (
    {
      carico: 'Carico',
      scarico: 'Scarico',
      vendita: 'Vendita',
      annullo: 'Annullo',
      rettifica: 'Rettifica',
    } satisfies Record<TipoMovimento, string>
  )[tipo];
}
