-- Preserve each original test while creating randomized, independent reattempts.
begin;

alter table public.tests
  add column if not exists source_reattempt_test_id uuid
  references public.tests(id) on delete set null;

create index if not exists idx_tests_source_reattempt
  on public.tests(source_reattempt_test_id)
  where source_reattempt_test_id is not null;

create or replace function public.student_reattempt_test(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_attempt public.test_attempts%rowtype;
  v_source public.tests%rowtype;
  v_root_test uuid;
  v_new_test uuid;
  v_new_attempt uuid;
  v_number integer;
  v_question_count integer;
  v_key_count integer;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select * into v_attempt
  from public.test_attempts
  where id = p_attempt_id and student_id = v_student;

  if not found or v_attempt.status not in ('submitted','auto_submitted') then
    raise exception 'Only a completed attempt can be reattempted';
  end if;

  select * into v_source
  from public.tests
  where id = v_attempt.test_id;

  if not found then
    raise exception 'Original test not found';
  end if;

  v_root_test := coalesce(v_source.source_reattempt_test_id, v_source.source_live_test_id, v_source.id);

  select count(*) into v_question_count
  from public.test_questions
  where test_id = v_source.id;

  select count(*) into v_key_count
  from public.test_questions tq
  join public.test_question_answer_keys ak on ak.test_question_id = tq.id
  where tq.test_id = v_source.id;

  if v_question_count = 0 then
    raise exception 'The original test has no questions';
  end if;
  if v_key_count <> v_question_count then
    raise exception 'The original test is missing answer keys and cannot be reattempted';
  end if;

  -- Every reattempt gets its own immutable test instance. This avoids changing
  -- the order or question rows used by earlier attempts and their analysis.
  insert into public.tests(
    exam_id, paper_id, subject_id, title, description, mode, creation_type,
    status, duration_seconds, total_marks, instructions, result_visibility,
    max_attempts, shuffle_questions, shuffle_options, show_solutions,
    created_by, published_at, source_live_test_id, source_reattempt_test_id
  )
  values(
    v_source.exam_id, v_source.paper_id, v_source.subject_id,
    'Reattempt · ' || v_source.title,
    coalesce(v_source.description, 'Independent randomized reattempt'),
    'practice', 'generated', 'published',
    v_source.duration_seconds, v_source.total_marks, v_source.instructions,
    'after_submission', null, true, v_source.shuffle_options, true,
    v_student, now(),
    coalesce(v_source.source_live_test_id, case when v_source.mode = 'live' then v_source.id else null end),
    v_root_test
  )
  returning id into v_new_test;

  insert into public.test_questions(
    test_id, question_id, question_version_id, section_title, position,
    marks, negative_marks, is_compulsory
  )
  select
    v_new_test, question_id, question_version_id, section_title,
    row_number() over (order by random())::integer,
    marks, negative_marks, is_compulsory
  from public.test_questions
  where test_id = v_source.id;

  insert into public.test_question_answer_keys(test_question_id, answer_key, evaluation_rules)
  select new_tq.id, old_key.answer_key, old_key.evaluation_rules
  from public.test_questions old_tq
  join public.test_question_answer_keys old_key on old_key.test_question_id = old_tq.id
  join public.test_questions new_tq
    on new_tq.test_id = v_new_test
   and new_tq.question_id = old_tq.question_id
  where old_tq.test_id = v_source.id;

  select coalesce(max(a.attempt_number), 0) + 1 into v_number
  from public.test_attempts a
  join public.tests t on t.id = a.test_id
  where a.student_id = v_student
    and (
      t.id = v_root_test
      or t.source_reattempt_test_id = v_root_test
      or t.source_live_test_id = v_root_test
    );

  insert into public.test_attempts(
    test_id, student_id, attempt_number, status, expires_at, max_score
  )
  values(
    v_new_test, v_student, v_number, 'in_progress',
    now() + make_interval(secs => v_source.duration_seconds),
    v_source.total_marks
  )
  returning id into v_new_attempt;

  insert into public.student_responses(attempt_id, test_question_id)
  select v_new_attempt, id
  from public.test_questions
  where test_id = v_new_test;

  return jsonb_build_object(
    'test_id', v_new_test,
    'attempt_id', v_new_attempt,
    'duration_seconds', v_source.duration_seconds,
    'attempt_number', v_number,
    'question_count', v_question_count,
    'shuffled', true
  );
end;
$$;

create or replace function public.student_get_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_attempt public.test_attempts%rowtype;
  v_test public.tests%rowtype;
  v_root_test uuid;
  v_questions jsonb;
  v_history jsonb;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select * into v_attempt
  from public.test_attempts
  where id = p_attempt_id and student_id = v_student;

  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status not in ('submitted','auto_submitted') then
    raise exception 'Result is not available until submission';
  end if;

  select * into v_test from public.tests where id = v_attempt.test_id;
  v_root_test := coalesce(v_test.source_reattempt_test_id, v_test.source_live_test_id, v_test.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id', tq.id,
    'position', tq.position,
    'question_type', qv.question_type,
    'prompt', qv.prompt,
    'stimulus', qv.stimulus,
    'options', qv.options,
    'explanation', qv.explanation,
    'response', sr.response,
    'is_correct', sr.is_correct,
    'awarded_marks', sr.awarded_marks,
    'marks', tq.marks,
    'negative_marks', tq.negative_marks,
    'answer_key', ak.answer_key
  ) order by tq.position), '[]'::jsonb)
  into v_questions
  from public.student_responses sr
  join public.test_questions tq on tq.id = sr.test_question_id
  join public.question_versions qv on qv.id = tq.question_version_id
  join public.test_question_answer_keys ak on ak.test_question_id = tq.id
  where sr.attempt_id = p_attempt_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'attempt_number', a.attempt_number,
    'status', a.status,
    'score', a.score,
    'max_score', a.max_score,
    'accuracy', a.accuracy,
    'correct_count', a.correct_count,
    'incorrect_count', a.incorrect_count,
    'unanswered_count', a.unanswered_count,
    'time_taken_seconds', a.time_taken_seconds,
    'started_at', a.started_at,
    'submitted_at', a.submitted_at
  ) order by a.attempt_number), '[]'::jsonb)
  into v_history
  from public.test_attempts a
  join public.tests history_test on history_test.id = a.test_id
  where a.student_id = v_student
    and a.status in ('submitted','auto_submitted')
    and (
      history_test.id = v_root_test
      or history_test.source_reattempt_test_id = v_root_test
      or history_test.source_live_test_id = v_root_test
    );

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'test_id', v_attempt.test_id,
      'attempt_number', v_attempt.attempt_number,
      'status', v_attempt.status,
      'score', v_attempt.score,
      'max_score', v_attempt.max_score,
      'accuracy', v_attempt.accuracy,
      'correct_count', v_attempt.correct_count,
      'incorrect_count', v_attempt.incorrect_count,
      'unanswered_count', v_attempt.unanswered_count,
      'questions_attempted', v_attempt.questions_attempted,
      'time_taken_seconds', v_attempt.time_taken_seconds,
      'submitted_at', v_attempt.submitted_at
    ),
    'test', jsonb_build_object(
      'id', v_test.id,
      'title', v_test.title,
      'mode', v_test.mode,
      'show_solutions', v_test.show_solutions,
      'source_live_test_id', v_test.source_live_test_id
    ),
    'questions', v_questions,
    'history', v_history
  );
end;
$$;

revoke all on function public.student_reattempt_test(uuid) from public, anon;
revoke all on function public.student_get_attempt_result(uuid) from public, anon;
grant execute on function public.student_reattempt_test(uuid) to authenticated;
grant execute on function public.student_get_attempt_result(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
