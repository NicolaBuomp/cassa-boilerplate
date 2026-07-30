# Print server

Gira sul PC al banco, sempre acceso. Ascolta la tabella `print_jobs` su Supabase
Realtime e stampa i **promemoria di vendita** su una termica ESC/POS.

Il promemoria **non ha valore fiscale**: il documento commerciale lo emette il
registratore telematico dell'attività, che con questa applicazione non c'entra.

## Perché una coda e non una stampa diretta dal telefono

Se la stampa partisse dal telefono, un telefono che si blocca o esce dalla rete
perderebbe il promemoria. Con la coda la vendita è già salvata: il job resta
`pending` e viene ripreso appena il PC torna disponibile. Il numero di tentativi
è limitato da `MAX_ATTEMPTS`, dopo di che il job va in `error` e compare come
"stampa fallita" nell'app, dove si può ristampare.

La presa del job avviene nel database: più processi possono essere attivi senza
stampare due volte lo stesso promemoria. `PRINT_LEASE_SECONDS` stabilisce dopo
quanto tempo un job lasciato in `printing` da un processo terminato può essere
recuperato; il valore predefinito è 120 secondi.

## Installazione

Questo pacchetto è **fuori dai workspace npm** del monorepo, perché
`@thiagoelg/node-printer` è una dipendenza nativa da compilare e serve solo qui.

```bash
cd apps/print-server
npm ci                 # non `npm install`: vedi sotto
cp .env.example .env   # poi compilare SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm start
```

`npm ci`, e non `npm install`, perché qui c'è un `package-lock.json` proprio —
il lock alla radice non copre questo pacchetto, che è fuori dai workspace. Senza
lock ogni PC di ogni attività risolverebbe le versioni al momento
dell'installazione, cioè in mesi diversi: la stampa smetterebbe di funzionare in
un posto solo, e senza che nulla sia cambiato nel codice.

Se serve aggiornare una dipendenza, `npm install <pacchetto>` qui dentro e
**committare il lock aggiornato**.

## Prova senza stampante

```bash
PRINTER_DRY_RUN=true npm run test:print
```

## Logo

Mettere un `assets/logo.png` monocromatico (larghezza ~384px per una termica da
58mm, ~576px per una da 80mm). Se manca, in cima viene stampata la scritta di
`INTESTAZIONE`.
