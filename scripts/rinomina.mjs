#!/usr/bin/env node
/**
 * Ribattezza il boilerplate col nome di una nuova Attività, e ne registra la
 * provenienza.
 *
 *   node scripts/rinomina.mjs bar-centrale
 *
 * Sostituisce il nome del pacchetto e lo scope npm nei cinque punti in cui
 * compaiono, che è il passo più ripetitivo della checklist e quello dove è più
 * facile dimenticarne uno. Il più facile di tutti da saltare è `project_id` in
 * `supabase/config.toml`: non rompe niente, ma fa collidere in locale due
 * Attività diverse.
 *
 * Registra poi in `package.json` da quale commit del boilerplate parte questa
 * copia. Serve perché ogni Attività è un fork congelato che non riceve
 * aggiornamenti (ADR 0004): quando qui viene corretto un difetto, quel campo è
 * l'unico modo per sapere se questa installazione se lo porta dietro.
 *
 * Lo script è idempotente ed è fatto per girare una volta sola, appena dopo
 * aver creato il repository dell'Attività.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');

const NOME_ATTUALE = leggiNomeAttuale();
const SCOPE_ATTUALE = leggiScopeAttuale();

function leggiNomeAttuale() {
  return JSON.parse(leggi('package.json')).name;
}

function leggiScopeAttuale() {
  const nome = JSON.parse(leggi('apps/web/package.json')).name;
  const scope = nome.startsWith('@') ? nome.split('/')[0].slice(1) : null;
  if (!scope) {
    esci(`apps/web/package.json non ha un nome con scope (@qualcosa/web): trovato "${nome}".`);
  }
  return scope;
}

function leggi(relativo) {
  return readFileSync(join(radice, relativo), 'utf8');
}

function scrivi(relativo, contenuto) {
  writeFileSync(join(radice, relativo), contenuto, 'utf8');
}

function esci(messaggio) {
  console.error(`\n  ${messaggio}\n`);
  process.exit(1);
}

// ── Argomento ────────────────────────────────────────────────────────────────

const slug = process.argv[2];

if (!slug) {
  esci(
    'Uso: node scripts/rinomina.mjs <nome-attivita>\n' +
      '  Esempio: node scripts/rinomina.mjs bar-centrale\n' +
      `  Attuale: ${NOME_ATTUALE} (scope @${SCOPE_ATTUALE})`,
  );
}

// Il nome finisce in un nome di pacchetto npm, in uno scope e in `project_id`
// di Supabase: tutti e tre accettano soltanto minuscole, cifre e trattini.
if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
  esci(
    `"${slug}" non va bene: servono minuscole, cifre e trattini, e deve cominciare con una lettera.`,
  );
}

if (slug === NOME_ATTUALE) {
  esci(`Il progetto si chiama già "${slug}". Non c'è niente da fare.`);
}

// ── Sostituzioni ─────────────────────────────────────────────────────────────

/** Ogni voce dice quale file toccare e come. Niente sostituzioni alla cieca. */
const lavori = [
  {
    file: 'package.json',
    cosa: 'nome del pacchetto e scope negli script dei workspace',
    trasforma: (t) =>
      t
        .replace(`"name": "${NOME_ATTUALE}"`, `"name": "${slug}"`)
        .replaceAll(`@${SCOPE_ATTUALE}/web`, `@${slug}/web`),
  },
  {
    file: 'apps/web/package.json',
    cosa: 'nome del pacchetto web',
    trasforma: (t) => t.replace(`"@${SCOPE_ATTUALE}/web"`, `"@${slug}/web"`),
  },
  {
    file: 'apps/print-server/package.json',
    cosa: 'nome del pacchetto del print server',
    trasforma: (t) => t.replace(`"@${SCOPE_ATTUALE}/print-server"`, `"@${slug}/print-server"`),
  },
  {
    file: 'supabase/config.toml',
    cosa: 'project_id (quello che si dimentica sempre)',
    trasforma: (t) => t.replace(`project_id = "${NOME_ATTUALE}"`, `project_id = "${slug}"`),
  },
];

console.log(`\n  ${NOME_ATTUALE} → ${slug}\n`);

let modificati = 0;
for (const { file, cosa, trasforma } of lavori) {
  const prima = leggi(file);
  const dopo = trasforma(prima);

  if (prima === dopo) {
    console.log(`  · ${file} — già a posto (${cosa})`);
    continue;
  }

  scrivi(file, dopo);
  modificati += 1;
  console.log(`  ✓ ${file} — ${cosa}`);
}

// ── Provenienza ──────────────────────────────────────────────────────────────

const pkg = JSON.parse(leggi('package.json'));

pkg.boilerplate = {
  origine: pkg.boilerplate?.origine ?? origineGit() ?? 'sconosciuta',
  commit: commitGit() ?? 'sconosciuto',
  copiatoIl: new Date().toISOString().slice(0, 10),
  '//': 'Da dove parte questa copia. Ogni Attività è un fork congelato e non riceve aggiornamenti: quando a monte viene corretto un difetto, questo commit dice se questa installazione se lo porta dietro. Vedi docs/adr/0004.',
};

scrivi('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`  ✓ package.json — provenienza: ${pkg.boilerplate.commit.slice(0, 12)}`);

function git(...argomenti) {
  try {
    return (
      execFileSync('git', argomenti, {
        cwd: radice,
        encoding: 'utf8',
        // Fuori da un repository git urlerebbe sul terminale, e qui il
        // fallimento è previsto: si vuole il valore o niente.
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null
    );
  } catch {
    // Non è un repository git, o git non c'è: la provenienza è un'informazione
    // utile, non un requisito. Si va avanti lo stesso.
    return null;
  }
}

function commitGit() {
  return git('rev-parse', 'HEAD');
}

function origineGit() {
  return git('remote', 'get-url', 'origin');
}

// ── Cosa resta da fare a mano ────────────────────────────────────────────────

console.log(`
  Fatto${modificati === 0 ? ' (nessun nome da cambiare)' : ''}. Restano a mano:

    npm install                     riallinea package-lock.json
    apps/web/lib/attivita.ts        nome, sottotitolo, descrizione, coloreBarra
    apps/web/app/globals.css        il blocco @theme
    apps/web/public/icona.svg       e app/icon.svg, stesso disegno
    README.md                       intestazione e descrizione

  La checklist completa è in docs/personalizzazione.md.
`);
