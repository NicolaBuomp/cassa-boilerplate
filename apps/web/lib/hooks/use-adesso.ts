'use client';

import { useEffect, useState } from 'react';

/**
 * L'ora corrente, che avanza a scatti.
 *
 * Serve alle etichette che invecchiano da sole — "In coda da 9 min" — e che
 * altrimenti resterebbero ferme finché qualcos'altro non fa ridisegnare la
 * lista. Leggere `Date.now()` dentro il render non si può: è impuro, e React
 * non garantisce quando quel render riaccade.
 *
 * Si chiama una volta sola nella schermata e si passa il valore alle righe: un
 * timer per riga, su una lista lunga, sarebbe uno spreco.
 */
export function useAdesso(intervalloMs = 30_000): number {
  const [adesso, setAdesso] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAdesso(Date.now()), intervalloMs);
    return () => clearInterval(id);
  }, [intervalloMs]);

  return adesso;
}
