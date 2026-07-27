/**
 * Tipi dello schema Postgres.
 *
 * Rigenerare dopo ogni migration con:
 *   npm run db:types
 *
 * Se questo file e il database divergono, il database ha ragione.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Ruolo = 'titolare' | 'cassiere';
export type StatoVendita = 'da_pagare' | 'pagata' | 'annullata';
export type MetodoPagamento = 'contanti' | 'pos';
export type StatoStampa = 'pending' | 'printing' | 'printed' | 'error';

export interface RigaVenditaJson {
  id: string;
  prodotto_id: string | null;
  nome_prodotto: string;
  prezzo_unitario: number;
  quantita: number;
  totale_riga: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          email: string | null;
          ruolo: Ruolo;
          attivo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          email?: string | null;
          ruolo?: Ruolo;
          attivo?: boolean;
        };
        Update: {
          nome?: string;
          email?: string | null;
          ruolo?: Ruolo;
          attivo?: boolean;
        };
        Relationships: [];
      };
      categorie: {
        Row: { id: string; nome: string; ordine: number; created_at: string };
        Insert: { id?: string; nome: string; ordine?: number };
        Update: { nome?: string; ordine?: number };
        Relationships: [];
      };
      prodotti: {
        Row: {
          id: string;
          nome: string;
          categoria_id: string | null;
          prezzo: number;
          disponibile: boolean;
          ordine: number;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          categoria_id?: string | null;
          prezzo: number;
          disponibile?: boolean;
          ordine?: number;
          note?: string | null;
        };
        Update: {
          nome?: string;
          categoria_id?: string | null;
          prezzo?: number;
          disponibile?: boolean;
          ordine?: number;
          note?: string | null;
        };
        Relationships: [];
      };
      chiusure: {
        Row: {
          id: string;
          numero: number;
          chiusa_at: string;
          chiusa_da: string;
          totale_contanti: number;
          totale_pos: number;
          totale_sconti: number;
          totale: number;
          numero_vendite: number;
          numero_annullate: number;
          note: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vendite: {
        Row: {
          id: string;
          numero: number;
          stato: StatoVendita;
          chiusura_id: string | null;
          metodo_pagamento: MetodoPagamento | null;
          totale_righe: number;
          sconto: number;
          sconto_motivo: string | null;
          totale: number;
          contante_ricevuto: number | null;
          resto: number | null;
          battuta_da: string;
          created_at: string;
          incassata_da: string | null;
          incassata_at: string | null;
          annullata_da: string | null;
          annullata_at: string | null;
          annullamento_motivo: string | null;
          request_id: string | null;
          note: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      righe_vendita: {
        Row: {
          id: string;
          vendita_id: string;
          prodotto_id: string | null;
          nome_prodotto: string;
          prezzo_unitario: number;
          quantita: number;
          totale_riga: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      print_jobs: {
        Row: {
          id: string;
          vendita_id: string;
          payload: Json;
          status: StatoStampa;
          attempts: number;
          error: string | null;
          printed_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      v_vendite: {
        Row: Database['public']['Tables']['vendite']['Row'] & {
          battuta_da_nome: string;
          incassata_da_nome: string | null;
          righe: RigaVenditaJson[];
          stato_stampa: StatoStampa | null;
          print_job_id: string | null;
        };
        Relationships: [];
      };
      v_venduto_giornaliero: {
        Row: {
          giorno: string;
          prodotto_id: string | null;
          nome_prodotto: string;
          quantita: number;
          incasso: number;
        };
        Relationships: [];
      };
      v_incassi_giornalieri: {
        Row: {
          giorno: string;
          ora: number;
          metodo_pagamento: MetodoPagamento | null;
          numero_vendite: number;
          incasso: number;
        };
        Relationships: [];
      };
      v_riepilogo_cassiere: {
        Row: {
          giorno: string;
          profile_id: string;
          nome: string;
          battute: number;
          pagate: number;
          annullate: number;
          incasso: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      crea_vendita: {
        Args: {
          p_righe: Json;
          p_request_id?: string | null;
          p_note?: string | null;
          p_metodo_pagamento?: MetodoPagamento | null;
          p_contante_ricevuto?: number | null;
        };
        Returns: { id: string; numero: number };
      };
      incassa_vendita: {
        Args: {
          p_vendita_id: string;
          p_metodo: MetodoPagamento;
          p_contante_ricevuto?: number | null;
          p_sconto?: number;
          p_sconto_motivo?: string | null;
        };
        Returns: string;
      };
      annulla_vendita: {
        Args: { p_vendita_id: string; p_motivo: string };
        Returns: string;
      };
      chiudi_cassa: {
        Args: { p_note?: string | null };
        Returns: string;
      };
      ristampa_vendita: {
        Args: { p_vendita_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profilo = Database['public']['Tables']['profiles']['Row'];
export type Categoria = Database['public']['Tables']['categorie']['Row'];
export type Prodotto = Database['public']['Tables']['prodotti']['Row'];
export type Chiusura = Database['public']['Tables']['chiusure']['Row'];
export type Vendita = Database['public']['Views']['v_vendite']['Row'];
export type VendutoGiornaliero = Database['public']['Views']['v_venduto_giornaliero']['Row'];
export type IncassoGiornaliero = Database['public']['Views']['v_incassi_giornalieri']['Row'];
export type RiepilogoCassiere = Database['public']['Views']['v_riepilogo_cassiere']['Row'];
