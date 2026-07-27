'use client';

import { createClient } from '@/lib/supabase/client';
import type {
  Chiusura,
  IncassoGiornaliero,
  RiepilogoCassiere,
  VendutoGiornaliero,
} from '@/lib/supabase/database.types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export interface Periodo {
  /** Data inclusa, formato `YYYY-MM-DD`. */
  da: string;
  /** Data inclusa, formato `YYYY-MM-DD`. */
  a: string;
}

/**
 * Le viste aggregano già per giorno lato server: qui si scaricano poche righe
 * e si somma sul periodo scelto. È il rimedio al calcolo lato client dell'app
 * originale, che paginava tutte le vendite per ricostruire il venduto.
 */
export function useVendutoPerProdotto(periodo: Periodo) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ['report', 'venduto', periodo.da, periodo.a],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_venduto_giornaliero')
        .select('*')
        .gte('giorno', periodo.da)
        .lte('giorno', periodo.a);
      if (error) throw error;

      const per = new Map<string, { nome: string; quantita: number; incasso: number }>();
      for (const riga of (data ?? []) as VendutoGiornaliero[]) {
        const chiave = riga.prodotto_id ?? riga.nome_prodotto;
        const corrente = per.get(chiave) ?? { nome: riga.nome_prodotto, quantita: 0, incasso: 0 };
        corrente.quantita += Number(riga.quantita);
        corrente.incasso += Number(riga.incasso);
        per.set(chiave, corrente);
      }

      return [...per.values()].sort((a, b) => b.incasso - a.incasso);
    },
  });
}

export function useIncassiPerGiorno(periodo: Periodo) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ['report', 'incassi', periodo.da, periodo.a],
    queryFn: async (): Promise<IncassoGiornaliero[]> => {
      const { data, error } = await supabase
        .from('v_incassi_giornalieri')
        .select('*')
        .gte('giorno', periodo.da)
        .lte('giorno', periodo.a)
        .order('giorno')
        .order('ora');
      if (error) throw error;
      return (data ?? []) as IncassoGiornaliero[];
    },
  });
}

export function useRiepilogoCassieri(periodo: Periodo) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ['report', 'cassieri', periodo.da, periodo.a],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_riepilogo_cassiere')
        .select('*')
        .gte('giorno', periodo.da)
        .lte('giorno', periodo.a);
      if (error) throw error;

      const per = new Map<string, { nome: string; battute: number; pagate: number; annullate: number; incasso: number }>();
      for (const riga of (data ?? []) as RiepilogoCassiere[]) {
        const corrente = per.get(riga.profile_id) ?? {
          nome: riga.nome,
          battute: 0,
          pagate: 0,
          annullate: 0,
          incasso: 0,
        };
        corrente.battute += riga.battute;
        corrente.pagate += riga.pagate;
        corrente.annullate += riga.annullate;
        corrente.incasso += Number(riga.incasso);
        per.set(riga.profile_id, corrente);
      }

      return [...per.values()].sort((a, b) => b.incasso - a.incasso);
    },
  });
}

export function useChiusure() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ['chiusure'],
    queryFn: async (): Promise<Chiusura[]> => {
      const { data, error } = await supabase
        .from('chiusure')
        .select('*')
        .order('numero', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}
