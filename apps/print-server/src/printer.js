import printer from '@thiagoelg/node-printer';
import { CharacterSet, PrinterTypes, ThermalPrinter } from 'node-thermal-printer';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const MAPPA_TIPI = {
  epson: PrinterTypes.EPSON,
  star: PrinterTypes.STAR,
  tanca: PrinterTypes.TANCA,
  daruma: PrinterTypes.DARUMA,
};

const LOGO_DEFAULT = fileURLToPath(new URL('../assets/logo.png', import.meta.url));
const LOGO = config.stampante.logoPath ?? (existsSync(LOGO_DEFAULT) ? LOGO_DEFAULT : null);

function costruisci() {
  return new ThermalPrinter({
    type: MAPPA_TIPI[config.stampante.tipo.toLowerCase()] ?? PrinterTypes.EPSON,
    interface: config.stampante.interface,
    driver: printer,
    width: config.stampante.larghezza,
    characterSet: CharacterSet[config.stampante.charset] ?? CharacterSet.PC852_LATIN2,
    removeSpecialCharacters: false,
  });
}

const qta = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
};

const eur = (n) => `€ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;

const ETICHETTA_METODO = {
  contanti: 'CONTANTI',
  pos: 'CARTA / POS',
};

/**
 * Riga di stato del promemoria. Una vendita nasce da pagare: è la condizione
 * normale, non un'anomalia, e il foglietto lo deve dire chiaramente perché è
 * quello che il cliente porta al banco per pagare.
 */
function rigaStato(payload) {
  if (payload.stato === 'pagata') {
    return `PAGATO — ${ETICHETTA_METODO[payload.metodo_pagamento] ?? payload.metodo_pagamento}`;
  }
  if (payload.stato === 'annullata') return 'ANNULLATA';
  return 'DA PAGARE';
}

export async function stampanteCollegata() {
  if (config.stampante.dryRun) return true;
  try {
    return await costruisci().isPrinterConnected();
  } catch {
    return false;
  }
}

/** Rende il promemoria come testo semplice (modalità dry-run / console). */
function rendiTesto(payload) {
  const w = config.stampante.larghezza;
  const linea = '-'.repeat(w);
  const out = [];

  out.push(LOGO ? `[logo: ${LOGO}]` : config.intestazione.toUpperCase());
  out.push(linea);
  out.push(`   N. ${payload.numero}`);
  out.push(linea);

  const quando = payload.created_at ? new Date(payload.created_at) : new Date();
  out.push(quando.toLocaleString('it-IT'));
  if (payload.cassiere) out.push(`Cassa: ${payload.cassiere}`);
  out.push(linea);

  for (const riga of payload.righe ?? []) {
    out.push(`${qta(riga.quantita)}x ${riga.nome_prodotto}`);
    if (riga.prezzo_unitario != null) {
      out.push(`   ${eur(riga.prezzo_unitario)} cad.  ${eur(riga.totale_riga)}`);
    }
  }

  out.push(linea);
  out.push(`TOTALE: ${eur(payload.totale)}`);
  out.push(rigaStato(payload));
  if (payload.note) {
    out.push(linea);
    out.push(`Nota: ${payload.note}`);
  }
  out.push('');
  out.push('Documento non fiscale');

  return out.join('\n');
}

/**
 * Stampa un promemoria a partire dal payload salvato in print_jobs.payload.
 * Solleva un'eccezione se fallisce, così il job va in retry o in errore.
 */
export async function stampaPromemoria(payload) {
  if (config.stampante.dryRun) {
    console.log('\n┌─ PROMEMORIA (dry-run) ───────────────');
    console.log(rendiTesto(payload));
    console.log('└──────────────────────────────────────\n');
    return;
  }

  const p = costruisci();

  p.alignCenter();
  let logoStampato = false;
  if (LOGO) {
    try {
      await p.printImage(LOGO);
      p.newLine();
      logoStampato = true;
    } catch (err) {
      console.warn('Logo non stampato:', String(err?.message ?? err));
    }
  }
  if (!logoStampato) {
    p.bold(true);
    p.setTextDoubleHeight();
    p.println(config.intestazione);
    p.setTextNormal();
    p.bold(false);
  }

  // Il Numero è l'unico aggancio fra il cliente e la sua vendita: va stampato
  // più grande di qualsiasi altra cosa sul foglietto.
  p.drawLine();
  p.bold(true);
  p.setTextSize(2, 2);
  p.println(`N. ${payload.numero}`);
  p.setTextNormal();
  p.bold(false);
  p.drawLine();

  p.alignLeft();
  const quando = payload.created_at ? new Date(payload.created_at) : new Date();
  p.println(quando.toLocaleString('it-IT'));
  if (payload.cassiere) p.println(`Cassa: ${payload.cassiere}`);
  p.drawLine();

  for (const riga of payload.righe ?? []) {
    p.bold(true);
    p.setTextDoubleHeight();
    p.println(`${qta(riga.quantita)}x ${riga.nome_prodotto}`);
    p.setTextNormal();
    p.bold(false);
    if (riga.prezzo_unitario != null) {
      p.tableCustom([
        { text: `  ${eur(riga.prezzo_unitario)} cad.`, align: 'LEFT', width: 0.6 },
        { text: eur(riga.totale_riga), align: 'RIGHT', width: 0.4 },
      ]);
    }
  }

  p.drawLine();
  p.bold(true);
  p.tableCustom([
    { text: 'TOTALE', align: 'LEFT', width: 0.5 },
    { text: eur(payload.totale), align: 'RIGHT', width: 0.5 },
  ]);
  p.bold(false);

  p.alignCenter();
  p.bold(true);
  p.println(rigaStato(payload));
  p.bold(false);

  if (payload.note) {
    p.alignLeft();
    p.drawLine();
    p.println(`Nota: ${payload.note}`);
  }

  p.newLine();
  p.alignCenter();
  // Obbligatorio dirlo: lo scontrino fiscale lo emette il registratore, non noi.
  p.println('Documento non fiscale');
  p.cut();

  const ok = await p.execute();
  if (ok === false) {
    throw new Error('La stampante ha rifiutato il job (execute=false)');
  }
}
