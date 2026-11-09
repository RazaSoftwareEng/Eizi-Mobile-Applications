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

-- Profile photo + short bio (customers & providers). Bio is limited to 500 words.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text not null default '';
do $$ begin
  alter table public.profiles add constraint profiles_bio_500_words
    check (coalesce(array_length(regexp_split_to_array(nullif(btrim(bio), ''), '\s+'), 1), 0) <= 500 and length(bio) <= 5000);
exception when duplicate_object then null; end $$;
-- The photo must be the user's own file in our "avatars" bucket — no external or other people's images.
do $$ begin
  alter table public.profiles add constraint profiles_avatar_own_file
    check (avatar_url is null or position('/storage/v1/object/public/avatars/' || id::text || '/' in avatar_url) > 0);
exception when duplicate_object then null; end $$;

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

-- ---------- Wallet ----------
-- Balances change ONLY through the security-definer functions below — the apps can read their wallet but never write it.
do $$ begin
  create type public.wallet_tx_type as enum
    ('topup', 'booking_payment', 'booking_refund', 'booking_earning', 'withdrawal', 'withdrawal_reversal', 'adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.wallet_request_kind as enum ('topup', 'withdraw');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.wallet_request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- How each booking is paid: cash after the job, or from the customer's wallet (held until the job is done).
alter table public.bookings add column if not exists payment_method text not null default 'cash';
alter table public.bookings add column if not exists payment_status text not null default 'unpaid';
do $$ begin
  alter table public.bookings add constraint bookings_payment_method_check check (payment_method in ('cash', 'wallet'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.bookings add constraint bookings_payment_status_check check (payment_status in ('unpaid', 'held', 'released', 'refunded'));
exception when duplicate_object then null; end $$;

create table if not exists public.wallets (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  balance     numeric(12, 2) not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  amount         numeric(12, 2) not null check (amount <> 0),      -- + credit, − debit
  type           public.wallet_tx_type not null,
  booking_id     bigint,                                          -- no FK: history survives booking deletion
  request_id     bigint,
  note           text not null default '',
  balance_after  numeric(12, 2) not null,
  created_at     timestamptz not null default now()
);
create index if not exists wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);

-- Eizi's own receiving accounts that customers send money to (filled in from the admin portal).
create table if not exists public.payment_accounts (
  method          text primary key check (method in ('easypaisa', 'jazzcash', 'sadapay', 'nayapay')),
  label           text not null,
  account_title   text not null default '',
  account_number  text not null default '',
  is_active       boolean not null default true,
  sort            int not null default 0
);
-- Default receiving account. "do nothing" on re-run, so numbers changed later in the admin portal are never overwritten.
insert into public.payment_accounts (method, label, sort, account_title, account_number) values
  ('easypaisa', 'EasyPaisa', 1, 'Ali Raza', '03003209005'),
  ('jazzcash',  'JazzCash',  2, 'Ali Raza', '03003209005'),
  ('sadapay',   'SadaPay',   3, 'Ali Raza', '03003209005'),
  ('nayapay',   'NayaPay',   4, 'Ali Raza', '03003209005')
on conflict (method) do nothing;

create table if not exists public.wallet_requests (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  kind            public.wallet_request_kind not null,
  method          text not null check (method in ('easypaisa', 'jazzcash', 'sadapay', 'nayapay')),
  amount          numeric(12, 2) not null check (amount > 0),
  reference       text not null default '',   -- top-up: transaction ID (TID) from the payment app
  account_title   text not null default '',   -- withdrawal: where to send the money
  account_number  text not null default '',
  status          public.wallet_request_status not null default 'pending',
  admin_note      text not null default '',
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users (id) on delete set null
);
create index if not exists wallet_requests_status_idx on public.wallet_requests (status, created_at desc);
create index if not exists wallet_requests_user_idx on public.wallet_requests (user_id, created_at desc);
-- The same TID can't be claimed twice (unless an earlier claim was rejected).
create unique index if not exists wallet_requests_unique_tid
  on public.wallet_requests (method, lower(reference)) where kind = 'topup' and status <> 'rejected';

-- The one place money moves. Locks the wallet row, refuses to go below zero, writes the ledger entry.
create or replace function public.wallet_apply(
  p_user uuid, p_amount numeric, p_type public.wallet_tx_type, p_booking bigint, p_request bigint, p_note text
)
returns numeric
language plpgsql
security definer set search_path = ''
as $$
declare
  v_balance numeric(12, 2);
begin
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select balance into v_balance from public.wallets where user_id = p_user for update;
  if v_balance + p_amount < 0 then
    raise exception 'Insufficient wallet balance (available Rs %)', round(v_balance);
  end if;
  update public.wallets set balance = balance + p_amount, updated_at = now()
    where user_id = p_user returning balance into v_balance;
  insert into public.wallet_transactions (user_id, amount, type, booking_id, request_id, note, balance_after)
    values (p_user, p_amount, p_type, p_booking, p_request, coalesce(p_note, ''), v_balance);
  return v_balance;
end;
$$;
revoke all on function public.wallet_apply(uuid, numeric, public.wallet_tx_type, bigint, bigint, text) from public, anon, authenticated;

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

  new.provider_id    := ps.provider_id;
  new.service_id     := ps.service_id;
  new.hourly_rate    := ps.hourly_rate;
  new.total_price    := ps.hourly_rate * new.hours;
  new.status         := 'pending';
  new.payment_method := coalesce(new.payment_method, 'cash');
  new.payment_status := case when new.payment_method = 'wallet' then 'held' else 'unpaid' end;
  return new;
end;
$$;

drop trigger if exists bookings_before_insert on public.bookings;
create trigger bookings_before_insert
  before insert on public.bookings
  for each row execute function public.bookings_before_insert();

-- Wallet payment: take the money right away (held by Eizi). Not enough balance → the whole booking is rejected.
create or replace function public.bookings_after_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.payment_method = 'wallet' then
    perform public.wallet_apply(new.customer_id, -new.total_price, 'booking_payment', new.id, null, 'Booking #' || new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists bookings_after_insert on public.bookings;
create trigger bookings_after_insert
  after insert on public.bookings
  for each row execute function public.bookings_after_insert();

-- Only status may change after booking, and only through allowed transitions:
--   customer : pending/accepted → cancelled
--   provider : pending → accepted | rejected,  accepted → completed
-- Held wallet money follows the status: completed → provider is paid; cancelled/rejected → customer refunded.
create or replace function public.bookings_before_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if public.is_admin() then
    -- Admins may correct details, but never the payment fields, and not the money side of a wallet-paid booking.
    new.payment_method := old.payment_method;
    new.payment_status := old.payment_status;
    if old.payment_status = 'held'
       and (new.total_price, new.customer_id, new.provider_id) is distinct from (old.total_price, old.customer_id, old.provider_id) then
      raise exception 'This booking was paid from the wallet. Cancel it (the customer is refunded automatically) and create a new one instead of changing the price or people.';
    end if;
    if old.payment_status in ('released', 'refunded') and new.status is distinct from old.status then
      raise exception 'The wallet payment for this booking is already settled, so its status can no longer change.';
    end if;
  else
    if (new.customer_id, new.provider_id, new.provider_service_id, new.service_id, new.hours,
        new.hourly_rate, new.total_price, new.scheduled_at, new.address, new.notes, new.created_at,
        new.payment_method, new.payment_status)
       is distinct from
       (old.customer_id, old.provider_id, old.provider_service_id, old.service_id, old.hours,
        old.hourly_rate, old.total_price, old.scheduled_at, old.address, old.notes, old.created_at,
        old.payment_method, old.payment_status)
    then
      raise exception 'Only the booking status can be changed';
    end if;

    if new.status is distinct from old.status and not (
         (auth.uid() = old.customer_id and old.status in ('pending', 'accepted') and new.status = 'cancelled') or
         (auth.uid() = old.provider_id and (
            (old.status = 'pending'  and new.status in ('accepted', 'rejected')) or
            (old.status = 'accepted' and new.status = 'completed')))
       ) then
      raise exception 'Cannot change booking from % to %', old.status, new.status;
    end if;
  end if;

  -- Move held wallet money
  if new.status is distinct from old.status and old.payment_status = 'held' then
    if new.status = 'completed' then
      perform public.wallet_apply(old.provider_id, old.total_price, 'booking_earning', old.id, null, 'Earning · booking #' || old.id);
      new.payment_status := 'released';
    elsif new.status in ('cancelled', 'rejected') then
      perform public.wallet_apply(old.customer_id, old.total_price, 'booking_refund', old.id, null, 'Refund · booking #' || old.id);
      new.payment_status := 'refunded';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_before_update on public.bookings;
create trigger bookings_before_update
  before update on public.bookings
  for each row execute function public.bookings_before_update();

-- Deleting a booking whose wallet payment is still held refunds the customer first.
create or replace function public.bookings_before_delete()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if old.payment_status = 'held' and exists (select 1 from public.profiles where id = old.customer_id) then
    perform public.wallet_apply(old.customer_id, old.total_price, 'booking_refund', old.id, null, 'Refund · booking #' || old.id || ' removed');
  end if;
  return old;
end;
$$;

drop trigger if exists bookings_before_delete on public.bookings;
create trigger bookings_before_delete
  before delete on public.bookings
  for each row execute function public.bookings_before_delete();

-- Customer: "I sent Rs X via EasyPaisa, TID 123…" → waits for an admin to verify.
create or replace function public.request_topup(p_method text, p_amount numeric, p_reference text)
returns bigint
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'Please sign in again'; end if;
  if p_amount is null or p_amount < 100 or p_amount > 50000 then
    raise exception 'Amount must be between Rs 100 and Rs 50,000';
  end if;
  if length(trim(coalesce(p_reference, ''))) < 6 then
    raise exception 'Enter the transaction ID (TID) shown in your payment app';
  end if;
  if not exists (select 1 from public.payment_accounts where method = p_method and is_active and account_number <> '') then
    raise exception 'This payment method is not available right now';
  end if;
  if (select count(*) from public.wallet_requests where user_id = auth.uid() and kind = 'topup' and status = 'pending') >= 3 then
    raise exception 'You already have 3 top-ups waiting for verification. Please wait for them to be checked.';
  end if;

  insert into public.wallet_requests (user_id, kind, method, amount, reference)
    values (auth.uid(), 'topup', p_method, round(p_amount, 2), trim(p_reference))
    returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'This transaction ID has already been submitted';
end;
$$;

-- Withdraw: the amount is taken from the wallet immediately (so it can't be spent twice) and paid out by an admin.
create or replace function public.request_withdrawal(p_method text, p_amount numeric, p_account_number text, p_account_title text)
returns bigint
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'Please sign in again'; end if;
  if p_amount is null or p_amount < 500 then raise exception 'Minimum withdrawal is Rs 500'; end if;
  if length(regexp_replace(coalesce(p_account_number, ''), '\D', '', 'g')) < 10 then
    raise exception 'Enter a valid mobile account number';
  end if;
  if length(trim(coalesce(p_account_title, ''))) < 3 then raise exception 'Enter the account holder name'; end if;
  if p_method not in ('easypaisa', 'jazzcash', 'sadapay', 'nayapay') then raise exception 'Choose a payout method'; end if;

  insert into public.wallet_requests (user_id, kind, method, amount, account_number, account_title)
    values (auth.uid(), 'withdraw', p_method, round(p_amount, 2), trim(p_account_number), trim(p_account_title))
    returning id into v_id;
  perform public.wallet_apply(auth.uid(), -round(p_amount, 2), 'withdrawal', null, v_id, 'Withdrawal request #' || v_id);
  return v_id;
end;
$$;

-- Admin: approve / reject a top-up or withdrawal.
create or replace function public.admin_review_wallet_request(p_id bigint, p_approve boolean, p_note text default '')
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.wallet_requests;
  v_label text;
begin
  if not public.is_admin() then raise exception 'Only admins can review wallet requests'; end if;
  select * into r from public.wallet_requests where id = p_id for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'This request was already reviewed'; end if;
  select label into v_label from public.payment_accounts where method = r.method;

  if r.kind = 'topup' and p_approve then
    perform public.wallet_apply(r.user_id, r.amount, 'topup', null, r.id, 'Top-up via ' || coalesce(v_label, r.method));
  elsif r.kind = 'withdraw' and not p_approve then
    perform public.wallet_apply(r.user_id, r.amount, 'withdrawal_reversal', null, r.id, 'Withdrawal #' || r.id || ' declined — returned');
  end if;

  update public.wallet_requests
     set status = case when p_approve then 'approved'::public.wallet_request_status else 'rejected'::public.wallet_request_status end,
         admin_note = coalesce(p_note, ''),
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = r.id;
end;
$$;

revoke all on function public.request_topup(text, numeric, text) from public, anon;
revoke all on function public.request_withdrawal(text, numeric, text, text) from public, anon;
revoke all on function public.admin_review_wallet_request(bigint, boolean, text) from public, anon;
grant execute on function public.request_topup(text, numeric, text) to authenticated;
grant execute on function public.request_withdrawal(text, numeric, text, text) to authenticated;
grant execute on function public.admin_review_wallet_request(bigint, boolean, text) to authenticated;

alter table public.wallets             enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_requests     enable row level security;
alter table public.payment_accounts    enable row level security;

drop policy if exists "own wallet" on public.wallets;
create policy "own wallet" on public.wallets
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "own wallet transactions" on public.wallet_transactions;
create policy "own wallet transactions" on public.wallet_transactions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "own wallet requests" on public.wallet_requests;
create policy "own wallet requests" on public.wallet_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payment accounts readable" on public.payment_accounts;
create policy "payment accounts readable" on public.payment_accounts
  for select to authenticated using (true);

drop policy if exists "admins manage payment accounts" on public.payment_accounts;
create policy "admins manage payment accounts" on public.payment_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Read-only for apps; every write goes through the functions above.
revoke insert, update, delete on public.wallets, public.wallet_transactions, public.wallet_requests from anon, authenticated;
grant select on public.wallets, public.wallet_transactions, public.wallet_requests, public.payment_accounts to authenticated;
grant insert, update, delete on public.payment_accounts to authenticated;   -- RLS: admins only

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

-- ---------- Storage: profile photos ----------
-- Public bucket; each user may only write inside their own folder: avatars/<user-id>/...
-- The app resizes to 400×400 and compresses before upload (~20–60 KB), so 512 KB is a generous ceiling.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- Website contact form ----------
-- Anyone (no login) can send a message from the public website; only admins can read or manage them.
create table if not exists public.contact_messages (
  id          bigint generated always as identity primary key,
  name        text not null check (length(btrim(name)) between 2 and 80),
  contact     text not null check (length(btrim(contact)) between 5 and 120),   -- phone or email
  topic       text not null default 'general' check (topic in ('general', 'app', 'provider', 'support', 'business')),
  message     text not null check (length(btrim(message)) between 10 and 2000),
  status      text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at  timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);

-- Light spam protection: max 3 messages per contact per 10 minutes, and 30 per minute overall.
create or replace function public.contact_messages_before_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.status := 'new';
  new.created_at := now();
  if (select count(*) from public.contact_messages
       where lower(btrim(contact)) = lower(btrim(new.contact)) and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Too many messages — please wait a few minutes before sending another.';
  end if;
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many messages right now — please try again shortly.';
  end if;
  return new;
end;
$$;

drop trigger if exists contact_messages_before_insert on public.contact_messages;
create trigger contact_messages_before_insert
  before insert on public.contact_messages
  for each row execute function public.contact_messages_before_insert();

alter table public.contact_messages enable row level security;

drop policy if exists "anyone can send a message" on public.contact_messages;
create policy "anyone can send a message" on public.contact_messages
  for insert to anon, authenticated with check (true);

drop policy if exists "admins manage messages" on public.contact_messages;
create policy "admins manage messages" on public.contact_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.contact_messages from anon;
grant insert (name, contact, topic, message) on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;   -- RLS: admins only
