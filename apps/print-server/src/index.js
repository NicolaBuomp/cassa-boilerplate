import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config } from './config.js';
import { stampaPromemoria, stampanteCollegata } from './printer.js';

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ── Coda sequenziale ─────────────────────────────────────────────────────────
// Un job alla volta: c'è una sola stampante e i promemoria non devono
// intrecciarsi fra loro.
const inAttesa = new Set();
let inSvuotamento = false;

function accoda(id) {
  if (inAttesa.has(id)) return;
  inAttesa.add(id);
  svuota();
}

async function svuota() {
  if (inSvuotamento) return;
  inSvuotamento = true;
  try {
    for (const id of inAttesa) {
      await lavora(id);
      inAttesa.delete(id);
    }
  } finally {
    inSvuotamento = false;
  }
  if (inAttesa.size > 0) svuota(); // id arrivati durante il giro
}

// ── Lavorazione di un job ────────────────────────────────────────────────────
async function lavora(id) {
  // Presa atomica: solo chi riesce a portare il job da 'pending' a 'printing'
  // lo stampa. Evita la doppia stampa fra il canale Realtime e il polling.
  const { data: preso, error: erroreP } = await supabase
    .from('print_jobs')
    .update({ status: 'printing' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, attempts, payload')
    .maybeSingle();

  if (erroreP) {
    log('errore in presa', id, erroreP.message);
    return;
  }
  if (!preso) return; // già preso, o non più pending

  const tentativi = (preso.attempts ?? 0) + 1;
  try {
    await stampaPromemoria(preso.payload);
    await supabase
      .from('print_jobs')
      .update({
        status: 'printed',
        attempts: tentativi,
        printed_at: new Date().toISOString(),
        error: null,
      })
      .eq('id', id);
    log('stampato', id);
  } catch (err) {
    const messaggio = String(err?.message ?? err);
    const rinuncia = tentativi >= config.maxTentativi;
    await supabase
      .from('print_jobs')
      .update({
        status: rinuncia ? 'error' : 'pending',
        attempts: tentativi,
        error: messaggio,
      })
      .eq('id', id);
    log(rinuncia ? 'ERRORE definitivo' : 'errore, riprovo', id, messaggio);
  }
}

// ── Recupero coda (rete di sicurezza) ────────────────────────────────────────
// Riprende i job lasciati indietro (PC spento, Realtime caduto) e sblocca i
// 'printing' rimasti appesi da un crash precedente.
async function recupera() {
  const vecchio = new Date(Date.now() - 60_000).toISOString();
  await supabase
    .from('print_jobs')
    .update({ status: 'pending' })
    .eq('status', 'printing')
    .lt('created_at', vecchio);

  const { data, error } = await supabase
    .from('print_jobs')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    log('errore in recupero', error.message);
    return;
  }
  for (const riga of data ?? []) accoda(riga.id);
}

// ── Realtime ─────────────────────────────────────────────────────────────────
function ascolta() {
  supabase
    .channel('print_jobs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'print_jobs' },
      (payload) => {
        if (payload.new?.status === 'pending') accoda(payload.new.id);
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'print_jobs' },
      (payload) => {
        // Ristampe e retry tornano a 'pending'.
        if (payload.new?.status === 'pending') accoda(payload.new.id);
      },
    )
    .subscribe((stato) => log('realtime:', stato));
}

async function main() {
  log('Roxy print server in avvio…');
  log('Stampante:', config.stampante.interface, `(${config.stampante.tipo})`);
  log(
    'Stampante collegata:',
    (await stampanteCollegata()) ? 'sì' : 'NO — controlla collegamento/condivisione',
  );

  ascolta();
  await recupera();

  if (config.pollIntervalMs > 0) {
    setInterval(recupera, config.pollIntervalMs);
  }
  log('In ascolto. Pronto a stampare.');
}

main().catch((err) => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
