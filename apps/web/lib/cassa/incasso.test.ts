import { describe, expect, it } from 'vitest';
import { calcolaResto, puoIncassare, scontoValido, totaleDaIncassare } from './incasso';

describe('totaleDaIncassare', () => {
  it('senza sconto è il totale delle righe', () => {
    expect(totaleDaIncassare(14.4)).toBe(14.4);
  });

  it('sottrae lo sconto', () => {
    expect(totaleDaIncassare(9.5, 0.5)).toBe(9);
  });

  it('non scende sotto zero se lo sconto supera il totale', () => {
    expect(totaleDaIncassare(5, 8)).toBe(0);
  });

  it('ignora uno sconto negativo', () => {
    expect(totaleDaIncassare(5, -3)).toBe(5);
  });
});

describe('calcolaResto', () => {
  it('è null con carta', () => {
    expect(calcolaResto('pos', 20, 14.4)).toBeNull();
  });

  it('è null finché non si digita il contante ricevuto', () => {
    expect(calcolaResto('contanti', '', 14.4)).toBeNull();
  });

  it('calcola il resto sui contanti', () => {
    expect(calcolaResto('contanti', 20, 14.4)).toBe(5.6);
  });

  it('è zero quando il cliente dà l’importo esatto', () => {
    expect(calcolaResto('contanti', 14.4, 14.4)).toBe(0);
  });
});

describe('puoIncassare', () => {
  it('no durante un invio in corso', () => {
    expect(puoIncassare('pos', '', 10, true)).toBe(false);
  });

  it('sì con carta, senza altre condizioni', () => {
    expect(puoIncassare('pos', '', 10, false)).toBe(true);
  });

  it('sì con contanti se il cassiere non digita nulla (conta a mano)', () => {
    expect(puoIncassare('contanti', '', 10, false)).toBe(true);
  });

  it('no se il contante ricevuto non copre il totale', () => {
    expect(puoIncassare('contanti', 5, 10, false)).toBe(false);
  });

  it('sì se lo copre esattamente', () => {
    expect(puoIncassare('contanti', 10, 10, false)).toBe(true);
  });
});

describe('scontoValido', () => {
  it('sconto zero è sempre valido, anche per un cassiere', () => {
    expect(scontoValido(0, '', 10, false)).toEqual({ valido: true });
  });

  it('un cassiere non può scontare', () => {
    expect(scontoValido(1, 'arrotondamento', 10, false)).toEqual({
      valido: false,
      errore: 'Solo il titolare può applicare uno sconto',
    });
  });

  it('lo sconto non può superare il totale', () => {
    expect(scontoValido(20, 'arrotondamento', 10, true)).toEqual({
      valido: false,
      errore: 'Lo sconto non può superare il totale della vendita',
    });
  });

  it('la causale è obbligatoria e non può essere solo spazi', () => {
    expect(scontoValido(1, '   ', 10, true)).toEqual({
      valido: false,
      errore: 'Indica il motivo dello sconto',
    });
  });

  it('titolare, importo nei limiti e causale: valido', () => {
    expect(scontoValido(0.5, 'arrotondamento', 9.5, true)).toEqual({ valido: true });
  });
});
