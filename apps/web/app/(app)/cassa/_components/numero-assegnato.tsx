'use client';

import { euro } from '@/lib/format';
import { useEffect } from 'react';

/**
 * Conferma di battitura. Il Numero è enorme di proposito: il cassiere lo legge
 * ad alta voce e lo ritrova stampato sul Promemoria che consegna al cliente.
 * È l'unico aggancio fra il cliente e la sua Vendita (ADR 0002).
 */
export function NumeroAssegnato({
  numero,
  totale,
  onChiudi,
}: {
  numero: number;
  totale: number;
  onChiudi: () => void;
}) {
  // Si richiude da sé: al banco nessuno ha una mano libera per premere "ok".
  useEffect(() => {
    const timer = setTimeout(onChiudi, 4000);
    return () => clearTimeout(timer);
  }, [onChiudi]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-fondo/95 px-6"
    >
      <p className="text-sm tracking-widest text-testo-debole uppercase">Numero</p>
      <p className="numeri text-[7rem] leading-none font-bold text-accento">{numero}</p>

      <div className="flex flex-col items-center gap-1">
        <p className="numeri text-2xl font-semibold">{euro(totale)}</p>
        <p className="text-sm text-testo-debole">da incassare</p>
      </div>

      <button
        type="button"
        onClick={onChiudi}
        className="mt-4 min-h-12 rounded-xl border border-bordo px-8 font-medium"
      >
        Avanti
      </button>
    </div>
  );
}
