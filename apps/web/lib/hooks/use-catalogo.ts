'use client';

import { createClient } from '@/lib/supabase/client';
import type { Categoria, Database, Prodotto } from '@/lib/supabase/database.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

type ProdottoInsert = Database['public']['Tables']['prodotti']['Insert'];
type ProdottoUpdate = Database['public']['Tables']['prodotti']['Update'];
type CategoriaInsert = Database['public']['Tables']['categorie']['Insert'];
type CategoriaUpdate = Database['public']['Tables']['categorie']['Update'];

export const CHIAVI = {
  categorie: ['categorie'] as const,
  prodotti: ['prodotti'] as const,
};

export function useCategorie() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: CHIAVI.categorie,
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from('categorie')
        .select('*')
        .order('ordine')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Il catalogo completo. La schermata di battitura filtra sui soli disponibili;
 * il Catalogo del titolare li vuole tutti, compresi gli esauriti.
 */
export function useProdotti() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: CHIAVI.prodotti,
    queryFn: async (): Promise<Prodotto[]> => {
      const { data, error } = await supabase
        .from('prodotti')
        .select('*')
        .order('ordine')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreaProdotto() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (prodotto: ProdottoInsert) => {
      const { data, error } = await supabase.from('prodotti').insert(prodotto).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHIAVI.prodotti }),
  });
}

export function useAggiornaProdotto() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: ProdottoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('prodotti')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHIAVI.prodotti }),
  });
}

export function useEliminaProdotto() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prodotti').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHIAVI.prodotti }),
  });
}

export function useCreaCategoria() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (categoria: CategoriaInsert) => {
      const { data, error } = await supabase.from('categorie').insert(categoria).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHIAVI.categorie }),
  });
}

export function useAggiornaCategoria() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: CategoriaUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('categorie')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHIAVI.categorie }),
  });
}

export function useEliminaCategoria() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorie').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CHIAVI.categorie });
      // I prodotti della categoria restano, con categoria_id a null.
      void qc.invalidateQueries({ queryKey: CHIAVI.prodotti });
    },
  });
}
