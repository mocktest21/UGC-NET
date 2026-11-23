create table if not exists public.subject_exam_schedules (
  exam_cycle text not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  exam_date date not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (exam_cycle, subject_id)
);
alter table public.subject_exam_schedules enable row level security;
drop policy if exists subject_exam_schedules_admin_manage on public.subject_exam_schedules;
create policy subject_exam_schedules_admin_manage on public.subject_exam_schedules for all to authenticated using (public.is_mockmaster_admin()) with check (public.is_mockmaster_admin());
drop policy if exists subject_exam_schedules_student_read on public.subject_exam_schedules;
create policy subject_exam_schedules_student_read on public.subject_exam_schedules for select to authenticated using (true);
grant select, insert, update, delete on public.subject_exam_schedules to authenticated;
comment on table public.subject_exam_schedules is 'Paper 2 subject-wise UGC-NET exam dates by exam cycle; student countdown uses only the selected Paper 2 subject date.';
