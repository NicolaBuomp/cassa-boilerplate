# Roxy Cassa

Cassa per un bar. Le vendite si compongono da smartphone, dallo staff.

Tre cose e nient'altro: **battere una vendita**, **incassarla**, **tenere il catalogo prodotti**.
Il linguaggio del dominio sta in [CONTEXT.md](CONTEXT.md) — leggerlo prima di toccare il codice
fa risparmiare tempo, perché diverse parole qui significano una cosa precisa.

Le tre decisioni che spiegano perché il codice ha questa forma stanno in [docs/adr](docs/adr):
non c'è nessun inventario, la vendita nasce non pagata, e incassa solo chi ha battuto.

## Come funziona, in due righe

Il cassiere compone la vendita sul telefono e la batte: nasce **da pagare**, prende un **Numero**
progressivo e stampa un promemoria. Il cliente riceve, poi torna a pagare esibendo il numero.
A fine serata il titolare chiude la cassa — e non può farlo finché resta anche un solo sospeso.

Il promemoria stampato **non ha valore fiscale**: il documento commerciale lo emette il
registratore telematico del locale, con cui questa applicazione non si integra.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Dati | Supabase (Postgres + RLS + Realtime), TanStack Query sul client browser |
| Stampa | `apps/print-server`: demone Node sul PC al banco, ESC/POS |
| Deploy | Vercel |

Le tabelle di dominio sono in **sola lettura** via RLS: ogni scrittura passa da una RPC
`security definer`. Le regole vivono lì, in un posto solo, e valgono anche se qualcuno chiama
l'API direttamente.

## Avvio

```bash
npm install
supabase start
```

`supabase start` stampa le chiavi locali: copiarle in `apps/web/.env.local`
(vedi `.env.example`). Poi:

```bash
npm run dev
```

Il seed crea tre utenti, password `password123`:

| Email | Ruolo |
|---|---|
| `titolare@roxy.local` | Titolare |
| `cassiere@roxy.local` | Cassiere |
| `cassiere2@roxy.local` | Cassiere |

In produzione non esiste un seed: **il primo utente che si registra diventa Titolare**, e da lì
gestisce gli altri.

## Verifica

```bash
npm test
```

Test unitari sulla logica pura (carrello, resto, sconto).

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/invarianti.sql
```

Invarianti di dominio contro il database vero: numerazione, idempotenza, chi può incassare cosa,
blocco della chiusura sui sospesi, e le policy RLS provate con due utenti diversi. È la parte che
conta davvero, perché è dove stanno le regole.

## Struttura

```
apps/web/            l'applicazione
  app/(app)/         le schermate autenticate
  lib/cassa/         logica pura, testata in isolamento
  lib/hooks/         accesso ai dati (TanStack Query)
  lib/supabase/      client e tipi generati
apps/print-server/   demone di stampa (fuori dai workspace: dipendenza nativa)
supabase/
  migrations/        schema, RPC, viste, RLS
  tests/             invarianti di dominio
```

## Rigenerare i tipi dopo una migration

```bash
npm run db:types
```
