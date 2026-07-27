import 'dotenv/config';

function obbligatoria(nome) {
  const valore = process.env[nome];
  if (!valore) {
    console.error(`[config] Variabile d'ambiente mancante: ${nome}. Vedi .env.example`);
    process.exit(1);
  }
  return valore;
}

export const config = {
  supabaseUrl: obbligatoria('SUPABASE_URL'),
  serviceRoleKey: obbligatoria('SUPABASE_SERVICE_ROLE_KEY'),
  intestazione: (process.env.INTESTAZIONE || 'ROXY').trim(),
  stampante: (() => {
    const iface = (process.env.PRINTER_INTERFACE || 'printer:auto').trim();
    return {
      tipo: (process.env.PRINTER_TYPE || 'epson').trim(),
      interface: iface,
      larghezza: Number(process.env.PRINTER_WIDTH || 48),
      charset: (process.env.PRINTER_CHARSET || 'PC852_LATIN2').trim(),
      logoPath: process.env.PRINTER_LOGO_PATH?.trim() || null,
      // Dry-run: nessun hardware, il promemoria finisce a console.
      dryRun: iface.toLowerCase() === 'console' || process.env.PRINTER_DRY_RUN === 'true',
    };
  })(),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 15000),
  maxTentativi: Number(process.env.MAX_ATTEMPTS || 3),
};
