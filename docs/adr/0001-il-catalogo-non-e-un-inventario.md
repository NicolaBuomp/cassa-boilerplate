# Il Catalogo non è un inventario

Questa app nasce estraendo la cassa di un altro gestionale, che teneva le giacenze: ogni vendita
generava un movimento di magazzino e scalava una quantità. Qui **non c'è nessuna giacenza**: un
Prodotto ha nome, prezzo e un interruttore di disponibilità, e basta. Il magazzino serviva solo
a sapere quanto vende un prodotto e a poterlo disabilitare quando finisce — entrambe le cose si
ottengono senza tenere un saldo.

## Considered Options

Tenere le giacenze come nell'originale è stato valutato e scartato. Un saldo di magazzino è
corretto solo se *ogni* carico, rottura, consumo interno e rettifica viene registrato: in un bar
questo non succede, il numero diverge nel giro di settimane, e a quel punto è peggio di non
averlo — perché qualcuno ci prende decisioni sopra. È stata scartata anche la via di mezzo
(giacenze solo sul confezionato, niente su cocktail e spina), perché avrebbe richiesto comunque
tutta la macchina dei movimenti per coprirne metà.

## Consequences

- Il "venduto per prodotto" si calcola aggregando le Righe di Vendita, non leggendo i movimenti.
- Non esiste il concetto di sotto scorta, quindi non esistono avvisi di riordino.
- Non esiste distinta base: un cocktail è un Prodotto come un altro, non scompone niente.
- Reintrodurre le giacenze più avanti significa aggiungere una tabella movimenti e ricostruire
  i saldi da un inventario fisico iniziale. È additivo, ma non è gratis.
