import { attivita } from '@/lib/attivita';
import type { MetadataRoute } from 'next';

/**
 * Il manifest che permette di installare la cassa sulla schermata del telefono.
 *
 * Non è un vezzo: installata, l'app perde la barra degli indirizzi e recupera
 * la striscia di schermo che al banco serve per un'altra riga di carrello. E si
 * apre con un tocco invece che cercando un segnalibro.
 *
 * `display: standalone` e non `fullscreen`: l'orologio e la batteria devono
 * restare visibili: chi sta al banco li guarda.
 *
 * Le icone sono in `public/`, in SVG. Vanno sostituite con quelle
 * dell'Attività — vedi `docs/personalizzazione.md`, punto 3.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: attivita.titolo,
    // Sotto l'icona ci stanno una dozzina di caratteri: meglio troncare qui che
    // lasciarlo fare al telefono.
    short_name: attivita.titolo.slice(0, 12),
    description: attivita.descrizione,
    start_url: '/cassa',
    display: 'standalone',
    orientation: 'portrait',
    background_color: attivita.coloreBarra,
    theme_color: attivita.coloreBarra,
    lang: 'it',
    icons: [
      {
        src: '/icona.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        // `maskable` lascia che Android ritagli l'icona nella forma del suo
        // tema: il disegno tiene i margini che quel ritaglio si mangia.
        src: '/icona.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
