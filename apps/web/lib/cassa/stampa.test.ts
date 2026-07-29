import { describe, expect, it } from 'vitest';
import { descriviStampa } from './stampa';

const ADESSO = Date.parse('2026-03-14T21:00:00.000Z');
const faMinuti = (n: number) => new Date(ADESSO - n * 60_000).toISOString();

describe('descriviStampa', () => {
  it('dice stampato quando il job è andato a buon fine', () => {
    expect(descriviStampa('printed', faMinuti(180), ADESSO)).toEqual({
      testo: 'Stampato',
      allarme: false,
    });
  });

  it('segnala il fallimento definitivo, per quanto vecchio', () => {
    expect(descriviStampa('error', faMinuti(600), ADESSO)).toEqual({
      testo: 'Stampa fallita',
      allarme: true,
    });
  });

  it('non allarma per un job appena accodato', () => {
    expect(descriviStampa('pending', faMinuti(0), ADESSO)).toEqual({
      testo: 'Stampa in coda',
      allarme: false,
    });
  });

  // Il caso che ha motivato la funzione: col print server spento il job resta
  // `pending` per sempre, e prima l'etichetta era identica a quella di un job
  // di mezzo secondo.
  it('allarma quando il job è pending da più di due minuti', () => {
    expect(descriviStampa('pending', faMinuti(9), ADESSO)).toEqual({
      testo: 'In coda da 9 min',
      allarme: true,
    });
  });

  it('vale anche per un job preso e mai concluso', () => {
    // `printing` rimasto appeso: il print server è morto a metà lavoro.
    expect(descriviStampa('printing', faMinuti(40), ADESSO).allarme).toBe(true);
  });

  it('non scrive mai attese in minuti a tre cifre', () => {
    expect(descriviStampa('pending', faMinuti(60), ADESSO).testo).toBe('In coda da 1 ora');
    expect(descriviStampa('pending', faMinuti(200), ADESSO).testo).toBe('In coda da 3 ore');
    expect(descriviStampa('pending', faMinuti(60 * 24), ADESSO).testo).toBe('In coda da 1 giorno');
    expect(descriviStampa('pending', faMinuti(60 * 24 * 5), ADESSO).testo).toBe(
      'In coda da 5 giorni',
    );
  });

  it('resta muto per una vendita senza job di stampa', () => {
    expect(descriviStampa(null, null, ADESSO)).toEqual({
      testo: 'Nessuna stampa',
      allarme: false,
    });
  });

  // La vista espone il timestamp del job più recente: se manca, o è illeggibile,
  // si torna all'etichetta neutra invece di mostrare "In coda da NaN min".
  it('regge un timestamp mancante o malformato', () => {
    expect(descriviStampa('pending', null, ADESSO).testo).toBe('Stampa in coda');
    expect(descriviStampa('pending', 'ieri sera', ADESSO).testo).toBe('Stampa in coda');
  });

  // Gli orologi del telefono e del server non sono sincronizzati: un job può
  // sembrare accodato nel futuro. Non deve diventare un allarme.
  it('non allarma se il job risulta accodato nel futuro', () => {
    expect(descriviStampa('pending', faMinuti(-5), ADESSO)).toEqual({
      testo: 'Stampa in coda',
      allarme: false,
    });
  });
});
