-- ============================================================================
-- Correzioni di integrità, concorrenza e sicurezza
-- ============================================================================

alter table public.print_jobs
  add column if not exists claimed_at timestamptz,
  add column if not exists worker_id uuid;

update public.print_jobs
   set status = 'pending', claimed_at = null, worker_id = null
 where status = 'printing';

alter table public.print_jobs
  drop constraint if exists print_jobs_lease_coerente;
alter table public.print_jobs
  add constraint print_jobs_lease_coerente check (
    (status = 'printing' and claimed_at is not null and worker_id is not null)
    or
    (status <> 'printing' and claimed_at is null and worker_id is null)
  );

create index if not exists print_jobs_lease_idx
  on public.print_jobs (claimed_at)
  where status = 'printing';

-- ============================================================================
-- Implementazioni privilegiate, fuori dallo schema esposto
-- ============================================================================

create or replace function app_private.crea_vendita(
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
  v_battuta_da uuid;
  v_numero integer;
  v_riga jsonb;
  v_prodotto record;
  v_qta numeric;
  v_totale_riga numeric(10, 2);
  v_totale numeric(10, 2) := 0;
  v_resto numeric(10, 2);
begin
  if v_utente is null then
    raise exception 'Non autenticato';
  end if;
  if not app_private.e_attivo() then
    raise exception 'Utente non attivo';
  end if;

  -- Coordina Numero, retry, incasso, annullamento e Chiusura.
  perform pg_advisory_xact_lock(4711001);

  if p_request_id is not null then
    select id, numero, battuta_da
      into v_vendita_id, v_numero, v_battuta_da
      from public.vendite
     where request_id = p_request_id;

    if v_vendita_id is not null then
      if v_battuta_da <> v_utente then
        raise exception 'Request ID già usato da un altro utente';
      end if;
      return jsonb_build_object('id', v_vendita_id, 'numero', v_numero);
    end if;
  end if;

  if p_righe is null
     or jsonb_typeof(p_righe) <> 'array'
     or jsonb_array_length(p_righe) = 0 then
    raise exception 'La vendita non ha righe';
  end if;
  if p_metodo_pagamento is not null
     and p_metodo_pagamento not in ('contanti', 'pos') then
    raise exception 'Metodo di pagamento non valido';
  end if;

  select coalesce(max(numero), 0) + 1
    into v_numero
    from public.vendite
   where chiusura_id is null;

  insert into public.vendite (numero, battuta_da, request_id, note)
  values (
    v_numero, v_utente, p_request_id,
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_vendita_id;

  for v_riga in
    select value from jsonb_array_elements(p_righe)
  loop
    v_qta := (v_riga ->> 'quantita')::numeric;
    if v_qta is null or v_qta <= 0 then
      raise exception 'Quantità non valida';
    end if;

    select id, nome, prezzo, disponibile
      into v_prodotto
      from public.prodotti
     where id = (v_riga ->> 'prodotto_id')::uuid
       for share;

    if not found then
      raise exception 'Prodotto inesistente';
    end if;
    if not v_prodotto.disponibile then
      raise exception 'Prodotto non disponibile: %', v_prodotto.nome;
    end if;

    v_totale_riga := round(v_prodotto.prezzo * v_qta, 2);

    insert into public.righe_vendita (
      vendita_id, prodotto_id, nome_prodotto, prezzo_unitario, quantita,
      totale_riga
    )
    values (
      v_vendita_id, v_prodotto.id, v_prodotto.nome, v_prodotto.prezzo,
      v_qta, v_totale_riga
    );

    v_totale := v_totale + v_totale_riga;
  end loop;

  update public.vendite
     set totale_righe = v_totale,
         totale = v_totale
   where id = v_vendita_id;

  if p_metodo_pagamento is not null then
    if p_metodo_pagamento = 'contanti'
       and p_contante_ricevuto is not null then
      if p_contante_ricevuto < v_totale then
        raise exception 'Il contante ricevuto non copre il totale';
      end if;
      v_resto := round(p_contante_ricevuto - v_totale, 2);
    end if;

    update public.vendite
       set stato = 'pagata',
           metodo_pagamento = p_metodo_pagamento,
           contante_ricevuto =
             case when p_metodo_pagamento = 'contanti'
                  then p_contante_ricevuto end,
           resto = v_resto,
           incassata_da = v_utente,
           incassata_at = now()
     where id = v_vendita_id;
  end if;

  perform app_private.accoda_stampa(v_vendita_id);
  return jsonb_build_object('id', v_vendita_id, 'numero', v_numero);
end;
$$;

create or replace function app_private.incassa_vendita(
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
  if v_sconto < 0 then
    raise exception 'Lo sconto non può essere negativo';
  end if;

  perform pg_advisory_xact_lock(4711001);

  select *
    into v_vendita
    from public.vendite
   where id = p_vendita_id
     for update;

  if not found then
    raise exception 'Vendita inesistente';
  end if;
  if v_vendita.stato <> 'da_pagare' then
    raise exception 'La vendita numero % non è da pagare (stato: %)',
      v_vendita.numero, v_vendita.stato;
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
         sconto_motivo =
           case when v_sconto > 0 then btrim(p_sconto_motivo) end,
         totale = v_totale,
         contante_ricevuto =
           case when p_metodo = 'contanti' then p_contante_ricevuto end,
         resto = v_resto,
         incassata_da = v_utente,
         incassata_at = now()
   where id = p_vendita_id;

  return p_vendita_id;
end;
$$;

create or replace function app_private.annulla_vendita(
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

  perform pg_advisory_xact_lock(4711001);

  select *
    into v_vendita
    from public.vendite
   where id = p_vendita_id
     for update;

  if not found then
    raise exception 'Vendita inesistente';
  end if;
  if v_vendita.stato <> 'da_pagare' then
    raise exception
      'Si possono annullare solo le vendite da pagare (numero %, stato: %)',
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

create or replace function app_private.chiudi_cassa(
  p_note text default null
)
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

  perform pg_advisory_xact_lock(4711001);

  select string_agg(numero::text, ', ' order by numero)
    into v_sospesi
    from public.vendite
   where chiusura_id is null
     and stato = 'da_pagare';

  if v_sospesi is not null then
    raise exception
      'Ci sono vendite ancora da pagare (numeri: %). Incassale o annullale prima di chiudere.',
      v_sospesi;
  end if;

  if not exists (
    select 1 from public.vendite where chiusura_id is null
  ) then
    raise exception 'Non c''è nessuna vendita da chiudere';
  end if;

  select
    coalesce(sum(totale) filter (
      where stato = 'pagata' and metodo_pagamento = 'contanti'
    ), 0),
    coalesce(sum(totale) filter (
      where stato = 'pagata' and metodo_pagamento = 'pos'
    ), 0),
    coalesce(sum(sconto) filter (where stato = 'pagata'), 0),
    count(*) filter (where stato = 'pagata'),
    count(*) filter (where stato = 'annullata')
  into
    v_totale_contanti, v_totale_pos, v_totale_sconti,
    v_numero_vendite, v_numero_annullate
  from public.vendite
  where chiusura_id is null;

  select coalesce(max(numero), 0) + 1
    into v_numero
    from public.chiusure;

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

create or replace function app_private.ristampa_vendita(
  p_vendita_id uuid
)
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

  select battuta_da
    into v_battuta_da
    from public.vendite
   where id = p_vendita_id;

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
-- Coda di stampa con claim atomico
-- ============================================================================

create or replace function app_private.prendi_job_stampa(
  p_worker_id uuid
)
returns setof public.print_jobs
language sql
security definer
set search_path = ''
as $$
  with candidato as (
    select id
      from public.print_jobs
     where status = 'pending'
     order by created_at
     limit 1
       for update skip locked
  ),
  preso as (
    update public.print_jobs j
       set status = 'printing',
           claimed_at = now(),
           worker_id = p_worker_id,
           attempts = attempts + 1
      from candidato c
     where j.id = c.id
    returning j.*
  )
  select * from preso;
$$;

create or replace function app_private.recupera_job_stampa(
  p_max_tentativi integer default 3,
  p_lease_secondi integer default 120
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quanti integer;
begin
  if p_max_tentativi < 1 then
    raise exception 'MAX_ATTEMPTS deve essere almeno 1';
  end if;
  if p_lease_secondi < 30 then
    raise exception 'Il lease di stampa deve durare almeno 30 secondi';
  end if;

  update public.print_jobs
     set status =
           case when attempts >= p_max_tentativi then 'error' else 'pending' end,
         error = 'Lease di stampa scaduto: il worker non ha confermato il job',
         claimed_at = null,
         worker_id = null
   where status = 'printing'
     and claimed_at < now() - make_interval(secs => p_lease_secondi);

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

-- ============================================================================
-- Wrapper Data API, tutti SECURITY INVOKER
-- ============================================================================

create or replace function public.crea_vendita(
  p_righe jsonb,
  p_request_id uuid default null,
  p_note text default null,
  p_metodo_pagamento text default null,
  p_contante_ricevuto numeric default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.crea_vendita(
    p_righe, p_request_id, p_note, p_metodo_pagamento, p_contante_ricevuto
  );
$$;

create or replace function public.incassa_vendita(
  p_vendita_id uuid,
  p_metodo text,
  p_contante_ricevuto numeric default null,
  p_sconto numeric default 0,
  p_sconto_motivo text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.incassa_vendita(
    p_vendita_id, p_metodo, p_contante_ricevuto, p_sconto, p_sconto_motivo
  );
$$;

create or replace function public.annulla_vendita(
  p_vendita_id uuid,
  p_motivo text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.annulla_vendita(p_vendita_id, p_motivo);
$$;

create or replace function public.chiudi_cassa(
  p_note text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.chiudi_cassa(p_note);
$$;

create or replace function public.ristampa_vendita(
  p_vendita_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.ristampa_vendita(p_vendita_id);
$$;

create or replace function public.prendi_job_stampa(
  p_worker_id uuid
)
returns setof public.print_jobs
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.prendi_job_stampa(p_worker_id);
$$;

create or replace function public.recupera_job_stampa(
  p_max_tentativi integer default 3,
  p_lease_secondi integer default 120
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select app_private.recupera_job_stampa(
    p_max_tentativi, p_lease_secondi
  );
$$;

-- ============================================================================
-- RLS ottimizzata e senza policy SELECT sovrapposte
-- ============================================================================

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_titolare on public.profiles;
create policy profiles_select
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select app_private.e_titolare())
  );
create policy profiles_update_titolare
  on public.profiles for update to authenticated
  using ((select app_private.e_titolare()))
  with check ((select app_private.e_titolare()));

drop policy if exists categorie_select on public.categorie;
drop policy if exists categorie_write on public.categorie;
drop policy if exists categorie_insert_titolare on public.categorie;
drop policy if exists categorie_update_titolare on public.categorie;
drop policy if exists categorie_delete_titolare on public.categorie;
create policy categorie_select
  on public.categorie for select to authenticated
  using ((select app_private.e_attivo()));
create policy categorie_insert_titolare
  on public.categorie for insert to authenticated
  with check ((select app_private.e_titolare()));
create policy categorie_update_titolare
  on public.categorie for update to authenticated
  using ((select app_private.e_titolare()))
  with check ((select app_private.e_titolare()));
create policy categorie_delete_titolare
  on public.categorie for delete to authenticated
  using ((select app_private.e_titolare()));

drop policy if exists prodotti_select on public.prodotti;
drop policy if exists prodotti_write on public.prodotti;
drop policy if exists prodotti_insert_titolare on public.prodotti;
drop policy if exists prodotti_update_titolare on public.prodotti;
drop policy if exists prodotti_delete_titolare on public.prodotti;
create policy prodotti_select
  on public.prodotti for select to authenticated
  using ((select app_private.e_attivo()));
create policy prodotti_insert_titolare
  on public.prodotti for insert to authenticated
  with check ((select app_private.e_titolare()));
create policy prodotti_update_titolare
  on public.prodotti for update to authenticated
  using ((select app_private.e_titolare()))
  with check ((select app_private.e_titolare()));
create policy prodotti_delete_titolare
  on public.prodotti for delete to authenticated
  using ((select app_private.e_titolare()));

drop policy if exists vendite_select on public.vendite;
create policy vendite_select
  on public.vendite for select to authenticated
  using (
    (select app_private.e_titolare())
    or battuta_da = (select auth.uid())
  );

drop policy if exists righe_vendita_select on public.righe_vendita;
create policy righe_vendita_select
  on public.righe_vendita for select to authenticated
  using (exists (
    select 1
      from public.vendite v
     where v.id = righe_vendita.vendita_id
       and (
         (select app_private.e_titolare())
         or v.battuta_da = (select auth.uid())
       )
  ));

drop policy if exists chiusure_select on public.chiusure;
create policy chiusure_select
  on public.chiusure for select to authenticated
  using ((select app_private.e_titolare()));

drop policy if exists print_jobs_select on public.print_jobs;
create policy print_jobs_select
  on public.print_jobs for select to authenticated
  using (exists (
    select 1
      from public.vendite v
     where v.id = print_jobs.vendita_id
       and (
         (select app_private.e_titolare())
         or v.battuta_da = (select auth.uid())
       )
  ));

create index if not exists chiusure_chiusa_da_idx
  on public.chiusure (chiusa_da);
create index if not exists vendite_incassata_da_idx
  on public.vendite (incassata_da);
create index if not exists vendite_annullata_da_idx
  on public.vendite (annullata_da);

-- Difesa in profondità sui privilegi tabella.
revoke insert, update, delete, truncate on
  public.vendite, public.righe_vendita, public.chiusure, public.print_jobs
  from anon, authenticated;
revoke insert, update, delete, truncate on
  public.categorie, public.prodotti, public.profiles
  from anon;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke select on
  public.profiles, public.categorie, public.prodotti, public.vendite,
  public.righe_vendita, public.chiusure, public.print_jobs
  from anon;

-- ============================================================================
-- Privilegi minimi sulle funzioni
-- ============================================================================

revoke execute on all functions in schema app_private
  from public, anon, authenticated;
grant usage on schema app_private to service_role;
grant execute on function app_private.e_titolare() to authenticated;
grant execute on function app_private.e_attivo() to authenticated;

grant execute on function
  app_private.crea_vendita(jsonb, uuid, text, text, numeric),
  app_private.incassa_vendita(uuid, text, numeric, numeric, text),
  app_private.annulla_vendita(uuid, text),
  app_private.chiudi_cassa(text),
  app_private.ristampa_vendita(uuid)
to authenticated;

grant execute on function
  app_private.prendi_job_stampa(uuid),
  app_private.recupera_job_stampa(integer, integer)
to service_role;

revoke execute on function
  public.crea_vendita(jsonb, uuid, text, text, numeric),
  public.incassa_vendita(uuid, text, numeric, numeric, text),
  public.annulla_vendita(uuid, text),
  public.chiudi_cassa(text),
  public.ristampa_vendita(uuid),
  public.prendi_job_stampa(uuid),
  public.recupera_job_stampa(integer, integer)
from public, anon;

grant execute on function
  public.crea_vendita(jsonb, uuid, text, text, numeric),
  public.incassa_vendita(uuid, text, numeric, numeric, text),
  public.annulla_vendita(uuid, text),
  public.chiudi_cassa(text),
  public.ristampa_vendita(uuid)
to authenticated;

revoke execute on function
  public.prendi_job_stampa(uuid),
  public.recupera_job_stampa(integer, integer)
from authenticated;
grant execute on function
  public.prendi_job_stampa(uuid),
  public.recupera_job_stampa(integer, integer)
to service_role;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute
      'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
