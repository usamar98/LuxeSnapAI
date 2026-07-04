create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  stripe_customer_id text unique,
  credits integer not null default 8 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'analyzing', 'generating', 'completed', 'failed')),
  scene text not null,
  style text not null,
  aspect_ratio text not null default '1:1',
  prompt text,
  final_prompt text,
  source_path text,
  output_path text,
  output_url text,
  fal_request_id text,
  error text,
  cost_cents integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.generation_jobs(id) on delete set null,
  stripe_checkout_session_id text,
  type text not null check (type in ('grant', 'purchase', 'usage', 'refund')),
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create unique index if not exists credit_ledger_checkout_session_idx
  on public.credit_ledger (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id);
create index if not exists generation_jobs_user_created_idx on public.generation_jobs (user_id, created_at desc);
create index if not exists generation_jobs_user_status_idx on public.generation_jobs (user_id, status);
create index if not exists credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);
create index if not exists credit_ledger_job_id_idx on public.credit_ledger (job_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists generation_jobs_set_updated_at on public.generation_jobs;
create trigger generation_jobs_set_updated_at
before update on public.generation_jobs
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.consume_credit_for_generation(
  p_user_id uuid,
  p_job_id uuid,
  p_description text,
  p_cost integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  new_balance integer;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'Unauthorized credit consumption' using errcode = '42501';
  end if;

  if p_cost <= 0 then
    raise exception 'Credit cost must be positive';
  end if;

  select credits
  into current_balance
  from public.profiles
  where id = p_user_id
  for update;

  if current_balance is null then
    raise exception 'Profile not found';
  end if;

  if current_balance < p_cost then
    raise exception 'Insufficient credits';
  end if;

  new_balance := current_balance - p_cost;

  update public.profiles
  set credits = new_balance
  where id = p_user_id;

  insert into public.credit_ledger (
    user_id,
    job_id,
    type,
    amount,
    balance_after,
    description
  )
  values (
    p_user_id,
    p_job_id,
    'usage',
    -p_cost,
    new_balance,
    p_description
  );

  return new_balance;
end;
$$;

create or replace function public.refund_credit_for_failed_generation(
  p_user_id uuid,
  p_job_id uuid,
  p_description text,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Refund amount must be positive';
  end if;

  if exists (
    select 1
    from public.credit_ledger
    where user_id = p_user_id
      and job_id = p_job_id
      and type = 'refund'
  ) then
    select credits into new_balance from public.profiles where id = p_user_id;
    return coalesce(new_balance, 0);
  end if;

  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id
  returning credits into new_balance;

  insert into public.credit_ledger (
    user_id,
    job_id,
    type,
    amount,
    balance_after,
    description
  )
  values (
    p_user_id,
    p_job_id,
    'refund',
    p_amount,
    new_balance,
    p_description
  );

  return new_balance;
end;
$$;

create or replace function public.grant_purchased_credits(
  p_user_id uuid,
  p_session_id text,
  p_amount integer,
  p_description text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Credit grant must be positive';
  end if;

  if exists (select 1 from public.stripe_events where id = p_event_id) then
    select credits into new_balance from public.profiles where id = p_user_id;
    return coalesce(new_balance, 0);
  end if;

  insert into public.stripe_events (id, type, payload)
  values (p_event_id, p_event_type, p_payload);

  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id
  returning credits into new_balance;

  insert into public.credit_ledger (
    user_id,
    stripe_checkout_session_id,
    type,
    amount,
    balance_after,
    description
  )
  values (
    p_user_id,
    p_session_id,
    'purchase',
    p_amount,
    new_balance,
    p_description
  )
  on conflict (stripe_checkout_session_id) do nothing;

  return new_balance;
end;
$$;

alter table public.profiles enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.stripe_events enable row level security;

alter table public.profiles force row level security;
alter table public.generation_jobs force row level security;
alter table public.credit_ledger force row level security;
alter table public.stripe_events force row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Profiles are editable by owner" on public.profiles;
create policy "Profiles are editable by owner"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Jobs are readable by owner" on public.generation_jobs;
create policy "Jobs are readable by owner"
on public.generation_jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Jobs are insertable by owner" on public.generation_jobs;
create policy "Jobs are insertable by owner"
on public.generation_jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Jobs are editable by owner" on public.generation_jobs;
create policy "Jobs are editable by owner"
on public.generation_jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Ledger is readable by owner" on public.credit_ledger;
create policy "Ledger is readable by owner"
on public.credit_ledger
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on function public.refund_credit_for_failed_generation(uuid, uuid, text, integer) from public;
revoke all on function public.grant_purchased_credits(uuid, text, integer, text, text, text, jsonb) from public;
grant execute on function public.consume_credit_for_generation(uuid, uuid, text, integer) to authenticated;
grant execute on function public.refund_credit_for_failed_generation(uuid, uuid, text, integer) to service_role;
grant execute on function public.grant_purchased_credits(uuid, text, integer, text, text, text, jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'selfies',
  'selfies',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'outputs',
  'outputs',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own selfies" on storage.objects;
create policy "Users can read own selfies"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'selfies'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can upload own selfies" on storage.objects;
create policy "Users can upload own selfies"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'selfies'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can read own outputs" on storage.objects;
create policy "Users can read own outputs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'outputs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can upload own outputs" on storage.objects;
create policy "Users can upload own outputs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'outputs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
