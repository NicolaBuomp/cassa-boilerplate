/**
 * Tipi dello schema Postgres.
 *
 * ATTENZIONE: questo file è mantenuto **a mano**, e non va sovrascritto con
 * l'output di `supabase gen types`. Il generatore non conosce le union con nome
 * qui sotto (`Ruolo`, `StatoVendita`, `StatoStampa`, `MetodoPagamento`): dove
 * loro dicono `'da_pagare' | 'pagata' | 'annullata'`, lui dice `string`, e i
 * controlli di esaustività nei componenti smetterebbero di funzionare.
 *
 * Dopo una migration:
 *   npm run db:types     → scrive database.generated.ts, che è un RIFERIMENTO
 *   e si riportano a mano le differenze qui dentro.
 *
 * Se questo file e il database divergono, il database ha ragione. Nessuno lo
 * verifica per voi: la CI prova soltanto che il generatore giri.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Ruolo = 'titolare' | 'cassiere';
export type StatoVendita = 'da_pagare' | 'pagata' | 'annullata';
export type MetodoPagamento = 'contanti' | 'pos';
export type StatoStampa = 'pending' | 'printing' | 'printed' | 'error';
export type TipoMovimento = 'carico' | 'scarico' | 'vendita' | 'annullo' | 'rettifica';

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
          traccia_giacenza: boolean;
          unita: string;
          sku: string | null;
          prezzo_acquisto: number;
          scorta_minima: number;
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
          traccia_giacenza?: boolean;
          unita?: string;
          sku?: string | null;
          prezzo_acquisto?: number;
          scorta_minima?: number;
          ordine?: number;
          note?: string | null;
        };
        Update: {
          nome?: string;
          categoria_id?: string | null;
          prezzo?: number;
          disponibile?: boolean;
          traccia_giacenza?: boolean;
          unita?: string;
          sku?: string | null;
          prezzo_acquisto?: number;
          scorta_minima?: number;
          ordine?: number;
          note?: string | null;
        };
        Relationships: [];
      };
      movimenti: {
        Row: {
          id: string;
          prodotto_id: string;
          tipo: TipoMovimento;
          quantita: number;
          prezzo_unitario: number | null;
          vendita_id: string | null;
          motivo: string | null;
          creato_da: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
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
          claimed_at: string | null;
          worker_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      v_inventario: {
        Row: {
          prodotto_id: string;
          nome: string;
          categoria_id: string | null;
          categoria_nome: string | null;
          prezzo: number;
          prezzo_acquisto: number;
          unita: string;
          sku: string | null;
          scorta_minima: number;
          disponibile: boolean;
          traccia_giacenza: boolean;
          saldo: number;
          sotto_scorta: boolean;
          valore_costo: number;
          valore_vendita: number;
          ultimo_movimento: string | null;
        };
        Relationships: [];
      };
      v_vendite: {
        Row: Database['public']['Tables']['vendite']['Row'] & {
          battuta_da_nome: string;
          incassata_da_nome: string | null;
          righe: RigaVenditaJson[];
          stato_stampa: StatoStampa | null;
          print_job_id: string | null;
          /** Quando il job è stato accodato. Serve a capire da quanto è fermo. */
          stampa_accodata_il: string | null;
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
      registra_movimento: {
        Args: {
          p_prodotto_id: string;
          p_tipo: 'carico' | 'scarico' | 'rettifica';
          p_quantita: number;
          p_prezzo_unitario: number | null;
          p_motivo: string;
        };
        Returns: number;
      };
      chiudi_cassa: {
        Args: { p_note?: string | null };
        Returns: string;
      };
      ristampa_vendita: {
        Args: { p_vendita_id: string };
        Returns: string;
      };
      prendi_job_stampa: {
        Args: { p_worker_id: string };
        Returns: {
          id: string;
          vendita_id: string;
          payload: Json;
          attempts: number;
        }[];
      };
      recupera_job_stampa: {
        Args: { p_max_tentativi?: number; p_lease_secondi?: number };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profilo = Database['public']['Tables']['profiles']['Row'];
export type Categoria = Database['public']['Tables']['categorie']['Row'];
export type Prodotto = Database['public']['Tables']['prodotti']['Row'];
export type Movimento = Database['public']['Tables']['movimenti']['Row'];
export type InventarioProdotto = Database['public']['Views']['v_inventario']['Row'];
export type Chiusura = Database['public']['Tables']['chiusure']['Row'];
export type Vendita = Database['public']['Views']['v_vendite']['Row'];
export type VendutoGiornaliero = Database['public']['Views']['v_venduto_giornaliero']['Row'];
export type IncassoGiornaliero = Database['public']['Views']['v_incassi_giornalieri']['Row'];
export type RiepilogoCassiere = Database['public']['Views']['v_riepilogo_cassiere']['Row'];
