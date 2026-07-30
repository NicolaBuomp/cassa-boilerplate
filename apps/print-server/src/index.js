import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import ws from 'ws';
import { config } from './config.js';
import { stampaPromemoria, stampanteCollegata } from './printer.js';

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const log = (...a) => console.log(new Date().toISOString(), ...a);
const workerId = randomUUID();

// ── Coda sequenziale ─────────────────────────────────────────────────────────
// Un job alla volta: c'è una sola stampante e i promemoria non devono
// intrecciarsi fra loro.
let inSvuotamento = false;

async function svuota() {
  if (inSvuotamento) return;
  inSvuotamento = true;
  try {
    while (true) {
      const job = await prendi();
      if (!job) break;
      await lavora(job);
    }
  } finally {
    inSvuotamento = false;
  }
}

// ── Lavorazione di un job ────────────────────────────────────────────────────
async function prendi() {
  // La RPC usa FOR UPDATE SKIP LOCKED: due demoni non possono prendere la
  // stessa riga e non si bloccano a vicenda.
  const { data, error } = await supabase.rpc('prendi_job_stampa', {
    p_worker_id: workerId,
  });

  if (error) {
    log('errore in presa', error.message);
    return null;
  }
  return data?.[0] ?? null;
}

async function lavora(job) {
  const { id, attempts: tentativi, payload } = job;
  try {
    await stampaPromemoria(payload);
    const { error } = await supabase
      .from('print_jobs')
      .update({
        status: 'printed',
        printed_at: new Date().toISOString(),
        error: null,
        claimed_at: null,
        worker_id: null,
      })
      .eq('id', id)
      .eq('status', 'printing')
      .eq('worker_id', workerId);
    if (error) throw error;
    log('stampato', id);
  } catch (err) {
    const messaggio = String(err?.message ?? err);
    const rinuncia = tentativi >= config.maxTentativi;
    const { error } = await supabase
      .from('print_jobs')
      .update({
        status: rinuncia ? 'error' : 'pending',
        error: messaggio,
        claimed_at: null,
        worker_id: null,
      })
      .eq('id', id)
      .eq('status', 'printing')
      .eq('worker_id', workerId);
    if (error) {
      log('errore nel rilascio del job', id, error.message);
      return;
    }
    log(rinuncia ? 'ERRORE definitivo' : 'errore, riprovo', id, messaggio);
  }
}

// ── Recupero coda (rete di sicurezza) ────────────────────────────────────────
// Riprende i job lasciati indietro (PC spento, Realtime caduto) e sblocca i
// 'printing' rimasti appesi da un crash precedente.
async function recupera() {
  const { data, error } = await supabase.rpc('recupera_job_stampa', {
    p_max_tentativi: config.maxTentativi,
    p_lease_secondi: config.leaseSecondi,
  });

  if (error) {
    log('errore in recupero', error.message);
    return;
  }
  if (data > 0) log('job con lease scaduto recuperati:', data);
  await svuota();
}

// ── Realtime ─────────────────────────────────────────────────────────────────
function ascolta() {
  supabase
    .channel('print_jobs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'print_jobs' },
      (payload) => {
        if (payload.new?.status === 'pending') void svuota();
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'print_jobs' },
      (payload) => {
        // Ristampe e retry tornano a 'pending'.
        if (payload.new?.status === 'pending') void svuota();
      },
    )
    .subscribe((stato) => log('realtime:', stato));
}

async function main() {
  log('Print server in avvio…');
  log('Worker:', workerId);
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
