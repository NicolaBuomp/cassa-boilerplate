# Solo chi ha battuto può incassare

Un Cassiere vede e incassa **soltanto le proprie** Vendite: non vede quelle dei colleghi e non
può incassarle. Il Titolare invece vede tutto e può incassare o annullare qualsiasi Vendita.

La scelta è deliberata e serve alla responsabilità individuale: ogni euro incassato è
attribuibile a una persona sola.

## Consequences

Il costo è noto e accettato: se il cliente torna a pagare quando al banco c'è un altro Cassiere,
quest'ultimo **non vede** quella Vendita e non può incassarla. Serve che rientri chi l'ha battuta,
oppure che intervenga il Titolare.

L'override del Titolare non è una comodità ma una necessità strutturale: senza, un Cassiere che
smonta lasciando due sospesi bloccherebbe la Chiusura in modo definitivo.

Se in esercizio questo attrito risultasse insostenibile, la modifica minima è rendere visibili a
tutti i Cassieri le sole Vendite *Da pagare*, mantenendo lo storico filtrato per autore. Il
modello dati già lo consente: `battuta_da` e `incassata_da` sono campi separati.
