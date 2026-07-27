import type { StatoVendita } from '@/lib/supabase/database.types';

const ETICHETTE: Record<StatoVendita, { testo: string; classe: string }> = {
  da_pagare: { testo: 'Da pagare', classe: 'border-accento text-accento' },
  pagata: { testo: 'Pagata', classe: 'border-positivo text-positivo' },
  annullata: { testo: 'Annullata', classe: 'border-bordo text-testo-debole line-through' },
};

export function StatoVenditaBadge({ stato }: { stato: StatoVendita }) {
  const { testo, classe } = ETICHETTE[stato];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${classe}`}>
      {testo}
    </span>
  );
}

export const METODO_ETICHETTA: Record<string, string> = {
  contanti: 'Contanti',
  pos: 'Carta',
};
