# Cassa da banco

Boilerplate di cassa per un'attività col banco — bar, chiosco, locale. Le vendite si compongono da
smartphone, dallo staff.

Tre cose e nient'altro: **battere una vendita**, **incassarla**, **tenere il catalogo prodotti**.

> Questo repository è un **template**, non un prodotto. Ogni attività parte da una copia
> (`Use this template`), la personalizza, e da lì vive per conto suo: non riceve aggiornamenti da
> qui, e un difetto corretto a monte va riportato a mano dove serve.
> Vedi [ADR 0004](docs/adr/0004-ogni-attivita-e-un-fork-congelato.md).

## Da leggere prima di toccare il codice

**[CONTEXT.md](CONTEXT.md)** — il linguaggio del dominio. Diverse parole qui significano una cosa
precisa, e il file distingue i termini del **nucleo** dalle **decisioni di questa attività**: cioè
ciò che è stato deliberatamente escluso, con l'argomento che l'ha deciso. Se ereditate questo
codice per un'attività diversa, è la prima cosa da rileggere.

**[docs/personalizzazione.md](docs/personalizzazione.md)** — la checklist per portare una nuova
attività in produzione, e l'elenco dei punti da toccare se il dominio è diverso.

**[docs/adr](docs/adr)** — le quattro decisioni che spiegano perché il codice ha questa forma: non
c'è nessun inventario, la vendita nasce non pagata, incassa solo chi ha battuto, ogni attività è un
fork congelato.

## Come funziona, in due righe

Il cassiere compone la vendita sul telefono e la batte: nasce **da pagare**, prende un **Numero**
progressivo e stampa un promemoria. Il cliente riceve, poi torna a pagare esibendo il numero.
A fine serata il titolare chiude la cassa — e non può farlo finché resta anche un solo sospeso.

Il promemoria stampato **non ha valore fiscale**: il documento commerciale lo emette il
registratore telematico del locale, con cui questa applicazione non si integra.

Il ciclo a due tempi presuppone un banco. Un'attività dove si batte e si paga nello stesso istante
non ne ha bisogno: `docs/personalizzazione.md` dice cosa cancellare.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Dati | Supabase (Postgres + RLS + Realtime), TanStack Query sul client browser |
| Stampa | `apps/print-server`: demone Node sul PC al banco, ESC/POS |
| Deploy | Vercel |

Vendite, righe e chiusure sono in **sola lettura** via RLS: ogni scrittura passa da una RPC
`security definer` (`crea_vendita`, `incassa_vendita`, `annulla_vendita`, `chiudi_cassa`). Le
regole del ciclo di vendita vivono lì, in un posto solo, e valgono anche se qualcuno chiama l'API
direttamente.

Catalogo e utenti no: `categorie`, `prodotti` e `profiles` il Titolare li scrive direttamente, con
una policy RLS che controlla il ruolo. Non c'è una regola di dominio da proteggere — un prodotto è
una riga — e una RPC in mezzo sarebbe solo cerimonia.

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

**Il seed è vuoto**, per scelta: un boilerplate non porta con sé credenziali di comodo, perché una
copia con quelle credenziali finirebbe prima o poi in produzione.

Anche le **registrazioni sono chiuse**, e l'app non ha una schermata per registrarsi: si crea il
primo utente dal Supabase Studio (http://127.0.0.1:54323, *Authentication → Users → Add user*, con
*Auto Confirm User*). **Il primo utente in assoluto diventa Titolare**; da lì si entra nell'app e
si inserisce il catalogo da `/catalogo`. I dettagli, e cosa cambia sul progetto hosted, stanno in
[docs/personalizzazione.md](docs/personalizzazione.md).

Per vedere il dominio funzionare senza inserire dati a mano, usare gli invarianti qui sotto: si
creano le proprie fixture e le annullano.

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

Lo script è autosufficiente: si crea utenti e catalogo e li cancella in fondo, quindi non dipende
dal seed. Rifiuta di partire su un database che contiene già dati. Se un blocco è rosso si ferma
lì senza pulire, di proposito, così potete guardarci dentro.

Tutto questo — più build e allineamento dei tipi allo schema — gira su ogni push in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Struttura

```
apps/web/            l'applicazione
  app/(app)/         le schermate autenticate
  lib/attivita.ts    l'identità dell'attività: l'unico file da personalizzare
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
