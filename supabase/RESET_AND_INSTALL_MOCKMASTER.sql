-- MOCKMASTER CLEAN REBUILD
-- DESTRUCTIVE: removes the existing MockMaster application tables in public.
-- Preserves Supabase-managed schemas (auth, storage, realtime), auth.users,
-- project settings, Auth providers, and existing Storage objects.
-- Existing public application data will be deleted. Current inspected
-- academic/test tables were all confirmed empty before preparing this script.

begin;

-- Remove the public Auth-to-profile trigger function first. CASCADE removes
-- its trigger on auth.users; the core schema migration recreates it.
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.is_mockmaster_admin() cascade;

-- Drop all known current/target MockMaster application tables.
drop table if exists
  public.student_responses,
  public.test_question_answer_keys,
  public.test_questions,
  public.test_attempts,
  public.tests,
  public.question_version_answer_keys,
  public.question_answer_keys,
  public.question_versions,
  public.question_import_items,
  public.question_import_batches,
  public.questions,
  public.topics,
  public.units,
  public.subjects,
  public.papers,
  public.exams,
  public.student_exam_preferences,
  public.bookmarks,
  public.personal_notes,
  public.admin_audit_logs,
  public.profiles
cascade;

-- Remove legacy and target enum types so the approved schema can recreate
-- them with the correct values and independent question workflow status.
drop type if exists
  public.question_type,
  public.question_status,
  public.test_mode,
  public.test_status,
  public.test_creation_type,
  public.attempt_status,
  public.difficulty_level,
  public.import_status
cascade;

commit;

-- Recreate the complete approved Module 2 schema.

-- MockMaster Module 2: revised, extensible database foundation
-- IMPORTANT: This migration has not been executed in Supabase.
-- Review docs/DATABASE_ARCHITECTURE.md before applying in Supabase SQL Editor.
begin;
create extension if not exists pgcrypto;

do $$ begin create type public.question_type as enum ('single_choice','multiple_choice','assertion_reason','matching','passage','numerical','short_answer','ordering','true_false'); exception when duplicate_object then null; end $$;
do $$ begin create type public.question_status as enum ('draft','in_review','approved','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.test_mode as enum ('practice','live'); exception when duplicate_object then null; end $$;
do $$ begin create type public.test_status as enum ('draft','published','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.test_creation_type as enum ('admin','generated'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attempt_status as enum ('in_progress','submitted','auto_submitted','abandoned'); exception when duplicate_object then null; end $$;
do $$ begin create type public.difficulty_level as enum ('easy','moderate','hard'); exception when duplicate_object then null; end $$;
do $$ begin create type public.import_status as enum ('uploaded','validating','needs_review','approved','rejected','completed'); exception when duplicate_object then null; end $$;

-- Identity and student preferences
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
insert into public.profiles(id,full_name,phone_number)
select u.id,coalesce(u.raw_user_meta_data ->> 'full_name',''),u.raw_user_meta_data ->> 'phone_number'
from auth.users u on conflict(id) do nothing;

create table if not exists public.student_exam_preferences (
 student_id uuid not null references auth.users(id) on delete cascade,
 exam_id uuid not null,
 selected_subject_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(student_id,exam_id)
);

create or replace function public.is_mockmaster_admin()
returns boolean language sql stable set search_path = ''
as $$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',false); $$;

-- Flexible syllabus taxonomy: exam -> paper -> subject -> unit -> topic.
-- Paper 1 can have a single "General Paper" subject node; Paper 2 has selectable subjects.
create table if not exists public.exams (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 name text not null,
 description text,
 is_active boolean not null default true,
 display_order integer not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.papers (
 id uuid primary key default gen_random_uuid(),
 exam_id uuid not null references public.exams(id) on delete cascade,
 code text not null,
 name text not null,
 description text,
 is_compulsory boolean not null default false,
 display_order integer not null default 0,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(exam_id,code),
 unique(exam_id,name),
 unique(id,exam_id)
);
create table if not exists public.subjects (
 id uuid primary key default gen_random_uuid(),
 exam_id uuid not null references public.exams(id) on delete cascade,
 paper_id uuid not null,
 code text,
 name text not null,
 description text,
 is_active boolean not null default true,
 display_order integer not null default 0,
 created_at timestamptz not null default now(),
 unique(paper_id,name),
 unique(paper_id,code),
 unique(id,exam_id,paper_id),
 foreign key(paper_id,exam_id) references public.papers(id,exam_id) on delete cascade
);
create table if not exists public.units (
 id uuid primary key default gen_random_uuid(),
 subject_id uuid not null references public.subjects(id) on delete cascade,
 unit_number integer,
 code text,
 name text not null,
 description text,
 is_active boolean not null default true,
 display_order integer not null default 0,
 created_at timestamptz not null default now(),
 unique(subject_id,name),
 unique(subject_id,unit_number)
);
create table if not exists public.topics (
 id uuid primary key default gen_random_uuid(),
 unit_id uuid not null references public.units(id) on delete cascade,
 name text not null,
 description text,
 is_active boolean not null default true,
 display_order integer not null default 0,
 created_at timestamptz not null default now(),
 unique(unit_id,name)
);
alter table public.student_exam_preferences drop constraint if exists student_exam_preferences_exam_id_fkey;
alter table public.student_exam_preferences add constraint student_exam_preferences_exam_id_fkey foreign key(exam_id) references public.exams(id) on delete cascade;
alter table public.student_exam_preferences drop constraint if exists student_exam_preferences_selected_subject_id_fkey;
alter table public.student_exam_preferences add constraint student_exam_preferences_selected_subject_id_fkey foreign key(selected_subject_id) references public.subjects(id) on delete set null;

-- Master bank records hold classification and workflow metadata; versions hold immutable content.
create table if not exists public.question_import_batches (
 id uuid primary key default gen_random_uuid(),
 source_filename text,
 source_label text,
 source_test_title text,
 status public.import_status not null default 'uploaded',
 total_rows integer not null default 0,
 valid_rows integer not null default 0,
 error_rows integer not null default 0,
 uploaded_by uuid references auth.users(id) on delete set null,
 reviewed_by uuid references auth.users(id) on delete set null,
 validation_report jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 constraint import_counts_nonnegative check(total_rows>=0 and valid_rows>=0 and error_rows>=0)
);
create table if not exists public.questions (
 id uuid primary key default gen_random_uuid(),
 exam_id uuid not null references public.exams(id) on delete restrict,
 paper_id uuid not null,
 subject_id uuid not null,
 unit_id uuid,
 topic_id uuid,
 question_type public.question_type not null,
 difficulty public.difficulty_level,
 language_code text not null default 'en',
 source_label text,
 source_year integer,
 source_type text not null default 'admin_created' check(source_type in ('admin_created','previous_year','imported','live_test','other')),
 source_test_id uuid,
 import_batch_id uuid references public.question_import_batches(id) on delete set null,
 question_fingerprint text,
 tags text[] not null default '{}',
 status public.question_status not null default 'draft',
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(paper_id,exam_id) references public.papers(id,exam_id) on delete restrict,
 foreign key(subject_id,exam_id,paper_id) references public.subjects(id,exam_id,paper_id) on delete restrict,
 foreign key(unit_id) references public.units(id) on delete set null,
 foreign key(topic_id) references public.topics(id) on delete set null
);
create table if not exists public.question_versions (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.questions(id) on delete restrict,
 version_number integer not null,
 question_type public.question_type not null,
 prompt jsonb not null,
 options jsonb not null default '[]'::jsonb,
 stimulus jsonb,
 media jsonb not null default '[]'::jsonb,
 explanation jsonb,
 default_marks numeric(8,2) not null default 2,
 default_negative_marks numeric(8,2) not null default 0,
 evaluation_rules jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(question_id,version_number),
 unique(question_id,id),
 constraint qv_version_positive check(version_number>0),
 constraint qv_marks_nonnegative check(default_marks>=0 and default_negative_marks>=0),
 constraint qv_prompt_object check(jsonb_typeof(prompt)='object'),
 constraint qv_options_array check(jsonb_typeof(options)='array'),
 constraint qv_media_array check(jsonb_typeof(media)='array'),
 constraint qv_rules_object check(jsonb_typeof(evaluation_rules)='object')
);
create table if not exists public.question_answer_keys (
 question_id uuid primary key references public.questions(id) on delete cascade,
 current_version_id uuid references public.question_versions(id) on delete restrict,
 answer_key jsonb not null,
 evaluation_rules jsonb not null default '{}'::jsonb,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 constraint answer_key_object check(jsonb_typeof(answer_key)='object'),
 constraint answer_rules_object check(jsonb_typeof(evaluation_rules)='object')
);
create table if not exists public.question_version_answer_keys (
 question_version_id uuid primary key references public.question_versions(id) on delete restrict,
 answer_key jsonb not null,
 evaluation_rules jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 constraint version_answer_object check(jsonb_typeof(answer_key)='object'),
 constraint version_answer_rules_object check(jsonb_typeof(evaluation_rules)='object')
);
create table if not exists public.question_import_items (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.question_import_batches(id) on delete cascade,
 row_number integer not null,
 raw_data jsonb not null,
 parsed_data jsonb,
 validation_errors jsonb not null default '[]'::jsonb,
 possible_duplicate_question_ids uuid[] not null default '{}',
 imported_question_id uuid references public.questions(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','valid','invalid','duplicate_review','approved','rejected','imported')),
 created_at timestamptz not null default now(),
 unique(batch_id,row_number)
);
create index if not exists idx_questions_taxonomy on public.questions(exam_id,paper_id,subject_id,unit_id,topic_id);
create index if not exists idx_questions_workflow on public.questions(status,question_type,difficulty);
create index if not exists idx_questions_fingerprint on public.questions(question_fingerprint) where question_fingerprint is not null;
create index if not exists idx_question_versions_question on public.question_versions(question_id,version_number desc);
create index if not exists idx_import_items_batch on public.question_import_items(batch_id,row_number);

-- Tests reference immutable question versions. Answer snapshots are stored separately and never exposed to students.
create table if not exists public.tests (
 id uuid primary key default gen_random_uuid(),
 exam_id uuid references public.exams(id) on delete restrict,
 paper_id uuid references public.papers(id) on delete restrict,
 subject_id uuid references public.subjects(id) on delete restrict,
 title text not null,
 description text,
 mode public.test_mode not null default 'practice',
 creation_type public.test_creation_type not null default 'admin',
 status public.test_status not null default 'draft',
 duration_seconds integer not null,
 total_marks numeric(10,2) not null default 0,
 instructions jsonb not null default '[]'::jsonb,
 starts_at timestamptz,
 ends_at timestamptz,
 result_visibility text not null default 'after_submission' check(result_visibility in ('immediate','after_window','manual','after_submission')),
 max_attempts integer,
 shuffle_questions boolean not null default false,
 shuffle_options boolean not null default false,
 show_solutions boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint tests_duration_positive check(duration_seconds>0),
 constraint tests_total_marks_nonnegative check(total_marks>=0),
 constraint tests_max_attempts_positive check(max_attempts is null or max_attempts>0),
 constraint tests_schedule_order check(ends_at is null or starts_at is null or ends_at>starts_at),
 constraint tests_subject_requires_paper check(subject_id is null or paper_id is not null),
 constraint tests_exam_paper_consistency foreign key(paper_id,exam_id) references public.papers(id,exam_id) on delete restrict
);
create table if not exists public.test_questions (
 id uuid primary key default gen_random_uuid(),
 test_id uuid not null references public.tests(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete restrict,
 question_version_id uuid not null,
 section_title text,
 position integer not null,
 marks numeric(8,2) not null default 2,
 negative_marks numeric(8,2) not null default 0,
 is_compulsory boolean not null default true,
 created_at timestamptz not null default now(),
 unique(test_id,question_id),
 unique(test_id,position),
 foreign key(question_id,question_version_id) references public.question_versions(question_id,id) on delete restrict,
 constraint test_questions_position_positive check(position>0),
 constraint test_questions_marks_nonnegative check(marks>=0 and negative_marks>=0)
);
create table if not exists public.test_question_answer_keys (
 test_question_id uuid primary key references public.test_questions(id) on delete cascade,
 answer_key jsonb not null,
 evaluation_rules jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 constraint test_answer_object check(jsonb_typeof(answer_key)='object'),
 constraint test_answer_rules_object check(jsonb_typeof(evaluation_rules)='object')
);
create index if not exists idx_tests_catalogue on public.tests(status,mode,exam_id,paper_id,subject_id);
create index if not exists idx_tests_schedule on public.tests(mode,starts_at,ends_at) where status='published';
create index if not exists idx_test_questions_order on public.test_questions(test_id,position);

create table if not exists public.test_attempts (
 id uuid primary key default gen_random_uuid(),
 test_id uuid not null references public.tests(id) on delete restrict,
 student_id uuid not null references auth.users(id) on delete cascade,
 attempt_number integer not null default 1,
 status public.attempt_status not null default 'in_progress',
 started_at timestamptz not null default now(),
 expires_at timestamptz,
 submitted_at timestamptz,
 time_taken_seconds integer,
 questions_attempted integer not null default 0,
 correct_count integer not null default 0,
 incorrect_count integer not null default 0,
 unanswered_count integer not null default 0,
 score numeric(10,2),
 max_score numeric(10,2),
 accuracy numeric(7,4),
 result_published_at timestamptz,
 created_at timestamptz not null default now(),
 unique(test_id,student_id,attempt_number),
 constraint attempt_number_positive check(attempt_number>0),
 constraint attempt_counts_nonnegative check(questions_attempted>=0 and correct_count>=0 and incorrect_count>=0 and unanswered_count>=0),
 constraint attempt_time_nonnegative check(time_taken_seconds is null or time_taken_seconds>=0)
);
create table if not exists public.student_responses (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.test_attempts(id) on delete cascade,
 test_question_id uuid not null references public.test_questions(id) on delete restrict,
 response jsonb,
 is_marked_for_review boolean not null default false,
 is_visited boolean not null default false,
 time_spent_seconds integer not null default 0,
 first_seen_at timestamptz,
 last_saved_at timestamptz not null default now(),
 is_correct boolean,
 awarded_marks numeric(8,2),
 unique(attempt_id,test_question_id),
 constraint response_time_nonnegative check(time_spent_seconds>=0)
);
create index if not exists idx_attempts_student_date on public.test_attempts(student_id,started_at desc);
create index if not exists idx_attempts_test_status on public.test_attempts(test_id,status);
create index if not exists idx_responses_attempt on public.student_responses(attempt_id);
create index if not exists idx_responses_test_question on public.student_responses(test_question_id);

-- Student-owned notebook features
create table if not exists public.bookmarks (
 student_id uuid not null references auth.users(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(student_id,question_id)
);
create table if not exists public.personal_notes (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 question_id uuid references public.questions(id) on delete set null,
 title text,
 body text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.admin_audit_logs (
 id bigint generated always as identity primary key,
 admin_id uuid references auth.users(id) on delete set null,
 action text not null,
 entity_type text not null,
 entity_id uuid,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

-- updated_at triggers
drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at before update on public.questions for each row execute function public.set_updated_at();
drop trigger if exists tests_set_updated_at on public.tests;
create trigger tests_set_updated_at before update on public.tests for each row execute function public.set_updated_at();
drop trigger if exists student_exam_preferences_set_updated_at on public.student_exam_preferences;
create trigger student_exam_preferences_set_updated_at before update on public.student_exam_preferences for each row execute function public.set_updated_at();
drop trigger if exists personal_notes_set_updated_at on public.personal_notes;
create trigger personal_notes_set_updated_at before update on public.personal_notes for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.student_exam_preferences enable row level security;
alter table public.exams enable row level security;
alter table public.papers enable row level security;
alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_versions enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.question_version_answer_keys enable row level security;
alter table public.question_import_batches enable row level security;
alter table public.question_import_items enable row level security;
alter table public.tests enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_question_answer_keys enable row level security;
alter table public.test_attempts enable row level security;
alter table public.student_responses enable row level security;
alter table public.bookmarks enable row level security;
alter table public.personal_notes enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_mockmaster_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using(id=(select auth.uid()) or public.is_mockmaster_admin()) with check(id=(select auth.uid()) or public.is_mockmaster_admin());

drop policy if exists student_exam_preferences_own on public.student_exam_preferences;
create policy student_exam_preferences_own on public.student_exam_preferences for all to authenticated using(student_id=(select auth.uid()) or public.is_mockmaster_admin()) with check(student_id=(select auth.uid()) or public.is_mockmaster_admin());

do $$ declare t text; begin
 foreach t in array array['exams','papers','subjects','units','topics'] loop
  execute format('drop policy if exists %I on public.%I',t||'_read_active',t);
  execute format('create policy %I on public.%I for select to anon, authenticated using(is_active or public.is_mockmaster_admin())',t||'_read_active',t);
  execute format('drop policy if exists %I on public.%I',t||'_admin_all',t);
  execute format('create policy %I on public.%I for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin())',t||'_admin_all',t);
 end loop;
end $$;

drop policy if exists questions_read_approved on public.questions;
create policy questions_read_approved on public.questions for select to authenticated using(status='approved' or public.is_mockmaster_admin());
drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all on public.questions for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());
drop policy if exists question_versions_read_approved on public.question_versions;
create policy question_versions_read_approved on public.question_versions for select to authenticated using(
 public.is_mockmaster_admin() or exists(select 1 from public.questions q where q.id=question_id and q.status='approved')
);
drop policy if exists question_versions_admin_all on public.question_versions;
create policy question_versions_admin_all on public.question_versions for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

drop policy if exists question_answer_keys_admin_only on public.question_answer_keys;
create policy question_answer_keys_admin_only on public.question_answer_keys for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());
drop policy if exists question_version_answer_keys_admin_only on public.question_version_answer_keys;
create policy question_version_answer_keys_admin_only on public.question_version_answer_keys for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

do $$ declare t text; begin
 foreach t in array array['question_import_batches','question_import_items'] loop
  execute format('drop policy if exists %I on public.%I',t||'_admin_only',t);
  execute format('create policy %I on public.%I for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin())',t||'_admin_only',t);
 end loop;
end $$;

drop policy if exists tests_read_available on public.tests;
create policy tests_read_available on public.tests for select to authenticated using(
 public.is_mockmaster_admin()
 or (status='published' and (creation_type='admin' or created_by=(select auth.uid())))
);
drop policy if exists tests_admin_insert_update_delete on public.tests;
create policy tests_admin_insert_update_delete on public.tests for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

drop policy if exists test_questions_read_available on public.test_questions;
create policy test_questions_read_available on public.test_questions for select to authenticated using(
 public.is_mockmaster_admin() or exists(
  select 1 from public.tests t where t.id=test_id and t.status='published'
  and (t.creation_type='admin' or t.created_by=(select auth.uid()))
 )
);
drop policy if exists test_questions_admin_all on public.test_questions;
create policy test_questions_admin_all on public.test_questions for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

drop policy if exists test_question_answer_keys_admin_only on public.test_question_answer_keys;
create policy test_question_answer_keys_admin_only on public.test_question_answer_keys for all to authenticated using(public.is_mockmaster_admin()) with check(public.is_mockmaster_admin());

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

drop policy if exists bookmarks_own on public.bookmarks;
create policy bookmarks_own on public.bookmarks for all to authenticated using(student_id=(select auth.uid()) or public.is_mockmaster_admin()) with check(student_id=(select auth.uid()) or public.is_mockmaster_admin());
drop policy if exists personal_notes_own on public.personal_notes;
create policy personal_notes_own on public.personal_notes for all to authenticated using(student_id=(select auth.uid()) or public.is_mockmaster_admin()) with check(student_id=(select auth.uid()) or public.is_mockmaster_admin());
drop policy if exists admin_audit_logs_admin_read on public.admin_audit_logs;
create policy admin_audit_logs_admin_read on public.admin_audit_logs for select to authenticated using(public.is_mockmaster_admin());
drop policy if exists admin_audit_logs_admin_insert on public.admin_audit_logs;
create policy admin_audit_logs_admin_insert on public.admin_audit_logs for insert to authenticated with check(public.is_mockmaster_admin());

-- Grants. No direct student write access to attempts, responses, tests or question content.
grant usage on schema public to anon,authenticated;
grant select on public.exams,public.papers,public.subjects,public.units,public.topics to anon,authenticated;
grant select on public.questions,public.question_versions,public.tests,public.test_questions to authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.student_exam_preferences,public.bookmarks,public.personal_notes to authenticated;
grant select on public.test_attempts,public.student_responses to authenticated;
revoke all on public.question_answer_keys,public.question_version_answer_keys,public.test_question_answer_keys from anon,authenticated;
revoke all on public.question_import_batches,public.question_import_items,public.admin_audit_logs from anon,authenticated;

commit;


-- Seed the initial UGC NET hierarchy (Paper 1, Commerce, Management).
-- MockMaster: initial UGC NET examination configuration
-- Idempotent seed. Run only AFTER 202611120001_mockmaster_core_schema.sql.
-- Syllabus source: UGC NET Bureau updated syllabus index (applicable from June 2019 onward)
-- and NTA UGC-NET June 2026 subject list. Review official notices before each exam cycle.

begin;

insert into public.exams(code,name,description,is_active,display_order)
values (
 'UGC_NET',
 'UGC-NET',
 'National Eligibility Test conducted by the National Testing Agency.',
 true, 10
)
on conflict(code) do update set
 name=excluded.name,
 description=excluded.description,
 is_active=true;

-- Paper 1 is compulsory for every candidate. Paper 2 is chosen by subject.
insert into public.papers(exam_id,code,name,description,is_compulsory,display_order,is_active)
select e.id,v.code,v.name,v.description,v.is_compulsory,v.display_order,true
from public.exams e
cross join (values
 ('PAPER_1','Paper 1','Common General Paper on Teaching and Research Aptitude; compulsory for all UGC-NET candidates.',true,1),
 ('PAPER_2','Paper 2','Subject-specific paper selected by the candidate.',true,2)
) as v(code,name,description,is_compulsory,display_order)
where e.code='UGC_NET'
on conflict(exam_id,code) do update set
 name=excluded.name,
 description=excluded.description,
 is_compulsory=excluded.is_compulsory,
 display_order=excluded.display_order,
 is_active=true;

-- Internal Paper 1 subject node keeps the taxonomy consistent. The student UI should show Paper 1 directly.
-- Paper 2 subjects use the current NTA three-digit subject codes; syllabus legacy codes are retained in description.
insert into public.subjects(exam_id,paper_id,code,name,description,is_active,display_order)
select e.id,p.id,v.code,v.name,v.description,true,v.display_order
from public.exams e
join public.papers p on p.exam_id=e.id
cross join (values
 ('PAPER_1','00','General Paper','Common Paper 1 syllabus: Teaching and Research Aptitude. UGC syllabus subject code 00.',1),
 ('PAPER_2','008','Commerce','UGC-NET Paper 2 subject. NTA June 2026 subject code 008; legacy UGC syllabus code 08.',1),
 ('PAPER_2','017','Management','UGC-NET Paper 2 subject. NTA June 2026 subject code 017; legacy UGC syllabus code 17.',2)
) as v(paper_code,code,name,description,display_order)
join public.papers pp on pp.exam_id=e.id and pp.code=v.paper_code
where e.code='UGC_NET' and p.id=pp.id
on conflict(paper_id,code) do update set
 name=excluded.name,
 description=excluded.description,
 is_active=true,
 display_order=excluded.display_order;

-- Official Paper 1 unit titles (10 units).
with unit_seed(subject_code,unit_number,name) as (
 values
 ('00',1,'Teaching Aptitude'),
 ('00',2,'Research Aptitude'),
 ('00',3,'Comprehension'),
 ('00',4,'Communication'),
 ('00',5,'Mathematical Reasoning and Aptitude'),
 ('00',6,'Logical Reasoning'),
 ('00',7,'Data Interpretation'),
 ('00',8,'Information and Communication Technology (ICT)'),
 ('00',9,'People, Development and Environment'),
 ('00',10,'Higher Education System')
)
insert into public.units(subject_id,unit_number,code,name,description,is_active,display_order)
select s.id,u.unit_number,'UNIT_'||lpad(u.unit_number::text,2,'0'),u.name,'UGC-NET Paper 1 syllabus unit.',true,u.unit_number
from public.exams e
join public.papers p on p.exam_id=e.id and p.code='PAPER_1'
join unit_seed u on true
join public.subjects s on s.paper_id=p.id and s.code='00'
where e.code='UGC_NET'
on conflict(subject_id,unit_number) do update set
 code=excluded.code,name=excluded.name,description=excluded.description,is_active=true,display_order=excluded.display_order;

-- Official Commerce syllabus unit titles (10 units).
with unit_seed(subject_code,unit_number,name) as (
 values
 ('008',1,'Business Environment and International Business'),
 ('008',2,'Accounting and Auditing'),
 ('008',3,'Business Economics'),
 ('008',4,'Business Finance'),
 ('008',5,'Business Statistics and Research Methods'),
 ('008',6,'Business Management and Human Resource Management'),
 ('008',7,'Banking and Financial Institutions'),
 ('008',8,'Marketing Management'),
 ('008',9,'Legal Aspects of Business'),
 ('008',10,'Income-tax and Corporate Tax Planning')
)
insert into public.units(subject_id,unit_number,code,name,description,is_active,display_order)
select s.id,u.unit_number,'UNIT_'||lpad(u.unit_number::text,2,'0'),u.name,'UGC-NET Commerce Paper 2 syllabus unit.',true,u.unit_number
from public.exams e
join public.papers p on p.exam_id=e.id and p.code='PAPER_2'
join unit_seed u on true
join public.subjects s on s.paper_id=p.id and s.code=u.subject_code
where e.code='UGC_NET'
on conflict(subject_id,unit_number) do update set
 code=excluded.code,name=excluded.name,description=excluded.description,is_active=true,display_order=excluded.display_order;

-- Official Management syllabus unit titles (10 units).
with unit_seed(subject_code,unit_number,name) as (
 values
 ('017',1,'Management: Concept, Process, Theories and Approaches'),
 ('017',2,'Organisational Behaviour'),
 ('017',3,'Human Resource Management'),
 ('017',4,'Accounting and Financial Statement Analysis'),
 ('017',5,'Financial Management'),
 ('017',6,'Strategic Management'),
 ('017',7,'Marketing Management'),
 ('017',8,'Statistics and Research Methods for Management'),
 ('017',9,'International Business'),
 ('017',10,'Entrepreneurship Development')
)
insert into public.units(subject_id,unit_number,code,name,description,is_active,display_order)
select s.id,u.unit_number,'UNIT_'||lpad(u.unit_number::text,2,'0'),u.name,'UGC-NET Management Paper 2 syllabus unit.',true,u.unit_number
from public.exams e
join public.papers p on p.exam_id=e.id and p.code='PAPER_2'
join unit_seed u on true
join public.subjects s on s.paper_id=p.id and s.code=u.subject_code
where e.code='UGC_NET'
on conflict(subject_id,unit_number) do update set
 code=excluded.code,name=excluded.name,description=excluded.description,is_active=true,display_order=excluded.display_order;

commit;


-- Verify the seeded hierarchy and unit counts.
-- MockMaster schema and UGC NET seed verification
-- Read-only checks. Run after both Module 2 migrations in Supabase SQL Editor.
do $$
declare
  v_exam uuid;
  v_paper1 uuid;
  v_paper2 uuid;
  v_paper1_units integer;
  v_commerce_units integer;
  v_management_units integer;
  v_subjects integer;
begin
  select id into v_exam from public.exams where code='UGC_NET';
  if v_exam is null then raise exception 'UGC_NET exam seed missing'; end if;

  select id into v_paper1 from public.papers where exam_id=v_exam and code='PAPER_1';
  select id into v_paper2 from public.papers where exam_id=v_exam and code='PAPER_2';
  if v_paper1 is null or v_paper2 is null then raise exception 'UGC NET Paper 1 or Paper 2 missing'; end if;

  select count(*) into v_subjects from public.subjects where paper_id=v_paper2 and code in ('008','017');
  if v_subjects <> 2 then raise exception 'Expected Commerce (008) and Management (017) under Paper 2; found %',v_subjects; end if;

  select count(*) into v_paper1_units
  from public.units u join public.subjects s on s.id=u.subject_id
  where s.paper_id=v_paper1 and s.code='00';
  select count(*) into v_commerce_units
  from public.units u join public.subjects s on s.id=u.subject_id
  where s.paper_id=v_paper2 and s.code='008';
  select count(*) into v_management_units
  from public.units u join public.subjects s on s.id=u.subject_id
  where s.paper_id=v_paper2 and s.code='017';

  if v_paper1_units <> 10 then raise exception 'Paper 1 expected 10 units; found %',v_paper1_units; end if;
  if v_commerce_units <> 10 then raise exception 'Commerce expected 10 units; found %',v_commerce_units; end if;
  if v_management_units <> 10 then raise exception 'Management expected 10 units; found %',v_management_units; end if;

  raise notice 'MockMaster UGC NET seed verified: Paper 1=10 units, Commerce=10 units, Management=10 units.';
end $$;

-- Inspect the configured hierarchy.
select e.name as examination,p.name as paper,p.is_compulsory,s.code as subject_code,s.name as subject,
       u.unit_number,u.name as unit
from public.exams e
join public.papers p on p.exam_id=e.id
join public.subjects s on s.paper_id=p.id
left join public.units u on u.subject_id=s.id
where e.code='UGC_NET'
order by p.display_order,s.display_order,u.unit_number;

