/** Formattazione condivisa. Locale fisso `it-IT`: l'app gira in un solo locale. */

const EURO = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

export function euro(value: number | string | null | undefined): string {
  return EURO.format(Number(value ?? 0));
}

/** Le quantità sono numeric: mostra i decimali solo quando ci sono davvero. */
export function quantita(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

const ORA = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const DATA_ORA = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function ora(value: string | Date): string {
  return ORA.format(new Date(value));
}

export function dataOra(value: string | Date): string {
  return DATA_ORA.format(new Date(value));
}
