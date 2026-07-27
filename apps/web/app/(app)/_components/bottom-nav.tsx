'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Voce {
  href: string;
  etichetta: string;
  icona: React.ReactNode;
  soloTitolare?: boolean;
}

// Icone inline: due tratti bastano a distinguerle e non serve una libreria.
const Ico = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-6"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const VOCI: Voce[] = [
  { href: '/cassa', etichetta: 'Batti', icona: <Ico d="M4 7h16M4 12h16M4 17h9" /> },
  {
    href: '/da-incassare',
    etichetta: 'Da incassare',
    icona: <Ico d="M3 8h18v10H3zM3 12h18M7 16h3" />,
  },
  { href: '/vendite', etichetta: 'Vendite', icona: <Ico d="M4 19V5m5 14V9m5 10v-7m5 7V7" /> },
  {
    href: '/plancia',
    etichetta: 'Plancia',
    icona: <Ico d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z" />,
    soloTitolare: true,
  },
  {
    href: '/altro',
    etichetta: 'Altro',
    icona: <Ico d="M5 12h.01M12 12h.01M19 12h.01" />,
    soloTitolare: true,
  },
];

export function BottomNav() {
  const { eTitolare } = useAuth();
  const pathname = usePathname();
  const voci = VOCI.filter((voce) => !voce.soloTitolare || eTitolare);

  return (
    <nav
      aria-label="Navigazione principale"
      className="sticky bottom-0 z-20 border-t border-bordo bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl">
        {voci.map((voce) => {
          const attiva = pathname === voce.href || pathname.startsWith(`${voce.href}/`);
          return (
            <li key={voce.href} className="flex-1">
              <Link
                href={voce.href}
                aria-current={attiva ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[0.68rem] ${
                  attiva ? 'text-accento' : 'text-testo-debole'
                }`}
              >
                {voce.icona}
                <span>{voce.etichetta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
