# La Vendita nasce non pagata

Nel gestionale da cui questa app deriva, una vendita nasceva già pagata: battitura e incasso
erano lo stesso atto, e non c'era nessuno stato. Qui il flusso reale del locale è
**ordinano → ricevono → pagano**, quindi la Vendita ha un ciclo di vita a due tempi: nasce
*Da pagare* con il metodo di pagamento non valorizzato, e viene incassata più tardi.

Il cliente e la sua Vendita si ricollegano tramite il **Numero**, progressivo e stampato in
grande sul Promemoria che il cliente porta con sé.

## Considered Options

- **Tavolo + Conto aperto** (il modello ristorante: si aggiunge al conto e si paga all'uscita).
  Scartato perché i tavoli del locale non sono numerati né riconoscibili a vista, quindi non
  esiste una chiave su cui aprire il conto. Una seconda consumazione è una seconda Vendita.
- **Pagamento contestuale**, come nell'originale. Scartato perché non descrive quello che succede
  davvero al banco.

## Consequences

- Il Numero riparte da 1 **a ogni Chiusura**, non a mezzanotte: un locale che chiude all'una
  avrebbe altrimenti due "numero 12" nella stessa serata. La sessione di cassa aperta non è
  una tabella, è semplicemente l'insieme delle Vendite senza Chiusura.
- La Chiusura **non può avvenire** finché esistono Vendite Da pagare: vanno incassate o annullate.
  È questo che impedisce ai sospesi di accumularsi.
- Esiste lo stato *Annullata* (solo Titolare, con motivo obbligatorio) perché senza di esso una
  Vendita mai incassata bloccherebbe ogni Chiusura futura.
- "Chi ha battuto" e "chi ha incassato" sono due campi distinti: possono essere persone diverse.
