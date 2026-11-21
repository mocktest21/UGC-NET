-- add_student_readiness_preferences
-- Adds student inputs required for category-aware UGC NET readiness estimates.
alter table public.student_exam_preferences
  add column if not exists category text,
  add column if not exists qualification_goal text,
  add column if not exists target_exam_cycle text;

alter table public.student_exam_preferences
  drop constraint if exists student_exam_preferences_category_check,
  add constraint student_exam_preferences_category_check
    check (category is null or category in ('General','EWS','OBC-NCL','SC','ST','PwD')),
  drop constraint if exists student_exam_preferences_qualification_goal_check,
  add constraint student_exam_preferences_qualification_goal_check
    check (qualification_goal is null or qualification_goal in ('Assistant Professor','JRF','Both'));

comment on column public.student_exam_preferences.category is 'Student-reported UGC NET reservation category used to select relevant historical cutoff benchmarks.';
comment on column public.student_exam_preferences.qualification_goal is 'Student target qualification: Assistant Professor, JRF, or Both.';
comment on column public.student_exam_preferences.target_exam_cycle is 'Student target UGC NET examination cycle, e.g. June 2027.';
