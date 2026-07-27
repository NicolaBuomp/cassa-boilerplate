// Logica pura dell'incasso: sconto, totale dovuto, resto.
// Il database ricalcola tutto per conto suo — queste funzioni servono solo a
// mostrare i numeri giusti prima di premere il tasto.

import { arrotonda } from './carrello';

export type MetodoPagamento = 'contanti' | 'pos';

export const METODI: ReadonlyArray<{ valore: MetodoPagamento; etichetta: string }> = [
  { valore: 'contanti', etichetta: 'Contanti' },
  { valore: 'pos', etichetta: 'Carta / POS' },
];

/** Quanto deve davvero il cliente: totale delle righe meno lo sconto. */
export function totaleDaIncassare(totaleRighe: number, sconto: number = 0): number {
  const scontoValido = Math.min(Math.max(sconto, 0), totaleRighe);
  return arrotonda(totaleRighe - scontoValido);
}

/**
 * Resto per il pagamento in contanti. `null` quando non è applicabile: con
 * carta, oppure finché il cassiere non ha digitato quanto ha ricevuto.
 */
export function calcolaResto(
  metodo: MetodoPagamento,
  contanteRicevuto: number | '',
  totale: number,
): number | null {
  if (metodo !== 'contanti' || contanteRicevuto === '') return null;
  return arrotonda(Number(contanteRicevuto) - totale);
}

/**
 * Si può incassare se non c'è già un invio in corso e — per i contanti — o il
 * cassiere non ha indicato il contante ricevuto (lo conta a mano), oppure
 * quanto ha ricevuto copre il totale.
 */
export function puoIncassare(
  metodo: MetodoPagamento,
  contanteRicevuto: number | '',
  totale: number,
  invioInCorso: boolean,
): boolean {
  if (invioInCorso) return false;
  if (metodo === 'contanti' && contanteRicevuto !== '') {
    return Number(contanteRicevuto) >= totale;
  }
  return true;
}

/**
 * Uno sconto è valido solo se lo applica il titolare, non supera il totale e
 * porta con sé una causale (vedi `incassa_vendita` lato database).
 */
export function scontoValido(
  sconto: number,
  motivo: string,
  totaleRighe: number,
  eTitolare: boolean,
): { valido: true } | { valido: false; errore: string } {
  if (sconto <= 0) return { valido: true };
  if (!eTitolare) return { valido: false, errore: 'Solo il titolare può applicare uno sconto' };
  if (sconto > totaleRighe) {
    return { valido: false, errore: 'Lo sconto non può superare il totale della vendita' };
  }
  if (motivo.trim() === '') return { valido: false, errore: 'Indica il motivo dello sconto' };
  return { valido: true };
}
