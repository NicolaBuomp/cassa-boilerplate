# Punto della situazione

Aggiornato al **29 luglio 2026**. Commit `1871e73`.

Documento di lavoro: dice cosa è stato deciso, cosa è costruito, **cosa è verificato davvero** e
cosa manca. Il linguaggio del dominio sta in [CONTEXT.md](../CONTEXT.md), le tre decisioni
strutturali in [docs/adr](adr). Questo file non li ripete: racconta lo stato.

---

## 1. Contesto

Serve una cassa per una seconda attività commerciale — un bar — senza alcun legame con
La Fossa Games. Copre **battitura**, **incasso**, **catalogo prodotti**, **chiusura**, **utenti**.
Le vendite si compongono da smartphone, dallo staff.

Il punto di partenza era `apps/live-ops` di La Fossa Events: una cassa mobile già funzionante, ma
scopata su `events` e legata a tornei, sponsor, iscrizioni e a un ledger finanziario. Questo
progetto ne estrae il nucleo in un **repository nuovo e indipendente**: il codice è copiato e
potato, non condiviso. Nessuna dipendenza residua nei due sensi, e La Fossa Events non è stata
toccata.

### Le due scoperte che hanno riscritto il progetto

Sono emerse durante l'intervista di progettazione e sono il motivo per cui questo non è
"copia live-ops e togli `event_id`".

**Non serve un inventario.** Quello che serviva — sapere quanto vende un prodotto e poterlo
disabilitare quando finisce — non richiede un saldo di magazzino. Sono spariti
`inventory_movements`, la colonna `quantity`, `min_quantity`, il trigger
`apply_inventory_movement()`, l'allarme sotto scorta, i carichi e lo scarico automatico dentro la
vendita. Il modulo si chiama **Catalogo** e non va mai chiamato "inventario"
([ADR 0001](adr/0001-il-catalogo-non-e-un-inventario.md)).

**La vendita non nasce pagata.** La richiesta iniziale diceva "si paga subito", ma il flusso reale
del locale è *ordinano → ricevono → pagano*. La Vendita ha quindi tre stati e un **Numero**
progressivo, stampato in grande sul promemoria, che il cliente esibisce per pagare e che riparte
da 1 a ogni Chiusura — non a mezzanotte, altrimenti un locale che chiude all'una avrebbe due
"numero 12" nella stessa serata ([ADR 0002](adr/0002-la-vendita-nasce-non-pagata.md)).

---

## 2. Decisioni

| # | Decisione | Conseguenza |
|---|---|---|
| 1 | Ordina **solo lo staff** dal proprio smartphone | Nessuna sessione anonima, nessun QR al tavolo, nessun accesso non autenticato |
| 2 | **Nessun Tavolo, nessun Conto** | I tavoli non sono riconoscibili a vista; consumazioni successive sono Vendite distinte |
| 3 | La Vendita nasce **Da pagare** | `metodo_pagamento` nullable + stato. È il ciclo di vita che in La Fossa non esiste |
| 4 | Identificazione tramite **Numero**, azzerato a ogni Chiusura | Unico aggancio cliente↔vendita |
| 5 | **Solo chi ha battuto può incassare**, con override del Titolare | Scelta esplicita; il rischio del cambio-banco è noto e accettato ([ADR 0003](adr/0003-solo-chi-ha-battuto-puo-incassare.md)) |
| 6 | I sospesi **bloccano** la Chiusura | Vanno incassati o annullati: è così che i conti tornano |
| 7 | **Nessuna giacenza**, per nessun prodotto | Vedi ADR 0001 |
| 8 | Attività **bar / chiosco** | Niente varianti, niente distinta base, niente resi retail |
| 9 | **Una sola attività, un solo punto vendita** | `event_id` non esiste. Cadono i membri-evento, i permessi per evento, gli stati dei moduli |
| 10 | Due ruoli soli: **Titolare** e **Cassiere** | Niente matrice modulo×azione, niente preset duplicati fra TypeScript e SQL |
| 11 | Login **email + password su telefono personale** | Supabase Auth così com'è: zero codice custom sull'identità, nessun PIN |
| 12 | Pagamenti: **solo contanti e POS** | Sparisce l'intero concetto di omaggio |
| 13 | Sconto: **solo il Titolare**, con importo e causale | Confluisce nel totale sconti della Chiusura |
| 14 | **Nessuna emissione fiscale** | Promemoria non fiscale; nessuna integrazione con registratore telematico |
| 15 | Stampa a **coda `print_jobs` + demone sul PC del banco** | Se il telefono muore il job resta in coda |
| 16 | **Online-only** | Nessuna PWA offline. Ma `request_id` è ora obbligatorio dal client |
| 17 | Stack **Next.js 16 + React 19 + TS + Supabase + Vercel + TanStack Query** | Massimo riuso di quello che già conosci |
| 18 | **Una sola app** mobile-first, Tailwind v4 | Il back-office è poche schermate: non giustifica un secondo progetto né Ant Design |
| 19 | Report aggregati **server-side** | Vedi §5, difetto 2 |
| 20 | **Plancia** realtime per il Titolare | Supabase Realtime su `vendite` e `print_jobs` |

---

## 3. Cosa esiste

Repository: `C:\Users\n.buompane\Documents\DEVELOPMENT\roxy-cassa`, branch `main`, un commit.

### Database — `supabase/migrations/20260727120000_baseline.sql`

Tabelle `profiles`, `categorie`, `prodotti`, `vendite`, `righe_vendita`, `chiusure`, `print_jobs`.

Le tabelle di dominio sono in **sola lettura** via RLS: ogni scrittura passa da una RPC
`security definer`, così le regole stanno in un posto solo e valgono anche a chi chiama l'API
direttamente. Le RPC sono `crea_vendita`, `incassa_vendita`, `annulla_vendita`, `chiudi_cassa`,
`ristampa_vendita`.

Due scelte di modellazione che val la pena ricordare:

- **La sessione di cassa aperta non è una tabella**: è `vendite where chiusura_id is null`. Da
  questo discende gratis la numerazione — il prossimo Numero è `max(numero)+1` fra le vendite non
  chiuse, quindi dopo una Chiusura riparte da 1 senza contatori da azzerare. L'unicità è garantita
  da un indice `(chiusura_id, numero) nulls not distinct`.
- **Il prezzo viene sempre dal catalogo**, mai da ciò che manda il client: `crea_vendita` legge
  `prodotti.prezzo` e congela nome e prezzo nelle righe.

Viste: `v_vendite` (con righe in jsonb e stato di stampa), più tre aggregati server-side
`v_venduto_giornaliero`, `v_incassi_giornalieri`, `v_riepilogo_cassiere`. Tutte con
`security_invoker = on`, altrimenti aggirerebbero le policy sottostanti.

### App — `apps/web`

13 rotte. Cassiere: *Batti*, *Da incassare*, *Le mie vendite*. Titolare: le stesse più *Plancia*,
*Catalogo*, *Categorie*, *Chiusura*, *Report*, *Utenti*.

La logica che vale la pena testare da sola sta in `lib/cassa/`: `carrello.ts` (totali,
arrotondamenti, quantità) e `incasso.ts` (sconto, totale dovuto, resto). Nessuna dipendenza da
React o Supabase.

### Print server — `apps/print-server`

Copiato da La Fossa e adattato: nuovo payload, Numero stampato a caratteri doppi in cima, riga di
stato (`DA PAGARE` / `PAGATO — CONTANTI`), e la dicitura **"Documento non fiscale"** in fondo.
È **fuori dai workspace npm**, perché ha una dipendenza nativa da compilare e si installa solo sul
PC del banco: non deve rompere `npm install` sul portatile.

---

## 4. Stato di verifica

Questa è la sezione da leggere prima di fidarsi di qualsiasi cosa.

### Verificato

| Cosa | Come |
|---|---|
| Compilazione e tipi | `npm run build` — build Next.js pulita, TypeScript senza errori, tutte e 13 le rotte generate |
| Stile | `npm run lint` — ESLint senza warning |
| Logica pura | `npm test` — **36 test verdi** su carrello, resto, sconto, arrotondamenti |
| Validità dello schema | La migration è stata eseguita **senza errori su un progetto Supabase cloud**. Copre sintassi di tabelle, RPC, viste, policy — e il trigger `handle_new_user`, che se fosse rotto avrebbe fatto fallire il seed |

### Non verificato

**Tutto il comportamento a runtime.** Nessuno ha ancora battuto una vendita vera. In particolare
non è mai stato provato:

- che la numerazione sia progressiva e condivisa fra cassieri concorrenti;
- che un retry con lo stesso `request_id` non generi una seconda vendita;
- che un Cassiere **non veda** le vendite dei colleghi — la regola su cui c'è stata più insistenza;
- che la Chiusura si rifiuti elencando i numeri sospesi;
- che dopo la Chiusura la numerazione riparta da 1;
- che il promemoria esca dalla stampante leggibile, col Numero in evidenza.

Esiste già lo script che verifica tutto questo: `supabase/tests/invarianti.sql`, 15 blocchi che
impersonano utenti diversi e falliscono rumorosamente. **Non è mai stato eseguito**, ed è
deliberatamente escluso dal progetto cloud perché scrive dati veri (crea vendite, le incassa, le
annulla, chiude la cassa).

### Bloccato

Servono due valori pubblici da Supabase → Project Settings → API, da mettere in
`apps/web/.env.local` al posto dei segnaposto:

```
NEXT_PUBLIC_SUPABASE_URL=https://<progetto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Finiscono entrambi nel bundle del browser: sono pubblici per progetto, non segreti.
La **`service_role` non va qui**: serve solo al print server, nel suo `.env` sul PC del banco.

---

## 5. Debiti e rischi noti

**Il seed è su un progetto cloud.** `supabase/seed.sql` crea tre utenti con password `password123`
in chiaro, incluso un Titolare che può tutto. Se quel progetto diventerà quello di produzione, le
password vanno cambiate o i tre utenti cancellati prima di inserirci dati reali.

**I tipi TypeScript sono scritti a mano.** `apps/web/lib/supabase/database.types.ts` è stato
redatto a mano perché il database locale non era disponibile. Va rigenerato con `npm run db:types`
e confrontato: se diverge, ha ragione il database.

**Nessuna verifica della concorrenza sulla numerazione.** `crea_vendita` prende un
`pg_advisory_xact_lock` prima di assegnare il Numero, e l'indice unico fa da rete di sicurezza, ma
due battiture simultanee non sono mai state provate davvero.

**Vulnerabilità npm.** `npm audit` segnala 12 problemi di gravità alta, tutti nella catena di
dipendenze di ESLint (`brace-expansion` / `minimatch`). Sono dev-only e non finiscono nel bundle.

### Difetti dell'originale non riportati

Quattro cose sono state corrette nel passaggio, e vale la pena non reintrodurle:

1. `p_request_id` esisteva nella RPC di La Fossa ma **nessun chiamante lo passava**: l'idempotenza
   era codice morto. Qui è obbligatorio dal client.
2. Il "venduto per prodotto" era calcolato **nel browser**, scaricando tutte le vendite a pagine da
   1000 righe. A 200 vendite al giorno diventa inusabile in pochi mesi. Qui è aggregato in SQL.
3. `PosFreeReason` dichiarava un valore `'promo'` che il `CHECK` del database rifiutava.
   Irrilevante qui, visto che gli omaggi non esistono, ma è il motivo per cui i tipi non sono stati
   copiati alla cieca.
4. `pos_closures.free_total` e `free_sales_count` erano tipizzati ma mai popolati.

---

## 6. Prossimi passi, in ordine

1. **Collegare l'app** — riempire `apps/web/.env.local`, poi `npm run dev`.
2. **Prova end-to-end dal browser**, su viewport telefono: batti → compare il Numero → incassa →
   chiudi. Poi il controllo che conta: entrare come `cassiere@roxy.local`, battere una vendita,
   entrare come `cassiere2@roxy.local` e confermare che **non la vede**. Si fa a mano, senza
   scrivere dati finti.
3. **Verifica degli invarianti** — avviare Docker Desktop, `supabase start`, `supabase db reset`,
   poi lo script:
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/invarianti.sql
   ```
   Da fare **solo in locale**: sul cloud sporcherebbe i dati.
4. **Rigenerare i tipi** con `npm run db:types` e confrontarli con quelli scritti a mano.
5. **Prova di stampa** — sul PC del banco: `cd apps/print-server && npm install`, compilare `.env`
   con la `service_role`, poi `PRINTER_DRY_RUN=true npm run test:print` per vedere il layout senza
   hardware, infine con la termica vera.
6. **Deploy su Vercel** — progetto puntato a `apps/web`, con le due variabili d'ambiente.
7. **Igiene del progetto di produzione** — cambiare o rimuovere gli utenti del seed.

### Non ancora deciso

- Se il progetto Supabase cloud attuale sia quello definitivo o solo una prova.
- Il logo del promemoria: serve un `apps/print-server/assets/logo.png` monocromatico (~384px di
  larghezza per una termica da 58mm, ~576px per una da 80mm). Senza, viene stampata la scritta di
  `INTESTAZIONE`, oggi `ROXY`.
- Nome di dominio e progetto Vercel.
