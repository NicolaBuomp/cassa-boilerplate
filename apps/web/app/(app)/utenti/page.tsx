'use client';

import { useAggiornaProfilo, useProfili } from '@/lib/hooks/use-utenti';
import { useAuth } from '@/lib/providers/auth-provider';
import type { Profilo } from '@/lib/supabase/database.types';
import { SoloTitolare } from '../_components/solo-titolare';

export default function UtentiPage() {
  const { eTitolare, profilo: mio } = useAuth();
  const { data: profili = [], isLoading } = useProfili();
  const aggiorna = useAggiornaProfilo();

  if (!eTitolare) return <SoloTitolare />;

  const titolariAttivi = profili.filter((p) => p.ruolo === 'titolare' && p.attivo).length;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <h1 className="text-xl font-semibold">Utenti</h1>

      <p className="text-xs text-testo-debole">
        Un cassiere vede e incassa solo le vendite che ha battuto lui. Tu puoi incassare e annullare
        qualsiasi vendita.
      </p>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-testo-debole">Carico…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {profili.map((profilo) => (
            <li key={profilo.id}>
              <SchedaUtente
                profilo={profilo}
                sonoIo={profilo.id === mio?.id}
                ultimoTitolare={
                  profilo.ruolo === 'titolare' && profilo.attivo && titolariAttivi === 1
                }
                inCorso={aggiorna.isPending}
                onCambia={(patch) => aggiorna.mutate({ id: profilo.id, ...patch })}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-2xl border border-bordo bg-superficie px-4 py-4">
        <p className="text-sm font-medium">Aggiungere una persona</p>
        <p className="mt-1 text-sm text-testo-debole">
          Non si può da qui: gli account si creano dal pannello Supabase dell&apos;attività, dove
          imposti anche la password. Chi viene creato entra come <strong>cassiere</strong>; poi da
          questa schermata lo promuovi a titolare o lo disattivi.
        </p>
        <p className="mt-2 text-sm text-testo-debole">
          Un account per persona, mai uno condiviso: incassa solo chi ha battuto, e il riepilogo di
          fine turno si appoggia su questo.
        </p>
      </div>
    </div>
  );
}

function SchedaUtente({
  profilo,
  sonoIo,
  ultimoTitolare,
  inCorso,
  onCambia,
}: {
  profilo: Profilo;
  sonoIo: boolean;
  ultimoTitolare: boolean;
  inCorso: boolean;
  onCambia: (patch: { ruolo?: Profilo['ruolo']; attivo?: boolean }) => void;
}) {
  // Togliersi da soli il ruolo di titolare, o disattivare l'ultimo titolare
  // rimasto, lascerebbe l'attività senza nessuno che possa chiudere cassa.
  const bloccato = sonoIo || ultimoTitolare;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-bordo bg-superficie px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{profilo.nome}</span>
        {sonoIo ? <span className="shrink-0 text-xs text-testo-debole">tu</span> : null}
      </div>
      {profilo.email ? (
        <span className="-mt-2 truncate text-xs text-testo-debole">{profilo.email}</span>
      ) : null}

      <div className="flex gap-2">
        {(['cassiere', 'titolare'] as const).map((ruolo) => (
          <button
            key={ruolo}
            type="button"
            disabled={bloccato || inCorso || profilo.ruolo === ruolo}
            onClick={() => onCambia({ ruolo })}
            aria-pressed={profilo.ruolo === ruolo}
            className={`min-h-11 flex-1 rounded-lg border text-sm ${
              profilo.ruolo === ruolo
                ? 'border-accento bg-accento font-semibold text-fondo'
                : 'border-bordo text-testo-debole'
            } disabled:opacity-50`}
          >
            {ruolo === 'titolare' ? 'Titolare' : 'Cassiere'}
          </button>
        ))}

        <button
          type="button"
          disabled={bloccato || inCorso}
          onClick={() => onCambia({ attivo: !profilo.attivo })}
          className={`min-h-11 rounded-lg border px-4 text-sm ${
            profilo.attivo ? 'border-bordo text-attenzione' : 'border-positivo text-positivo'
          } disabled:opacity-50`}
        >
          {profilo.attivo ? 'Disattiva' : 'Attiva'}
        </button>
      </div>

      {ultimoTitolare && !sonoIo ? (
        <p className="text-xs text-testo-debole">
          È l’unico titolare attivo: promuovine un altro prima di modificarlo.
        </p>
      ) : null}
    </div>
  );
}
