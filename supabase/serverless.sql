-- Run after schema.sql — removes need for Express/Render.
-- Enables direct client → Supabase for all app features.

-- ---------------------------------------------------------------------------
-- Helpers (must exist before RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.time_slots()
returns text[]
language sql
immutable
as $$
  select array['9:00 AM', '10:30 AM', '12:00 PM', '1:30 PM', '3:00 PM', '4:30 PM']::text[];
$$;

create or replace function public.active_booking_statuses()
returns text[]
language sql
immutable
as $$
  select array['pending_deposit', 'deposit_submitted', 'approved']::text[];
$$;

-- ---------------------------------------------------------------------------
-- Config tables
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id text primary key,
  name text not null,
  tagline text default '',
  description text default '',
  duration text default '',
  price integer not null,
  vibe text default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.studio_settings (
  id integer primary key default 1 check (id = 1),
  deposit_percent integer not null default 50,
  deposit_hold_hours integer not null default 24,
  currency text not null default 'EC$',
  studio_name text not null default 'The Liyelle Atelier',
  studio_type text not null default 'Salon Studio',
  whatsapp text default '',
  instagram text default '',
  email text default '',
  address text default 'Vieux-Fort, Saint Lucia',
  hours text default 'Tue–Sat · 9:00 AM – 6:00 PM'
);

insert into public.studio_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.bank_accounts (
  id text primary key,
  name text not null,
  short_name text not null,
  account_name text not null default 'The Liyelle Atelier',
  account_number text default '',
  branch text default '',
  sort_order integer not null default 0
);

insert into public.services (id, name, tagline, description, duration, price, vibe, sort_order) values
  ('classic', 'Classic Set', 'Soft, natural definition', 'One extension per natural lash for an effortless, everyday elegance.', '2 hrs', 180, 'soft-glam', 1),
  ('hybrid', 'Hybrid Set', 'Soft glam with dimension', 'A blend of classic and volume fans for textured, fluttery fullness.', '2.5 hrs', 210, 'soft-glam', 2),
  ('volume', 'Volume Set', 'Full, fluffy drama', 'Lightweight handmade fans for dense, camera-ready lashes.', '3 hrs', 250, 'high-fashion', 3),
  ('mega-volume', 'Mega Volume', 'Editorial impact', 'Ultra-dense fans for maximum drama — red carpet, runway, statement.', '3.5 hrs', 290, 'high-fashion', 4),
  ('fill-2wk', '2-Week Fill', 'Maintain your set', 'Refresh for clients with 50%+ retention within 14 days.', '1.5 hrs', 90, 'soft-glam', 5),
  ('fill-3wk', '3-Week Fill', 'Extended maintenance', 'Full refresh for sets between 15–21 days.', '2 hrs', 110, 'soft-glam', 6),
  ('removal', 'Lash Removal', 'Safe, gentle take-off', 'Professional removal with nourishing aftercare.', '30 min', 45, 'soft-glam', 7),
  ('lash-lift', 'Lash Lift & Tint', 'No extensions needed', 'Lift and curl your natural lashes for a wide-eyed look.', '1 hr', 130, 'high-fashion', 8)
on conflict (id) do nothing;

insert into public.bank_accounts (id, name, short_name, sort_order) values
  ('bosl', 'Bank of Saint Lucia (BOSL)', 'BOSL', 1),
  ('cibc', 'CIBC FirstCaribbean', 'CIBC', 2),
  ('1st-national', '1st National Bank', '1st National', 3),
  ('republic', 'Republic Bank', 'Republic', 4)
on conflict (id) do nothing;

alter table public.services enable row level security;
alter table public.studio_settings enable row level security;
alter table public.bank_accounts enable row level security;

create policy "Anyone can read active services"
  on public.services for select using (is_active = true);

create policy "Anyone can read studio settings"
  on public.studio_settings for select using (true);

create policy "Anyone can read bank accounts"
  on public.bank_accounts for select using (true);

create policy "Admins manage services"
  on public.services for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage studio settings"
  on public.studio_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage bank accounts"
  on public.bank_accounts for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin + public RLS policies
-- ---------------------------------------------------------------------------
create policy "Anyone can view booking by id"
  on public.bookings for select
  using (true);

create policy "Admins manage all bookings"
  on public.bookings for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage availability slots"
  on public.availability_slots for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage blocked dates"
  on public.blocked_dates for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage promo codes"
  on public.promo_codes for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins view all profiles"
  on public.profiles for select
  using (public.is_admin() or auth.uid() = id);

create policy "Admins update profiles"
  on public.profiles for update
  using (public.is_admin());

create policy "Service can insert notifications"
  on public.notifications for insert
  with check (true);

-- ---------------------------------------------------------------------------
-- Storage policies (deposit proofs)
-- ---------------------------------------------------------------------------
create policy "Upload deposit proof for eligible booking"
  on storage.objects for insert
  with check (
    bucket_id = 'deposit-proofs'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.bookings b
      where b.status in ('pending_deposit', 'deposit_submitted')
    )
  );

create policy "Admin read deposit proofs"
  on storage.objects for select
  using (bucket_id = 'deposit-proofs' and public.is_admin());

create policy "Public read own booking deposit proof path"
  on storage.objects for select
  using (bucket_id = 'deposit-proofs');

-- ---------------------------------------------------------------------------
-- expire_stale_bookings
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_bookings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set status = 'expired', updated_at = now()
  where status = 'pending_deposit'
    and expires_at is not null
    and expires_at < now();
end;
$$;

-- ---------------------------------------------------------------------------
-- get_availability_for_date
-- ---------------------------------------------------------------------------
create or replace function public.get_availability_for_date(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dow smallint;
  v_blocked boolean;
  v_booked text[];
  v_slots jsonb := '[]'::jsonb;
  v_time text;
  v_admin_available boolean;
begin
  perform public.expire_stale_bookings();

  if p_date is null then
    raise exception 'Date is required.';
  end if;

  v_dow := extract(dow from p_date)::smallint;

  select exists(select 1 from public.blocked_dates where date = p_date) into v_blocked;

  select coalesce(array_agg(time), array[]::text[])
  into v_booked
  from public.bookings
  where date = p_date
    and status = any(public.active_booking_statuses());

  foreach v_time in array public.time_slots() loop
    if v_blocked then
      v_admin_available := false;
    else
      select coalesce(
        (select is_available from public.availability_slots
         where day_of_week = v_dow and time_slot = v_time),
        v_dow between 2 and 6
      ) into v_admin_available;
    end if;

    v_slots := v_slots || jsonb_build_object(
      'time', v_time,
      'available', v_admin_available and not (v_time = any(v_booked))
    );
  end loop;

  return jsonb_build_object(
    'date', p_date,
    'slots', v_slots,
    'timeSlots', to_jsonb(public.time_slots())
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- validate_promo_code
-- ---------------------------------------------------------------------------
create or replace function public.validate_promo_code(p_code text, p_service_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_price integer;
  v_discount integer;
begin
  select price into v_price from public.services where id = p_service_id and is_active;
  if v_price is null then
    return jsonb_build_object('valid', false, 'error', 'Invalid service selected.');
  end if;

  select * into v_promo
  from public.promo_codes
  where upper(code) = upper(trim(p_code))
  limit 1;

  if v_promo.id is null then
    return jsonb_build_object('valid', false, 'error', 'Invalid promo code.');
  end if;
  if not v_promo.is_active then
    return jsonb_build_object('valid', false, 'error', 'This promo code is inactive.');
  end if;
  if v_promo.expires_at is not null and v_promo.expires_at < now() then
    return jsonb_build_object('valid', false, 'error', 'This promo code has expired.');
  end if;
  if v_promo.max_uses is not null and v_promo.use_count >= v_promo.max_uses then
    return jsonb_build_object('valid', false, 'error', 'This promo code has reached its usage limit.');
  end if;
  if v_price < v_promo.min_order_amount then
    return jsonb_build_object(
      'valid', false,
      'error', format('Minimum order of EC$%s required for this code.', v_promo.min_order_amount)
    );
  end if;

  if v_promo.discount_type = 'percent' then
    v_discount := least(v_price, round(v_price * (v_promo.discount_value / 100))::integer);
  else
    v_discount := least(v_price, round(v_promo.discount_value)::integer);
  end if;

  return jsonb_build_object(
    'valid', true,
    'promoCode', v_promo.code,
    'promoCodeId', v_promo.id,
    'discountAmount', v_discount,
    'finalPrice', v_price - v_discount
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- create_booking
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_service_id text,
  p_date date,
  p_time text,
  p_client_name text,
  p_phone text,
  p_email text default '',
  p_notes text default '',
  p_preferred_bank_id text default null,
  p_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_settings public.studio_settings%rowtype;
  v_user_id uuid;
  v_price integer;
  v_discount integer := 0;
  v_promo_id uuid;
  v_applied_code text;
  v_promo public.promo_codes%rowtype;
  v_deposit integer;
  v_reference text;
  v_hold interval;
  v_dow smallint;
  v_admin_available boolean;
  v_booking public.bookings%rowtype;
begin
  perform public.expire_stale_bookings();

  v_user_id := auth.uid();

  if p_service_id is null or p_date is null or p_time is null
     or trim(p_client_name) = '' or trim(p_phone) = '' then
    raise exception 'Service, date, time, name, and phone are required.';
  end if;

  if not (p_time = any(public.time_slots())) then
    raise exception 'Invalid time slot selected.';
  end if;

  select * into v_service from public.services where id = p_service_id and is_active;
  if v_service.id is null then
    raise exception 'Invalid service selected.';
  end if;

  if p_preferred_bank_id is not null and not exists (
    select 1 from public.bank_accounts where id = p_preferred_bank_id
  ) then
    raise exception 'Invalid bank selected.';
  end if;

  select * into v_settings from public.studio_settings where id = 1;

  v_dow := extract(dow from p_date)::smallint;

  if exists (select 1 from public.blocked_dates where date = p_date) then
    raise exception 'That time slot is not available. Please choose another.';
  end if;

  select coalesce(
    (select is_available from public.availability_slots
     where day_of_week = v_dow and time_slot = p_time),
    v_dow between 2 and 6
  ) into v_admin_available;

  if not v_admin_available then
    raise exception 'That time slot is not available. Please choose another.';
  end if;

  if exists (
    select 1 from public.bookings
    where date = p_date and time = p_time
      and status = any(public.active_booking_statuses())
  ) then
    raise exception 'That time slot is no longer available. Please choose another.';
  end if;

  v_price := v_service.price;

  if p_promo_code is not null and trim(p_promo_code) <> '' then
    select * into v_promo
    from public.promo_codes
    where upper(code) = upper(trim(p_promo_code))
    limit 1;

    if v_promo.id is null then raise exception 'Invalid promo code.'; end if;
    if not v_promo.is_active then raise exception 'This promo code is inactive.'; end if;
    if v_promo.expires_at is not null and v_promo.expires_at < now() then
      raise exception 'This promo code has expired.';
    end if;
    if v_promo.max_uses is not null and v_promo.use_count >= v_promo.max_uses then
      raise exception 'This promo code has reached its usage limit.';
    end if;
    if v_price < v_promo.min_order_amount then
      raise exception '%', format('Minimum order of EC$%s required for this code.', v_promo.min_order_amount);
    end if;

    if v_promo.discount_type = 'percent' then
      v_discount := least(v_price, round(v_price * (v_promo.discount_value / 100))::integer);
    else
      v_discount := least(v_price, round(v_promo.discount_value)::integer);
    end if;

    v_price := v_price - v_discount;
    v_promo_id := v_promo.id;
    v_applied_code := v_promo.code;
  end if;

  v_deposit := round(v_price * (v_settings.deposit_percent / 100.0))::integer;
  v_reference := 'LIYELLE-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8));
  v_hold := (v_settings.deposit_hold_hours || ' hours')::interval;

  insert into public.bookings (
    reference, user_id, service_id, service_name, service_price,
    deposit_percent, deposit_amount, balance_due,
    promo_code_id, promo_code, discount_amount,
    date, time, client_name, phone, email, notes, preferred_bank_id,
    status, expires_at
  ) values (
    v_reference, v_user_id, v_service.id, v_service.name, v_price,
    v_settings.deposit_percent, v_deposit, v_price - v_deposit,
    v_promo_id, v_applied_code, v_discount,
    p_date, p_time, trim(p_client_name), trim(p_phone),
    coalesce(trim(p_email), ''), coalesce(trim(p_notes), ''), p_preferred_bank_id,
    'pending_deposit', now() + v_hold
  )
  returning * into v_booking;

  if v_promo_id is not null then
    update public.promo_codes set use_count = use_count + 1 where id = v_promo_id;
  end if;

  return to_jsonb(v_booking);
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_deposit_proof
-- ---------------------------------------------------------------------------
create or replace function public.submit_deposit_proof(
  p_booking_id uuid,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  perform public.expire_stale_bookings();

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status not in ('pending_deposit', 'deposit_submitted') then
    raise exception 'Deposit cannot be submitted for this booking.';
  end if;

  if v_booking.status = 'pending_deposit' and v_booking.expires_at < now() then
    update public.bookings set status = 'expired', updated_at = now() where id = p_booking_id;
    raise exception 'Booking hold has expired. Please book again.';
  end if;

  update public.bookings
  set
    status = 'deposit_submitted',
    deposit_proof = p_storage_path,
    deposit_submitted_at = now(),
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return to_jsonb(v_booking);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_update_booking
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_booking(
  p_booking_id uuid,
  p_status text default null,
  p_admin_notes text default null,
  p_date date default null,
  p_time text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_new_date date;
  v_new_time text;
  v_dow smallint;
  v_admin_available boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  perform public.expire_stale_bookings();

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  v_new_date := coalesce(p_date, v_booking.date);
  v_new_time := coalesce(p_time, v_booking.time);

  if p_status is not null then
    if p_status not in ('approved', 'rejected', 'cancelled') then
      raise exception 'Status must be approved, rejected, or cancelled.';
    end if;
    if p_status = 'approved' and v_booking.status <> 'deposit_submitted' then
      raise exception 'Only bookings with submitted deposits can be approved.';
    end if;
  end if;

  if p_date is not null or p_time is not null then
    if v_new_date is null or v_new_time is null then
      raise exception 'Both date and time are required to reschedule.';
    end if;
    if not (v_new_time = any(public.time_slots())) then
      raise exception 'Invalid time slot.';
    end if;

    v_dow := extract(dow from v_new_date)::smallint;

    if exists (select 1 from public.blocked_dates where date = v_new_date) then
      raise exception 'That time slot is not available on the admin schedule.';
    end if;

    select coalesce(
      (select is_available from public.availability_slots
       where day_of_week = v_dow and time_slot = v_new_time),
      v_dow between 2 and 6
    ) into v_admin_available;

    if not v_admin_available then
      raise exception 'That time slot is not available on the admin schedule.';
    end if;

    if exists (
      select 1 from public.bookings
      where date = v_new_date and time = v_new_time
        and status = any(public.active_booking_statuses())
        and id <> p_booking_id
    ) then
      raise exception 'That time slot is already booked.';
    end if;
  end if;

  update public.bookings
  set
    status = coalesce(p_status, status),
    admin_notes = case when p_admin_notes is not null then trim(p_admin_notes) else admin_notes end,
    date = v_new_date,
    time = v_new_time,
    reviewed_at = case when p_status is not null then now() else reviewed_at end,
    rescheduled_at = case when p_date is not null or p_time is not null then now() else rescheduled_at end,
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return to_jsonb(v_booking);
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking status → in-app notifications
-- ---------------------------------------------------------------------------
create or replace function public.notify_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_title text;
  v_message text;
begin
  if new.user_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = old.status and new.date = old.date and new.time = old.time then
      return new;
    end if;

    if new.status = 'approved' and old.status is distinct from 'approved' then
      v_type := 'booking_confirmed';
      v_title := 'Appointment confirmed';
      v_message := format('Your %s on %s at %s is confirmed. See you at the studio!', new.service_name, new.date, new.time);
    elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
      v_type := 'booking_declined';
      v_title := 'Booking declined';
      v_message := format('Your booking (%s) was declined. Contact us on WhatsApp if you have questions.', new.reference);
    elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      v_type := 'booking_cancelled';
      v_title := 'Booking cancelled';
      v_message := format('Your booking (%s) for %s has been cancelled.', new.reference, new.date);
    elsif new.status = 'deposit_submitted' and old.status = 'pending_deposit' then
      v_type := 'deposit_received';
      v_title := 'Deposit received';
      v_message := format('We received your deposit for %s. Awaiting admin approval.', new.reference);
    elsif new.status = 'expired' and old.status is distinct from 'expired' then
      v_type := 'booking_expired';
      v_title := 'Booking expired';
      v_message := format('Your hold on %s at %s expired. Book again to reserve a new slot.', new.date, new.time);
    elsif (new.date <> old.date or new.time <> old.time) and new.status = old.status then
      v_type := 'booking_rescheduled';
      v_title := 'Appointment rescheduled';
      v_message := format('Your appointment has been moved to %s at %s.', new.date, new.time);
    else
      return new;
    end if;

    insert into public.notifications (user_id, booking_id, type, title, message)
    values (new.user_id, new.id, v_type, v_title, v_message);
  end if;

  return new;
end;
$$;

drop trigger if exists booking_notify on public.bookings;
create trigger booking_notify
  after update on public.bookings
  for each row execute function public.notify_booking_change();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant execute on function public.expire_stale_bookings() to anon, authenticated;
grant execute on function public.get_availability_for_date(date) to anon, authenticated;
grant execute on function public.validate_promo_code(text, text) to anon, authenticated;
grant execute on function public.create_booking(text, date, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.submit_deposit_proof(uuid, text) to anon, authenticated;
grant execute on function public.admin_update_booking(uuid, text, text, date, text) to authenticated;

grant select on public.services to anon, authenticated;
grant select on public.studio_settings to anon, authenticated;
grant select on public.bank_accounts to anon, authenticated;
