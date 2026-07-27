'use client';

import type { MetodoPagamento } from '@/lib/cassa/incasso';
import { createClient } from '@/lib/supabase/client';
import type { Json, Vendita } from '@/lib/supabase/database.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

export const CHIAVI_VENDITE = {
  daIncassare: ['vendite', 'da-incassare'] as const,
  sessione: ['vendite', 'sessione'] as const,
  mie: ['vendite', 'mie'] as const,
};

/** Invalida tutto ciò che dipende dalle vendite: gli stati si incrociano. */
function invalidaVendite(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['vendite'] });
}

/**
 * Le vendite ancora da incassare. La RLS fa già il filtro per autore: un
 * Cassiere vede solo le proprie, il Titolare le vede tutte (ADR 0003).
 */
export function useVenditeDaIncassare() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: CHIAVI_VENDITE.daIncassare,
    queryFn: async (): Promise<Vendita[]> => {
      const { data, error } = await supabase
        .from('v_vendite')
        .select('*')
        .eq('stato', 'da_pagare')
        .is('chiusura_id', null)
        .order('numero');
      if (error) throw error;
      return (data ?? []) as Vendita[];
    },
  });
}

/** Tutte le vendite della sessione di cassa aperta. Alimenta la Plancia. */
export function useVenditeSessione() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: CHIAVI_VENDITE.sessione,
    queryFn: async (): Promise<Vendita[]> => {
      const { data, error } = await supabase
        .from('v_vendite')
        .select('*')
        .is('chiusura_id', null)
        .order('numero', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Vendita[];
    },
  });
}

/** Storico ricercabile. La RLS applica lo stesso filtro per autore. */
export function useStoricoVendite(opzioni: { da?: string; a?: string; limite?: number } = {}) {
  const supabase = useMemo(() => createClient(), []);
  const { da, a, limite = 200 } = opzioni;

  return useQuery({
    queryKey: [...CHIAVI_VENDITE.mie, da ?? null, a ?? null, limite],
    queryFn: async (): Promise<Vendita[]> => {
      let q = supabase.from('v_vendite').select('*').order('created_at', { ascending: false });
      if (da) q = q.gte('created_at', da);
      if (a) q = q.lte('created_at', a);
      const { data, error } = await q.limit(limite);
      if (error) throw error;
      return (data ?? []) as Vendita[];
    },
  });
}

export interface CreaVenditaInput {
  righe: Array<{ prodotto_id: string; quantita: number }>;
  /** Idempotenza sui retry di rete: stesso id, una sola vendita. */
  requestId: string;
  note?: string;
  /** Valorizzato solo nel caso "paga subito": altrimenti la vendita nasce da pagare. */
  metodoPagamento?: MetodoPagamento;
  contanteRicevuto?: number;
}

export interface VenditaCreata {
  id: string;
  numero: number;
}

export function useCreaVendita() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreaVenditaInput): Promise<VenditaCreata> => {
      const { data, error } = await supabase.rpc('crea_vendita', {
        p_righe: input.righe as unknown as Json,
        p_request_id: input.requestId,
        p_note: input.note ?? null,
        p_metodo_pagamento: input.metodoPagamento ?? null,
        p_contante_ricevuto: input.contanteRicevuto ?? null,
      });
      if (error) throw error;
      return data as VenditaCreata;
    },
    onSuccess: () => invalidaVendite(qc),
  });
}

export interface IncassaVenditaInput {
  venditaId: string;
  metodo: MetodoPagamento;
  contanteRicevuto?: number;
  sconto?: number;
  scontoMotivo?: string;
}

export function useIncassaVendita() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: IncassaVenditaInput): Promise<string> => {
      const { data, error } = await supabase.rpc('incassa_vendita', {
        p_vendita_id: input.venditaId,
        p_metodo: input.metodo,
        p_contante_ricevuto: input.contanteRicevuto ?? null,
        p_sconto: input.sconto ?? 0,
        p_sconto_motivo: input.scontoMotivo ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidaVendite(qc),
  });
}

export function useAnnullaVendita() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ venditaId, motivo }: { venditaId: string; motivo: string }) => {
      const { data, error } = await supabase.rpc('annulla_vendita', {
        p_vendita_id: venditaId,
        p_motivo: motivo,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidaVendite(qc),
  });
}

export function useRistampaVendita() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (venditaId: string) => {
      const { data, error } = await supabase.rpc('ristampa_vendita', { p_vendita_id: venditaId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidaVendite(qc),
  });
}

export function useChiudiCassa() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (note?: string) => {
      const { data, error } = await supabase.rpc('chiudi_cassa', { p_note: note ?? null });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      invalidaVendite(qc);
      void qc.invalidateQueries({ queryKey: ['chiusure'] });
    },
  });
}

/**
 * Tiene allineate le liste di vendite senza polling. Serve alla Plancia e alla
 * lista "Da incassare": due cassieri che battono in contemporanea devono
 * vedersi comparire i numeri l'uno dell'altro.
 */
export function useVenditeRealtime(attivo: boolean = true) {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  useEffect(() => {
    if (!attivo) return;

    const canale = supabase
      .channel('vendite-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendite' }, () =>
        invalidaVendite(qc),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, () =>
        invalidaVendite(qc),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canale);
    };
  }, [supabase, qc, attivo]);
}
