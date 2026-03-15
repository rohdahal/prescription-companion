create extension if not exists vector;

create table if not exists prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null,
  raw_text text,
  medication_name text not null,
  dosage text not null,
  frequency text not null,
  instructions text not null,
  follow_up_recommendation text not null,
  storage_bucket text,
  storage_key text,
  created_at timestamptz not null default now()
);

create table if not exists medication_schedules (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid references prescriptions(id),
  frequency text not null,
  dose_times jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists adherence_logs (
  id uuid primary key default gen_random_uuid(),
  prescription_id text not null,
  dose_time timestamptz not null,
  taken boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists reminder_events (
  id uuid primary key default gen_random_uuid(),
  prescription_id text,
  reminder_type text not null,
  status text not null,
  scheduled_for timestamptz not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null,
  prescription_id uuid references prescriptions(id),
  title text not null,
  subtitle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_history_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references chat_threads(id),
  patient_id text not null,
  prescription_id uuid references prescriptions(id),
  role text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists care_visits (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null,
  visit_type text not null,
  provider_name text not null,
  location text not null,
  visit_date timestamptz not null,
  summary text not null,
  next_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists care_visit_prescriptions (
  visit_id uuid not null references care_visits(id),
  prescription_id uuid not null references prescriptions(id),
  primary key (visit_id, prescription_id)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  actor_type text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_event_logs (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  response text not null,
  model text not null,
  latency_ms int not null,
  tool_calls jsonb,
  error text,
  trace_id text,
  created_at timestamptz not null default now()
);

create table if not exists medication_guidance_embeddings (
  id text primary key,
  title text not null,
  content text not null,
  embedding vector(8) not null,
  created_at timestamptz not null default now()
);

create or replace function match_medication_guidance(
  query_embedding vector(8),
  match_count int
)
returns table (id text, content text, similarity float)
language sql
as $$
  select
    medication_guidance_embeddings.id,
    medication_guidance_embeddings.content,
    1 - (medication_guidance_embeddings.embedding <=> query_embedding) as similarity
  from medication_guidance_embeddings
  order by medication_guidance_embeddings.embedding <=> query_embedding
  limit match_count;
$$;
