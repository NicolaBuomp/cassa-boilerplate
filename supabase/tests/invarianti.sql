-- Invarianti del dominio: le regole che, se si rompono, fanno perdere soldi o
-- fiducia nei numeri. Si eseguono contro il database locale:
--
--   supabase start
--   supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/invarianti.sql
--
-- Ogni blocco fallisce rumorosamente con `assert`. Nessun output = tutto verde.
--
-- Lo script è **autosufficiente**: si crea i propri utenti e il proprio catalogo,
-- e li cancella in fondo. Non dipende dal seed, che nel boilerplate è vuoto.
--
-- Ogni blocco è una transazione a sé (autocommit), e non è un dettaglio: le
-- impersonazioni usano `set_config(..., is_local => true)`, che vale fino a fine
-- transazione. È così che ogni blocco riparte da superuser e può leggere le
-- tabelle senza che la RLS gli nasconda metà delle righe. Non racchiudete il
-- file in un `begin/rollback`: i blocchi 10, 11 e 15 comincerebbero a mentire.
--
-- Se un blocco fallisce, psql si ferma e la pulizia finale non viene eseguita:
-- il database resta sporco di proposito, così potete guardarci dentro. Per
-- rieseguire, `supabase db reset`.

\set ON_ERROR_STOP on
\timing off

-- ── Guardia ──────────────────────────────────────────────────────────────────
-- Questo script scrive utenti e vendite, e dà per scontato di partire da zero
-- (il primo utente creato deve diventare Titolare, la prima vendita deve essere
-- la numero 1). Su un database con dati veri fallirebbe in modo incomprensibile,
-- oltre a essere una pessima idea.

do $$
begin
  if exists (select 1 from auth.users)
     or exists (select 1 from public.vendite)
     or exists (select 1 from public.chiusure) then
    raise exception using message =
      'Il database non è vuoto. invarianti.sql crea utenti e vendite e presuppone '
      'una cassa mai aperta: eseguilo solo in locale, dopo `supabase db reset`.';
  end if;
end;
$$;

-- ── Fixture ──────────────────────────────────────────────────────────────────
-- Tre utenti con id fissi, così i blocchi sotto possono impersonarli. Il primo
-- inserito diventa Titolare per via del trigger `on_auth_user_created`: è già di
-- per sé una verifica del bootstrap.
--
-- La password è un uuid casuale che nessuno conosce: questi utenti non servono
-- per entrare nell'app, e non devono poterlo fare nemmeno per sbaglio.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'titolare@prova.local',
    extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Titolare di prova"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'cassiere1@prova.local',
    extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Cassiere di prova"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'cassiere2@prova.local',
    extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Seconda cassiera di prova"}'::jsonb
  );

do $$
begin
  assert (select ruolo from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'titolare',
    'il primo utente registrato deve diventare Titolare';
  assert (select ruolo from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'cassiere',
    'dal secondo in poi si nasce Cassiere';
end;
$$;

-- Catalogo di prova, deliberatamente senza vocabolario di settore: il nucleo non
-- presume che tipo di attività lo stia usando. I prezzi sono scelti per i blocchi
-- che li verificano, non per verosimiglianza.

insert into public.categorie (id, nome, ordine) values
  ('aaaaaaa1-0000-4000-8000-000000000001', 'Prova', 10);

insert into public.prodotti (nome, categoria_id, prezzo, ordine, disponibile) values
  ('Prova A',        'aaaaaaa1-0000-4000-8000-000000000001',  4.00, 10, true),
  ('Prova B',        'aaaaaaa1-0000-4000-8000-000000000001',  1.20, 20, true),
  ('Prova C',        'aaaaaaa1-0000-4000-8000-000000000001',  3.00, 30, true),
  ('Prova D',        'aaaaaaa1-0000-4000-8000-000000000001', 12.00, 40, true),
  ('Prova E',        'aaaaaaa1-0000-4000-8000-000000000001',  5.00, 50, true),
  ('Prova esaurita', 'aaaaaaa1-0000-4000-8000-000000000001',  7.00, 60, false);

-- Impersona un utente: è così che `auth.uid()` risolve dentro le RPC e le policy.
create or replace function pg_temp.diventa(p_utente uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_utente)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.righe(p_nome text, p_qta numeric default 1) returns jsonb
language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'prodotto_id', (select id from public.prodotti where nome = p_nome),
    'quantita', p_qta
  ));
$$;

\echo '── 1. Numerazione progressiva ──────────────────────────────────────────'
do $$
declare v1 jsonb; v2 jsonb; v3 jsonb;
begin
  perform pg_temp.diventa('11111111-1111-1111-1111-111111111111');
  v1 := public.crea_vendita(pg_temp.righe('Prova A'));
  v2 := public.crea_vendita(pg_temp.righe('Prova B', 2));

  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  v3 := public.crea_vendita(pg_temp.righe('Prova C'));

  -- I numeri sono progressivi e condivisi fra cassieri diversi: il cliente
  -- non deve mai vedere due volte lo stesso numero nella stessa sessione.
  assert (v1 ->> 'numero')::int = 1, 'la prima vendita deve essere la numero 1';
  assert (v2 ->> 'numero')::int = 2, 'i numeri devono essere progressivi';
  assert (v3 ->> 'numero')::int = 3, 'la numerazione è condivisa fra cassieri';
end;
$$;

\echo '── 2. Idempotenza su request_id ────────────────────────────────────────'
do $$
declare rid uuid := gen_random_uuid(); a jsonb; b jsonb; quante int;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  a := public.crea_vendita(pg_temp.righe('Prova E'), rid);
  b := public.crea_vendita(pg_temp.righe('Prova E'), rid);

  assert a ->> 'id' = b ->> 'id', 'stesso request_id deve restituire la stessa vendita';
  select count(*) into quante from public.vendite where request_id = rid;
  assert quante = 1, 'un retry non deve creare una seconda vendita';
end;
$$;

\echo '── 3. Il prezzo viene dal catalogo, non dal client ──────────────────────'
do $$
declare v jsonb; prezzo numeric;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  -- Il client manda anche un prezzo: deve essere ignorato.
  v := public.crea_vendita(jsonb_build_array(jsonb_build_object(
    'prodotto_id', (select id from public.prodotti where nome = 'Prova A'),
    'quantita', 1,
    'prezzo_unitario', 0.01
  )));

  select prezzo_unitario into prezzo
    from public.righe_vendita where vendita_id = (v ->> 'id')::uuid;
  assert prezzo = 4.00, format('il prezzo deve venire dal catalogo, trovato %s', prezzo);
end;
$$;

\echo '── 4. Un prodotto non disponibile non si può vendere ────────────────────'
do $$
declare fallito boolean := false;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  begin
    perform public.crea_vendita(pg_temp.righe('Prova esaurita')); -- disponibile = false
  exception when others then
    fallito := true;
  end;
  assert fallito, 'vendere un prodotto esaurito deve fallire';
end;
$$;

\echo '── 5. Solo chi ha battuto può incassare (ADR 0003) ──────────────────────'
do $$
declare v jsonb; fallito boolean := false;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  v := public.crea_vendita(pg_temp.righe('Prova C'));

  -- Un altro cassiere non può incassarla.
  perform pg_temp.diventa('33333333-3333-3333-3333-333333333333');
  begin
    perform public.incassa_vendita((v ->> 'id')::uuid, 'contanti');
  exception when others then
    fallito := true;
  end;
  assert fallito, 'un cassiere non deve poter incassare la vendita di un collega';

  -- Il titolare invece sì: è la valvola che impedisce di bloccare la chiusura.
  perform pg_temp.diventa('11111111-1111-1111-1111-111111111111');
  perform public.incassa_vendita((v ->> 'id')::uuid, 'contanti');
  assert (select stato from public.vendite where id = (v ->> 'id')::uuid) = 'pagata',
    'il titolare deve poter incassare qualsiasi vendita';
end;
$$;

\echo '── 6. Lo sconto è riservato al titolare e richiede una causale ──────────'
do $$
declare v jsonb; fallito boolean := false; v_totale numeric;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  v := public.crea_vendita(pg_temp.righe('Prova D')); -- 12.00

  begin
    perform public.incassa_vendita((v ->> 'id')::uuid, 'contanti', null, 2, 'sconto amico');
  exception when others then
    fallito := true;
  end;
  assert fallito, 'un cassiere non deve poter scontare';

  perform pg_temp.diventa('11111111-1111-1111-1111-111111111111');
  fallito := false;
  begin
    perform public.incassa_vendita((v ->> 'id')::uuid, 'contanti', null, 2, '   ');
  exception when others then
    fallito := true;
  end;
  assert fallito, 'lo sconto senza causale deve fallire';

  perform public.incassa_vendita((v ->> 'id')::uuid, 'contanti', 20, 2, 'arrotondamento');
  select ve.totale into v_totale
    from public.vendite ve
   where ve.id = (v ->> 'id')::uuid;
  assert v_totale = 10.00, format('12,00 meno 2,00 di sconto deve fare 10,00, trovato %s', v_totale);
  assert (select resto from public.vendite where id = (v ->> 'id')::uuid) = 10.00,
    'il resto va calcolato sul totale scontato';
end;
$$;

\echo '── 7. Il contante ricevuto deve coprire il totale ───────────────────────'
do $$
declare v jsonb; fallito boolean := false;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  v := public.crea_vendita(pg_temp.righe('Prova D')); -- 12.00
  begin
    perform public.incassa_vendita((v ->> 'id')::uuid, 'contanti', 5);
  exception when others then
    fallito := true;
  end;
  assert fallito, 'incassare meno del dovuto deve fallire';
end;
$$;

\echo '── 8. L''annullamento è del titolare e vuole un motivo ──────────────────'
do $$
declare v jsonb; fallito boolean := false;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  v := public.crea_vendita(pg_temp.righe('Prova B'));

  begin
    perform public.annulla_vendita((v ->> 'id')::uuid, 'sbagliato');
  exception when others then
    fallito := true;
  end;
  assert fallito, 'un cassiere non deve poter annullare';

  perform pg_temp.diventa('11111111-1111-1111-1111-111111111111');
  fallito := false;
  begin
    perform public.annulla_vendita((v ->> 'id')::uuid, '  ');
  exception when others then
    fallito := true;
  end;
  assert fallito, 'annullare senza motivo deve fallire';

  perform public.annulla_vendita((v ->> 'id')::uuid, 'cliente andato via');
  assert (select stato from public.vendite where id = (v ->> 'id')::uuid) = 'annullata',
    'la vendita deve risultare annullata';
  assert (select totale from public.vendite where id = (v ->> 'id')::uuid) = 0,
    'una vendita annullata non vale niente';
end;
$$;

\echo '── 9. I sospesi bloccano la chiusura, e la nominano ─────────────────────'
do $$
declare v jsonb; messaggio text; fallito boolean := false;
begin
  perform pg_temp.diventa('11111111-1111-1111-1111-111111111111');
  v := public.crea_vendita(pg_temp.righe('Prova C'));

  begin
    perform public.chiudi_cassa();
  exception when others then
    fallito := true;
    messaggio := sqlerrm;
  end;

  assert fallito, 'la chiusura deve fallire se ci sono vendite da pagare';
  assert messaggio like format('%%%s%%', (v ->> 'numero')),
    format('il messaggio deve nominare il numero sospeso, era: %s', messaggio);

  -- Risolto il sospeso, la chiusura passa.
  perform public.incassa_vendita((v ->> 'id')::uuid, 'pos');
  perform public.chiudi_cassa('prova');
end;
$$;

\echo '── 10. Dopo la chiusura la numerazione riparte da 1 ─────────────────────'
do $$
declare v jsonb; aperte int;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  v := public.crea_vendita(pg_temp.righe('Prova B'));
  assert (v ->> 'numero')::int = 1,
    format('dopo la chiusura si riparte da 1, trovato %s', v ->> 'numero');

  select count(*) into aperte from public.vendite where chiusura_id is null;
  assert aperte = 1, 'la chiusura deve aver agganciato tutte le vendite precedenti';
end;
$$;

\echo '── 11. I totali della chiusura tornano ─────────────────────────────────'
do $$
declare c record; atteso numeric;
begin
  select * into c from public.chiusure order by numero desc limit 1;
  assert c.totale = c.totale_contanti + c.totale_pos,
    'il totale della chiusura è contanti + pos';
  assert c.numero_vendite > 0, 'la chiusura deve contare le vendite incassate';
  -- Gli annullamenti non entrano negli incassi.
  select coalesce(sum(totale), 0) into atteso
    from public.vendite where chiusura_id = c.id and stato = 'pagata';
  assert c.totale = atteso, format('atteso %s, in chiusura %s', atteso, c.totale);
end;
$$;

\echo '── 12. RLS: un cassiere vede solo le proprie vendite ────────────────────'
do $$
declare visibili int; totali int;
begin
  -- Qui serve davvero il ruolo `authenticated`: le policy non si applicano al
  -- superuser che esegue lo script.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);

  select count(*) into visibili from public.vendite;
  select count(*) into totali from public.vendite where battuta_da = '22222222-2222-2222-2222-222222222222';
  assert visibili = totali,
    format('il cassiere vede %s vendite ma ne ha battute %s', visibili, totali);

  -- Le chiusure sono roba da titolare.
  assert (select count(*) from public.chiusure) = 0,
    'un cassiere non deve vedere le chiusure';

  reset role;
end;
$$;

\echo '── 13. RLS: il titolare vede tutto ─────────────────────────────────────'
do $$
declare visibili int; totali int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  select count(*) into visibili from public.vendite;
  reset role;
  select count(*) into totali from public.vendite;

  assert visibili = totali, 'il titolare deve vedere tutte le vendite';
end;
$$;

\echo '── 14. RLS: un cassiere non modifica il catalogo ────────────────────────'
do $$
declare fallito boolean := false; toccate int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);

  begin
    insert into public.prodotti (nome, prezzo) values ('Abusivo', 1);
  exception when others then
    fallito := true;
  end;

  -- Un UPDATE bloccato dalla RLS non solleva: semplicemente non tocca righe.
  update public.prodotti set prezzo = 0 where nome = 'Prova A';
  get diagnostics toccate = row_count;

  reset role;

  assert fallito, 'un cassiere non deve poter creare prodotti';
  assert toccate = 0, 'un cassiere non deve poter modificare i prezzi';
  assert (select prezzo from public.prodotti where nome = 'Prova A') = 4.00,
    'il prezzo non deve essere cambiato';
end;
$$;

\echo '── 15. Ogni vendita accoda una stampa ──────────────────────────────────'
do $$
declare v jsonb; job record;
begin
  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  v := public.crea_vendita(pg_temp.righe('Prova B', 2));

  select * into job from public.print_jobs where vendita_id = (v ->> 'id')::uuid;
  assert found, 'la battitura deve accodare un promemoria da stampare';
  assert job.status = 'pending', 'il job nasce pending';
  assert (job.payload ->> 'numero')::int = (v ->> 'numero')::int,
    'il payload deve portare il Numero: è ciò che il cliente esibisce';
  assert jsonb_array_length(job.payload -> 'righe') = 1, 'il payload deve contenere le righe';
  assert (job.payload ->> 'stato') = 'da_pagare', 'il promemoria deve dire che è da pagare';

  -- La ristampa ne accoda un altro senza toccare la vendita.
  perform public.ristampa_vendita((v ->> 'id')::uuid);
  assert (select count(*) from public.print_jobs where vendita_id = (v ->> 'id')::uuid) = 2,
    'la ristampa deve accodare un secondo job';
end;
$$;

\echo '── 16. Inventario opzionale: battitura, annullo e scarico manuale ──────'
do $$
declare pid uuid; v jsonb; s numeric; fallita boolean;
begin
  perform pg_temp.diventa('11111111-1111-1111-1111-111111111111');
  insert into public.prodotti
    (nome, categoria_id, prezzo, traccia_giacenza, prezzo_acquisto, scorta_minima)
  values
    ('Inventario A', 'aaaaaaa1-0000-4000-8000-000000000001', 4, true, 2, 2)
  returning id into pid;

  perform public.registra_movimento(pid, 'carico', 5, 2, 'bolla di prova');

  perform pg_temp.diventa('22222222-2222-2222-2222-222222222222');
  v := public.crea_vendita(pg_temp.righe('Inventario A', 2));
  select saldo into s from public.v_inventario where prodotto_id = pid;
  assert s = 3, 'la battitura deve scaricare la merce quando viene servita';

  perform pg_temp.diventa('11111111-1111-1111-1111-111111111111');
  perform public.annulla_vendita((v ->> 'id')::uuid, 'errore di prova');
  select saldo into s from public.v_inventario where prodotto_id = pid;
  assert s = 5, 'annullare deve reintegrare la merce';

  fallita := false;
  begin
    perform public.registra_movimento(pid, 'scarico', 6, 2, 'rottura');
  exception when others then fallita := true;
  end;
  assert fallita, 'uno scarico manuale insufficiente deve essere rifiutato';

  perform public.registra_movimento(pid, 'rettifica', 4, null, 'conteggio');
  select saldo into s from public.v_inventario where prodotto_id = pid;
  assert s = 4, 'la rettifica deve portare il saldo al valore contato';
end;
$$;

-- ── Pulizia ──────────────────────────────────────────────────────────────────
-- L'ordine conta: `vendite.chiusura_id` è `on delete restrict`, e le vendite
-- puntano ai profili di chi le ha battute. I profili se ne vanno da soli con gli
-- utenti (`on delete cascade`).

delete from public.movimenti;
delete from public.print_jobs;
delete from public.righe_vendita;
delete from public.vendite;
delete from public.chiusure;
delete from public.prodotti;
delete from public.categorie;
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

do $$
begin
  assert not exists (select 1 from auth.users), 'la pulizia deve rimuovere gli utenti di prova';
  assert not exists (select 1 from public.vendite), 'la pulizia deve rimuovere le vendite di prova';
  assert not exists (select 1 from public.prodotti), 'la pulizia deve rimuovere il catalogo di prova';
end;
$$;

\echo ''
\echo 'Tutti gli invarianti sono verdi. Il database è tornato com''era.'
