// Logica pura del carrello di battitura. Nessuna dipendenza da React o
// Supabase, così è testabile in isolamento.
//
// Gli importi sono arrotondati a 2 decimali a ogni passo per evitare derive
// floating-point: il totale mostrato al banco deve coincidere con quello che
// il database ricalcola dai prezzi di catalogo.
//
// Nota: qui non c'è nessun controllo di giacenza, perché non esiste giacenza
// (ADR 0001). Un prodotto o è disponibile o non compare proprio.

export interface RigaCarrello {
  prodottoId: string;
  nome: string;
  prezzo: number;
  quantita: number;
}

/** Tetto per riga: protegge dal dito che resta premuto sul +. */
export const QUANTITA_MASSIMA = 99;

export function arrotonda(value: number): number {
  return Math.round(value * 100) / 100;
}

export function pezziCarrello(righe: RigaCarrello[]): number {
  return righe.reduce((somma, riga) => somma + riga.quantita, 0);
}

export function totaleCarrello(righe: RigaCarrello[]): number {
  return arrotonda(
    righe.reduce((somma, riga) => somma + arrotonda(riga.prezzo * riga.quantita), 0),
  );
}

/** Aggiunge un pezzo, accorpando sulla riga esistente. `null` se si è al tetto. */
export function aggiungiRiga(
  righe: RigaCarrello[],
  prodotto: Omit<RigaCarrello, 'quantita'>,
): RigaCarrello[] | null {
  const esistente = righe.find((riga) => riga.prodottoId === prodotto.prodottoId);

  if (!esistente) {
    return [...righe, { ...prodotto, quantita: 1 }];
  }
  if (esistente.quantita + 1 > QUANTITA_MASSIMA) {
    return null;
  }
  return righe.map((riga) =>
    riga.prodottoId === prodotto.prodottoId ? { ...riga, quantita: riga.quantita + 1 } : riga,
  );
}

/** Varia la quantità di una riga: la rimuove a 0, si ferma al tetto. */
export function cambiaQuantita(
  righe: RigaCarrello[],
  prodottoId: string,
  delta: number,
): RigaCarrello[] {
  const corrente = righe.find((riga) => riga.prodottoId === prodottoId);
  if (!corrente) return righe;

  const nuova = corrente.quantita + delta;
  if (nuova <= 0) return righe.filter((riga) => riga.prodottoId !== prodottoId);
  if (nuova > QUANTITA_MASSIMA) return righe;

  return righe.map((riga) =>
    riga.prodottoId === prodottoId ? { ...riga, quantita: nuova } : riga,
  );
}

export function rimuoviRiga(righe: RigaCarrello[], prodottoId: string): RigaCarrello[] {
  return righe.filter((riga) => riga.prodottoId !== prodottoId);
}

/**
 * Si può battere se il carrello non è vuoto e non c'è già un invio in corso.
 * Nessun controllo sul pagamento: la Vendita nasce da pagare (ADR 0002).
 */
export function puoBattere(righe: RigaCarrello[], invioInCorso: boolean): boolean {
  return righe.length > 0 && !invioInCorso;
}

/** Payload delle righe per la RPC `crea_vendita`. */
export function righePerRpc(righe: RigaCarrello[]): Array<{ prodotto_id: string; quantita: number }> {
  return righe.map((riga) => ({ prodotto_id: riga.prodottoId, quantita: riga.quantita }));
}
