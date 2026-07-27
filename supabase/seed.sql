-- Dati di sviluppo. Girano solo in locale (`supabase db reset`): non finiscono
-- mai in produzione.

-- ── Utenti ───────────────────────────────────────────────────────────────────
-- I profili nascono dal trigger on_auth_user_created; il primo diventa Titolare.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'titolare@roxy.local',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Anna Titolare"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'cassiere@roxy.local',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Bruno Cassiere"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'cassiere2@roxy.local',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Carla Cassiera"}'::jsonb
  );

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
from auth.users u;

-- ── Catalogo ─────────────────────────────────────────────────────────────────

insert into public.categorie (id, nome, ordine) values
  ('aaaaaaa1-0000-4000-8000-000000000001', 'Birre',       10),
  ('aaaaaaa1-0000-4000-8000-000000000002', 'Cocktail',    20),
  ('aaaaaaa1-0000-4000-8000-000000000003', 'Bibite',      30),
  ('aaaaaaa1-0000-4000-8000-000000000004', 'Caffetteria', 40),
  ('aaaaaaa1-0000-4000-8000-000000000005', 'Cibo',        50);

insert into public.prodotti (nome, categoria_id, prezzo, ordine, disponibile) values
  ('Birra media',        'aaaaaaa1-0000-4000-8000-000000000001', 4.00, 10, true),
  ('Birra piccola',      'aaaaaaa1-0000-4000-8000-000000000001', 3.00, 20, true),
  ('Birra bottiglia',    'aaaaaaa1-0000-4000-8000-000000000001', 4.50, 30, true),
  ('Spritz',             'aaaaaaa1-0000-4000-8000-000000000002', 5.00, 10, true),
  ('Negroni',            'aaaaaaa1-0000-4000-8000-000000000002', 7.00, 20, true),
  ('Gin tonic',          'aaaaaaa1-0000-4000-8000-000000000002', 7.00, 30, true),
  ('Mojito',             'aaaaaaa1-0000-4000-8000-000000000002', 7.00, 40, false),
  ('Acqua naturale',     'aaaaaaa1-0000-4000-8000-000000000003', 1.50, 10, true),
  ('Coca cola',          'aaaaaaa1-0000-4000-8000-000000000003', 3.00, 20, true),
  ('Caffè',              'aaaaaaa1-0000-4000-8000-000000000004', 1.20, 10, true),
  ('Cappuccino',         'aaaaaaa1-0000-4000-8000-000000000004', 1.60, 20, true),
  ('Panino',             'aaaaaaa1-0000-4000-8000-000000000005', 5.00, 10, true),
  ('Tagliere',           'aaaaaaa1-0000-4000-8000-000000000005', 12.00, 20, true);
