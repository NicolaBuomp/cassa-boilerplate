/**
 * L'identità dell'Attività che usa questa cassa.
 *
 * È l'unico file di codice che ogni nuova installazione deve modificare: tutto
 * il resto è dominio, e il dominio non cambia con l'insegna.
 *
 * I colori NON stanno qui. I token `@theme` di Tailwind v4 sono compile-time e
 * vivono in `app/globals.css`: da lì li leggono le classi (`bg-accento`,
 * `text-testo-debole`…), e nessuna variabile TypeScript può alimentarli.
 * L'unica eccezione è `coloreBarra` qui sotto, che il browser vuole come stringa
 * nel `<meta name="theme-color">` — e che va tenuto allineato a mano.
 */
export const attivita = {
  /** Il nome che compare sulla schermata di accesso. */
  nome: 'Cassa',

  /** La riga sotto il nome. Serve a dire cosa è questa app, non a fare marketing. */
  sottotitolo: 'Cassa',

  /** Titolo della scheda del browser e nome dell'app installata sul telefono. */
  titolo: 'Cassa',

  /** Descrizione nei metadati. Non la legge quasi nessuno, ma finisce nelle anteprime. */
  descrizione: 'Cassa e catalogo prodotti.',

  /**
   * Colore della barra di sistema del telefono.
   * Deve corrispondere a `--color-fondo` in `app/globals.css`: se ricolori il
   * tema e dimentichi questo, la barra resta del colore di un'altra attività.
   */
  coloreBarra: '#14161a',
} as const;
