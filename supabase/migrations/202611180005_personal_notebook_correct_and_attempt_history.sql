-- Retain compact per-question outcome history in Personal Notebook.
-- Detailed test attempts/results remain untouched so existing result review keeps working.
begin;

create or replace function public.student_get_personal_notebook()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_result jsonb;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  with history as (
    select
      tq.question_id,
      count(*) filter (
        where sr.response is not null
          and sr.response <> 'null'::jsonb
          and sr.response <> '""'::jsonb
      )::integer as attempt_count,
      count(*) filter (where sr.is_correct is true)::integer as correct_count,
      count(*) filter (where sr.is_correct is false)::integer as incorrect_count
    from public.student_responses sr
    join public.test_attempts a on a.id = sr.attempt_id
    join public.test_questions tq on tq.id = sr.test_question_id
    where a.student_id = v_student
      and a.status in ('submitted','auto_submitted')
      and tq.question_id is not null
    group by tq.question_id
  ),
  latest_any as (
    select distinct on (tq.question_id)
      tq.question_id, sr.response, a.submitted_at, t.title
    from public.student_responses sr
    join public.test_attempts a on a.id = sr.attempt_id
    join public.test_questions tq on tq.id = sr.test_question_id
    join public.tests t on t.id = a.test_id
    where a.student_id = v_student
      and a.status in ('submitted','auto_submitted')
      and tq.question_id is not null
    order by tq.question_id, a.submitted_at desc nulls last, sr.last_saved_at desc
  ),
  base as (
    select
      q.id,
      qv.prompt,
      qv.stimulus,
      qv.options,
      qv.explanation,
      coalesce(ak.answer_key, qak.answer_key) as correct_answer,
      coalesce(s.name, 'Subject not tagged') as subject,
      coalesce(u.name, 'Unit not tagged') as unit,
      h.attempt_count,
      h.correct_count,
      h.incorrect_count,
      la.response,
      la.title as test_title,
      la.submitted_at as last_date
    from history h
    join public.questions q on q.id = h.question_id
    left join public.subjects s on s.id = q.subject_id
    left join public.units u on u.id = q.unit_id
    left join lateral (
      select v.id, v.prompt, v.stimulus, v.options, v.explanation
      from public.question_versions v
      where v.question_id = q.id
      order by v.version_number desc
      limit 1
    ) qv on true
    left join public.question_version_answer_keys ak on ak.question_version_id = qv.id
    left join public.question_answer_keys qak on qak.question_id = q.id
    left join latest_any la on la.question_id = q.id
  ),
  bookmarked as (
    select
      q.id, qv.prompt, qv.stimulus, qv.options, qv.explanation,
      coalesce(ak.answer_key, qak.answer_key) as correct_answer,
      coalesce(s.name, 'Subject not tagged') as subject,
      coalesce(u.name, 'Unit not tagged') as unit
    from public.bookmarks b
    join public.questions q on q.id = b.question_id
    left join public.subjects s on s.id = q.subject_id
    left join public.units u on u.id = q.unit_id
    left join lateral (
      select v.id, v.prompt, v.stimulus, v.options, v.explanation
      from public.question_versions v
      where v.question_id = q.id
      order by v.version_number desc
      limit 1
    ) qv on true
    left join public.question_version_answer_keys ak on ak.question_version_id = qv.id
    left join public.question_answer_keys qak on qak.question_id = q.id
    where b.student_id = v_student
    order by b.created_at desc
  ),
  correct_latest as (
    select distinct on (tq.question_id)
      tq.question_id, sr.response, a.submitted_at, t.title
    from public.student_responses sr
    join public.test_attempts a on a.id = sr.attempt_id
    join public.test_questions tq on tq.id = sr.test_question_id
    join public.tests t on t.id = a.test_id
    where a.student_id = v_student
      and a.status in ('submitted','auto_submitted')
      and sr.is_correct is true
    order by tq.question_id, a.submitted_at desc nulls last, sr.last_saved_at desc
  ),
  incorrect_latest as (
    select distinct on (tq.question_id)
      tq.question_id, sr.response, a.submitted_at, t.title
    from public.student_responses sr
    join public.test_attempts a on a.id = sr.attempt_id
    join public.test_questions tq on tq.id = sr.test_question_id
    join public.tests t on t.id = a.test_id
    where a.student_id = v_student
      and a.status in ('submitted','auto_submitted')
      and sr.is_correct is false
    order by tq.question_id, a.submitted_at desc nulls last, sr.last_saved_at desc
  )
  select jsonb_build_object(
    'bookmarks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'prompt', b.prompt, 'stimulus', b.stimulus, 'options', b.options,
        'explanation', b.explanation, 'correctAnswer', b.correct_answer,
        'subject', b.subject, 'unit', b.unit
      )) from bookmarked b
    ), '[]'::jsonb),
    'correct', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'prompt', b.prompt, 'stimulus', b.stimulus, 'options', b.options,
        'explanation', b.explanation, 'correctAnswer', b.correct_answer,
        'subject', b.subject, 'unit', b.unit, 'response', cl.response,
        'testTitle', cl.title, 'date', cl.submitted_at,
        'attemptCount', b.attempt_count, 'correctCount', b.correct_count,
        'incorrectCount', b.incorrect_count
      ) order by cl.submitted_at desc nulls last)
      from base b
      join correct_latest cl on cl.question_id = b.id
      where b.correct_count > 0
    ), '[]'::jsonb),
    'incorrect', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'prompt', b.prompt, 'stimulus', b.stimulus, 'options', b.options,
        'explanation', b.explanation, 'correctAnswer', b.correct_answer,
        'subject', b.subject, 'unit', b.unit, 'response', il.response,
        'testTitle', il.title, 'date', il.submitted_at,
        'wrongCount', b.incorrect_count, 'attemptCount', b.attempt_count,
        'correctCount', b.correct_count, 'incorrectCount', b.incorrect_count
      ) order by il.submitted_at desc nulls last)
      from base b
      join incorrect_latest il on il.question_id = b.id
      where b.incorrect_count > 0
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.student_get_personal_notebook() from public, anon;
grant execute on function public.student_get_personal_notebook() to authenticated;

notify pgrst, 'reload schema';
commit;
