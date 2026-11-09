-- =====================================================================
-- Eizi — database schema
-- Run this whole file once in Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- ---------- Types ----------
do $$ begin
  create type public.user_role as enum ('customer', 'provider');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------- Profiles (1 row per auth user) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  role        public.user_role,            -- null until the user picks customer / provider
  created_at  timestamptz not null default now()
);

create index if not exists profiles_created_idx on public.profiles (created_at desc);

-- Auto-create a profile whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    case when meta_role in ('customer', 'provider') then meta_role::public.user_role end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Admins (managed ONLY from the SQL editor — never from the apps) ----------
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Service categories (Dishwasher, Cook, Electrician ...) ----------
create table if not exists public.services (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  icon         text not null default 'toolbox-outline',  -- MaterialCommunityIcons name
  description  text not null default ''
);

-- Optional cover photo shown on the app's service cards (uploaded from the admin portal).
alter table public.services add column if not exists image_url text;

-- ---------- What each provider offers + their hourly price ----------
create table if not exists public.provider_services (
  id           bigint generated always as identity primary key,
  provider_id  uuid not null references public.profiles (id) on delete cascade,
  service_id   bigint not null references public.services (id) on delete cascade,
  hourly_rate  numeric(10, 2) not null check (hourly_rate > 0),
  description  text not null default '',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (provider_id, service_id)
);

-- ---------- Bookings ----------
create table if not exists public.bookings (
  id                   bigint generated always as identity primary key,
  customer_id          uuid not null references public.profiles (id) on delete cascade,
  provider_id          uuid not null references public.profiles (id) on delete cascade,
  provider_service_id  bigint not null references public.provider_services (id) on delete cascade,
  service_id           bigint not null references public.services (id),
  hours                int not null check (hours between 1 and 12),
  hourly_rate          numeric(10, 2) not null,
  total_price          numeric(10, 2) not null,
  scheduled_at         timestamptz not null,
  address              text not null,
  notes                text not null default '',
  status               public.booking_status not null default 'pending',
  created_at           timestamptz not null default now()
);

create index if not exists bookings_customer_idx on public.bookings (customer_id, created_at desc);
create index if not exists bookings_provider_idx on public.bookings (provider_id, created_at desc);
create index if not exists provider_services_service_idx on public.provider_services (service_id) where is_active;

-- Price is ALWAYS computed on the server from the provider's current rate,
-- so a customer can never send a fake total from the app.
create or replace function public.bookings_before_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  ps public.provider_services;
begin
  select * into ps from public.provider_services where id = new.provider_service_id;
  if ps.id is null or not ps.is_active then
    raise exception 'This service is not available';
  end if;
  if ps.provider_id = new.customer_id then
    raise exception 'You cannot book your own service';
  end if;

  new.provider_id := ps.provider_id;
  new.service_id  := ps.service_id;
  new.hourly_rate := ps.hourly_rate;
  new.total_price := ps.hourly_rate * new.hours;
  new.status      := 'pending';
  return new;
end;
$$;

drop trigger if exists bookings_before_insert on public.bookings;
create trigger bookings_before_insert
  before insert on public.bookings
  for each row execute function public.bookings_before_insert();

-- Only status may change after booking, and only through allowed transitions:
--   customer : pending/accepted → cancelled
--   provider : pending → accepted | rejected,  accepted → completed
create or replace function public.bookings_before_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Admins may correct anything (status, time, address …).
  if public.is_admin() then
    return new;
  end if;

  if (new.customer_id, new.provider_id, new.provider_service_id, new.service_id, new.hours,
      new.hourly_rate, new.total_price, new.scheduled_at, new.address, new.notes, new.created_at)
     is distinct from
     (old.customer_id, old.provider_id, old.provider_service_id, old.service_id, old.hours,
      old.hourly_rate, old.total_price, old.scheduled_at, old.address, old.notes, old.created_at)
  then
    raise exception 'Only the booking status can be changed';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if auth.uid() = old.customer_id
     and old.status in ('pending', 'accepted') and new.status = 'cancelled' then
    return new;
  end if;

  if auth.uid() = old.provider_id and (
       (old.status = 'pending'  and new.status in ('accepted', 'rejected')) or
       (old.status = 'accepted' and new.status = 'completed')
     ) then
    return new;
  end if;

  raise exception 'Cannot change booking from % to %', old.status, new.status;
end;
$$;

drop trigger if exists bookings_before_update on public.bookings;
create trigger bookings_before_update
  before update on public.bookings
  for each row execute function public.bookings_before_update();

-- ---------- Row Level Security ----------
alter table public.profiles          enable row level security;
alter table public.services          enable row level security;
alter table public.provider_services enable row level security;
alter table public.bookings          enable row level security;

-- profiles
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- services (public catalogue)
drop policy if exists "services readable" on public.services;
create policy "services readable" on public.services
  for select to anon, authenticated using (true);

-- provider_services
drop policy if exists "provider services readable" on public.provider_services;
create policy "provider services readable" on public.provider_services
  for select to authenticated using (true);

drop policy if exists "providers manage own services" on public.provider_services;
create policy "providers manage own services" on public.provider_services
  for all to authenticated
  using (provider_id = auth.uid())
  with check (
    provider_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'provider')
  );

-- bookings
drop policy if exists "parties read their bookings" on public.bookings;
create policy "parties read their bookings" on public.bookings
  for select to authenticated
  using (customer_id = auth.uid() or provider_id = auth.uid());

drop policy if exists "customers create bookings" on public.bookings;
create policy "customers create bookings" on public.bookings
  for insert to authenticated
  with check (customer_id = auth.uid());

drop policy if exists "parties update their bookings" on public.bookings;
create policy "parties update their bookings" on public.bookings
  for update to authenticated
  using (customer_id = auth.uid() or provider_id = auth.uid())
  with check (customer_id = auth.uid() or provider_id = auth.uid());

-- ---------- Admin access (admin portal) ----------
alter table public.admins enable row level security;

drop policy if exists "admins see own admin row" on public.admins;
create policy "admins see own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admin full access" on public.profiles;
create policy "admin full access" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin full access" on public.services;
create policy "admin full access" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin full access" on public.provider_services;
create policy "admin full access" on public.provider_services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin full access" on public.bookings;
create policy "admin full access" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Fully delete a user (auth account + profile + their listings & bookings). Admin only.
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete users';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot delete your own admin account';
  end if;
  delete from auth.users where id = target;   -- cascades to profiles → listings → bookings
end;
$$;

-- Emails + last sign-in live in auth.users (private). Only admins can read them, through this function.
create or replace function public.admin_list_accounts()
returns table (id uuid, email text, last_sign_in_at timestamptz, email_confirmed_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can list accounts';
  end if;
  return query select u.id, u.email::text, u.last_sign_in_at, u.email_confirmed_at from auth.users u;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
revoke all on function public.admin_list_accounts() from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- Grants (newer Supabase projects need these explicitly) ----------
grant usage on schema public to anon, authenticated;
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;           -- RLS: admins only
grant select on public.admins to authenticated;                             -- RLS: own row only

grant select, insert, update, delete on public.profiles to authenticated;   -- delete: RLS admins only

grant select, insert, update, delete on public.provider_services to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;   -- delete: RLS admins only

-- ---------- Seed: service categories ----------
insert into public.services (name, icon, description) values
  ('Dishwasher',     'dishwasher', 'Dishes washed, kitchen sink cleared'),
  ('Cook',           'chef-hat', 'Home-cooked meals prepared in your kitchen'),
  ('Electrician',    'flash', 'Wiring, switches, fans, lights and repairs'),
  ('Plumber',        'pipe-wrench', 'Leaks, taps, drains and fittings'),
  ('House Cleaner',  'broom', 'Sweeping, mopping, dusting and tidying'),
  ('Carpenter',      'saw-blade', 'Furniture repair, doors and woodwork'),
  ('Painter',        'format-paint', 'Walls, doors and touch-ups'),
  ('AC Technician',  'air-conditioner', 'AC service, gas refill and repair'),
  ('Laundry',        'washing-machine', 'Washing, drying and ironing clothes'),
  ('Babysitter',     'baby-face-outline', 'Trusted childcare at home'),
  ('Driver',         'car-outline', 'Personal driver for your own car'),
  ('Gardener',       'flower-outline', 'Lawn, plants and garden upkeep')
on conflict (name) do update set icon = excluded.icon;

-- ---------- Storage: service cover photos ----------
-- Public bucket (anyone can view the photos in the app); only admins can upload, replace or delete.
-- The admin portal converts every upload to a small WebP (max 640px, ~150 KB), so the bucket only accepts WebP up to 1 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images', 'service-images', true, 1048576, array['image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins upload service images" on storage.objects;
create policy "admins upload service images" on storage.objects
  for insert to authenticated with check (bucket_id = 'service-images' and public.is_admin());

drop policy if exists "admins update service images" on storage.objects;
create policy "admins update service images" on storage.objects
  for update to authenticated using (bucket_id = 'service-images' and public.is_admin());

drop policy if exists "admins delete service images" on storage.objects;
create policy "admins delete service images" on storage.objects
  for delete to authenticated using (bucket_id = 'service-images' and public.is_admin());
