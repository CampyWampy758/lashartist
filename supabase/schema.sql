-- The Liyelle Atelier — Supabase schema
-- Run this in the Supabase SQL Editor for your project.

-- Extensions
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  reference text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  service_id text not null,
  service_name text not null,
  service_price integer not null,
  deposit_percent integer not null default 50,
  deposit_amount integer not null,
  balance_due integer not null,
  promo_code_id uuid,
  promo_code text,
  discount_amount integer not null default 0,
  date date not null,
  time text not null,
  client_name text not null,
  phone text not null,
  email text default '',
  notes text default '',
  preferred_bank_id text,
  status text not null default 'pending_deposit'
    check (status in (
      'pending_deposit', 'deposit_submitted', 'approved',
      'rejected', 'expired', 'cancelled'
    )),
  deposit_proof text,
  admin_notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  deposit_submitted_at timestamptz,
  reviewed_at timestamptz,
  rescheduled_at timestamptz
);

create index if not exists bookings_user_id_idx on public.bookings (user_id);
create index if not exists bookings_date_time_idx on public.bookings (date, time);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_reference_idx on public.bookings (reference);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  type text not null check (type in (
    'booking_confirmed', 'booking_rescheduled', 'booking_declined',
    'booking_cancelled', 'deposit_received', 'booking_expired'
  )),
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_read_idx on public.notifications (user_id, read);

-- ---------------------------------------------------------------------------
-- Availability — weekly schedule (day_of_week: 0=Sun … 6=Sat)
-- ---------------------------------------------------------------------------
create table if not exists public.availability_slots (
  id uuid primary key default uuid_generate_v4(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  time_slot text not null,
  is_available boolean not null default true,
  unique (day_of_week, time_slot)
);

-- Blocked dates (holidays, closures)
create table if not exists public.blocked_dates (
  id uuid primary key default uuid_generate_v4(),
  date date not null unique,
  reason text default ''
);

-- Default weekly schedule (Tue–Sat, 6 slots)
insert into public.availability_slots (day_of_week, time_slot, is_available) values
  (0, '9:00 AM', false), (0, '10:30 AM', false), (0, '12:00 PM', false),
  (0, '1:30 PM', false), (0, '3:00 PM', false), (0, '4:30 PM', false),
  (1, '9:00 AM', false), (1, '10:30 AM', false), (1, '12:00 PM', false),
  (1, '1:30 PM', false), (1, '3:00 PM', false), (1, '4:30 PM', false),
  (2, '9:00 AM', true),  (2, '10:30 AM', true),  (2, '12:00 PM', true),
  (2, '1:30 PM', true),  (2, '3:00 PM', true),  (2, '4:30 PM', true),
  (3, '9:00 AM', true),  (3, '10:30 AM', true),  (3, '12:00 PM', true),
  (3, '1:30 PM', true),  (3, '3:00 PM', true),  (3, '4:30 PM', true),
  (4, '9:00 AM', true),  (4, '10:30 AM', true),  (4, '12:00 PM', true),
  (4, '1:30 PM', true),  (4, '3:00 PM', true),  (4, '4:30 PM', true),
  (5, '9:00 AM', true),  (5, '10:30 AM', true),  (5, '12:00 PM', true),
  (5, '1:30 PM', true),  (5, '3:00 PM', true),  (5, '4:30 PM', true),
  (6, '9:00 AM', true),  (6, '10:30 AM', true),  (6, '12:00 PM', true),
  (6, '1:30 PM', true),  (6, '3:00 PM', true),  (6, '4:30 PM', false)
on conflict (day_of_week, time_slot) do nothing;

-- ---------------------------------------------------------------------------
-- Promo codes
-- ---------------------------------------------------------------------------
create table if not exists public.promo_codes (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  description text default '',
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10, 2) not null,
  max_uses integer,
  use_count integer not null default 0,
  min_order_amount integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on public.promo_codes (upper(code));

alter table public.bookings
  drop constraint if exists bookings_promo_code_id_fkey;
alter table public.bookings
  add constraint bookings_promo_code_id_fkey
  foreign key (promo_code_id) references public.promo_codes (id) on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists promo_codes_updated_at on public.promo_codes;
create trigger promo_codes_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;
alter table public.availability_slots enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.promo_codes enable row level security;

-- Profiles: users read/update own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Bookings: users see own bookings; anyone can insert (guest booking)
create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = user_id);

create policy "Anyone can create bookings"
  on public.bookings for insert
  with check (true);

-- Notifications: users see own only
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Availability & blocked dates: public read
create policy "Anyone can read availability"
  on public.availability_slots for select
  using (true);

create policy "Anyone can read blocked dates"
  on public.blocked_dates for select
  using (true);

-- Promo codes: public can read active promos (validation done server-side)
create policy "Anyone can read active promos"
  on public.promo_codes for select
  using (is_active = true);

-- Service role bypasses RLS — the Express API uses SUPABASE_SERVICE_ROLE_KEY.
