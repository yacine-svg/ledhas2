-- =====================================================================
-- Ledhas · réservations + espace admin
-- À exécuter une seule fois dans Supabase : SQL Editor → New query → Run.
-- Le script peut être relancé sans danger (il ne supprime aucune donnée).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Administrateurs : seuls les comptes listés ici voient les réservations
-- ---------------------------------------------------------------------
create table if not exists public.ledhas_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default 'Admin',
  created_at timestamptz not null default now()
);

create or replace function public.is_ledhas_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ledhas_admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Réservations
-- ---------------------------------------------------------------------
create or replace function public.ledhas_new_ref()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  out_ref text;
begin
  loop
    out_ref := 'LDH-';
    for i in 1..6 loop
      out_ref := out_ref || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.reservations where ref = out_ref);
  end loop;
  return out_ref;
end;
$$;

create table if not exists public.reservations (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  status         text not null default 'nouvelle'
                 check (status in ('nouvelle', 'confirmee', 'arrivee', 'terminee', 'annulee')),
  source         text not null default 'site'
                 check (source in ('site', 'whatsapp', 'telephone', 'sur_place', 'autre')),
  lang           text not null default 'fr' check (lang in ('fr', 'en', 'ar')),
  name           text not null check (char_length(name) between 2 and 80),
  phone          text not null check (char_length(phone) between 6 and 25),
  email          text check (email is null or char_length(email) <= 120),
  arrival        date not null,
  departure      date not null,
  nights         int generated always as (departure - arrival) stored,
  adults         int not null default 2 check (adults between 1 and 40),
  children       int not null default 0 check (children between 0 and 20),
  room_type      text not null default 'double' check (room_type in ('double', 'triple', 'quadruple')),
  extra_mattress int not null default 0 check (extra_mattress between 0 and 2),
  board          text not null default 'pdj' check (board in ('pdj', 'demi', 'complete')),
  activity       text not null default 'aucune' check (activity in ('aucune', 'quad', 'evasion', 'team', 'soiree')),
  message        text check (message is null or char_length(message) <= 1000),
  -- champs réservés à l'admin
  room_label     text check (room_label is null or char_length(room_label) <= 40),
  price_total    numeric(12, 2) check (price_total is null or price_total >= 0),
  deposit        numeric(12, 2) check (deposit is null or deposit >= 0),
  admin_notes    text check (admin_notes is null or char_length(admin_notes) <= 4000),
  confirmed_at   timestamptz,
  cancelled_at   timestamptz,
  constraint reservations_dates_ok check (departure > arrival and departure - arrival <= 60)
);

alter table public.reservations alter column ref set default public.ledhas_new_ref();

create index if not exists reservations_arrival_idx on public.reservations (arrival);
create index if not exists reservations_status_idx on public.reservations (status);
create index if not exists reservations_created_idx on public.reservations (created_at desc);
create index if not exists reservations_phone_idx on public.reservations (phone);

-- Historique : création, changements de statut, modifications, contacts
create table if not exists public.reservation_events (
  id             bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  at             timestamptz not null default now(),
  actor          uuid references auth.users (id) on delete set null,
  actor_name     text,
  kind           text not null check (kind in ('created', 'status', 'edit', 'contact', 'note')),
  detail         jsonb not null default '{}'::jsonb
);
create index if not exists reservation_events_res_idx on public.reservation_events (reservation_id, at desc);

-- ---------------------------------------------------------------------
-- Journal automatique (côté serveur, impossible à contourner)
-- ---------------------------------------------------------------------
create or replace function public.ledhas_actor_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select name from public.ledhas_admins where user_id = auth.uid();
$$;

create or replace function public.reservations_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changes jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_events (reservation_id, actor, actor_name, kind, detail)
    values (new.id, auth.uid(), public.ledhas_actor_name(), 'created',
            jsonb_build_object('source', new.source, 'status', new.status));
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'confirmee' and new.confirmed_at is null then new.confirmed_at := now(); end if;
    if new.status = 'annulee' then new.cancelled_at := now(); end if;
    insert into public.reservation_events (reservation_id, actor, actor_name, kind, detail)
    values (new.id, auth.uid(), public.ledhas_actor_name(), 'status',
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb)
    into changes
    from jsonb_each(to_jsonb(new)) n
   where n.key not in ('updated_at', 'status', 'confirmed_at', 'cancelled_at', 'nights')
     and n.value is distinct from (to_jsonb(old) -> n.key);

  if changes <> '{}'::jsonb then
    insert into public.reservation_events (reservation_id, actor, actor_name, kind, detail)
    values (new.id, auth.uid(), public.ledhas_actor_name(), 'edit',
            jsonb_build_object('fields', (select jsonb_agg(t.k) from jsonb_object_keys(changes) as t(k))));
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reservations_audit_ins on public.reservations;
create trigger reservations_audit_ins after insert on public.reservations
  for each row execute function public.reservations_audit();

drop trigger if exists reservations_audit_upd on public.reservations;
create trigger reservations_audit_upd before update on public.reservations
  for each row execute function public.reservations_audit();

create or replace function public.reservation_events_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor is not null and new.actor_name is null then
    new.actor_name := public.ledhas_actor_name();
  end if;
  return new;
end;
$$;

drop trigger if exists reservation_events_actor on public.reservation_events;
create trigger reservation_events_actor before insert on public.reservation_events
  for each row execute function public.reservation_events_actor();

-- ---------------------------------------------------------------------
-- Sécurité (RLS) : le public ne peut RIEN lire ni modifier.
-- Il peut seulement envoyer une demande via submit_reservation().
-- ---------------------------------------------------------------------
alter table public.ledhas_admins      enable row level security;
alter table public.reservations       enable row level security;
alter table public.reservation_events enable row level security;

drop policy if exists "admin lit son profil" on public.ledhas_admins;
create policy "admin lit son profil" on public.ledhas_admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins lisent les réservations" on public.reservations;
create policy "admins lisent les réservations" on public.reservations
  for select to authenticated using (public.is_ledhas_admin());
drop policy if exists "admins ajoutent des réservations" on public.reservations;
create policy "admins ajoutent des réservations" on public.reservations
  for insert to authenticated with check (public.is_ledhas_admin());
drop policy if exists "admins modifient les réservations" on public.reservations;
create policy "admins modifient les réservations" on public.reservations
  for update to authenticated using (public.is_ledhas_admin()) with check (public.is_ledhas_admin());
drop policy if exists "admins suppriment les réservations" on public.reservations;
create policy "admins suppriment les réservations" on public.reservations
  for delete to authenticated using (public.is_ledhas_admin());

drop policy if exists "admins lisent l'historique" on public.reservation_events;
create policy "admins lisent l'historique" on public.reservation_events
  for select to authenticated using (public.is_ledhas_admin());
drop policy if exists "admins notent un contact" on public.reservation_events;
create policy "admins notent un contact" on public.reservation_events
  for insert to authenticated
  with check (public.is_ledhas_admin() and kind in ('contact', 'note') and actor = auth.uid());

revoke all on public.reservations, public.reservation_events, public.ledhas_admins from anon;
grant select, insert, update, delete on public.reservations to authenticated;
grant select, insert on public.reservation_events to authenticated;
grant select on public.ledhas_admins to authenticated;

-- ---------------------------------------------------------------------
-- Formulaire du site : seule porte d'entrée publique
-- ---------------------------------------------------------------------
create or replace function public.submit_reservation(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ref      text := upper(coalesce(p ->> 'ref', ''));
  v_name     text := btrim(coalesce(p ->> 'name', ''));
  v_phone    text := btrim(coalesce(p ->> 'phone', ''));
  v_email    text := nullif(lower(btrim(coalesce(p ->> 'email', ''))), '');
  v_arrival  date;
  v_depart   date;
  v_existing public.reservations;
begin
  begin
    v_arrival := (p ->> 'arrival')::date;
    v_depart  := (p ->> 'departure')::date;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'dates');
  end;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'name');
  end if;
  if v_phone !~ '^\+?[0-9 ().-]{6,25}$' or char_length(regexp_replace(v_phone, '\D', '', 'g')) < 6 then
    return jsonb_build_object('ok', false, 'error', 'phone');
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'email');
  end if;
  if v_arrival is null or v_depart is null or v_arrival < current_date - 1
     or v_depart <= v_arrival or v_depart - v_arrival > 60 or v_arrival > current_date + 730 then
    return jsonb_build_object('ok', false, 'error', 'dates');
  end if;

  -- Double clic / renvoi : même référence et même téléphone → on renvoie la demande existante
  if v_ref ~ '^LDH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$' then
    select * into v_existing from public.reservations where ref = v_ref;
    if found then
      if v_existing.phone = v_phone then
        return jsonb_build_object('ok', true, 'ref', v_existing.ref, 'duplicate', true);
      end if;
      v_ref := public.ledhas_new_ref();
    end if;
  else
    v_ref := public.ledhas_new_ref();
  end if;

  -- Anti-abus : 5 demandes par numéro et par heure, 120 au total par heure
  if (select count(*) from public.reservations
       where phone = v_phone and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.reservations
       where source = 'site' and created_at > now() - interval '1 hour') >= 120 then
    return jsonb_build_object('ok', false, 'error', 'rate');
  end if;

  insert into public.reservations (
    ref, source, lang, name, phone, email, arrival, departure, adults, children,
    room_type, extra_mattress, board, activity, message
  ) values (
    v_ref, 'site',
    case when p ->> 'lang' in ('fr', 'en', 'ar') then p ->> 'lang' else 'fr' end,
    v_name, v_phone, v_email, v_arrival, v_depart,
    least(greatest(coalesce((p ->> 'adults')::int, 1), 1), 40),
    least(greatest(coalesce((p ->> 'children')::int, 0), 0), 20),
    case when p ->> 'room_type' in ('double', 'triple', 'quadruple') then p ->> 'room_type' else 'double' end,
    least(greatest(coalesce((p ->> 'extra_mattress')::int, 0), 0), 2),
    case when p ->> 'board' in ('pdj', 'demi', 'complete') then p ->> 'board' else 'pdj' end,
    case when p ->> 'activity' in ('aucune', 'quad', 'evasion', 'team', 'soiree') then p ->> 'activity' else 'aucune' end,
    nullif(left(btrim(coalesce(p ->> 'message', '')), 1000), '')
  );

  return jsonb_build_object('ok', true, 'ref', v_ref);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'error', 'invalid');
end;
$$;

revoke all on function public.submit_reservation(jsonb) from public;
grant execute on function public.submit_reservation(jsonb) to anon, authenticated;
revoke all on function public.ledhas_new_ref() from public, anon;
grant execute on function public.ledhas_new_ref() to authenticated;
revoke all on function public.is_ledhas_admin() from public, anon;
grant execute on function public.is_ledhas_admin() to authenticated;
revoke all on function public.ledhas_actor_name() from public, anon;
grant execute on function public.ledhas_actor_name() to authenticated;
revoke all on function public.reservations_audit() from public, anon, authenticated;
revoke all on function public.reservation_events_actor() from public, anon, authenticated;

-- =====================================================================
-- APRÈS avoir créé le compte admin (Authentication → Users → Add user),
-- remplacez l'e-mail et le nom ci-dessous puis exécutez ces 3 lignes :
--
--   insert into public.ledhas_admins (user_id, name)
--   select id, 'Ledhas' from auth.users where email = 'contact@exemple.com'
--   on conflict (user_id) do update set name = excluded.name;
-- =====================================================================
