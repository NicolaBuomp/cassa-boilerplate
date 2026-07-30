# Linguaggio del dominio

Questo file è un **glossario**, non una specifica. Non contiene dettagli implementativi.
Se un termine qui è in disaccordo con il codice, uno dei due è sbagliato: risolvete la
discrepanza invece di aggirarla.

Il glossario è diviso in due parti, e la distinzione conta:

- **Il nucleo** — i termini che valgono in ogni installazione. Se li cambiate, non state
  personalizzando: state costruendo un'altra applicazione.
- **Le decisioni di questa Attività** — ciò che è stato deliberatamente *escluso*, con il perché.
  Sono le scelte che tengono l'applicazione piccola, ma sono vere **per questa Attività**, non
  per tutte. Chi parte da questo boilerplate è tenuto a rileggerle e a decidere se reggono ancora.

---

# Il nucleo

## Attività

L'esercizio commerciale che usa questa cassa. Ce n'è **esattamente una per installazione**: un
solo punto vendita, un solo catalogo, una sola serie di Numeri.

Due Attività non condividono niente — né database, né codice dopo il primo giorno. Se ne servono
due, sono due installazioni distinte.

## Prodotto

Una cosa vendibile: nome, categoria, prezzo, e un interruttore di **disponibilità**.

Un Prodotto non disponibile non è cancellato: è semplicemente non vendibile oggi (finito,
fuori stagione). Resta nel Catalogo e resta nei report storici.

Il modulo si chiama **Catalogo**. Vedi *Nessuna giacenza* fra le decisioni locali.

## Categoria

Un raggruppamento di Prodotti usato per organizzare la griglia di battitura. Ha un **ordine**
perché la velocità al banco dipende da dove sta il tasto.

## Vendita

Ciò che un cliente ha consumato, dal momento in cui viene battuta. Ha un **Numero** e attraversa
tre stati:

- **Da pagare** — battuta e servita, non ancora incassata. È lo stato iniziale.
- **Pagata** — incassata, con un metodo (contanti o POS) e un orario di incasso.
- **Annullata** — non sarà mai incassata: il cliente se n'è andato, oppure è un errore di
  battitura. La riga resta, con motivo e autore. Non si cancella nulla.

> Il ciclo a due tempi presuppone un **banco**: si ordina, si riceve, si paga dopo. È il nucleo di
> questa applicazione, non una variante. Un'Attività dove battitura e incasso sono lo stesso atto —
> un negozio, una rivendita — non ha bisogno né del ciclo né del Numero, e farà bene a sopprimerli
> invece di conviverci. Vedi [ADR 0002](docs/adr/0002-la-vendita-nasce-non-pagata.md).

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

## Chiusura

Congela tutte le Vendite non ancora chiuse e ne ricava i totali del periodo (contanti, POS,
sconti). Una Vendita appartiene al massimo a una Chiusura, e una Chiusura non si riapre.

Non si può chiudere finché esistono Vendite **Da pagare**: vanno prima incassate o annullate.

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

## Inventario

Il registro delle quantità di merce disponibili, dei loro ingressi e delle loro uscite. È una
capacità opzionale dell'Attività: se attiva usa la stessa anagrafica Prodotto del Catalogo; se
inattiva, *giacenza*, *Movimento* e *scorta* non appartengono al suo linguaggio.

## Movimento

Una variazione con segno della giacenza di un Prodotto: Carico, Scarico, Vendita, Annullo o
Rettifica. Il Saldo è la somma dei Movimenti, mai un valore indipendente.

---

# Le decisioni di questa Attività

Quello che segue è vero per l'installazione che state leggendo. Ogni voce riporta l'argomento che
l'ha decisa, così che chi eredita il codice possa giudicare se quell'argomento vale ancora **da
lui** — e non limitarsi a subirlo.

Se una di queste decisioni cambia, cambiate anche questa sezione. Un glossario che mente è peggio
di un glossario che manca.

## Nessuna giacenza

**Non esistono** *giacenza*, *carico*, *scarico*, *movimento di magazzino*, *sotto scorta*,
*distinta base*. Quanti pezzi ci sono nel frigo lo sa il Titolare guardando il frigo. Per questo
il modulo si chiama **Catalogo** — mai "Inventario", mai "Magazzino".

Questa resta la configurazione iniziale del boilerplate; un fork può deliberatamente attivare
l'Inventario descritto nel nucleo quando l'argomento seguente non vale per la sua Attività.

*Perché:* un saldo di magazzino è corretto solo se ogni carico, rottura, consumo interno e
rettifica viene registrato. In un bar questo non succede, il numero diverge in poche settimane, e
allora è peggio di non averlo — perché qualcuno ci prende decisioni sopra.
Vedi [ADR 0001](docs/adr/0001-il-catalogo-non-e-un-inventario.md).
Vedi anche [ADR 0005](docs/adr/0005-inventario-opzionale-per-attivita.md).

*Quando smette di valere:* in un'Attività dove la merce entra con una fattura ed esce con una
vendita — un negozio, una rivendita — l'argomento non regge e le giacenze diventano sensate.
L'ADR spiega anche cosa costa reintrodurle.

## Nessun Ordine

**Non esiste** il termine *Ordine*. Non c'è nessuna fase di prenotazione, nessuno stato "in
preparazione" o "servito": il banco e la cucina non sono modellati. Chi dice "ordine" intende
Vendita.

*Perché:* modellare la preparazione richiede che qualcuno la aggiorni mentre lavora. Al banco
nessuno lo fa, e uno stato che nessuno aggiorna è rumore.

## Nessun Tavolo, nessun Conto

**Non esistono** *Tavolo* e *Conto*. Due consumazioni dello stesso cliente in momenti diversi
sono due Vendite distinte.

*Perché:* i tavoli del locale non sono numerati né riconoscibili a vista, quindi non esiste una
chiave su cui aprire un conto.

*Quando smette di valere:* in un'Attività con tavoli identificabili — un ristorante, una
pizzeria — il Conto aperto è il modello giusto, e sostituisce il Numero come aggancio fra cliente
e Vendita.

## Nessun valore fiscale

Il Promemoria **non ha valore fiscale**. Il documento commerciale è emesso separatamente sul
registratore telematico dell'Attività. Questa applicazione non lo sostituisce, non ci si integra,
e non trasmette corrispettivi. Non esistono aliquote, imponibile, scorporo.

## Nessuna quadratura di cassa

La Chiusura **conta soltanto ciò che è passato dall'app**. Non esistono fondo cassa, conteggio del
contante fisico, differenza, prelievi. Non è una quadratura: è un riepilogo.

## Due ruoli soltanto

Esistono **Titolare** e **Cassiere**, e nient'altro.

*Perché:* una matrice di permessi modulo×azione costa più di quanto renda in un locale dove le
persone sono tre e si conoscono tutte.

*Quando smette di valere:* con più turni e un responsabile che non è il Titolare, serve un terzo
ruolo. È additivo, ma tocca sia il database sia l'interfaccia.
