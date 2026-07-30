-- Inventario opzionale
--
-- Il boilerplate conserva il caso bar senza magazzino, ma offre ai fork che ne
-- hanno bisogno un registro completo. L'attivazione dell'interfaccia è statica
-- in `lib/attivita.ts`; nel database decide `prodotti.traccia_giacenza`.

alter table public.prodotti
  add column traccia_giacenza boolean not null default false,
  add column unita text not null default 'pz',
  add column sku text,
  add column prezzo_acquisto numeric(10, 2) not null default 0 check (prezzo_acquisto >= 0),
  add column scorta_minima numeric(10, 2) not null default 0 check (scorta_minima >= 0);

create unique index prodotti_sku_uidx
  on public.prodotti (lower(sku)) where nullif(btrim(sku), '') is not null;

create table public.movimenti (
  id uuid primary key default gen_random_uuid(),
  prodotto_id uuid not null references public.prodotti (id) on delete restrict,
  tipo text not null check (tipo in ('carico', 'scarico', 'vendita', 'annullo', 'rettifica')),
  quantita numeric(10, 2) not null check (quantita <> 0),
  prezzo_unitario numeric(10, 2) check (prezzo_unitario is null or prezzo_unitario >= 0),
  vendita_id uuid references public.vendite (id) on delete set null,
  motivo text,
  creato_da uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint movimenti_origine_coerente check (
    (tipo in ('vendita', 'annullo') and vendita_id is not null)
    or
    (tipo in ('carico', 'scarico', 'rettifica') and nullif(btrim(motivo), '') is not null)
  )
);

create index movimenti_prodotto_data_idx on public.movimenti (prodotto_id, created_at desc);
create index movimenti_vendita_idx on public.movimenti (vendita_id);

create view public.v_inventario with (security_invoker = on) as
select
  p.id as prodotto_id,
  p.nome,
  p.categoria_id,
  c.nome as categoria_nome,
  p.prezzo,
  p.prezzo_acquisto,
  p.unita,
  p.sku,
  p.scorta_minima,
  p.disponibile,
  p.traccia_giacenza,
  coalesce(sum(m.quantita), 0)::numeric(12, 2) as saldo,
  (coalesce(sum(m.quantita), 0) <= p.scorta_minima) as sotto_scorta,
  (coalesce(sum(m.quantita), 0) * p.prezzo_acquisto)::numeric(14, 2) as valore_costo,
  (coalesce(sum(m.quantita), 0) * p.prezzo)::numeric(14, 2) as valore_vendita,
  max(m.created_at) as ultimo_movimento
from public.prodotti p
left join public.categorie c on c.id = p.categoria_id
left join public.movimenti m on m.prodotto_id = p.id
where p.traccia_giacenza
group by p.id, c.nome;

create or replace function app_private.movimento_da_riga()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autore uuid;
begin
  if new.prodotto_id is null or not exists (
    select 1 from public.prodotti
    where id = new.prodotto_id and traccia_giacenza
  ) then
    return new;
  end if;

  select battuta_da into v_autore
  from public.vendite where id = new.vendita_id;

  insert into public.movimenti
    (prodotto_id, tipo, quantita, prezzo_unitario, vendita_id, creato_da)
  values
    (new.prodotto_id, 'vendita', -new.quantita, new.prezzo_unitario, new.vendita_id, v_autore);
  return new;
end;
$$;

create trigger righe_vendita_movimento
  after insert on public.righe_vendita
  for each row execute function app_private.movimento_da_riga();

create or replace function app_private.reintegra_vendita_annullata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stato = 'annullata' and old.stato <> 'annullata' then
    insert into public.movimenti
      (prodotto_id, tipo, quantita, prezzo_unitario, vendita_id, creato_da)
    select
      rv.prodotto_id,
      'annullo',
      sum(rv.quantita),
      rv.prezzo_unitario,
      new.id,
      coalesce(new.annullata_da, new.battuta_da)
    from public.righe_vendita rv
    join public.prodotti p on p.id = rv.prodotto_id and p.traccia_giacenza
    where rv.vendita_id = new.id
    group by rv.prodotto_id, rv.prezzo_unitario;
  end if;
  return new;
end;
$$;

create trigger vendite_reintegro_inventario
  after update of stato on public.vendite
  for each row execute function app_private.reintegra_vendita_annullata();

create or replace function public.registra_movimento(
  p_prodotto_id uuid,
  p_tipo text,
  p_quantita numeric,
  p_prezzo_unitario numeric,
  p_motivo text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo numeric(12, 2);
  v_delta numeric(12, 2);
begin
  if not app_private.e_titolare() then
    raise exception 'Solo il titolare può registrare movimenti';
  end if;
  if p_tipo not in ('carico', 'scarico', 'rettifica') then
    raise exception 'Tipo di movimento non valido';
  end if;
  if p_quantita is null or p_quantita < 0 then
    raise exception 'La quantità non può essere negativa';
  end if;
  if p_tipo in ('carico', 'scarico') and p_quantita = 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Il motivo è obbligatorio';
  end if;
  if not exists (
    select 1 from public.prodotti
    where id = p_prodotto_id and traccia_giacenza
  ) then
    raise exception 'Prodotto inesistente o senza tracciamento';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_prodotto_id::text, 0));
  select coalesce(sum(quantita), 0) into v_saldo
  from public.movimenti where prodotto_id = p_prodotto_id;

  v_delta := case p_tipo
    when 'carico' then p_quantita
    when 'scarico' then -p_quantita
    else round(p_quantita - v_saldo, 2)
  end;

  if p_tipo = 'scarico' and p_quantita > v_saldo then
    raise exception 'Giacenza insufficiente per lo scarico';
  end if;
  if v_delta = 0 then return 0; end if;

  insert into public.movimenti
    (prodotto_id, tipo, quantita, prezzo_unitario, motivo, creato_da)
  values
    (p_prodotto_id, p_tipo, v_delta, p_prezzo_unitario, btrim(p_motivo), auth.uid());
  return v_delta;
end;
$$;

alter table public.movimenti enable row level security;
create policy movimenti_select on public.movimenti for select to authenticated
  using (app_private.e_titolare());

grant select on public.movimenti, public.v_inventario to authenticated;
revoke all on function public.registra_movimento(uuid, text, numeric, numeric, text) from public;
grant execute on function public.registra_movimento(uuid, text, numeric, numeric, text)
  to authenticated;
revoke insert, update, delete, truncate on public.movimenti from anon, authenticated;
