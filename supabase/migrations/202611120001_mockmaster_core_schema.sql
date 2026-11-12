-- MockMaster Module 2: database foundation
-- Apply once in Supabase SQL Editor. See docs/DATABASE_ARCHITECTURE.md.
begin;
create extension if not exists pgcrypto;

do $$ begin create type public.question_type as enum ('single_choice','multiple_choice','assertion_reason','matching','passage','numerical','short_answer','ordering','true_false'); exception when duplicate_object then null; end $$;
do $$ begin create type public.test_mode as enum ('practice','live'); exception when duplicate_object then null; end $$;
do $$ begin create type public.test_status as enum ('draft','published','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attempt_status as enum ('in_progress','submitted','auto_submitted','abandoned'); exception when duplicate_object then null; end $$;
do $$ begin create type public.difficulty_level as enum ('easy','moderate','hard'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 phone_number text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.profiles(id,full_name,phone_number)
 values(new.id,coalesce(new.raw_user_meta_data ->> 'full_name',''),new.raw_user_meta_data ->> 'phone_number')
 on conflict(id) do update set full_name=excluded.full_name, phone_number=excluded.phone_number;
 return new;
end; $$;

drop trigger if exists on_auth_user_created_mockmaster on auth.users;
create trigger on_auth_user_created_mockmaster after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill accounts that were registered before this migration was installed.
insert into public.profiles(id,full_name,phone_number)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name',''),
  u.raw_user_meta_data ->> 'phone_number'
from auth.users u
on conflict(id) do nothing;

create or replace function public.is_mockmaster_admin()
returns boolean language sql stable set search_path = ''
as $$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',false); $$;

create table if not exists public.exams (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 description text, is_active boolean not null default true, display_order integer not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.subjects (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id) on delete cascade,
 code text, name text not null, description text, is_active boolean not null default true,
 display_order integer not null default 0, created_at timestamptz not null default now(),
 unique(exam_id,name), unique(exam_id,code)
);
create table if not exists public.units (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null references public.subjects(id) on delete cascade,
 unit_number integer, code text, name text not null, description text, is_active boolean not null default true,
 display_order integer not null default 0, created_at timestamptz not null default now(),
 unique(subject_id,name), unique(subject_id,unit_number)
);
create table if not exists public.topics (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id) on delete cascade,
 name text not null, description text, is_active boolean not null default true,
 display_order integer not null default 0, created_at timestamptz not null default now(),
 unique(unit_id,name)
);

-- Prompt/options are separated from answer keys to prevent answer leakage to browsers.
create table if not exists public.questions (
 id uuid primary key default gen_random_uuid(),
 exam_id uuid references public.exams(id) on delete set null,
 subject_id uuid references public.subjects(id) on delete set null,
 unit_id uuid references public.units(id) on delete set null,
 topic_id uuid references public.topics(id) on delete set null,
 question_type public.question_type not null,
 prompt jsonb not null, options jsonb not null default '[]'::jsonb,
 stimulus jsonb, media jsonb not null default '[]'::jsonb,
 difficulty public.difficulty_level,
 default_marks numeric(8,2) not null default 2,
 default_negative_marks numeric(8,2) not null default 0,
 explanation jsonb, language_code text not null default 'en',
 source_label text, source_year integer, tags text[] not null default '{}',
 status public.test_status not null default 'draft',
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint questions_marks_nonnegative check(default_marks>=0 and default_negative_marks>=0),
 constraint questions_prompt_object check(jsonb_typeof(prompt)='object'),
 constraint questions_options_array check(jsonb_typeof(options)='array'),
 constraint questions_media_array check(jsonb_typeof(media)='array')
);
create table if not exists public.question_answer_keys (
 question_id uuid primary key references public.questions(id) on delete cascade,
 answer_key jsonb not null, evaluation_rules jsonb not null default '{}'::jsonb,
 updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now(),
 constraint answer_key_object check(jsonb_typeof(answer_key)='object'),
 constraint evaluation_rules_object check(jsonb_typeof(evaluation_rules)='object')
);
drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at before update on public.questions for each row execute function public.set_updated_at();

create table if not exists public.tests (
 id uuid primary key default gen_random_uuid(),
 exam_id uuid references public.exams(id) on delete set null,
 subject_id uuid references public.subjects(id) on delete set null,
 title text not null, description text, mode public.test_mode not null default 'practice',
 status public.test_status not null default 'draft',
 duration_seconds integer not null, total_marks numeric(10,2) not null default 0,
 instructions jsonb not null default '[]'::jsonb,
 starts_at timestamptz, ends_at timestamptz,
 result_visibility text not null default 'after_submission'
  check(result_visibility in ('immediate','after_window','manual','after_submission')),
 max_attempts integer, shuffle_questions boolean not null default false,
 shuffle_options boolean not null default false, show_solutions boolean not null default true,
 created_by uuid references auth.users(id) on delete set null, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint tests_duration_positive check(duration_seconds>0),
 constraint tests_total_marks_nonnegative check(total_marks>=0),
 constraint tests_max_attempts_positive check(max_attempts is null or max_attempts>0),
 constraint tests_schedule_order check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create table if not exists public.test_questions (
 id uuid primary key default gen_random_uuid(),
 test_id uuid not null references public.tests(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete restrict,
 section_title text, position integer not null, marks numeric(8,2) not null default 2,
 negative_marks numeric(8,2) not null default 0, is_compulsory boolean not null default true,
 created_at timestamptz not null default now(),
 unique(test_id,question_id), unique(test_id,position),
 constraint test_questions_position_positive check(position>0),
 constraint test_questions_marks_nonnegative check(marks>=0 and negative_marks>=0)
);

create table if not exists public.test_attempts (
 id uuid primary key default gen_random_uuid(),
 test_id uuid not null references public.tests(id) on delete restrict,
 student_id uuid not null references auth.users(id) on delete cascade,
 attempt_number integer not null default 1, status public.attempt_status not null default 'in_progress',
 started_at timestamptz not null default now(), expires_at timestamptz, submitted_at timestamptz,
 time_taken_seconds integer, questions_attempted integer not null default 0,
 correct_count integer not null default 0, incorrect_count integer not null default 0,
 unanswered_count integer not null default 0, score numeric(10,2), max_score numeric(10,2),
 accuracy numeric(7,4), result_published_at timestamptz, created_at timestamptz not null default now(),
 unique(test_id,student_id,attempt_number),
 constraint attempt_number_positive check(attempt_number>0),
 constraint attempt_counts_nonnegative check(questions_attempted>=0 and correct_count>=0 and incorrect_count>=0 and unanswered_count>=0),
 constraint attempt_time_nonnegative check(time_taken_seconds is null or time_taken_seconds>=0)
);
create table if not exists public.student_responses (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.test_attempts(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete restrict,
 response jsonb, is_marked_for_review boolean not null default false,
 is_visited boolean not null default false, time_spent_seconds integer not null default 0,
 first_seen_at timestamptz, last_saved_at timestamptz not null default now(),
 is_correct boolean, awarded_marks numeric(8,2),
 unique(attempt_id,question_id),
 constraint response_time_nonnegative check(time_spent_seconds>=0)
);

create index if not exists idx_subjects_exam on public.subjects(exam_id,display_order);
create index if not exists idx_units_subject on public.units(subject_id,display_order);
create index if not exists idx_topics_unit on public.topics(unit_id,display_order);
create index if not exists idx_questions_taxonomy on public.questions(exam_id,subject_id,unit_id,topic_id);
create index if not exists idx_questions_status_type on public.questions(status,question_type);
create index if not exists idx_tests_catalogue on public.tests(status,mode,exam_id,subject_id);
create index if not exists idx_tests_schedule on public.tests(mode,starts_at,ends_at) where status='published';
create index if not exists idx_test_questions_order on public.test_questions(test_id,position);
create index if not exists idx_attempts_student_date on public.test_attempts(student_id,started_at desc);
create index if not exists idx_attempts_test_status on public.test_attempts(test_id,status);
create index if not exists idx_responses_attempt on public.student_responses(attempt_id);
create index if not exists idx_responses_question on public.student_responses(question_id);

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.tests enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.student_responses enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_mockmaster_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using(id=(select auth.uid()) or public.is_mockmaster_admin()) with check(id=(select auth.uid()) or public.is_mockmaster_admin());

do $$ declare t text; begin
 foreach t in array array['exams','subjects','units','topics'] loop
  execute format('drop policy if exists %I on public.%I',t||'_read_active',t);
  execute format('create policy %I on public.%I for select to anon, authenticated using(is_active or public.is_mockmaster_admin())',t||'_read_active',t);
  execute format('drop policy if exists %I on public.%I',t||'_admin_all',t);
  execute format('create policy %I on public.%I for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin())',t||'_admin_all',t);
 end loop;
end $$;

drop policy if exists questions_read_published on public.questions;
create policy questions_read_published on public.questions for select to authenticated using(status='published' or public.is_mockmaster_admin());
drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all on public.questions for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());
drop policy if exists answer_keys_admin_only on public.question_answer_keys;
create policy answer_keys_admin_only on public.question_answer_keys for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

drop policy if exists tests_read_published on public.tests;
create policy tests_read_published on public.tests for select to authenticated using(status='published' or public.is_mockmaster_admin());
drop policy if exists tests_admin_all on public.tests;
create policy tests_admin_all on public.tests for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

drop policy if exists test_questions_read_published on public.test_questions;
create policy test_questions_read_published on public.test_questions for select to authenticated using(
 public.is_mockmaster_admin() or exists(select 1 from public.tests t where t.id=test_id and t.status='published')
);
drop policy if exists test_questions_admin_all on public.test_questions;
create policy test_questions_admin_all on public.test_questions for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

drop policy if exists attempts_read_own on public.test_attempts;
create policy attempts_read_own on public.test_attempts for select to authenticated using(student_id=(select auth.uid()) or public.is_mockmaster_admin());
drop policy if exists attempts_admin_all on public.test_attempts;
create policy attempts_admin_all on public.test_attempts for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

drop policy if exists responses_read_own on public.student_responses;
create policy responses_read_own on public.student_responses for select to authenticated using(
 public.is_mockmaster_admin() or exists(select 1 from public.test_attempts a where a.id=attempt_id and a.student_id=(select auth.uid()))
);
drop policy if exists responses_admin_all on public.student_responses;
create policy responses_admin_all on public.student_responses for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

grant usage on schema public to anon,authenticated;
grant select on public.exams,public.subjects,public.units,public.topics to anon,authenticated;
grant select on public.questions,public.tests,public.test_questions to authenticated;
grant select,update on public.profiles to authenticated;
grant select on public.test_attempts,public.student_responses to authenticated;
revoke all on public.question_answer_keys from anon,authenticated;

commit;
