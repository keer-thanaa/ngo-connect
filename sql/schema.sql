-- ============================================================
-- NGO Connect — database schema
-- Run this once in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste → Run)
-- ============================================================

-- ---------- profiles ----------
-- One row per registered user: either an institution (orphanage /
-- old age home) or an NGO. approved=false until you review them
-- manually in Table Editor.
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             text not null check (role in ('institution','ngo')),
  name             text not null,
  institution_type text check (institution_type in ('orphanage','old_age_home')),
  location         text not null,
  contact_email    text not null,
  contact_phone    text,
  description      text,
  approved         boolean not null default false,
  last_claim_at    timestamptz,
  created_at       timestamptz not null default now()
);

alter table profiles enable row level security;

-- Public directory: anyone (even logged-out visitors) can see approved profiles
create policy "public can view approved profiles"
  on profiles for select
  using (approved = true);

-- Users can always see their own profile, even before approval
create policy "users can view own profile"
  on profiles for select
  using (auth.uid() = id);

-- Users can create their own profile once, at signup
create policy "users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Users can edit their own profile details (not their approval status —
-- approved is only ever changed by you, manually, in Table Editor)
create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and approved = (select approved from profiles where id = auth.uid()));


-- ---------- requirements ----------
-- Posted by institutions. NGOs claim them via the claim_requirement()
-- function below rather than direct UPDATE, so claiming logic can't
-- be tampered with from the browser.
create table requirements (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references profiles(id) on delete cascade,
  category       text not null,
  description    text not null,
  status         text not null default 'pending' check (status in ('pending','claimed','done')),
  claimed_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);

alter table requirements enable row level security;

-- Public can see requirements only from approved institutions
create policy "public can view requirements of approved institutions"
  on requirements for select
  using (
    exists (select 1 from profiles p where p.id = institution_id and p.approved = true)
  );

-- An approved institution can post requirements for itself
create policy "approved institution can insert own requirement"
  on requirements for insert
  with check (
    auth.uid() = institution_id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.approved = true and p.role = 'institution')
  );

-- An institution can edit/close its own requirement (e.g. mark done)
create policy "institution can update own requirement"
  on requirements for update
  using (auth.uid() = institution_id)
  with check (auth.uid() = institution_id);


-- ---------- claim_requirement() ----------
-- NGOs never get a direct UPDATE policy on requirements. Instead they
-- call this function, which checks the NGO is approved, enforces a
-- simple per-account cooldown (basic abuse/rate-limit protection),
-- and only lets a *pending* requirement be claimed (no overwriting
-- someone else's claim).
create or replace function claim_requirement(requirement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  is_approved_ngo boolean;
  last_claim timestamptz;
begin
  if caller_id is null then
    raise exception 'Sign in required';
  end if;

  select approved, last_claim_at into is_approved_ngo, last_claim
  from profiles
  where id = caller_id and role = 'ngo';

  if is_approved_ngo is not true then
    raise exception 'Only approved NGOs can claim requirements';
  end if;

  if last_claim is not null and now() - last_claim < interval '10 seconds' then
    raise exception 'Please wait a few seconds before claiming again';
  end if;

  update requirements
  set status = 'claimed', claimed_by = caller_id
  where id = requirement_id and status = 'pending';

  if not found then
    raise exception 'This requirement is no longer available';
  end if;

  update profiles set last_claim_at = now() where id = caller_id;
end;
$$;

revoke all on function claim_requirement(uuid) from public;
grant execute on function claim_requirement(uuid) to authenticated;
