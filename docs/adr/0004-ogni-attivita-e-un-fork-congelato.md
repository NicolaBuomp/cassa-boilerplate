# Ogni Attività è un fork congelato

Questo repository è un **boilerplate**, non un prodotto. Ogni Attività che chiede la cassa parte da
una copia (`Use this template` su GitHub), la personalizza, e da quel momento **non riceve più
niente da qui**. Non esiste un remote `upstream`, non esiste una versione da aggiornare, non esiste
un canale per far scendere le correzioni.

La conseguenza va detta chiara, perché è il prezzo dell'intera scelta: **un bug nel nucleo costa N
correzioni**, una per Attività, ognuna da ritrovare e riapplicare a mano. È il motivo per cui gli
invarianti in `supabase/tests/invarianti.sql` vanno eseguiti *prima* di generare la prima istanza,
e non "quando capita".

## Considered Options

- **Multi-tenant in un solo database.** Un'installazione sola, una colonna `attivita_id` in ogni
  tabella. Scartato: quella colonna andrebbe infilata in ogni indice, ogni RPC e ogni policy RLS,
  e i lock consultivi sulla numerazione diventerebbero per-Attività. Ma soprattutto non risolve il
  problema vero — Attività di tipo diverso non vogliono lo *stesso* dominio con dati separati,
  vogliono domini diversi. Un negozio che scala le quantità non è questa applicazione con un
  filtro in più.
- **Fork sincronizzati via `git pull upstream`.** Ogni Attività resta un fork che tira le
  correzioni. Scartato per un motivo più concreto di git: ogni Attività ha il **suo progetto
  Supabase con la sua storia di migration**. Se un'istanza aggiunge `0002_inventario.sql` e a monte
  nasce `0002_qualcosaltro.sql`, le due storie collidono e la risoluzione è manuale ogni volta.
  Il costo della sincronizzazione supera il costo di ricorreggere.
- **Un solo codice deployato N volte,** con le differenze in variabili d'ambiente. È la soluzione
  giusta se cambiano solo insegna e colori — ma non regge appena cambia il dominio, e il dominio
  cambia: la prima Attività non-bar in coda vuole le giacenze, che questo nucleo non ha
  ([ADR 0001](0001-il-catalogo-non-e-un-inventario.md)).
- **Feature flag e moduli accendibili.** Scartato perché ogni interruttore è una combinazione da
  provare, e nessuno le proverà: sarebbero varianti dichiarate e mai verificate.

## Consequences

- L'unica metrica da ottimizzare è **quanto poco tempo passa da `clone` a cassa funzionante**. Non
  la manutenibilità di N installazioni, che non esiste per costruzione. Da qui discende che la
  personalizzazione sta in due file soli (`apps/web/lib/attivita.ts` e i token in
  `app/globals.css`) e che il resto è documentazione, non astrazione.
- **Il boilerplate ha un'opinione**: è la cassa di un'Attività col banco, dove si ordina, si riceve
  e si paga dopo. Un'Attività diversa forka e *cancella* — Numero, `/da-incassare`, print server.
  Cancellare è più facile che inventare, e non si paga oggi per una variante che non esiste ancora.
- Il seed è vuoto e gli utenti non viaggiano col template: una credenziale di comodo replicata a
  ogni fork prima o poi finisce su un progetto di produzione.
- `CONTEXT.md` distingue il nucleo dalle decisioni locali, perché quelle negazioni sono argomenti
  contestuali e chi eredita il codice deve poterle giudicare invece di subirle.
- Non esiste un numero di versione da confrontare fra istanze. Il tag `v1.0` a monte dice soltanto
  da dove sono partite, non che cosa hanno oggi.
