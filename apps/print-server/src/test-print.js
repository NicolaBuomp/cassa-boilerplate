// Stampa un promemoria finto, senza toccare il database.
//   npm run test:print
// Con PRINTER_DRY_RUN=true finisce a console invece che sulla termica.

import { stampaPromemoria, stampanteCollegata } from './printer.js';

const finto = {
  numero: 47,
  created_at: new Date().toISOString(),
  cassiere: 'Prova',
  stato: 'da_pagare',
  metodo_pagamento: null,
  totale: 14.4,
  note: 'Stampa di prova',
  righe: [
    { nome_prodotto: 'Birra media', quantita: 3, prezzo_unitario: 4, totale_riga: 12 },
    { nome_prodotto: 'Caffè', quantita: 2, prezzo_unitario: 1.2, totale_riga: 2.4 },
  ],
};

console.log('Stampante collegata:', (await stampanteCollegata()) ? 'sì' : 'NO');
await stampaPromemoria(finto);
console.log('Fatto.');
