create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  phone_or_identifier text,
  memo text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  movement_type text not null default 'bodyweight_squat',
  selected_view text not null check (selected_view in ('front', 'side', 'rear')),
  status text not null default 'draft' check (status in ('draft', 'analyzed', 'tests_added', 'report_ready', 'shared')),
  recorded_at timestamptz not null default timezone('utc', now()),
  overall_summary text not null default '',
  trainer_note text not null default '',
  analysis_version text not null default 'mvp-rule-engine-v1',
  summary_draft_json jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.video_analysis_results (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  rep_count_estimate integer not null default 0,
  analysis_quality text not null default 'poor' check (analysis_quality in ('good', 'fair', 'poor')),
  metrics_json jsonb not null,
  raw_landmark_summary_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  code text not null,
  label_ko text not null,
  category text not null check (category in ('observation', 'hypothesis')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  description_ko text not null,
  rationale_ko text not null,
  source_view text not null check (source_view in ('front', 'side', 'rear')),
  is_hidden_by_trainer boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.recommended_tests (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_code text not null,
  test_name_ko text not null,
  priority_order integer not null,
  reason_ko text not null,
  status text not null default 'recommended' check (status in ('recommended', 'skipped', 'completed')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  test_code text not null,
  test_name_ko text not null,
  side text not null check (side in ('left', 'right', 'bilateral', 'none')),
  result_label text not null default '',
  result_value_json jsonb not null default '{}'::jsonb,
  memo text not null default '',
  performed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  share_token text not null unique,
  is_active boolean not null default true,
  expires_at timestamptz,
  report_snapshot_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_clients_trainer_id on public.clients (trainer_id);
create index if not exists idx_assessment_sessions_trainer_id on public.assessment_sessions (trainer_id);
create index if not exists idx_assessment_sessions_client_id on public.assessment_sessions (client_id);
create index if not exists idx_video_analysis_results_session_id on public.video_analysis_results (assessment_session_id);
create index if not exists idx_findings_session_id on public.findings (assessment_session_id);
create index if not exists idx_recommended_tests_session_id on public.recommended_tests (assessment_session_id);
create index if not exists idx_test_results_session_id on public.test_results (assessment_session_id);
create index if not exists idx_reports_session_id on public.reports (assessment_session_id);
create index if not exists idx_reports_share_token on public.reports (share_token);

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_sessions_updated_at on public.assessment_sessions;
create trigger set_assessment_sessions_updated_at
before update on public.assessment_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists set_test_results_updated_at on public.test_results;
create trigger set_test_results_updated_at
before update on public.test_results
for each row
execute function public.set_updated_at();

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
before update on public.reports
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.video_analysis_results enable row level security;
alter table public.findings enable row level security;
alter table public.recommended_tests enable row level security;
alter table public.test_results enable row level security;
alter table public.reports enable row level security;

drop policy if exists "users_select_self" on public.users;
create policy "users_select_self"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self"
on public.users
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "clients_manage_own" on public.clients;
create policy "clients_manage_own"
on public.clients
for all
to authenticated
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());

drop policy if exists "sessions_manage_own" on public.assessment_sessions;
create policy "sessions_manage_own"
on public.assessment_sessions
for all
to authenticated
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());

drop policy if exists "analysis_manage_own" on public.video_analysis_results;
create policy "analysis_manage_own"
on public.video_analysis_results
for all
to authenticated
using (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
);

drop policy if exists "findings_manage_own" on public.findings;
create policy "findings_manage_own"
on public.findings
for all
to authenticated
using (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
);

drop policy if exists "recommended_tests_manage_own" on public.recommended_tests;
create policy "recommended_tests_manage_own"
on public.recommended_tests
for all
to authenticated
using (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
);

drop policy if exists "test_results_manage_own" on public.test_results;
create policy "test_results_manage_own"
on public.test_results
for all
to authenticated
using (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
);

drop policy if exists "reports_manage_own" on public.reports;
create policy "reports_manage_own"
on public.reports
for all
to authenticated
using (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assessment_sessions session
    where session.id = assessment_session_id
      and session.trainer_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.assessment_sessions to authenticated;
grant select, insert, update, delete on public.video_analysis_results to authenticated;
grant select, insert, update, delete on public.findings to authenticated;
grant select, insert, update, delete on public.recommended_tests to authenticated;
grant select, insert, update, delete on public.test_results to authenticated;
grant select, insert, update, delete on public.reports to authenticated;

create or replace function public.get_public_report(p_share_token text)
returns setof public.reports
language sql
security definer
set search_path = public
as $$
  select *
  from public.reports
  where share_token = p_share_token
    and is_active = true
    and (expires_at is null or expires_at > timezone('utc', now()))
  order by created_at desc
  limit 1;
$$;

revoke all on function public.get_public_report(text) from public;
grant execute on function public.get_public_report(text) to anon, authenticated;
