-- Make completed admin-created live tests reusable as independent practice attempts.
-- The original question rows are already in the approved question bank; this migration
-- reuses their immutable question versions without creating duplicate bank records.
begin;

alter table public.tests
  add column if not exists source_live_test_id uuid
  references public.tests(id) on delete set null;

create index if not exists idx_tests_source_live_test
  on public.tests(source_live_test_id)
  where source_live_test_id is not null;

create or replace function public.student_start_completed_live_test(p_source_live_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_source public.tests%rowtype;
  v_test_id uuid;
  v_attempt_id uuid;
  v_question_count integer;
  v_key_count integer;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select * into v_source
  from public.tests
  where id=p_source_live_test_id
    and mode='live'
    and status='published'
    and ends_at is not null
    and ends_at<=now()
  for share;

  if not found then
    raise exception 'This live test is not completed or is no longer available';
  end if;

  if not exists (
    select 1 from public.student_exam_preferences p
    where p.student_id=v_student and p.exam_id=v_source.exam_id
  ) then
    raise exception 'This test is not available for your exam profile';
  end if;

  select count(*) into v_question_count
  from public.test_questions
  where test_id=v_source.id;

  select count(*) into v_key_count
  from public.test_questions tq
  join public.test_question_answer_keys ak on ak.test_question_id=tq.id
  where tq.test_id=v_source.id;

  if v_question_count=0 then
    raise exception 'This live test has no questions';
  end if;
  if v_key_count<>v_question_count then
    raise exception 'This live test is missing answer keys and cannot be practised yet';
  end if;

  insert into public.tests(
    exam_id,paper_id,subject_id,title,description,mode,creation_type,status,
    duration_seconds,total_marks,instructions,result_visibility,max_attempts,
    shuffle_questions,shuffle_options,show_solutions,created_by,published_at,
    source_live_test_id
  ) values (
    v_source.exam_id,v_source.paper_id,v_source.subject_id,
    'Practice · '||v_source.title,
    coalesce(v_source.description,'Practice version of a completed live test'),
    'practice','generated','published',
    v_source.duration_seconds,v_source.total_marks,v_source.instructions,
    'after_submission',1,v_source.shuffle_questions,v_source.shuffle_options,
    true,v_student,now(),v_source.id
  ) returning id into v_test_id;

  insert into public.test_questions(
    test_id,question_id,question_version_id,section_title,position,
    marks,negative_marks,is_compulsory
  )
  select v_test_id,question_id,question_version_id,section_title,position,
         marks,negative_marks,is_compulsory
  from public.test_questions
  where test_id=v_source.id
  order by position;

  insert into public.test_question_answer_keys(test_question_id,answer_key,evaluation_rules)
  select new_tq.id,old_ak.answer_key,old_ak.evaluation_rules
  from public.test_questions old_tq
  join public.test_question_answer_keys old_ak on old_ak.test_question_id=old_tq.id
  join public.test_questions new_tq
    on new_tq.test_id=v_test_id and new_tq.question_id=old_tq.question_id
  where old_tq.test_id=v_source.id;

  insert into public.test_attempts(test_id,student_id,attempt_number,status,expires_at,max_score)
  values(v_test_id,v_student,1,'in_progress',
         now()+make_interval(secs=>v_source.duration_seconds),v_source.total_marks)
  returning id into v_attempt_id;

  insert into public.student_responses(attempt_id,test_question_id)
  select v_attempt_id,id from public.test_questions where test_id=v_test_id;

  return jsonb_build_object(
    'test_id',v_test_id,
    'attempt_id',v_attempt_id,
    'question_count',v_question_count,
    'duration_seconds',v_source.duration_seconds
  );
end;
$$;

revoke all on function public.student_start_completed_live_test(uuid) from public,anon;
grant execute on function public.student_start_completed_live_test(uuid) to authenticated;

commit;
