'use client';

import { createClient } from '@/lib/supabase/client';
import type { Profilo, Ruolo } from '@/lib/supabase/database.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

export function useProfili() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ['profili'],
    queryFn: async (): Promise<Profilo[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAggiornaProfilo() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      nome?: string;
      ruolo?: Ruolo;
      attivo?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profili'] }),
  });
}
