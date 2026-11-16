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

-- City / area (customers), the provider's work category, and the provider's rating (kept up to date by rate_booking()).
alter table public.profiles add column if not exists city text not null default '';
alter table public.profiles add column if not exists rating_avg numeric(3, 2) not null default 0;
alter table public.profiles add column if not exists rating_count int not null default 0;

-- Auto-create a profile whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  meta_role text := meta ->> 'role';
  v_service bigint;
  v_cnic    text := regexp_replace(coalesce(meta ->> 'cnic', ''), '\D', '', 'g');
begin
  insert into public.profiles (id, full_name, phone, role, city)
  values (
    new.id,
    left(coalesce(meta ->> 'full_name', ''), 120),
    meta ->> 'phone',
    case when meta_role in ('customer', 'provider') then meta_role::public.user_role end,
    left(btrim(coalesce(meta ->> 'city', '')), 80)
  );

  if meta_role = 'provider' then
    if (meta ->> 'service_id') ~ '^\d+$' then
      select id into v_service from public.services where id = (meta ->> 'service_id')::bigint and is_active;
    end if;
    update public.profiles set service_id = v_service where id = new.id;
    if length(v_cnic) = 13 then
      insert into public.provider_kyc (user_id, cnic) values (new.id, v_cnic) on conflict do nothing;
    end if;
  end if;
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

-- Base visiting fee for the category (set by admins). The customer sees it before requesting;
-- the worker's final quote can't be lower — the fee is adjusted against the final service cost.
alter table public.services add column if not exists visit_fee numeric(10, 2) not null default 300;
alter table public.services add column if not exists sort int not null default 100;
alter table public.services add column if not exists is_active boolean not null default true;
do $$ begin
  alter table public.services add constraint services_visit_fee_check check (visit_fee >= 0 and visit_fee <= 100000);
exception when duplicate_object then null; end $$;

-- ---------- Sub-services: the specific jobs a customer ticks (Fan Fitting, Washroom Deep Cleaning …) ----------
create table if not exists public.service_tasks (
  id          bigint generated always as identity primary key,
  service_id  bigint not null references public.services (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 80),
  base_price  numeric(10, 2) check (base_price is null or base_price >= 0),   -- optional "from" price, shown as a guide
  sort        int not null default 100,
  is_active   boolean not null default true,
  unique (service_id, name)
);
create index if not exists service_tasks_service_idx on public.service_tasks (service_id, sort);

-- Provider's work category (chosen at sign-up).
alter table public.profiles add column if not exists service_id bigint references public.services (id) on delete set null;

-- Private provider details: CNIC. Only the provider and admins can read it.
create table if not exists public.provider_kyc (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  cnic        text not null unique check (cnic ~ '^\d{13}$'),
  created_at  timestamptz not null default now()
);

-- Provider availability + last known position (private: own row + admins). Written only via set_availability().
create table if not exists public.provider_presence (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  is_online   boolean not null default false,
  latitude    double precision check (latitude between -90 and 90),
  longitude   double precision check (longitude between -180 and 180),
  updated_at  timestamptz not null default now()
);

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

-- Exact spot the customer shared from their phone's GPS (optional). Visible only to that booking's
-- customer, provider and admins (same RLS as the rest of the row) — the provider opens it in Google Maps.
alter table public.bookings add column if not exists latitude double precision;
alter table public.bookings add column if not exists longitude double precision;
do $$ begin
  alter table public.bookings add constraint bookings_location_check check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null
      and latitude between -90 and 90 and longitude between -180 and 180)
  );
exception when duplicate_object then null; end $$;

-- ---------- On-demand request flow ----------
--   customer picks a category + ticks sub-services → request goes to nearby ONLINE workers of that category
--   first worker to accept gets it → visits → sends a quote → customer approves (cash or wallet) → completed → rating
-- The worker is unknown until someone accepts, so the first-version columns become optional.
alter table public.bookings alter column provider_id drop not null;
alter table public.bookings alter column provider_service_id drop not null;
alter table public.bookings alter column hourly_rate drop not null;
alter table public.bookings alter column hours drop not null;
alter table public.bookings add column if not exists task_ids     bigint[] not null default '{}';
alter table public.bookings add column if not exists tasks        jsonb not null default '[]';   -- names at booking time
alter table public.bookings add column if not exists visit_fee    numeric(10, 2) not null default 0;
alter table public.bookings add column if not exists quote_amount numeric(10, 2);
alter table public.bookings add column if not exists quote_note   text not null default '';
alter table public.bookings add column if not exists quote_status text not null default 'none';
alter table public.bookings add column if not exists accepted_at  timestamptz;
alter table public.bookings add column if not exists quoted_at    timestamptz;
alter table public.bookings add column if not exists completed_at timestamptz;
alter table public.bookings add column if not exists rating       smallint;
alter table public.bookings add column if not exists review       text not null default '';
do $$ begin
  alter table public.bookings add constraint bookings_quote_status_check check (quote_status in ('none', 'sent', 'approved', 'declined'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.bookings add constraint bookings_rating_check check (rating is null or rating between 1 and 5);
exception when duplicate_object then null; end $$;
create index if not exists bookings_open_idx on public.bookings (service_id, created_at desc) where status = 'pending' and provider_id is null;

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

-- A new request: everything that matters is decided on the server, never trusted from the app —
-- the category's visiting fee, the sub-service names, who the worker is (nobody yet) and the payment state.
create or replace function public.bookings_before_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  svc public.services;
  v_tasks jsonb;
  v_count int;
begin
  if not exists (select 1 from public.profiles where id = new.customer_id and role = 'customer') then
    raise exception 'Only customer accounts can request services';
  end if;
  select * into svc from public.services where id = new.service_id;
  if svc.id is null or not svc.is_active then
    raise exception 'This service is not available';
  end if;

  new.task_ids := array(select distinct unnest(coalesce(new.task_ids, '{}')));
  select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.sort, t.id), count(*)
    into v_tasks, v_count
  from public.service_tasks t
  where t.id = any (new.task_ids) and t.service_id = svc.id and t.is_active;
  if coalesce(v_count, 0) = 0 or v_count <> cardinality(new.task_ids) then
    raise exception 'Please select at least one task from this service';
  end if;
  if length(btrim(coalesce(new.address, ''))) < 3 then
    raise exception 'Please add your address';
  end if;
  if (select count(*) from public.bookings where customer_id = new.customer_id and status = 'pending') >= 3 then
    raise exception 'You already have 3 open requests. Please wait for a worker or cancel one first.';
  end if;

  new.tasks          := v_tasks;
  new.visit_fee      := svc.visit_fee;
  new.total_price    := svc.visit_fee;     -- becomes the agreed quote once the customer approves it
  new.provider_id    := null;
  new.provider_service_id := null;
  new.hourly_rate    := null;
  new.hours          := null;
  new.scheduled_at   := greatest(coalesce(new.scheduled_at, now()), now() - interval '5 minutes');
  new.status         := 'pending';
  new.quote_amount   := null;
  new.quote_note     := '';
  new.quote_status   := 'none';
  new.accepted_at    := null;
  new.quoted_at      := null;
  new.completed_at   := null;
  new.rating         := null;
  new.review         := '';
  new.payment_method := 'cash';           -- chosen when the customer approves the quote
  new.payment_status := 'unpaid';
  new.notes          := left(coalesce(new.notes, ''), 500);
  new.address        := left(btrim(new.address), 300);
  new.created_at     := now();
  return new;
end;
$$;

drop trigger if exists bookings_before_insert on public.bookings;
create trigger bookings_before_insert
  before insert on public.bookings
  for each row execute function public.bookings_before_insert();

-- (First version took wallet money at booking time; now money is only held when a quote is approved.)
drop trigger if exists bookings_after_insert on public.bookings;
drop function if exists public.bookings_after_insert();

-- Bookings change ONLY through the request functions below (accept_booking, send_quote, …) or by admins.
-- Those functions mark the transaction as trusted; anything else is refused.
-- Held wallet money always follows the status: completed → worker is paid; cancelled → customer refunded.
create or replace function public.bookings_before_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if current_setting('eizi.booking_rpc', true) = 'on' then
    null;  -- trusted request function (it already checked who may do what)
  elsif public.is_admin() then
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
    raise exception 'Bookings can only be changed through the app actions';
  end if;

  -- Move held wallet money
  if new.status is distinct from old.status and old.payment_status = 'held' then
    if new.status = 'completed' then
      perform public.wallet_apply(new.provider_id, old.total_price, 'booking_earning', old.id, null, 'Earning · booking #' || old.id);
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

-- No direct updates: customers and workers change bookings only through the request functions.
drop policy if exists "parties update their bookings" on public.bookings;

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

-- ---------- Seed: the 5 service categories + their sub-services ----------
-- Re-running never overwrites what admins changed later (visit fee, names, prices), it only adds what's missing.
insert into public.services (name, icon, description, sort, visit_fee) values
  ('Cleaning Services',      'broom',           'Sweeping, mopping, dusting, washrooms and kitchen scrubbing', 1, 300),
  ('Cooking & Kitchen Help', 'chef-hat',        'Daily meals, chopping, aata kneading and kitchen wiping',     2, 300),
  ('Electrician Services',   'flash',           'Switchboards, fans, lights, UPS wiring and DB box checks',    3, 300),
  ('Laundry Support',        'washing-machine', 'Ironing, washing, delicates and wardrobe organizing',         4, 300),
  ('Dishwashing & Utensils', 'dishwasher',      'Daily dishes, party pots and sink sanitization',              5, 300)
on conflict (name) do update set sort = excluded.sort, is_active = true;

-- Categories from the first version of the app stay for old bookings, but are hidden from new requests.
update public.services set is_active = false
where is_active
  and name in ('Dishwasher', 'Cook', 'Electrician', 'Plumber', 'House Cleaner', 'Carpenter', 'Painter',
               'AC Technician', 'Laundry', 'Babysitter', 'Driver', 'Gardener')
  and not exists (select 1 from public.service_tasks t where t.service_id = services.id);

insert into public.service_tasks (service_id, name, sort)
select s.id, t.name, t.sort
from (values
  ('Cleaning Services',      'Full Room Sweeping & Mopping',               1),
  ('Cleaning Services',      'Dusting & Furniture Wiping',                 2),
  ('Cleaning Services',      'Washroom Deep Cleaning',                     3),
  ('Cleaning Services',      'Kitchen Slab & Tile Scrubbing',              4),
  ('Cleaning Services',      'Balcony & Yard Sweeping',                    5),
  ('Cooking & Kitchen Help', 'Daily Meal Prep (Breakfast / Lunch / Dinner)', 1),
  ('Cooking & Kitchen Help', 'Vegetable Chopping & Peeling',               2),
  ('Cooking & Kitchen Help', 'Aata Kneading (Dough Prep)',                 3),
  ('Cooking & Kitchen Help', 'Post-Cooking Kitchen Wiping',                4),
  ('Electrician Services',   'Switchboard & Socket Repair',                1),
  ('Electrician Services',   'Fan Fitting & Repair',                       2),
  ('Electrician Services',   'Light Fixture Installation',                 3),
  ('Electrician Services',   'UPS & Battery Wiring Check',                 4),
  ('Electrician Services',   'Breaker & Main DB Box Diagnosis',            5),
  ('Laundry Support',        'Clothes Ironing & Folding',                  1),
  ('Laundry Support',        'Heavy Ironing (Suits / Formal Wear)',        2),
  ('Laundry Support',        'Machine Washing Assistance',                 3),
  ('Laundry Support',        'Hand Washing (Delicates)',                   4),
  ('Laundry Support',        'Wardrobe Organizing',                        5),
  ('Dishwashing & Utensils', 'Daily Routine Utensil Washing',              1),
  ('Dishwashing & Utensils', 'Heavy Event / Party Pot Cleaning',           2),
  ('Dishwashing & Utensils', 'Sink & Counter Sanitization',                3)
) as t(service, name, sort)
join public.services s on s.name = t.service
on conflict (service_id, name) do nothing;

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

-- =====================================================================
-- Push notifications (Expo push service, sent straight from the database)
-- =====================================================================
--   app signs in → register_push_token()  → push_tokens
--   booking inserted / status changes, wallet request reviewed → trigger → notify_user()
--   notify_user() → pg_net HTTP POST → https://exp.host/--/api/v2/push/send → phone (sound: booking.wav)
-- pg_net queues the request and sends it after the transaction commits, so a slow or failed push
-- never delays or breaks the booking itself.
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available, push notifications are disabled (%).', sqlerrm;
end $$;

create table if not exists public.push_tokens (
  token       text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  platform    text not null default '' check (platform in ('', 'android', 'ios')),
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- Apps never touch the table directly, only through the two functions below.
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- Link this phone to the signed-in user (moves it over if another account used the phone before).
create or replace function public.register_push_token(p_token text, p_platform text default '')
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, ''), now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  -- keep at most 5 phones per user
  delete from public.push_tokens
  where user_id = auth.uid()
    and token not in (select token from public.push_tokens where user_id = auth.uid() order by updated_at desc limit 5);
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Send one notification to every phone of a user. Internal only (not callable from the apps).
-- p_kind picks the Android channel + sound (must match src/lib/notifications.ts and app.json):
--   'booking'   → channel "bookings",      booking.wav   (requests, updates, wallet)
--   'confirmed' → channel "confirmations", confirmed.wav (cheerful chime when a booking is accepted)
drop function if exists public.notify_user(uuid, text, text, jsonb);
create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_data jsonb default '{}', p_kind text default 'booking')
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', p_title,
           'body', p_body,
           'data', coalesce(p_data, '{}'::jsonb),
           'sound', case when p_kind = 'confirmed' then 'confirmed.wav' else 'booking.wav' end,  -- iOS; Android uses the channel's sound
           'channelId', case when p_kind = 'confirmed' then 'confirmations' else 'bookings' end,
           'priority', 'high'))
    into msgs
  from public.push_tokens t
  where t.user_id = p_user;

  if msgs is null then
    return;
  end if;

  begin
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      body    := msgs,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  exception when others then
    raise warning 'push notification not sent: %', sqlerrm;   -- never block the booking
  end;
end;
$$;
revoke all on function public.notify_user(uuid, text, text, jsonb, text) from public, anon, authenticated;

create or replace function public.eizi_when(ts timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$ select to_char(ts at time zone 'Asia/Karachi', 'Dy DD Mon, HH12:MI AM') $$;

create or replace function public.eizi_rs(amount numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select 'Rs ' || to_char(round(amount), 'FM999,999,999,990') $$;

-- "Fan Fitting & Repair, Switchboard & Socket Repair + 1 more"
create or replace function public.eizi_tasks_summary(tasks jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select string_agg(t ->> 'name', ', ') from (select t from jsonb_array_elements(tasks) with ordinality as x(t, n) where n <= 2) s), '')
    || case when jsonb_array_length(coalesce(tasks, '[]'::jsonb)) > 2
            then ' + ' || (jsonb_array_length(tasks) - 2) || ' more' else '' end
$$;

-- Every step of a request tells the other side, with sound:
--   new request        → nearby online workers of that category
--   accepted           → customer (cheerful "confirmed" chime)
--   handed back        → customer ("finding another worker")
--   quote sent         → customer      quote approved / declined → worker
--   completed          → customer (please rate) + worker (wallet payment received)
--   cancelled          → the side that didn't cancel
create or replace function public.bookings_notify()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  svc   text;
  cust  text;
  first text;
  prov  text;
  jobs  text;
  w     record;
  dist  text;
begin
  select name into svc from public.services where id = new.service_id;
  svc := coalesce(svc, 'your service');
  select coalesce(nullif(btrim(full_name), ''), 'A customer'), split_part(btrim(coalesce(full_name, '')), ' ', 1)
    into cust, first from public.profiles where id = new.customer_id;
  select coalesce(nullif(btrim(full_name), ''), 'Your worker') into prov from public.profiles where id = new.provider_id;
  prov := coalesce(prov, 'Your worker');
  jobs := public.eizi_tasks_summary(new.tasks);

  -- New request → every nearby online worker in that category
  if tg_op = 'INSERT' then
    for w in
      select p.id,
             case when new.latitude is null or pr.latitude is null then null
                  else public.km_between(pr.latitude, pr.longitude, new.latitude, new.longitude) end as km
      from public.profiles p
      join public.provider_presence pr on pr.user_id = p.id and pr.is_online
      where p.role = 'provider' and p.service_id = new.service_id and p.id <> new.customer_id
    loop
      continue when w.km is not null and w.km > public.request_radius_km();
      dist := case when w.km is null then '' else ' · ' || round(w.km::numeric, 1) || ' km away' end;
      perform public.notify_user(w.id, 'New job nearby · ' || svc,
        coalesce(nullif(first, ''), 'A customer') || ' needs ' || jobs || dist || '. Visiting fee ' || public.eizi_rs(new.visit_fee) || '. Tap to accept.',
        jsonb_build_object('url', '/provider', 'booking_id', new.id));
    end loop;
    return new;
  end if;

  -- Worker accepted
  if old.status = 'pending' and new.status = 'accepted' and new.provider_id is not null then
    perform public.notify_user(new.customer_id,
      case when coalesce(first, '') <> '' then 'Great news, ' || first || '! ' || prov || ' accepted your request'
           else 'Great news! ' || prov || ' accepted your request' end,
      prov || ' is coming for ' || jobs || '. They will check the work and send you a price before starting. '
        || 'Visiting fee ' || public.eizi_rs(new.visit_fee) || ' is adjusted in the final price. Tap to call them.',
      jsonb_build_object('url', '/customer/bookings', 'booking_id', new.id),
      'confirmed');
    return new;
  end if;

  -- Worker handed it back
  if old.status = 'accepted' and new.status = 'pending' then
    perform public.notify_user(new.customer_id, 'Finding another worker',
      'Your ' || svc || ' request is back with nearby workers. We will tell you as soon as someone accepts.',
      jsonb_build_object('url', '/customer/bookings', 'booking_id', new.id));
    return new;
  end if;

  -- Quote
  if new.quote_status is distinct from old.quote_status or (new.quote_status = 'sent' and new.quote_amount is distinct from old.quote_amount) then
    if new.quote_status = 'sent' then
      perform public.notify_user(new.customer_id, 'Price for your job: ' || public.eizi_rs(new.quote_amount),
        prov || ' checked the work and quoted ' || public.eizi_rs(new.quote_amount) || ' for ' || jobs || '. Tap to approve or decline.',
        jsonb_build_object('url', '/customer/bookings', 'booking_id', new.id));
    elsif new.quote_status = 'approved' then
      perform public.notify_user(new.provider_id, 'Price approved · start the work',
        cust || ' approved ' || public.eizi_rs(new.total_price)
          || case when new.payment_status = 'held' then ', paid from wallet and held safely until you mark it completed.'
                  else '. Collect cash after the job.' end,
        jsonb_build_object('url', '/provider', 'booking_id', new.id),
        'confirmed');
    elsif new.quote_status = 'declined' then
      perform public.notify_user(new.provider_id, 'Price declined',
        cust || ' declined ' || public.eizi_rs(new.quote_amount) || '. Send a new price, or complete for the visiting fee ' || public.eizi_rs(new.visit_fee) || '.',
        jsonb_build_object('url', '/provider', 'booking_id', new.id));
    end if;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'completed' then
    perform public.notify_user(new.customer_id, 'Job completed',
      'Thanks for using Eizi! How was ' || prov || '? Tap to rate, it helps other families choose.',
      jsonb_build_object('url', '/customer/bookings', 'booking_id', new.id));
    if new.payment_status = 'released' then
      perform public.notify_user(new.provider_id, 'Payment received',
        public.eizi_rs(new.total_price) || ' for booking #' || new.id || ' was added to your wallet.',
        jsonb_build_object('url', '/provider/wallet', 'booking_id', new.id));
    end if;
  elsif new.status in ('cancelled', 'rejected') then
    if new.provider_id is not null and auth.uid() is distinct from new.provider_id then
      perform public.notify_user(new.provider_id, 'Booking cancelled',
        cust || ' cancelled ' || svc || ' (' || jobs || ').',
        jsonb_build_object('url', '/provider', 'booking_id', new.id));
    end if;
    if auth.uid() is distinct from new.customer_id then
      perform public.notify_user(new.customer_id, 'Booking cancelled',
        'Your ' || svc || ' booking was cancelled.'
          || case when new.payment_status = 'refunded' then ' ' || public.eizi_rs(new.total_price) || ' is back in your wallet.' else '' end,
        jsonb_build_object('url', '/customer/bookings', 'booking_id', new.id));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.bookings_notify() from public, anon, authenticated;

drop trigger if exists bookings_notify_insert on public.bookings;
create trigger bookings_notify_insert
  after insert on public.bookings
  for each row execute function public.bookings_notify();

drop trigger if exists bookings_notify_status on public.bookings;
drop trigger if exists bookings_notify_update on public.bookings;
create trigger bookings_notify_update
  after update of status, provider_id, quote_status, quote_amount on public.bookings
  for each row execute function public.bookings_notify();

-- Admin approved / rejected a top-up or withdrawal → tell the user.
create or replace function public.wallet_requests_notify()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  dest text;
begin
  if new.status is not distinct from old.status or new.status = 'pending' then
    return new;
  end if;
  select case when role = 'provider' then '/provider/wallet' else '/customer/wallet' end
    into dest from public.profiles where id = new.user_id;

  perform public.notify_user(new.user_id,
    case when new.kind = 'topup' then
      case when new.status = 'approved' then 'Money added' else 'Top-up not approved' end
    else
      case when new.status = 'approved' then 'Withdrawal sent' else 'Withdrawal not approved' end
    end,
    case when new.kind = 'topup' and new.status = 'approved' then public.eizi_rs(new.amount) || ' is now in your Eizi wallet.'
         when new.kind = 'withdraw' and new.status = 'approved' then public.eizi_rs(new.amount) || ' was sent to your ' || new.method || ' account.'
         else coalesce(nullif(new.admin_note, ''), 'Open your wallet for details.')
    end,
    jsonb_build_object('url', coalesce(dest, '/customer/wallet')));
  return new;
end;
$$;
revoke all on function public.wallet_requests_notify() from public, anon, authenticated;

drop trigger if exists wallet_requests_notify on public.wallet_requests;
create trigger wallet_requests_notify
  after update of status on public.wallet_requests
  for each row execute function public.wallet_requests_notify();

-- =====================================================================
-- On-demand request flow (customer ↔ nearby workers)
-- =====================================================================
-- pending  (searching)  ──accept_booking──▶ accepted ──send_quote──▶ quote sent
--    ▲                                        │  ▲                       │
--    └────────────release_booking─────────────┘  └──(declined)───respond_quote──▶ approved (cash / wallet held)
--                                                                                     │
--                                                    complete_booking ◀───────────────┘ ──▶ completed ──rate_booking──▶ ★
-- Customer may cancel until a quote is approved.  A declined quote can be completed for the visiting fee only.

create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- How far a request travels. Workers whose position or the customer's pin is unknown still see it.
create or replace function public.request_radius_km()
returns double precision language sql immutable set search_path = '' as $$ select 15::double precision $$;

-- Marks this transaction as a trusted booking change (see bookings_before_update).
create or replace function public.eizi_trust_booking_change()
returns void language sql volatile set search_path = '' as $$ select set_config('eizi.booking_rpc', 'on', true) $$;
revoke all on function public.eizi_trust_booking_change() from public, anon, authenticated;

create or replace function public.eizi_me_provider()
returns public.profiles
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.role is distinct from 'provider' then
    raise exception 'Only worker accounts can do this';
  end if;
  return me;
end;
$$;
revoke all on function public.eizi_me_provider() from public, anon, authenticated;

-- Worker goes online / offline. Online saves the current GPS position so nearby requests reach them.
create or replace function public.set_availability(p_online boolean, p_lat double precision default null, p_lng double precision default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me public.profiles := public.eizi_me_provider();
begin
  if p_online and me.service_id is null then
    raise exception 'Choose your service category in Profile before going online';
  end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location';
  end if;
  insert into public.provider_presence (user_id, is_online, latitude, longitude, updated_at)
  values (me.id, coalesce(p_online, false), p_lat, p_lng, now())
  on conflict (user_id) do update
    set is_online = excluded.is_online,
        latitude  = coalesce(excluded.latitude, public.provider_presence.latitude),
        longitude = coalesce(excluded.longitude, public.provider_presence.longitude),
        updated_at = now();
end;
$$;

-- Open requests a worker can take right now: their category, still unassigned, within the radius.
create or replace function public.open_requests()
returns table (
  id bigint, service_id bigint, service_name text, tasks jsonb, address text, notes text,
  scheduled_at timestamptz, created_at timestamptz, visit_fee numeric,
  customer_name text, customer_avatar text, distance_km double precision
)
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  me public.profiles := public.eizi_me_provider();
  pr public.provider_presence;
begin
  select * into pr from public.provider_presence where user_id = me.id;
  if pr.user_id is null or not pr.is_online or me.service_id is null then
    return;
  end if;
  return query
    select b.id, b.service_id, s.name, b.tasks, b.address, b.notes, b.scheduled_at, b.created_at, b.visit_fee,
           split_part(btrim(c.full_name), ' ', 1), c.avatar_url,
           case when b.latitude is null or pr.latitude is null then null
                else round(public.km_between(pr.latitude, pr.longitude, b.latitude, b.longitude)::numeric, 1)::double precision end
    from public.bookings b
    join public.services s on s.id = b.service_id
    join public.profiles c on c.id = b.customer_id
    where b.status = 'pending'
      and b.provider_id is null
      and b.service_id = me.service_id
      and b.customer_id <> me.id
      and b.created_at > now() - interval '2 days'
      and (b.latitude is null or pr.latitude is null
           or public.km_between(pr.latitude, pr.longitude, b.latitude, b.longitude) <= public.request_radius_km())
    order by b.created_at desc
    limit 50;
end;
$$;

-- First worker to accept gets the job.
create or replace function public.accept_booking(p_id bigint)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me public.profiles := public.eizi_me_provider();
  b  public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.service_id is distinct from me.service_id then
    raise exception 'Request not found';
  end if;
  if b.status <> 'pending' or b.provider_id is not null then
    raise exception 'Another worker already took this request';
  end if;
  if b.customer_id = me.id then
    raise exception 'You cannot accept your own request';
  end if;
  if not exists (select 1 from public.provider_presence where user_id = me.id and is_online) then
    raise exception 'Go online to accept requests';
  end if;
  if (select count(*) from public.bookings where provider_id = me.id and status = 'accepted') >= 3 then
    raise exception 'Finish your current jobs first (max 3 at a time)';
  end if;

  perform public.eizi_trust_booking_change();
  update public.bookings
     set provider_id = me.id, status = 'accepted', accepted_at = now()
   where id = b.id;
end;
$$;

-- Worker can't make it after all → back to searching, other workers see it again.
create or replace function public.release_booking(p_id bigint)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me public.profiles := public.eizi_me_provider();
  b  public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.provider_id is distinct from me.id then raise exception 'Booking not found'; end if;
  if b.status <> 'accepted' or b.quote_status = 'approved' then
    raise exception 'This job can no longer be handed back';
  end if;
  perform public.eizi_trust_booking_change();
  update public.bookings
     set provider_id = null, status = 'pending', accepted_at = null,
         quote_amount = null, quote_note = '', quote_status = 'none', quoted_at = null
   where id = b.id;
end;
$$;

-- After inspecting the work the worker sends the final price (never below the visiting fee).
create or replace function public.send_quote(p_id bigint, p_amount numeric, p_note text default '')
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me public.profiles := public.eizi_me_provider();
  b  public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.provider_id is distinct from me.id then raise exception 'Booking not found'; end if;
  if b.status <> 'accepted' or b.quote_status = 'approved' then
    raise exception 'A quote can no longer be sent for this job';
  end if;
  if p_amount is null or round(p_amount) < b.visit_fee then
    raise exception 'The price must be at least the visiting fee (Rs %)', round(b.visit_fee);
  end if;
  if p_amount > 500000 then raise exception 'Please check the amount'; end if;

  perform public.eizi_trust_booking_change();
  update public.bookings
     set quote_amount = round(p_amount), quote_note = left(btrim(coalesce(p_note, '')), 300),
         quote_status = 'sent', quoted_at = now()
   where id = b.id;
end;
$$;

-- Customer approves (choosing cash or wallet) or declines the quote.
create or replace function public.respond_quote(p_id bigint, p_approve boolean, p_pay text default 'cash')
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.customer_id is distinct from auth.uid() then raise exception 'Booking not found'; end if;
  if b.status <> 'accepted' or b.quote_status <> 'sent' then
    raise exception 'There is no price waiting for your approval';
  end if;
  perform public.eizi_trust_booking_change();

  if not p_approve then
    update public.bookings set quote_status = 'declined' where id = b.id;
    return;
  end if;

  if p_pay not in ('cash', 'wallet') then raise exception 'Choose cash or wallet'; end if;
  if p_pay = 'wallet' then
    -- Raises "Insufficient wallet balance" (and nothing changes) if there isn't enough.
    perform public.wallet_apply(b.customer_id, -b.quote_amount, 'booking_payment', b.id, null, 'Booking #' || b.id);
  end if;
  update public.bookings
     set quote_status = 'approved', total_price = b.quote_amount, payment_method = p_pay,
         payment_status = case when p_pay = 'wallet' then 'held' else 'unpaid' end
   where id = b.id;
end;
$$;

-- Worker finishes. Approved quote → that price (wallet money is released to the worker);
-- declined quote → only the visiting fee, in cash.
create or replace function public.complete_booking(p_id bigint)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me public.profiles := public.eizi_me_provider();
  b  public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.provider_id is distinct from me.id then raise exception 'Booking not found'; end if;
  if b.status <> 'accepted' then raise exception 'This job is not in progress'; end if;
  if b.quote_status not in ('approved', 'declined') then
    raise exception 'Send your price and wait for the customer to approve it first';
  end if;
  perform public.eizi_trust_booking_change();
  update public.bookings
     set status = 'completed', completed_at = now(),
         total_price = case when b.quote_status = 'approved' then b.total_price else b.visit_fee end
   where id = b.id;
end;
$$;

-- Customer cancels — any time before a quote is approved.
create or replace function public.cancel_booking(p_id bigint)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.customer_id is distinct from auth.uid() then raise exception 'Booking not found'; end if;
  if not (b.status = 'pending' or (b.status = 'accepted' and b.quote_status <> 'approved')) then
    raise exception 'This booking can no longer be cancelled from the app. Please contact Eizi support.';
  end if;
  perform public.eizi_trust_booking_change();
  update public.bookings set status = 'cancelled' where id = b.id;
end;
$$;

-- Customer rates the worker once, after the job.
create or replace function public.rate_booking(p_id bigint, p_stars int, p_review text default '')
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.customer_id is distinct from auth.uid() then raise exception 'Booking not found'; end if;
  if b.status <> 'completed' or b.provider_id is null then raise exception 'You can rate after the job is completed'; end if;
  if b.rating is not null then raise exception 'You already rated this job'; end if;
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars'; end if;

  perform public.eizi_trust_booking_change();
  update public.bookings set rating = p_stars, review = left(btrim(coalesce(p_review, '')), 500) where id = b.id;
  update public.profiles p
     set rating_count = r.n, rating_avg = round(r.avg_stars, 2)
    from (select count(*) n, avg(rating) avg_stars from public.bookings where provider_id = b.provider_id and rating is not null) r
   where p.id = b.provider_id;
end;
$$;

revoke all on function public.set_availability(boolean, double precision, double precision) from public, anon;
revoke all on function public.open_requests() from public, anon;
revoke all on function public.accept_booking(bigint) from public, anon;
revoke all on function public.release_booking(bigint) from public, anon;
revoke all on function public.send_quote(bigint, numeric, text) from public, anon;
revoke all on function public.respond_quote(bigint, boolean, text) from public, anon;
revoke all on function public.complete_booking(bigint) from public, anon;
revoke all on function public.cancel_booking(bigint) from public, anon;
revoke all on function public.rate_booking(bigint, int, text) from public, anon;
grant execute on function public.set_availability(boolean, double precision, double precision) to authenticated;
grant execute on function public.open_requests() to authenticated;
grant execute on function public.accept_booking(bigint) to authenticated;
grant execute on function public.release_booking(bigint) to authenticated;
grant execute on function public.send_quote(bigint, numeric, text) to authenticated;
grant execute on function public.respond_quote(bigint, boolean, text) to authenticated;
grant execute on function public.complete_booking(bigint) to authenticated;
grant execute on function public.cancel_booking(bigint) to authenticated;
grant execute on function public.rate_booking(bigint, int, text) to authenticated;

-- Users edit their own profile, but can't change their role once set, or their rating.
create or replace function public.profiles_before_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if public.is_admin() or current_setting('eizi.booking_rpc', true) = 'on' then
    return new;
  end if;
  if old.role is not null and new.role is distinct from old.role then
    raise exception 'Your account type cannot be changed';
  end if;
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  if new.service_id is distinct from old.service_id and new.service_id is not null
     and not exists (select 1 from public.services where id = new.service_id and is_active) then
    raise exception 'Choose an available service category';
  end if;
  new.city := left(btrim(coalesce(new.city, '')), 80);
  return new;
end;
$$;

drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update
  before update on public.profiles
  for each row execute function public.profiles_before_update();

-- Access for the new tables
alter table public.service_tasks     enable row level security;
alter table public.provider_kyc      enable row level security;
alter table public.provider_presence enable row level security;

drop policy if exists "service tasks readable" on public.service_tasks;
create policy "service tasks readable" on public.service_tasks
  for select to anon, authenticated using (true);
drop policy if exists "admin full access" on public.service_tasks;
create policy "admin full access" on public.service_tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own cnic" on public.provider_kyc;
create policy "own cnic" on public.provider_kyc
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin full access" on public.provider_kyc;
create policy "admin full access" on public.provider_kyc
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own presence" on public.provider_presence;
create policy "own presence" on public.provider_presence
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

revoke all on public.service_tasks, public.provider_kyc, public.provider_presence from anon, authenticated;
grant select on public.service_tasks to anon, authenticated;
grant insert, update, delete on public.service_tasks to authenticated;            -- RLS: admins only
grant select, insert, update, delete on public.provider_kyc to authenticated;      -- RLS: own read, admins write
grant select on public.provider_presence to authenticated;                         -- RLS: own + admins; writes via set_availability()
