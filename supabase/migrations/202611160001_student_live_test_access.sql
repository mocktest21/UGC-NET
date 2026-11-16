-- Secure student start flow for published live tests.
begin;

create or replace function public.student_start_live_test(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_test public.tests%rowtype;
  v_attempt_id uuid;
  v_attempt_number integer;
  v_question_count integer;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select * into v_test
  from public.tests
  where id=p_test_id and mode='live' and status='published'
  for share;

  if not found then
    raise exception 'This live test is not available';
  end if;

  if v_test.starts_at is null or v_test.ends_at is null
     or now()<v_test.starts_at or now()>=v_test.ends_at then
    raise exception 'This test is outside its scheduled window';
  end if;

  if not exists (
    select 1 from public.student_exam_preferences p
    where p.student_id=v_student and p.exam_id=v_test.exam_id
  ) then
    raise exception 'This test is not available for your exam profile';
  end if;

  if exists (
    select 1 from public.test_attempts a
    where a.test_id=p_test_id and a.student_id=v_student and a.status='in_progress'
  ) then
    raise exception 'You already have an active attempt for this test';
  end if;

  select count(*) into v_attempt_number
  from public.test_attempts a
  where a.test_id=p_test_id and a.student_id=v_student;

  if v_test.max_attempts is not null and v_attempt_number>=v_test.max_attempts then
    raise exception 'You have used all allowed attempts for this test';
  end if;

  select count(*) into v_question_count
  from public.test_questions tq
  join public.test_question_answer_keys ak on ak.test_question_id=tq.id
  where tq.test_id=p_test_id;

  if v_question_count=0 or v_question_count<>(select count(*) from public.test_questions where test_id=p_test_id) then
    raise exception 'This live test is missing questions or answer keys';
  end if;

  insert into public.test_attempts(
    test_id,student_id,attempt_number,status,expires_at,max_score
  ) values (
    p_test_id,v_student,v_attempt_number+1,'in_progress',
    least(now()+make_interval(secs=>v_test.duration_seconds),v_test.ends_at),
    v_test.total_marks
  ) returning id into v_attempt_id;

  insert into public.student_responses(attempt_id,test_question_id)
  select v_attempt_id,tq.id
  from public.test_questions tq
  where tq.test_id=p_test_id;

  return jsonb_build_object(
    'test_id',p_test_id,
    'attempt_id',v_attempt_id,
    'duration_seconds',greatest(1,least(v_test.duration_seconds,extract(epoch from (v_test.ends_at-now()))::integer))
  );
end;
$$;

revoke all on function public.student_start_live_test(uuid) from public,anon;
grant execute on function public.student_start_live_test(uuid) to authenticated;

commit;
