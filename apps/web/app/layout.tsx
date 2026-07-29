import type { Metadata, Viewport } from 'next';
import { attivita } from '@/lib/attivita';
import { AuthProvider } from '@/lib/providers/auth-provider';
import { QueryProvider } from '@/lib/providers/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: attivita.titolo,
  description: attivita.descrizione,
};

export const viewport: Viewport = {
  themeColor: attivita.coloreBarra,
  // Si lavora con una mano sola su un telefono: niente zoom accidentale sui
  // tasti, ma il pinch resta possibile per chi ne ha bisogno.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
