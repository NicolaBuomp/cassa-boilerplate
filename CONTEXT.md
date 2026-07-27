# Linguaggio del dominio

Questo file è un **glossario**, non una specifica. Non contiene dettagli implementativi.
Se un termine qui è in disaccordo con il codice, uno dei due è sbagliato: risolvete la
discrepanza invece di aggirarla.

---

## Prodotto

Una cosa vendibile: nome, categoria, prezzo, e un interruttore di **disponibilità**.

Un Prodotto non disponibile non è cancellato: è semplicemente non vendibile oggi (finito,
fuori stagione). Resta nel Catalogo e resta nei report storici.

> **Non esistono** *giacenza*, *carico*, *scarico*, *movimento di magazzino*, *sotto scorta*,
> *distinta base*. Quanti pezzi ci sono nel frigo lo sa il titolare guardando il frigo.
> Per questo il modulo si chiama **Catalogo** — mai "Inventario", mai "Magazzino".
> Vedi [ADR 0001](docs/adr/0001-il-catalogo-non-e-un-inventario.md).

## Categoria

Un raggruppamento di Prodotti usato per organizzare la griglia di battitura (Birre, Cocktail,
Caffetteria…). Ha un **ordine** perché la velocità al banco dipende da dove sta il tasto.

## Vendita

Ciò che un cliente ha consumato, dal momento in cui viene battuta. Ha un **Numero** e attraversa
tre stati:

- **Da pagare** — battuta e servita, non ancora incassata. È lo stato iniziale.
- **Pagata** — incassata, con un metodo (contanti o POS) e un orario di incasso.
- **Annullata** — non sarà mai incassata: il cliente se n'è andato, oppure è un errore di
  battitura. La riga resta, con motivo e autore. Non si cancella nulla.

> **Non esiste** il termine *Ordine*. Non c'è nessuna fase di prenotazione, nessuno stato
> "in preparazione" o "servito": il banco e la cucina non sono modellati. Chi dice "ordine"
> intende Vendita.
>
> **Non esistono** *Tavolo* e *Conto*: i tavoli non sono numerati e non si riconoscono a vista.
> Due consumazioni dello stesso cliente in momenti diversi sono due Vendite distinte.
> Vedi [ADR 0002](docs/adr/0002-la-vendita-nasce-non-pagata.md).

## Riga di Vendita

Una voce dentro una Vendita. Nome e prezzo del Prodotto sono **congelati** al momento della
battitura: cambiare il prezzo di un Prodotto non riscrive la storia.

## Numero

Progressivo intero stampato in grande sul Promemoria, che il cliente esibisce per pagare.
È l'**unico aggancio** fra un cliente e la sua Vendita.

**Riparte da 1 a ogni Chiusura**, non a mezzanotte: un locale che chiude all'una di notte
avrebbe altrimenti due Vendite "numero 12" nella stessa serata.

## Promemoria di vendita

Il foglietto stampato sulla termica al banco quando la Vendita viene battuta.

> **Non ha valore fiscale.** Il documento commerciale è emesso separatamente sul registratore
> telematico dell'attività. Questa applicazione non lo sostituisce, non ci si integra, e non
> trasmette corrispettivi.

## Chiusura

Congela tutte le Vendite non ancora chiuse e ne ricava i totali del periodo (contanti, POS,
sconti). Una Vendita appartiene al massimo a una Chiusura, e una Chiusura non si riapre.

Non si può chiudere finché esistono Vendite **Da pagare**: vanno prima incassate o annullate.

> **Conta soltanto ciò che è passato dall'app.** Non esistono fondo cassa, conteggio del contante
> fisico, differenza, prelievi. Non è una quadratura di cassa: è un riepilogo.

## Titolare

Può tutto: Catalogo, prezzi, utenti, report, sconti, annullamenti, Chiusura. Può incassare o
annullare **qualsiasi** Vendita, anche battuta da altri — è la valvola che impedisce a un
Cassiere andato a casa di bloccare la Chiusura per sempre.

## Cassiere

Batte Vendite e incassa **soltanto le proprie**. Non vede le Vendite dei colleghi, non annulla,
non sconta, non chiude cassa, non tocca il Catalogo.
Vedi [ADR 0003](docs/adr/0003-solo-chi-ha-battuto-puo-incassare.md).

## Plancia

La schermata del Titolare che mostra tutte le Vendite del periodo aperto e il loro stato, in
tempo reale. Serve a vedere il locale, non a operarci.
