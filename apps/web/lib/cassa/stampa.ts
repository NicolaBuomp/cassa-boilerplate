import type { StatoStampa } from '@/lib/supabase/database.types';

/**
 * Oltre questa attesa un job ancora `pending` smette di essere normale.
 *
 * Il print server prende in carico un job in un attimo, e comunque ripassa la
 * coda ogni 15 secondi. Due minuti sono lontanissimi da entrambi i tempi:
 * quando si superano, quasi sempre significa che il demone non è in ascolto —
 * PC riavviato, finestra chiusa, rete del banco caduta.
 *
 * Non è una diagnosi, è un sospetto: per questo l'etichetta dice da quanto
 * aspetta invece di dichiarare che il print server è morto.
 */
const ATTESA_SOSPETTA_MS = 2 * 60 * 1000;

export interface DescrizioneStampa {
  testo: string;
  /** Vero quando vale la pena guardare il PC del banco. */
  allarme: boolean;
}

/**
 * Che cosa scrivere accanto a una Vendita a proposito della sua stampa.
 *
 * `adesso` è un parametro e non `Date.now()` preso qui dentro, perché così la
 * funzione resta pura e la si prova senza orologi finti.
 */
export function descriviStampa(
  stato: StatoStampa | null,
  accodataIl: string | null,
  adesso: number,
): DescrizioneStampa {
  if (stato === 'error') return { testo: 'Stampa fallita', allarme: true };
  if (stato === 'printed') return { testo: 'Stampato', allarme: false };

  // Nessun job: la Vendita è nata prima che l'Attività attivasse la stampa,
  // oppure il job è stato cancellato a mano. Non c'è niente da attendere.
  if (stato === null) return { testo: 'Nessuna stampa', allarme: false };

  const accodata = accodataIl ? Date.parse(accodataIl) : Number.NaN;
  if (Number.isNaN(accodata)) return { testo: 'Stampa in coda', allarme: false };

  const attesaMs = adesso - accodata;
  if (attesaMs < ATTESA_SOSPETTA_MS) return { testo: 'Stampa in coda', allarme: false };

  return { testo: `In coda da ${descriviAttesa(attesaMs)}`, allarme: true };
}

/** Un'attesa arrotondata per grosso: serve a dare la scala, non l'ora esatta. */
function descriviAttesa(ms: number): string {
  const minuti = Math.floor(ms / 60_000);
  if (minuti < 60) return `${minuti} min`;

  const ore = Math.floor(minuti / 60);
  if (ore < 24) return ore === 1 ? '1 ora' : `${ore} ore`;

  const giorni = Math.floor(ore / 24);
  return giorni === 1 ? '1 giorno' : `${giorni} giorni`;
}
