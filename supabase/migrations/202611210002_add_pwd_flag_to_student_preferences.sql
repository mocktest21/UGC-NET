-- Store PwBD as a horizontal reservation flag, not as a vertical category.
alter table public.student_exam_preferences
  add column if not exists is_pwd boolean not null default false;

alter table public.student_exam_preferences
  drop constraint if exists student_exam_preferences_category_check,
  add constraint student_exam_preferences_category_check
    check (category is null or category in ('General','EWS','OBC-NCL','SC','ST'));

comment on column public.student_exam_preferences.is_pwd is 'Whether the student identifies under the Persons with Benchmark Disabilities (PwBD) horizontal reservation category.';
