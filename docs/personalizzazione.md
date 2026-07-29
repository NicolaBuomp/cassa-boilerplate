# Personalizzare per una nuova Attività

Questa è la checklist da seguire quando un'Attività chiede la cassa. Si parte da una copia di
questo repository e la si porta in produzione; da quel momento la copia vive per conto suo e non
riceve più aggiornamenti da qui ([ADR 0004](adr/0004-ogni-attivita-e-un-fork-congelato.md)).

Prima di cominciare, leggere [CONTEXT.md](../CONTEXT.md) — in particolare la sezione **decisioni
di questa Attività**. È lì che si scopre se questa cassa è quella giusta per il cliente che l'ha
chiesta, o se serve una variante.

---

## 0. Verificare che il nucleo sia sano

Da fare **una volta a monte**, non a ogni fork — ma da rifare qui se avete toccato lo schema o le
RPC. Un difetto che passa di qui va corretto in ogni istanza già consegnata.

```bash
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/invarianti.sql
```

Lo script si crea le proprie fixture e le cancella in fondo: non dipende dal seed, che è vuoto.
Copre numerazione condivisa fra cassieri, idempotenza dei retry, isolamento del
Cassiere, blocco della Chiusura sui sospesi, ripartenza da 1, e le policy RLS provate con utenti
diversi. Se un blocco è rosso, si corregge prima di andare avanti.

```bash
npm run db:types
```

Produce `database.generated.ts`, un riferimento ignorato da git. **Non** rigenera i tipi dell'app:
`database.types.ts` è scritto a mano, e le differenze si riportano a mano. Se i due divergono, ha
ragione il database.

Gli stessi controlli girano da soli in `.github/workflows/ci.yml`, ed è il file che conviene
**tenere anche nel fork**: nessuno guarda le copie, e la CI è l'unica cosa che si accorge di una
regressione prima che se ne accorga il banco.

---

## 1. Creare il repository dell'Attività

`Use this template` su GitHub → nuovo repository privato, nome dell'Attività.

Non una fork di GitHub: una fork mantiene il legame col repository originale, e qui il legame non
serve a niente. Il template dà una storia pulita che parte dal primo commit dell'Attività.

## 2. Rinominare

```bash
npm run rinomina -- bar-centrale
```

Il `--` serve: senza, npm si tiene l'argomento invece di passarlo allo script.

Sostituisce `cassa-banco` e lo scope `@cassa` col nome dell'Attività in `package.json` (nome e
script dei workspace), nei due `package.json` delle app, e in `project_id` di
`supabase/config.toml` — quest'ultimo è quello che si dimentica sempre, perché sbagliarlo non
rompe niente: fa solo collidere in locale due Attività diverse.

Registra anche, in `package.json`, **da quale commit del boilerplate parte questa copia**. Ogni
Attività è un fork congelato e non riceve aggiornamenti
([ADR 0004](adr/0004-ogni-attivita-e-un-fork-congelato.md)): quando a monte viene corretto un
difetto, quel commit è l'unico modo per sapere se questa installazione se lo porta dietro.

Poi `npm install` per riallineare `package-lock.json`, e restano a mano `README.md` (intestazione e
descrizione) e i file del punto 3.

## 3. Identità visiva

Due file di codice:

- **`apps/web/lib/attivita.ts`** — nome, sottotitolo, titolo della scheda, descrizione, e
  `coloreBarra`.
- **`apps/web/app/globals.css`** — il blocco `@theme`, dodici token. Sono compile-time: non possono
  arrivare da variabili d'ambiente né dal database.

E le icone, che sono file a sé:

- **`apps/web/public/icona.svg`** e **`apps/web/app/icon.svg`** — lo stesso disegno, in due posti
  perché servono a due cose: il primo è l'icona dell'app installata (`app/manifest.ts`), il secondo
  la favicon della scheda. Quello in repository è un segnaposto neutro e ha i colori del tema
  **ricopiati a mano**: un SVG in `public/` non legge i token di `globals.css`, quindi se ricolorate
  il tema ricolorate anche l'icona.
- **`apps/web/app/apple-icon.png`**, 180×180 — **manca, e va aggiunto se l'Attività usa iPhone.**
  iOS non accetta SVG per l'icona della schermata home: senza questo file, "Aggiungi a Home"
  produce una miniatura della pagina invece dell'icona. Android invece si accontenta dell'SVG.

Installare l'app sul telefono non è un vezzo: sparisce la barra degli indirizzi e si recupera la
striscia di schermo che al banco vale una riga di carrello in più.

**Se cambiate `--color-fondo`, aggiornate anche `coloreBarra`**: è la barra di sistema del
telefono e non si deriva dal CSS. È la svista più facile da fare e la più visibile.

Il fondo scuro non è estetica: al banco si legge di sbieco, spesso in penombra. Un tema chiaro va
provato sul posto prima di adottarlo.

## 4. Progetto Supabase

Un progetto **nuovo**, mai condiviso con un'altra Attività. Poi:

```bash
supabase link --project-ref <ref>
supabase db push
```

Copiare in `apps/web/.env.local` i due valori pubblici da *Project Settings → API*:

```
NEXT_PUBLIC_SUPABASE_URL=https://<progetto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Finiscono entrambi nel bundle del browser: sono pubblici per progetto, non segreti. La
**`service_role` non va qui** — serve solo al print server, nel suo `.env` sul PC del banco.

Il fuso orario `Europe/Rome` è scritto dentro le viste dei report nella migration di baseline. Per
un'Attività fuori dall'Italia va cambiato lì.

**Chiudere le registrazioni sul progetto hosted.** In *Authentication → Sign In / Providers →
Email*, togliere **Allow new users to sign up**. `supabase db push` porta su solo lo schema: le
impostazioni di autenticazione di `config.toml` restano in locale, quindi il progetto nuovo nasce
con le registrazioni **aperte** e va chiuso a mano. Finché resta aperto, chiunque conosca l'URL
dell'Attività ottiene un Cassiere attivo che può battere vendite vere.

## 5. Primo accesso

Il seed è vuoto: si parte da un database senza utenti e senza catalogo. E l'app non ha una
schermata di registrazione — c'è solo l'accesso — quindi **gli utenti si creano dalla dashboard
Supabase**, in *Authentication → Users → Add user* (in locale: Studio su
http://127.0.0.1:54323). Spuntare *Auto Confirm User*, altrimenti l'utente non riesce a entrare
finché non conferma l'email.

1. Creare il Titolare. **Il primo utente in assoluto diventa Titolare**, per via del trigger
   `on_auth_user_created`: quindi creare per primo chi deve comandare, non chi è di turno. Tutti
   quelli creati dopo nascono Cassieri.
2. Entrare nell'app come Titolare, in `/catalogo/categorie`, e creare le Categorie nell'ordine in
   cui devono comparire nella griglia: la velocità al banco dipende da dove sta il tasto.
3. Creare i Prodotti.
4. Creare i Cassieri dalla dashboard, uno per persona — mai un account condiviso: è chi ha battuto
   la vendita che potrà incassarla ([ADR 0003](adr/0003-solo-chi-ha-battuto-puo-incassare.md)), e
   un account in comune manda all'aria sia l'isolamento sia il riepilogo per cassiere.
5. Da `/utenti`, nell'app, il Titolare vede tutti e decide ruolo e attivazione. Quando qualcuno se
   ne va **si disattiva da qui**, non si cancella: le sue vendite passate devono restare.

Le password le imposta chi crea gli utenti, e **si cambiano dalla dashboard**: l'app non ha né una
schermata di registrazione né una di recupero password, perché entrambe presuppongono un SMTP
configurato e un'email che il personale del banco legge davvero. Con tre persone che si conoscono
tutte, il Titolare che reimposta una password vale quanto un giro di email. Se un'Attività è più
grande e la cosa diventa un peso, è lì che conviene aggiungere il recupero password — non prima.

## 6. Print server, se l'Attività stampa

Si installa **solo sul PC del banco**, ed è fuori dai workspace npm perché ha una dipendenza
nativa da compilare.

```bash
cd apps/print-server
npm ci
cp .env.example .env
```

`npm ci` usa il `package-lock.json` di questo pacchetto, che è suo e separato da
quello alla radice: due installazioni fatte in mesi diversi devono ottenere le stesse versioni.

Nel `.env`: `SUPABASE_URL`, la `SUPABASE_SERVICE_ROLE_KEY` (bypassa la RLS — **non deve mai finire
in un repository né su un client**), e `INTESTAZIONE` col nome dell'Attività in maiuscolo.

Per il logo: `apps/print-server/assets/logo.png`, monocromatico, circa 384px di larghezza per una
termica da 58mm e 576px per una da 80mm. Senza logo viene stampata la scritta di `INTESTAZIONE`.

Provare il layout senza hardware prima di collegare la stampante:

```bash
PRINTER_DRY_RUN=true npm run test:print
```

## 7. Deploy

Progetto Vercel puntato a `apps/web`, con le due variabili pubbliche del punto 4.

## 8. Prima di dati veri

- Provare a mano il giro completo su viewport telefono: batti → compare il Numero → incassa →
  chiudi.
- Il controllo che conta davvero: entrare come un Cassiere, battere una vendita, entrare come un
  secondo Cassiere e confermare che **non la vede**.
- Provare la stampa sulla termica vera, e leggere il promemoria da un metro di distanza: il Numero
  deve saltare all'occhio, perché è l'unica cosa che il cliente deve saper esibire.

## 9. Cosa non committare

- `.env`, `.env.local`, qualsiasi `.env.*` che non sia `.env.example`
- la `service_role` key, in qualunque forma
- il logo del cliente, se coperto da accordi

---

# Se questa Attività è diversa

Il boilerplate è la cassa di un'Attività **col banco**: si ordina, si riceve, si paga dopo. Se
l'Attività non funziona così, le modifiche sono nel fork e nessuno le riporterà a monte.

Quel che segue non è una guida all'implementazione: è l'elenco dei punti da toccare, così da poter
stimare il lavoro prima di accettarlo.

## Battitura e incasso sono lo stesso atto

Il caso del negozio: il cliente arriva alla cassa, si batte, paga, esce. Cadono il Numero, il
Promemoria e lo stato *Da pagare*, e con loro
[ADR 0002](adr/0002-la-vendita-nasce-non-pagata.md) e
[ADR 0003](adr/0003-solo-chi-ha-battuto-puo-incassare.md).

Si **cancella**, non si astrae: la rotta `/da-incassare`, il componente del numero assegnato, il
print server, e nella migration lo stato iniziale e i campi dell'incasso separato. Aggiornare
`CONTEXT.md`: il ciclo a due tempi è nel nucleo del boilerplate, quindi va riscritto qui.

## Giacenze che scalano a ogni vendita

Additivo, ma non gratis — [ADR 0001](adr/0001-il-catalogo-non-e-un-inventario.md) spiega perché
era stato escluso e a quali condizioni l'argomento cade.

Serve una tabella di movimenti, un saldo ricostruito da un inventario fisico iniziale, e lo scarico
dentro `crea_vendita` — con la domanda scomoda da risolvere prima di scrivere codice: **a quale
momento si scala?** Alla battitura, all'incasso, o alla Chiusura? E cosa succede al saldo quando
una Vendita viene annullata dopo essere stata pagata. Decidere questo prima, e scriverlo in un ADR
del fork.

Aggiornare `CONTEXT.md`: la voce *Nessuna giacenza* diventa falsa, e il modulo può finalmente
chiamarsi Inventario.

## Ruoli oltre a Titolare e Cassiere

Il vincolo `CHECK` sul ruolo nella migration di baseline, le policy RLS che chiamano
`app_private.e_titolare()`, l'unione `Ruolo` in `lib/supabase/database.types.ts`, `eTitolare` in
`lib/providers/auth-provider.tsx`, il flag `soloTitolare` nella barra di navigazione e il
componente `SoloTitolare`.

Prima di aggiungerne uno: serve davvero un ruolo, o serve che una persona precisa possa fare una
cosa precisa? La seconda si risolve promuovendo quella persona.

## Tavoli e conto aperto

Il modello ristorante. Non è una variante: è un'altra applicazione, e converrebbe partire da un
altro punto. [ADR 0002](adr/0002-la-vendita-nasce-non-pagata.md) spiega perché era stato scartato.

## IVA e documento fiscale

Non esiste niente da estendere: non c'è alcun modello fiscale, per scelta. Il documento commerciale
lo emette il registratore telematico dell'Attività. Se serve davvero l'emissione, è un progetto a
sé e va valutato come tale, non come una colonna in più su `prodotti`.
