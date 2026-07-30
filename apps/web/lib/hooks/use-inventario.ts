'use client';

import { createClient } from '@/lib/supabase/client';
import type {
  InventarioProdotto,
  Movimento,
  TipoMovimento,
  VendutoGiornaliero,
} from '@/lib/supabase/database.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

export const CHIAVI_INVENTARIO = {
  prodotti: ['inventario', 'prodotti'] as const,
  movimenti: ['inventario', 'movimenti'] as const,
  venduto: ['inventario', 'venduto'] as const,
};

export interface RigaVenduto {
  prodotto_id: string | null;
  nome_prodotto: string;
  quantita: number;
  incasso: number;
}
export function useInventario() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: CHIAVI_INVENTARIO.prodotti,
    queryFn: async (): Promise<InventarioProdotto[]> => {
      const { data, error } = await supabase.from('v_inventario').select('*').order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMovimentiInventario(limite = 200) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: [...CHIAVI_INVENTARIO.movimenti, limite],
    queryFn: async (): Promise<Movimento[]> => {
      const { data, error } = await supabase
        .from('movimenti')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limite);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVendutoInventario(da: string, a: string) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: [...CHIAVI_INVENTARIO.venduto, da, a],
    queryFn: async (): Promise<RigaVenduto[]> => {
      let query = supabase.from('v_venduto_giornaliero').select('*');
      if (da) query = query.gte('giorno', da);
      if (a) query = query.lte('giorno', a);
      const { data, error } = await query;
      if (error) throw error;
      const aggregate = new Map<string, RigaVenduto>();
      for (const row of (data ?? []) as VendutoGiornaliero[]) {
        const key = row.prodotto_id ?? row.nome_prodotto;
        const corrente = aggregate.get(key);
        aggregate.set(key, {
          prodotto_id: row.prodotto_id,
          nome_prodotto: row.nome_prodotto,
          quantita: Number(corrente?.quantita ?? 0) + Number(row.quantita),
          incasso: Number(corrente?.incasso ?? 0) + Number(row.incasso),
        });
      }
      return [...aggregate.values()].sort((x, y) => y.quantita - x.quantita);
    },
  });
}

export function useRegistraMovimento() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      prodottoId: string;
      tipo: Extract<TipoMovimento, 'carico' | 'scarico' | 'rettifica'>;
      quantita: number;
      prezzoUnitario: number | null;
      motivo: string;
    }) => {
      const { data, error } = await supabase.rpc('registra_movimento', {
        p_prodotto_id: input.prodottoId,
        p_tipo: input.tipo,
        p_quantita: input.quantita,
        p_prezzo_unitario: input.prezzoUnitario,
        p_motivo: input.motivo,
      });
      if (error) throw error;
      return Number(data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventario'] });
      void qc.invalidateQueries({ queryKey: ['giacenze'] });
    },
  });
}
