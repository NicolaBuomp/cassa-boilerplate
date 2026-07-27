import { describe, expect, it } from 'vitest';
import {
  QUANTITA_MASSIMA,
  aggiungiRiga,
  cambiaQuantita,
  pezziCarrello,
  puoBattere,
  righePerRpc,
  rimuoviRiga,
  totaleCarrello,
  type RigaCarrello,
} from './carrello';

const birra = { prodottoId: 'p1', nome: 'Birra media', prezzo: 4 };
const caffe = { prodottoId: 'p2', nome: 'Caffè', prezzo: 1.2 };

const carrello = (...righe: RigaCarrello[]) => righe;

describe('totaleCarrello', () => {
  it('somma prezzo per quantità', () => {
    expect(totaleCarrello(carrello({ ...birra, quantita: 3 }, { ...caffe, quantita: 2 }))).toBe(14.4);
  });

  it('è zero sul carrello vuoto', () => {
    expect(totaleCarrello([])).toBe(0);
  });

  it('non accumula derive floating-point sui centesimi', () => {
    const righe = Array.from({ length: 10 }, (_, i) => ({
      prodottoId: `p${i}`,
      nome: `Prodotto ${i}`,
      prezzo: 0.1,
      quantita: 1,
    }));
    expect(totaleCarrello(righe)).toBe(1);
  });

  it('arrotonda la singola riga prima di sommare', () => {
    // 1.115 * 3 = 3.345 → la riga vale 3.35 (arrotondata), non 3.34.
    expect(totaleCarrello(carrello({ prodottoId: 'x', nome: 'X', prezzo: 1.115, quantita: 3 }))).toBe(3.35);
  });
});

describe('pezziCarrello', () => {
  it('conta i pezzi, non le righe', () => {
    expect(pezziCarrello(carrello({ ...birra, quantita: 3 }, { ...caffe, quantita: 2 }))).toBe(5);
  });
});

describe('aggiungiRiga', () => {
  it('crea la riga la prima volta', () => {
    expect(aggiungiRiga([], birra)).toEqual([{ ...birra, quantita: 1 }]);
  });

  it('accorpa sulla riga esistente invece di duplicarla', () => {
    const righe = aggiungiRiga(carrello({ ...birra, quantita: 1 }), birra);
    expect(righe).toEqual([{ ...birra, quantita: 2 }]);
  });

  it('non supera il tetto per riga', () => {
    expect(aggiungiRiga(carrello({ ...birra, quantita: QUANTITA_MASSIMA }), birra)).toBeNull();
  });

  it('non muta il carrello di partenza', () => {
    const partenza = carrello({ ...birra, quantita: 1 });
    aggiungiRiga(partenza, birra);
    expect(partenza).toEqual([{ ...birra, quantita: 1 }]);
  });
});

describe('cambiaQuantita', () => {
  it('incrementa', () => {
    expect(cambiaQuantita(carrello({ ...birra, quantita: 2 }), 'p1', 1)).toEqual([
      { ...birra, quantita: 3 },
    ]);
  });

  it('rimuove la riga quando si scende a zero', () => {
    expect(cambiaQuantita(carrello({ ...birra, quantita: 1 }), 'p1', -1)).toEqual([]);
  });

  it('ignora un prodotto che non è nel carrello', () => {
    const righe = carrello({ ...birra, quantita: 1 });
    expect(cambiaQuantita(righe, 'inesistente', 1)).toEqual(righe);
  });

  it('si ferma al tetto senza modificare nulla', () => {
    const righe = carrello({ ...birra, quantita: QUANTITA_MASSIMA });
    expect(cambiaQuantita(righe, 'p1', 1)).toEqual(righe);
  });
});

describe('rimuoviRiga', () => {
  it('toglie solo la riga indicata', () => {
    const righe = carrello({ ...birra, quantita: 2 }, { ...caffe, quantita: 1 });
    expect(rimuoviRiga(righe, 'p1')).toEqual([{ ...caffe, quantita: 1 }]);
  });
});

describe('puoBattere', () => {
  it('no sul carrello vuoto', () => {
    expect(puoBattere([], false)).toBe(false);
  });

  it('no se c’è già un invio in corso', () => {
    expect(puoBattere(carrello({ ...birra, quantita: 1 }), true)).toBe(false);
  });

  it('sì con almeno una riga e nessun invio in corso', () => {
    expect(puoBattere(carrello({ ...birra, quantita: 1 }), false)).toBe(true);
  });
});

describe('righePerRpc', () => {
  it('manda solo prodotto e quantità: il prezzo lo decide il database', () => {
    expect(righePerRpc(carrello({ ...birra, quantita: 2 }))).toEqual([
      { prodotto_id: 'p1', quantita: 2 },
    ]);
  });
});
