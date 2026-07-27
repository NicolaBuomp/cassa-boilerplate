'use client';

import { createClient } from '@/lib/supabase/client';
import type { Profilo } from '@/lib/supabase/database.types';
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface AuthContextValue {
  session: Session | null;
  /** Il profilo applicativo. `null` finché non è caricato o se l'utente non ne ha uno. */
  profilo: Profilo | null;
  isLoading: boolean;
  /** Due soli ruoli (ADR 0003): il resto dei permessi discende da qui. */
  eTitolare: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profilo, setProfilo] = useState<Profilo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const profiloCaricatoPer = useRef<string | null>(null);

  const caricaProfilo = useCallback(
    async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      setProfilo(data ?? null);
      profiloCaricatoPer.current = userId;
    },
    [supabase],
  );

  useEffect(() => {
    let annullato = false;

    const idrata = async (nuovaSessione: Session | null) => {
      if (annullato) return;
      setSession(nuovaSessione);

      if (!nuovaSessione) {
        setProfilo(null);
        profiloCaricatoPer.current = null;
        setIsLoading(false);
        return;
      }

      if (profiloCaricatoPer.current === nuovaSessione.user.id) return;

      setIsLoading(true);
      await caricaProfilo(nuovaSessione.user.id);
      if (!annullato) setIsLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => idrata(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, nuovaSessione) => {
      void idrata(nuovaSessione);
    });

    return () => {
      annullato = true;
      subscription.unsubscribe();
    };
  }, [supabase, caricaProfilo]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profilo,
      isLoading,
      eTitolare: profilo?.ruolo === 'titolare' && profilo.attivo,
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.session) {
          return { error: error?.message ?? 'Accesso non riuscito' };
        }
        await caricaProfilo(data.session.user.id);
        return { error: null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
        window.location.assign('/login');
      },
    }),
    [session, profilo, isLoading, supabase, caricaProfilo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth va usato dentro AuthProvider');
  return ctx;
}
