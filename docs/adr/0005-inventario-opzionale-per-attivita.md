# L'Inventario è una capacità opzionale per Attività

Il boilerplate include un Inventario completo ma non presume che ogni Attività debba usarlo:
parte disattivato e ogni fork lo abilita solo quando ingressi e uscite sono registrabili con
affidabilità. Quando è attivo, la battitura scarica subito la merce e l'annullamento la reintegra;
una vendita non è mai bloccata dal saldo, mentre uno scarico manuale insufficiente sì.

Questa decisione supera l'esclusione tecnica dell'[ADR 0001](0001-il-catalogo-non-e-un-inventario.md)
senza negarne l'argomento di dominio: un bar può continuare a non avere giacenze, una rivendita
non deve ricostruire il modulo da zero.
