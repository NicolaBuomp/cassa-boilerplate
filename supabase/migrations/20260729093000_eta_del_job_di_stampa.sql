-- Espone in `v_vendite` il momento in cui il job di stampa è stato accodato.
--
-- Serve a distinguere due situazioni che l'interfaccia mostrava identiche.
-- Quando il print server non è in ascolto — PC riavviato, processo chiuso — i
-- job restano `pending` per sempre: `attempts` non avanza, perché il ramo che
-- lo incrementa gira solo se il demone ha *preso* il job e la stampa è fallita.
-- Quindi lo stato non diventa mai `error`, e "in coda da un secondo" e "in coda
-- da un'ora" si leggevano tutte e due "Stampa in coda".
--
-- Al banco l'ambiguità non pesa: se non esce la carta, il cassiere se ne accorge
-- subito e detta il Numero a voce. Pesa a chi assiste l'Attività da remoto e
-- vorrebbe capire dal telefono se il demone è vivo.
--
-- Si aggiunge il timestamp del job, non un flag "in ritardo": la soglia oltre la
-- quale l'attesa diventa sospetta dipende da com'è messo il banco, e sta
-- nell'interfaccia, dove si cambia senza toccare il database.

create or replace view public.v_vendite with (security_invoker = on) as
select
  v.*,
  pb.nome as battuta_da_nome,
  pinc.nome as incassata_da_nome,
  coalesce(r.righe, '[]'::jsonb) as righe,
  pj.status as stato_stampa,
  pj.id as print_job_id,
  pj.created_at as stampa_accodata_il
from public.vendite v
join public.profiles pb on pb.id = v.battuta_da
left join public.profiles pinc on pinc.id = v.incassata_da
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'id', rv.id,
    'prodotto_id', rv.prodotto_id,
    'nome_prodotto', rv.nome_prodotto,
    'prezzo_unitario', rv.prezzo_unitario,
    'quantita', rv.quantita,
    'totale_riga', rv.totale_riga
  ) order by rv.nome_prodotto) as righe
  from public.righe_vendita rv
  where rv.vendita_id = v.id
) r on true
-- Il job più recente della Vendita: una ristampa ne accoda uno nuovo, ed è
-- quello che conta per capire se la stampa sta procedendo adesso.
left join lateral (
  select j.id, j.status, j.created_at
  from public.print_jobs j
  where j.vendita_id = v.id
  order by j.created_at desc
  limit 1
) pj on true;

grant select on public.v_vendite to authenticated;
