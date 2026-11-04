-- Néstor Premium · estat compartit del joc a Supabase
-- Enganxa-ho tot a SQL Editor i prem Run. Abans, canvia 'XXXX' pel PIN dels organitzadors.
-- Es pot tornar a executar sense perdre res (només actualitza el PIN i les funcions).

create table if not exists public.np_game (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- El PIN viu en una taula que ningú pot llegir des de l'app
create table if not exists public.np_secret (
  id int primary key default 1,
  pin text not null
);

alter table public.np_game enable row level security;
alter table public.np_secret enable row level security;

-- Tothom pot llegir l'estat; ningú hi pot escriure directament, només amb les funcions de sota
drop policy if exists np_game_read on public.np_game;
create policy np_game_read on public.np_game for select to anon, authenticated using (true);

insert into public.np_secret (id, pin) values (1, 'XXXX')
  on conflict (id) do update set pin = excluded.pin;
insert into public.np_game (id, state) values ('nestor', '{}') on conflict (id) do nothing;

-- Avançar la ruta (parada, pas, opció triada...). Les quotes pagades no es poden tocar d'aquí.
create or replace function public.np_progress(patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update np_game
     set state = state || (patch - 'paid' - 'tools'), updated_at = now()
   where id = 'nestor';
end $$;

-- Desar l'estat d'una eina (marcadors, cartes, rosco...)
create or replace function public.np_tool(n text, value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update np_game
     set state = jsonb_set(state || jsonb_build_object('tools', coalesce(state->'tools', '{}'::jsonb)),
                           array['tools', n], value),
         updated_at = now()
   where id = 'nestor';
end $$;

create or replace function public.np_check_pin(pin text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from np_secret where np_secret.pin = np_check_pin.pin);
$$;

-- Veredicte d'una prova: només amb el PIN dels organitzadors
create or replace function public.np_verdict(pin text, n int, ok boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not np_check_pin(pin) then return false; end if;
  if ok then
    update np_game
       set state = jsonb_set(state || jsonb_build_object('paid', coalesce(state->'paid', '{}'::jsonb)),
                             array['paid', n::text],
                             coalesce(state->'paid'->n::text,
                                      jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint)))
                   || '{"stage": "paid"}'::jsonb,
           updated_at = now()
     where id = 'nestor';
  else
    update np_game set state = state || '{"stage": "rejected"}'::jsonb, updated_at = now() where id = 'nestor';
  end if;
  return true;
end $$;

-- Reiniciar el joc: només amb el PIN
create or replace function public.np_reset(pin text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not np_check_pin(pin) then return false; end if;
  update np_game set state = '{}'::jsonb, updated_at = now() where id = 'nestor';
  return true;
end $$;

grant execute on function public.np_progress(jsonb), public.np_tool(text, jsonb),
  public.np_check_pin(text), public.np_verdict(text, int, boolean), public.np_reset(text) to anon, authenticated;

-- Canvis en directe a tots els mòbils
do $$
begin
  alter publication supabase_realtime add table public.np_game;
exception when duplicate_object then null;
end $$;
