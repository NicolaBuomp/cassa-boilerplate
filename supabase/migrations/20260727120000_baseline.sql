-- ============================================================================
-- Roxy Cassa — schema di baseline
--
-- Il linguaggio segue CONTEXT.md: Prodotto, Vendita, Riga di Vendita, Numero,
-- Chiusura, Titolare, Cassiere. Non esiste il concetto di giacenza (ADR 0001),
-- non esiste il termine "ordine" (ADR 0002).
--
-- Le tabelle di dominio sono in sola lettura via RLS: ogni scrittura passa da
-- una RPC `security definer`, che è l'unico posto dove vivono le regole.
-- ============================================================================

create schema if not exists app_private;

-- ============================================================================
-- Utenti
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text,
  ruolo text not null default 'cassiere' check (ruolo in ('titolare', 'cassiere')),
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Utenti dell''app. Due soli ruoli: il Titolare può tutto, il Cassiere batte e incassa le proprie vendite.';

-- ----------------------------------------------------------------------------
-- Helper di autorizzazione. Vivono in app_private perché non sono API pubblica,
-- ma vanno eseguibili da `authenticated` perché le policy RLS li invocano.
-- ----------------------------------------------------------------------------

create or replace function app_private.e_titolare()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.ruolo = 'titolare' and p.attivo
  );
$$;

create or replace function app_private.e_attivo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.attivo
  );
$$;

grant usage on schema app_private to authenticated;
grant execute on function app_private.e_titolare() to authenticated;
grant execute on function app_private.e_attivo() to authenticated;

-- Il primo utente che si registra diventa Titolare: senza questo nessuno
-- potrebbe creare il catalogo né promuovere gli altri.
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primo boolean;
begin
  select not exists (select 1 from public.profiles) into v_primo;

  insert into public.profiles (id, nome, email, ruolo)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when v_primo then 'titolare' else 'cassiere' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

create or replace function app_private.tocca_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function app_private.tocca_updated_at();

-- ============================================================================
-- Catalogo
-- ============================================================================

create table public.categorie (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.prodotti (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid references public.categorie (id) on delete set null,
  prezzo numeric(10, 2) not null check (prezzo >= 0),
  -- L'interruttore di disponibilità sostituisce la giacenza (ADR 0001).
  disponibile boolean not null default true,
  ordine integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.prodotti.disponibile is
  'Non vendibile oggi (finito, fuori stagione). Non è una cancellazione: il prodotto resta nei report storici.';

create index prodotti_categoria_idx on public.prodotti (categoria_id);
create index prodotti_disponibile_idx on public.prodotti (disponibile) where disponibile;

create trigger prodotti_updated_at
  before update on public.prodotti
  for each row execute function app_private.tocca_updated_at();

-- ============================================================================
-- Chiusure
-- ============================================================================

create table public.chiusure (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  chiusa_at timestamptz not null default now(),
  chiusa_da uuid not null references public.profiles (id),
  totale_contanti numeric(10, 2) not null default 0,
  totale_pos numeric(10, 2) not null default 0,
  totale_sconti numeric(10, 2) not null default 0,
  totale numeric(10, 2) not null default 0,
  numero_vendite integer not null default 0,
  numero_annullate integer not null default 0,
  note text
);

comment on table public.chiusure is
  'Riepilogo di ciò che è passato dall''app in un periodo. Non è una quadratura di cassa: non esistono fondo cassa, contato o differenza.';

-- ============================================================================
-- Vendite
-- ============================================================================

create table public.vendite (
  id uuid primary key default gen_random_uuid(),
  -- Progressivo dentro la sessione di cassa aperta; riparte da 1 a ogni
  -- Chiusura, non a mezzanotte (ADR 0002).
  numero integer not null,
  stato text not null default 'da_pagare' check (stato in ('da_pagare', 'pagata', 'annullata')),
  -- null = sessione di cassa ancora aperta. Non serve una tabella "sessione".
  chiusura_id uuid references public.chiusure (id) on delete restrict,

  metodo_pagamento text check (metodo_pagamento in ('contanti', 'pos')),
  totale_righe numeric(10, 2) not null default 0,
  sconto numeric(10, 2) not null default 0 check (sconto >= 0),
  sconto_motivo text,
  totale numeric(10, 2) not null default 0,
  contante_ricevuto numeric(10, 2),
  resto numeric(10, 2),

  battuta_da uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  incassata_da uuid references public.profiles (id),
  incassata_at timestamptz,
  annullata_da uuid references public.profiles (id),
  annullata_at timestamptz,
  annullamento_motivo text,

  -- Idempotenza sui retry di rete: un secondo invio con lo stesso id non crea
  -- una seconda vendita.
  request_id uuid unique,
  note text,

  constraint vendite_stato_coerente check (
    (stato = 'da_pagare'
      and metodo_pagamento is null and incassata_at is null and annullata_at is null)
    or (stato = 'pagata'
      and metodo_pagamento is not null and incassata_at is not null and annullata_at is null)
    or (stato = 'annullata'
      and annullata_at is not null and annullamento_motivo is not null
      and metodo_pagamento is null and incassata_at is null)
  ),
  constraint vendite_sconto_motivato check (sconto = 0 or nullif(btrim(sconto_motivo), '') is not null),
  constraint vendite_sconto_non_supera_righe check (sconto <= totale_righe)
);

-- Il Numero è unico dentro la sessione: `nulls not distinct` fa sì che le
-- vendite ancora aperte (chiusura_id null) si contendano lo stesso spazio di
-- numerazione, e che dopo la Chiusura si riparta da 1 senza collisioni.
create unique index vendite_numero_sessione_uidx
  on public.vendite (chiusura_id, numero) nulls not distinct;

create index vendite_sessione_aperta_idx on public.vendite (numero) where chiusura_id is null;
create index vendite_created_at_idx on public.vendite (created_at desc);
create index vendite_stato_idx on public.vendite (stato);
create index vendite_battuta_da_idx on public.vendite (battuta_da);

create table public.righe_vendita (
  id uuid primary key default gen_random_uuid(),
  vendita_id uuid not null references public.vendite (id) on delete cascade,
  -- Il prodotto può sparire dal catalogo: nome e prezzo qui sono congelati.
  prodotto_id uuid references public.prodotti (id) on delete set null,
  nome_prodotto text not null,
  prezzo_unitario numeric(10, 2) not null,
  quantita numeric(10, 2) not null check (quantita > 0),
  totale_riga numeric(10, 2) not null
);

create index righe_vendita_vendita_idx on public.righe_vendita (vendita_id);
create index righe_vendita_prodotto_idx on public.righe_vendita (prodotto_id);

-- ============================================================================
-- Coda di stampa
--
-- Colonne in inglese di proposito: questa tabella non è dominio, è la coda
-- consumata dal demone `apps/print-server`, che resta scritto sul contratto
-- originale (status / attempts / error / printed_at).
-- ============================================================================

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  vendita_id uuid not null references public.vendite (id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'printing', 'printed', 'error')),
  attempts integer not null default 0,
  error text,
  printed_at timestamptz,
  created_at timestamptz not null default now()
);

create index print_jobs_status_idx on public.print_jobs (status, created_at);
create index print_jobs_vendita_idx on public.print_jobs (vendita_id, created_at desc);

-- ============================================================================
-- Payload di stampa
-- ============================================================================

create or replace function app_private.payload_stampa(p_vendita_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', v.numero,
    'created_at', v.created_at,
    'cassiere', p.nome,
    'stato', v.stato,
    'metodo_pagamento', v.metodo_pagamento,
    'totale', v.totale,
    'note', v.note,
    'righe', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'nome_prodotto', rv.nome_prodotto,
                'quantita', rv.quantita,
                'prezzo_unitario', rv.prezzo_unitario,
                'totale_riga', rv.totale_riga
              ) order by rv.nome_prodotto)
       from public.righe_vendita rv where rv.vendita_id = v.id),
      '[]'::jsonb)
  )
  from public.vendite v
  join public.profiles p on p.id = v.battuta_da
  where v.id = p_vendita_id;
$$;

create or replace function app_private.accoda_stampa(p_vendita_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  insert into public.print_jobs (vendita_id, payload)
  values (p_vendita_id, app_private.payload_stampa(p_vendita_id))
  returning id into v_job_id;
  return v_job_id;
end;
$$;

-- ============================================================================
-- RPC — l'unica via di scrittura
-- ============================================================================

-- Batte una Vendita. Nasce `da_pagare`; se p_metodo_pagamento è valorizzato
-- (caso "paga subito") nasce già `pagata`.
--
-- Ritorna {id, numero}: il Numero serve subito a schermo, perché è l'unico
-- aggancio fra il cliente e la sua Vendita (ADR 0002).
create or replace function public.crea_vendita(
  p_righe jsonb,
  p_request_id uuid default null,
  p_note text default null,
  p_metodo_pagamento text default null,
  p_contante_ricevuto numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := auth.uid();
  v_vendita_id uuid;
  v_numero integer;
  v_riga jsonb;
  v_prodotto record;
  v_qta numeric;
  v_totale numeric(10, 2) := 0;
  v_resto numeric(10, 2);
begin
  if v_utente is null then
    raise exception 'Non autenticato';
  end if;
  if not app_private.e_attivo() then
    raise exception 'Utente non attivo';
  end if;
  if p_righe is null or jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 then
    raise exception 'La vendita non ha righe';
  end if;
  if p_metodo_pagamento is not null and p_metodo_pagamento not in ('contanti', 'pos') then
    raise exception 'Metodo di pagamento non valido';
  end if;

  -- Idempotenza: un retry con lo stesso request_id restituisce la vendita già creata.
  if p_request_id is not null then
    select id, numero into v_vendita_id, v_numero
      from public.vendite where request_id = p_request_id;
    if v_vendita_id is not null then
      return jsonb_build_object('id', v_vendita_id, 'numero', v_numero);
    end if;
  end if;

  -- Serializza l'assegnazione del Numero fra cassieri concorrenti. Il lock si
  -- rilascia a fine transazione.
  perform pg_advisory_xact_lock(4711001);

  select coalesce(max(numero), 0) + 1 into v_numero
  from public.vendite
  where chiusura_id is null;

  insert into public.vendite (numero, battuta_da, request_id, note)
  values (v_numero, v_utente, p_request_id, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_vendita_id;

  for v_riga in select * from jsonb_array_elements(p_righe)
  loop
    v_qta := (v_riga ->> 'quantita')::numeric;
    if v_qta is null or v_qta <= 0 then
      raise exception 'Quantità non valida';
    end if;

    -- Il prezzo viene sempre dal catalogo, mai da ciò che manda il client.
    select id, nome, prezzo, disponibile
      into v_prodotto
      from public.prodotti
     where id = (v_riga ->> 'prodotto_id')::uuid;

    if not found then
      raise exception 'Prodotto inesistente';
    end if;
    if not v_prodotto.disponibile then
      raise exception 'Prodotto non disponibile: %', v_prodotto.nome;
    end if;

    insert into public.righe_vendita
      (vendita_id, prodotto_id, nome_prodotto, prezzo_unitario, quantita, totale_riga)
    values
      (v_vendita_id, v_prodotto.id, v_prodotto.nome, v_prodotto.prezzo, v_qta,
       round(v_prodotto.prezzo * v_qta, 2));

    v_totale := v_totale + round(v_prodotto.prezzo * v_qta, 2);
  end loop;

  update public.vendite
     set totale_righe = v_totale,
         totale = v_totale
   where id = v_vendita_id;

  if p_metodo_pagamento is not null then
    if p_metodo_pagamento = 'contanti' and p_contante_ricevuto is not null then
      if p_contante_ricevuto < v_totale then
        raise exception 'Il contante ricevuto non copre il totale';
      end if;
      v_resto := round(p_contante_ricevuto - v_totale, 2);
    end if;

    update public.vendite
       set stato = 'pagata',
           metodo_pagamento = p_metodo_pagamento,
           contante_ricevuto = case when p_metodo_pagamento = 'contanti' then p_contante_ricevuto end,
           resto = v_resto,
           incassata_da = v_utente,
           incassata_at = now()
     where id = v_vendita_id;
  end if;

  perform app_private.accoda_stampa(v_vendita_id);

  return jsonb_build_object('id', v_vendita_id, 'numero', v_numero);
end;
$$;

-- Incassa una Vendita `da_pagare`. Solo chi l'ha battuta, oppure il Titolare
-- (ADR 0003). Lo sconto è prerogativa del solo Titolare e richiede una causale.
create or replace function public.incassa_vendita(
  p_vendita_id uuid,
  p_metodo text,
  p_contante_ricevuto numeric default null,
  p_sconto numeric default 0,
  p_sconto_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := auth.uid();
  v_titolare boolean := app_private.e_titolare();
  v_vendita record;
  v_sconto numeric(10, 2) := coalesce(p_sconto, 0);
  v_totale numeric(10, 2);
  v_resto numeric(10, 2);
begin
  if v_utente is null then
    raise exception 'Non autenticato';
  end if;
  if not app_private.e_attivo() then
    raise exception 'Utente non attivo';
  end if;
  if p_metodo not in ('contanti', 'pos') then
    raise exception 'Metodo di pagamento non valido';
  end if;

  select * into v_vendita from public.vendite where id = p_vendita_id for update;
  if not found then
    raise exception 'Vendita inesistente';
  end if;
  if v_vendita.stato <> 'da_pagare' then
    raise exception 'La vendita numero % non è da pagare (stato: %)', v_vendita.numero, v_vendita.stato;
  end if;
  if not v_titolare and v_vendita.battuta_da <> v_utente then
    raise exception 'Puoi incassare solo le vendite che hai battuto tu';
  end if;

  if v_sconto > 0 then
    if not v_titolare then
      raise exception 'Solo il titolare può applicare uno sconto';
    end if;
    if nullif(btrim(coalesce(p_sconto_motivo, '')), '') is null then
      raise exception 'Lo sconto richiede una causale';
    end if;
    if v_sconto > v_vendita.totale_righe then
      raise exception 'Lo sconto non può superare il totale della vendita';
    end if;
  end if;

  v_totale := round(v_vendita.totale_righe - v_sconto, 2);

  if p_metodo = 'contanti' and p_contante_ricevuto is not null then
    if p_contante_ricevuto < v_totale then
      raise exception 'Il contante ricevuto non copre il totale';
    end if;
    v_resto := round(p_contante_ricevuto - v_totale, 2);
  end if;

  update public.vendite
     set stato = 'pagata',
         metodo_pagamento = p_metodo,
         sconto = v_sconto,
         sconto_motivo = case when v_sconto > 0 then btrim(p_sconto_motivo) end,
         totale = v_totale,
         contante_ricevuto = case when p_metodo = 'contanti' then p_contante_ricevuto end,
         resto = v_resto,
         incassata_da = v_utente,
         incassata_at = now()
   where id = p_vendita_id;

  return p_vendita_id;
end;
$$;

-- Annulla una Vendita mai incassata. Solo il Titolare, con motivo obbligatorio.
-- La riga resta: non si cancella nulla.
create or replace function public.annulla_vendita(
  p_vendita_id uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := auth.uid();
  v_vendita record;
begin
  if not app_private.e_titolare() then
    raise exception 'Solo il titolare può annullare una vendita';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'L''annullamento richiede un motivo';
  end if;

  select * into v_vendita from public.vendite where id = p_vendita_id for update;
  if not found then
    raise exception 'Vendita inesistente';
  end if;
  if v_vendita.stato <> 'da_pagare' then
    raise exception 'Si possono annullare solo le vendite da pagare (numero %, stato: %)',
      v_vendita.numero, v_vendita.stato;
  end if;

  update public.vendite
     set stato = 'annullata',
         annullata_da = v_utente,
         annullata_at = now(),
         annullamento_motivo = btrim(p_motivo),
         totale = 0
   where id = p_vendita_id;

  return p_vendita_id;
end;
$$;

-- Chiude la sessione di cassa. Si rifiuta finché esistono vendite da pagare:
-- è questo che impedisce ai sospesi di accumularsi (ADR 0002).
create or replace function public.chiudi_cassa(p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := auth.uid();
  v_sospesi text;
  v_chiusura_id uuid;
  v_numero integer;
  v_totale_contanti numeric(10, 2);
  v_totale_pos numeric(10, 2);
  v_totale_sconti numeric(10, 2);
  v_numero_vendite integer;
  v_numero_annullate integer;
begin
  if not app_private.e_titolare() then
    raise exception 'Solo il titolare può chiudere la cassa';
  end if;

  perform pg_advisory_xact_lock(4711002);

  select string_agg(numero::text, ', ' order by numero)
    into v_sospesi
    from public.vendite
   where chiusura_id is null and stato = 'da_pagare';

  if v_sospesi is not null then
    raise exception 'Ci sono vendite ancora da pagare (numeri: %). Incassale o annullale prima di chiudere.', v_sospesi;
  end if;

  if not exists (select 1 from public.vendite where chiusura_id is null) then
    raise exception 'Non c''è nessuna vendita da chiudere';
  end if;

  select
    coalesce(sum(totale) filter (where stato = 'pagata' and metodo_pagamento = 'contanti'), 0),
    coalesce(sum(totale) filter (where stato = 'pagata' and metodo_pagamento = 'pos'), 0),
    coalesce(sum(sconto) filter (where stato = 'pagata'), 0),
    count(*) filter (where stato = 'pagata'),
    count(*) filter (where stato = 'annullata')
  into v_totale_contanti, v_totale_pos, v_totale_sconti, v_numero_vendite, v_numero_annullate
  from public.vendite
  where chiusura_id is null;

  select coalesce(max(numero), 0) + 1 into v_numero from public.chiusure;

  insert into public.chiusure (
    numero, chiusa_da, totale_contanti, totale_pos, totale_sconti, totale,
    numero_vendite, numero_annullate, note
  )
  values (
    v_numero, v_utente, v_totale_contanti, v_totale_pos, v_totale_sconti,
    v_totale_contanti + v_totale_pos,
    v_numero_vendite, v_numero_annullate,
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_chiusura_id;

  update public.vendite
     set chiusura_id = v_chiusura_id
   where chiusura_id is null;

  return v_chiusura_id;
end;
$$;

-- Riaccoda la stampa del Promemoria.
create or replace function public.ristampa_vendita(p_vendita_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := auth.uid();
  v_battuta_da uuid;
begin
  if not app_private.e_attivo() then
    raise exception 'Utente non attivo';
  end if;

  select battuta_da into v_battuta_da from public.vendite where id = p_vendita_id;
  if not found then
    raise exception 'Vendita inesistente';
  end if;
  if not app_private.e_titolare() and v_battuta_da <> v_utente then
    raise exception 'Puoi ristampare solo le vendite che hai battuto tu';
  end if;

  return app_private.accoda_stampa(p_vendita_id);
end;
$$;

-- ============================================================================
-- Viste
--
-- `security_invoker` è essenziale: senza, le viste girerebbero con i permessi
-- del proprietario e aggirerebbero le policy RLS sottostanti.
-- ============================================================================

create view public.v_vendite with (security_invoker = on) as
select
  v.*,
  pb.nome as battuta_da_nome,
  pinc.nome as incassata_da_nome,
  coalesce(r.righe, '[]'::jsonb) as righe,
  pj.status as stato_stampa,
  pj.id as print_job_id
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
left join lateral (
  select j.id, j.status
  from public.print_jobs j
  where j.vendita_id = v.id
  order by j.created_at desc
  limit 1
) pj on true;

-- Aggregato del venduto. Sostituisce il calcolo lato client dell'app originale,
-- che scaricava tutte le vendite a pagine da 1000 righe per sommarle in JS.
-- Cardinalità piccola (prodotti × giorni): il client somma sul periodo scelto.
-- Nota: `incasso` è la somma delle righe, al lordo dell'eventuale sconto, che è
-- applicato a livello di Vendita e non attribuibile a un singolo prodotto.
create view public.v_venduto_giornaliero with (security_invoker = on) as
select
  (v.created_at at time zone 'Europe/Rome')::date as giorno,
  rv.prodotto_id,
  rv.nome_prodotto,
  sum(rv.quantita)::numeric(12, 2) as quantita,
  sum(rv.totale_riga)::numeric(12, 2) as incasso
from public.vendite v
join public.righe_vendita rv on rv.vendita_id = v.id
where v.stato = 'pagata'
group by 1, 2, 3;

create view public.v_incassi_giornalieri with (security_invoker = on) as
select
  (v.created_at at time zone 'Europe/Rome')::date as giorno,
  extract(hour from v.created_at at time zone 'Europe/Rome')::int as ora,
  v.metodo_pagamento,
  count(*)::int as numero_vendite,
  sum(v.totale)::numeric(12, 2) as incasso
from public.vendite v
where v.stato = 'pagata'
group by 1, 2, 3;

create view public.v_riepilogo_cassiere with (security_invoker = on) as
select
  (v.created_at at time zone 'Europe/Rome')::date as giorno,
  v.battuta_da as profile_id,
  p.nome,
  count(*) filter (where v.stato <> 'annullata')::int as battute,
  count(*) filter (where v.stato = 'pagata')::int as pagate,
  count(*) filter (where v.stato = 'annullata')::int as annullate,
  coalesce(sum(v.totale) filter (where v.stato = 'pagata'), 0)::numeric(12, 2) as incasso
from public.vendite v
join public.profiles p on p.id = v.battuta_da
group by 1, 2, 3;

-- ============================================================================
-- RLS
--
-- Le tabelle di dominio sono in sola lettura: ogni scrittura passa dalle RPC.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.categorie enable row level security;
alter table public.prodotti enable row level security;
alter table public.vendite enable row level security;
alter table public.righe_vendita enable row level security;
alter table public.chiusure enable row level security;
alter table public.print_jobs enable row level security;

-- Profili: ognuno vede sé stesso; il Titolare vede e gestisce tutti.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app_private.e_titolare());
create policy profiles_update_titolare on public.profiles for update to authenticated
  using (app_private.e_titolare()) with check (app_private.e_titolare());

-- Catalogo: lo leggono tutti gli utenti attivi (serve a battere), lo scrive il Titolare.
create policy categorie_select on public.categorie for select to authenticated
  using (app_private.e_attivo());
create policy categorie_write on public.categorie for all to authenticated
  using (app_private.e_titolare()) with check (app_private.e_titolare());

create policy prodotti_select on public.prodotti for select to authenticated
  using (app_private.e_attivo());
create policy prodotti_write on public.prodotti for all to authenticated
  using (app_private.e_titolare()) with check (app_private.e_titolare());

-- Vendite: il Cassiere vede solo le proprie (ADR 0003). Nessuna scrittura diretta.
create policy vendite_select on public.vendite for select to authenticated
  using (app_private.e_titolare() or battuta_da = auth.uid());

create policy righe_vendita_select on public.righe_vendita for select to authenticated
  using (exists (
    select 1 from public.vendite v
    where v.id = righe_vendita.vendita_id
      and (app_private.e_titolare() or v.battuta_da = auth.uid())
  ));

create policy chiusure_select on public.chiusure for select to authenticated
  using (app_private.e_titolare());

create policy print_jobs_select on public.print_jobs for select to authenticated
  using (exists (
    select 1 from public.vendite v
    where v.id = print_jobs.vendita_id
      and (app_private.e_titolare() or v.battuta_da = auth.uid())
  ));

-- ============================================================================
-- Grant
-- ============================================================================

grant usage on schema public to authenticated;
grant select on public.profiles, public.categorie, public.prodotti,
  public.vendite, public.righe_vendita, public.chiusure, public.print_jobs to authenticated;
grant insert, update, delete on public.categorie, public.prodotti to authenticated;
grant update on public.profiles to authenticated;
grant select on public.v_vendite, public.v_venduto_giornaliero,
  public.v_incassi_giornalieri, public.v_riepilogo_cassiere to authenticated;

grant execute on function public.crea_vendita(jsonb, uuid, text, text, numeric) to authenticated;

grant execute on function public.incassa_vendita(uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.annulla_vendita(uuid, text) to authenticated;
grant execute on function public.chiudi_cassa(text) to authenticated;
grant execute on function public.ristampa_vendita(uuid) to authenticated;

-- ============================================================================
-- Realtime — la Plancia del Titolare e lo stato di stampa
-- ============================================================================

alter publication supabase_realtime add table public.vendite;
alter publication supabase_realtime add table public.print_jobs;
