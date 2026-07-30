import 'dotenv/config';

function obbligatoria(nome) {
  const valore = process.env[nome];
  if (!valore) {
    console.error(`[config] Variabile d'ambiente mancante: ${nome}. Vedi .env.example`);
    process.exit(1);
  }
  return valore;
}

function interoPositivo(nome, predefinito, minimo = 1) {
  const raw = process.env[nome];
  const valore = raw === undefined ? predefinito : Number(raw);
  if (!Number.isInteger(valore) || valore < minimo) {
    console.error(`[config] ${nome} deve essere un intero >= ${minimo}`);
    process.exit(1);
  }
  return valore;
}

export const config = {
  supabaseUrl: obbligatoria('SUPABASE_URL'),
  serviceRoleKey: obbligatoria('SUPABASE_SERVICE_ROLE_KEY'),
  // Il nome dell'attività stampato in cima al promemoria, se non c'è un logo.
  intestazione: (process.env.INTESTAZIONE || 'CASSA').trim(),
  stampante: (() => {
    const iface = (process.env.PRINTER_INTERFACE || 'printer:auto').trim();
    return {
      tipo: (process.env.PRINTER_TYPE || 'epson').trim(),
      interface: iface,
      larghezza: interoPositivo('PRINTER_WIDTH', 48, 20),
      charset: (process.env.PRINTER_CHARSET || 'PC852_LATIN2').trim(),
      logoPath: process.env.PRINTER_LOGO_PATH?.trim() || null,
      // Dry-run: nessun hardware, il promemoria finisce a console.
      dryRun: iface.toLowerCase() === 'console' || process.env.PRINTER_DRY_RUN === 'true',
    };
  })(),
  pollIntervalMs: interoPositivo('POLL_INTERVAL_MS', 15000),
  maxTentativi: interoPositivo('MAX_ATTEMPTS', 3),
  leaseSecondi: interoPositivo('PRINT_LEASE_SECONDS', 120, 30),
};
