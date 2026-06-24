-- Venture Radar MVP schema for Supabase Postgres.
-- RLS is enabled on every public table. Policies below assume a single authenticated
-- analyst workspace. Replace with owner/team-scoped policies before multi-tenant use.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  source_uid text,
  name text not null,
  website_url text,
  source_url text,
  source_name text,
  discovered_at timestamptz not null default now(),
  launch_date date,
  domain text not null,
  subdomain text,
  description text,
  product_summary text,
  business_model text,
  target_customer text,
  pricing text,
  geography text,
  stage text,
  funding_status text,
  founders jsonb not null default '[]'::jsonb,
  founder_background_summary text,
  technical_summary text,
  traction_summary text,
  competitors jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  score_inputs jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  traction_signals jsonb not null default '[]'::jsonb,
  pros jsonb not null default '[]'::jsonb,
  cons jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  diligence_questions jsonb not null default '[]'::jsonb,
  raw_candidate jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies add column if not exists source_uid text;
alter table public.companies add column if not exists score_inputs jsonb not null default '{}'::jsonb;
alter table public.companies add column if not exists evidence jsonb not null default '{}'::jsonb;
alter table public.companies add column if not exists traction_signals jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists pros jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists cons jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists risk_flags jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists diligence_questions jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists raw_candidate jsonb not null default '{}'::jsonb;

create table if not exists public.company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  raw_text text,
  extracted_text text,
  fetched_at timestamptz not null default now(),
  reliability_score numeric(4, 3) not null default 0.700 check (reliability_score >= 0 and reliability_score <= 1)
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  base_url text,
  enabled boolean not null default true,
  default_reliability_score numeric(4, 3) not null default 0.700 check (default_reliability_score >= 0 and default_reliability_score <= 1),
  extraction_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  role text,
  background text,
  prior_companies jsonb not null default '[]'::jsonb,
  university_links jsonb not null default '[]'::jsonb,
  linkedin_url text,
  github_url text,
  source_links jsonb not null default '[]'::jsonb,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.enrichment_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  event_type text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  extraction_method text,
  source_url text,
  raw_text text,
  structured_payload jsonb not null default '{}'::jsonb,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.company_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  founder_score integer not null check (founder_score between 0 and 100),
  market_score integer not null check (market_score between 0 and 100),
  product_score integer not null check (product_score between 0 and 100),
  traction_score integer not null check (traction_score between 0 and 100),
  defensibility_score integer not null check (defensibility_score between 0 and 100),
  timing_score integer not null check (timing_score between 0 and 100),
  risk_score integer not null check (risk_score between 0 and 100),
  overall_score integer not null check (overall_score between 0 and 100),
  explanation jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.startup_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  founder_quality integer check (founder_quality between 0 and 100),
  technical_differentiation integer check (technical_differentiation between 0 and 100),
  market_size integer check (market_size between 0 and 100),
  market_timing integer check (market_timing between 0 and 100),
  product_clarity integer check (product_clarity between 0 and 100),
  traction integer check (traction between 0 and 100),
  distribution_potential integer check (distribution_potential between 0 and 100),
  competitive_intensity integer check (competitive_intensity between 0 and 100),
  defensibility integer check (defensibility between 0 and 100),
  regulatory_risk integer check (regulatory_risk between 0 and 100),
  capital_intensity integer check (capital_intensity between 0 and 100),
  fundability integer check (fundability between 0 and 100),
  exit_potential integer check (exit_potential between 0 and 100),
  overall_investment_attractiveness integer check (overall_investment_attractiveness between 0 and 100),
  explanations jsonb not null default '{}'::jsonb,
  supporting_evidence jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  diligence_questions jsonb not null default '[]'::jsonb,
  confidence_level text check (confidence_level in ('Low', 'Medium', 'High')),
  created_at timestamptz not null default now()
);

create table if not exists public.score_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  score_type text not null,
  previous_score jsonb,
  new_score jsonb not null,
  changed_by text,
  change_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.company_risks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  risk_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  explanation text not null,
  evidence_url text
);

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  market_context text,
  momentum_score integer not null default 0 check (momentum_score between 0 and 100),
  competition_level text check (competition_level in ('Low', 'Medium', 'High')),
  investor_interest_score integer not null default 0 check (investor_interest_score between 0 and 100),
  regulatory_risk text check (regulatory_risk in ('Low', 'Medium', 'High')),
  created_at timestamptz not null default now()
);

create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('VC', 'angel', 'accelerator', 'corporate venture', 'university fund', 'strategic investor')),
  website_url text,
  thesis text not null,
  stages jsonb not null default '[]'::jsonb,
  domains jsonb not null default '[]'::jsonb,
  geography jsonb not null default '[]'::jsonb,
  notable_investments jsonb not null default '[]'::jsonb,
  partner_names jsonb not null default '[]'::jsonb,
  contact_url text,
  relevance_notes text
);

create table if not exists public.vc_firms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website_url text,
  contact_url text,
  type text not null default 'VC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vc_profiles (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.vc_firms(id) on delete cascade,
  sector_focus jsonb not null default '[]'::jsonb,
  stage_focus jsonb not null default '[]'::jsonb,
  geography jsonb not null default '[]'::jsonb,
  check_size_estimate text,
  historical_investments jsonb not null default '[]'::jsonb,
  partner_interests jsonb not null default '[]'::jsonb,
  public_thesis_language text,
  typical_founder_profile text,
  business_model_preference jsonb not null default '[]'::jsonb,
  risk_tolerance text,
  technical_depth_preference text,
  examples_fit jsonb not null default '[]'::jsonb,
  examples_not_fit jsonb not null default '[]'::jsonb,
  source_links jsonb not null default '[]'::jsonb,
  editable_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investor_matches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  investor_id uuid not null references public.investors(id) on delete cascade,
  match_score integer not null check (match_score between 0 and 100),
  reasoning text not null,
  suggested_angle text,
  created_at timestamptz not null default now(),
  unique(company_id, investor_id)
);

create table if not exists public.vc_fit_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  firm_id uuid not null references public.vc_firms(id) on delete cascade,
  vc_fit_score integer not null check (vc_fit_score between 0 and 100),
  component_scores jsonb not null default '{}'::jsonb,
  reasoning text not null,
  relevant_partners jsonb not null default '[]'::jsonb,
  why_this_firm_might_care text,
  why_this_firm_might_pass text,
  suggested_angle text,
  best_contact_target text,
  confidence_level text check (confidence_level in ('Low', 'Medium', 'High')),
  created_at timestamptz not null default now(),
  unique(company_id, firm_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  report_type text not null,
  period_start date,
  period_end date,
  content_markdown text not null,
  content_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  memo_type text not null,
  content_markdown text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete set null,
  proposal_type text not null,
  subject text not null,
  body_markdown text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  firm_id uuid references public.vc_firms(id) on delete set null,
  audience text not null check (audience in ('investor', 'founder')),
  channel text not null check (channel in ('linkedin_dm', 'email', 'memo_note')),
  subject text,
  body text not null,
  tone text not null default 'direct_analytical',
  created_at timestamptz not null default now()
);

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null check (status in ('watch', 'pass', 'reach_out', 'high_priority')),
  rationale text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id)
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  logs jsonb not null default '[]'::jsonb,
  error text
);

create index if not exists companies_domain_idx on public.companies(domain);
create index if not exists companies_discovered_at_idx on public.companies(discovered_at desc);
create unique index if not exists companies_source_uid_unique_idx on public.companies(source_uid);
create index if not exists founders_company_id_idx on public.founders(company_id);
create index if not exists enrichment_events_company_id_created_at_idx on public.enrichment_events(company_id, created_at desc);
create index if not exists company_scores_company_id_created_at_idx on public.company_scores(company_id, created_at desc);
create index if not exists startup_scores_company_id_created_at_idx on public.startup_scores(company_id, created_at desc);
create index if not exists score_history_company_id_created_at_idx on public.score_history(company_id, created_at desc);
create index if not exists company_risks_company_id_idx on public.company_risks(company_id);
create index if not exists vc_profiles_firm_id_idx on public.vc_profiles(firm_id);
create index if not exists investor_matches_company_id_score_idx on public.investor_matches(company_id, match_score desc);
create index if not exists vc_fit_scores_company_id_score_idx on public.vc_fit_scores(company_id, vc_fit_score desc);
create index if not exists vc_fit_scores_firm_id_score_idx on public.vc_fit_scores(firm_id, vc_fit_score desc);
create index if not exists reports_type_period_idx on public.reports(report_type, period_start desc, period_end desc);
create index if not exists memos_company_id_created_at_idx on public.memos(company_id, created_at desc);
create index if not exists proposals_company_id_created_at_idx on public.proposals(company_id, created_at desc);
create index if not exists outreach_drafts_company_id_created_at_idx on public.outreach_drafts(company_id, created_at desc);
create index if not exists watchlist_status_created_at_idx on public.watchlist(status, created_at desc);
create index if not exists jobs_type_status_idx on public.jobs(job_type, status);

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.company_sources enable row level security;
alter table public.sources enable row level security;
alter table public.founders enable row level security;
alter table public.enrichment_events enable row level security;
alter table public.company_scores enable row level security;
alter table public.startup_scores enable row level security;
alter table public.score_history enable row level security;
alter table public.company_risks enable row level security;
alter table public.domains enable row level security;
alter table public.investors enable row level security;
alter table public.vc_firms enable row level security;
alter table public.vc_profiles enable row level security;
alter table public.investor_matches enable row level security;
alter table public.vc_fit_scores enable row level security;
alter table public.reports enable row level security;
alter table public.memos enable row level security;
alter table public.proposals enable row level security;
alter table public.outreach_drafts enable row level security;
alter table public.watchlist enable row level security;
alter table public.jobs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

create policy "authenticated analysts can read companies" on public.companies for select to authenticated using (true);
create policy "authenticated analysts can write companies" on public.companies for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read company sources" on public.company_sources for select to authenticated using (true);
create policy "authenticated analysts can write company sources" on public.company_sources for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read sources" on public.sources for select to authenticated using (true);
create policy "authenticated analysts can write sources" on public.sources for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read founders" on public.founders for select to authenticated using (true);
create policy "authenticated analysts can write founders" on public.founders for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read enrichment events" on public.enrichment_events for select to authenticated using (true);
create policy "authenticated analysts can write enrichment events" on public.enrichment_events for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read company scores" on public.company_scores for select to authenticated using (true);
create policy "authenticated analysts can write company scores" on public.company_scores for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read startup scores" on public.startup_scores for select to authenticated using (true);
create policy "authenticated analysts can write startup scores" on public.startup_scores for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read score history" on public.score_history for select to authenticated using (true);
create policy "authenticated analysts can write score history" on public.score_history for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read company risks" on public.company_risks for select to authenticated using (true);
create policy "authenticated analysts can write company risks" on public.company_risks for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read domains" on public.domains for select to authenticated using (true);
create policy "authenticated analysts can write domains" on public.domains for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read investors" on public.investors for select to authenticated using (true);
create policy "authenticated analysts can write investors" on public.investors for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read vc firms" on public.vc_firms for select to authenticated using (true);
create policy "authenticated analysts can write vc firms" on public.vc_firms for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read vc profiles" on public.vc_profiles for select to authenticated using (true);
create policy "authenticated analysts can write vc profiles" on public.vc_profiles for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read investor matches" on public.investor_matches for select to authenticated using (true);
create policy "authenticated analysts can write investor matches" on public.investor_matches for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read vc fit scores" on public.vc_fit_scores for select to authenticated using (true);
create policy "authenticated analysts can write vc fit scores" on public.vc_fit_scores for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read reports" on public.reports for select to authenticated using (true);
create policy "authenticated analysts can write reports" on public.reports for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read memos" on public.memos for select to authenticated using (true);
create policy "authenticated analysts can write memos" on public.memos for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read proposals" on public.proposals for select to authenticated using (true);
create policy "authenticated analysts can write proposals" on public.proposals for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read outreach drafts" on public.outreach_drafts for select to authenticated using (true);
create policy "authenticated analysts can write outreach drafts" on public.outreach_drafts for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read watchlist" on public.watchlist for select to authenticated using (true);
create policy "authenticated analysts can write watchlist" on public.watchlist for all to authenticated using (true) with check (true);

create policy "authenticated analysts can read jobs" on public.jobs for select to authenticated using (true);
create policy "authenticated analysts can write jobs" on public.jobs for all to authenticated using (true) with check (true);
