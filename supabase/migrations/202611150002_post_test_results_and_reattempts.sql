-- Post-test grading, secure result retrieval, reattempts and attempt history for Practice and Live tests.
begin;

create or replace function public.mm_response_is_correct(p_response jsonb,p_key jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare v_expected jsonb;
begin
  if p_response is null or p_response='null'::jsonb then return false; end if;
  if p_key ? 'correct_option_id' then
    v_expected:=p_key->'correct_option_id';
  elsif p_key ? 'correct_option_ids' then
    v_expected:=p_key->'correct_option_ids';
  elsif p_key ? 'correct_answer' then
    v_expected:=p_key->'correct_answer';
  elsif p_key ? 'answer' then
    v_expected:=p_key->'answer';
  else
    v_expected:=p_key;
  end if;
  return p_response=v_expected;
end;
$$;

drop function if exists public.student_submit_practice_test(uuid);

create function public.student_submit_practice_test(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid:=auth.uid();
  v_attempt public.test_attempts%rowtype;
  v_total integer;
  v_answered integer;
  v_correct integer;
  v_incorrect integer;
  v_unanswered integer;
  v_score numeric(10,2);
  v_max numeric(10,2);
  v_accuracy numeric(7,4);
  v_status public.attempt_status;
begin
  if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_attempt from public.test_attempts where id=p_attempt_id and student_id=v_student for update;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status not in ('in_progress') then
    return jsonb_build_object('attempt_id',p_attempt_id,'status',v_attempt.status,'already_submitted',true);
  end if;

  select count(*),
    count(*) filter(where sr.response is not null and sr.response<>'null'::jsonb and sr.response<>'""'::jsonb),
    count(*) filter(where sr.response is not null and sr.response<>'null'::jsonb and sr.response<>'""'::jsonb and public.mm_response_is_correct(sr.response,ak.answer_key)),
    count(*) filter(where sr.response is not null and sr.response<>'null'::jsonb and sr.response<>'""'::jsonb and not public.mm_response_is_correct(sr.response,ak.answer_key)),
    coalesce(sum(case
      when sr.response is null or sr.response='null'::jsonb or sr.response='""'::jsonb then 0
      when public.mm_response_is_correct(sr.response,ak.answer_key) then tq.marks
      else -tq.negative_marks end),0),
    coalesce(sum(tq.marks),0)
  into v_total,v_answered,v_correct,v_incorrect,v_score,v_max
  from public.student_responses sr
  join public.test_questions tq on tq.id=sr.test_question_id
  join public.test_question_answer_keys ak on ak.test_question_id=tq.id
  where sr.attempt_id=p_attempt_id;

  select count(*) into v_total from public.student_responses where attempt_id=p_attempt_id;
  v_unanswered:=greatest(0,v_total-v_answered);
  v_accuracy:=case when v_answered>0 then round((v_correct::numeric/v_answered)*100,2) else 0 end;
  v_status:=case when v_attempt.expires_at is not null and v_attempt.expires_at<=now() then 'auto_submitted'::public.attempt_status else 'submitted'::public.attempt_status end;

  update public.student_responses sr
  set is_correct=case
        when sr.response is null or sr.response='null'::jsonb or sr.response='""'::jsonb then null
        else public.mm_response_is_correct(sr.response,ak.answer_key) end,
      awarded_marks=case
        when sr.response is null or sr.response='null'::jsonb or sr.response='""'::jsonb then 0
        when public.mm_response_is_correct(sr.response,ak.answer_key) then tq.marks
        else -tq.negative_marks end
  from public.test_questions tq
  join public.test_question_answer_keys ak on ak.test_question_id=tq.id
  where sr.attempt_id=p_attempt_id and sr.test_question_id=tq.id;

  update public.test_attempts
  set status=v_status,submitted_at=coalesce(submitted_at,now()),
      time_taken_seconds=greatest(0,extract(epoch from (now()-started_at))::integer),
      questions_attempted=v_answered,correct_count=v_correct,incorrect_count=v_incorrect,
      unanswered_count=v_unanswered,score=v_score,max_score=v_max,accuracy=v_accuracy,
      result_published_at=now()
  where id=p_attempt_id and student_id=v_student;

  return jsonb_build_object('attempt_id',p_attempt_id,'status',v_status,'score',v_score,
    'max_score',v_max,'correct',v_correct,'incorrect',v_incorrect,'unattempted',v_unanswered,'accuracy',v_accuracy);
end;
$$;

create or replace function public.student_get_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid:=auth.uid();
  v_attempt public.test_attempts%rowtype;
  v_test public.tests%rowtype;
  v_questions jsonb;
  v_history jsonb;
begin
  if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_attempt from public.test_attempts where id=p_attempt_id and student_id=v_student;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status not in ('submitted','auto_submitted') then raise exception 'Result is not available until submission'; end if;
  select * into v_test from public.tests where id=v_attempt.test_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id',tq.id,'position',tq.position,'question_type',qv.question_type,
    'prompt',qv.prompt,'stimulus',qv.stimulus,'options',qv.options,'explanation',qv.explanation,
    'response',sr.response,'is_correct',sr.is_correct,'awarded_marks',sr.awarded_marks,
    'marks',tq.marks,'negative_marks',tq.negative_marks,'answer_key',ak.answer_key
  ) order by tq.position),'[]'::jsonb)
  into v_questions
  from public.student_responses sr
  join public.test_questions tq on tq.id=sr.test_question_id
  join public.question_versions qv on qv.id=tq.question_version_id
  join public.test_question_answer_keys ak on ak.test_question_id=tq.id
  where sr.attempt_id=p_attempt_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'attempt_number',a.attempt_number,'status',a.status,'score',a.score,
    'max_score',a.max_score,'accuracy',a.accuracy,'correct_count',a.correct_count,
    'incorrect_count',a.incorrect_count,'unanswered_count',a.unanswered_count,
    'time_taken_seconds',a.time_taken_seconds,'started_at',a.started_at,'submitted_at',a.submitted_at
  ) order by a.attempt_number),'[]'::jsonb)
  into v_history
  from public.test_attempts a
  where a.student_id=v_student
    and a.status in ('submitted','auto_submitted')
    and (
      a.test_id=v_attempt.test_id
      or a.test_id=v_test.source_live_test_id
      or exists (
        select 1 from public.tests linked
        where linked.id=a.test_id
          and linked.source_live_test_id=coalesce(v_test.source_live_test_id,v_test.id)
      )
    );

  return jsonb_build_object(
    'attempt',jsonb_build_object('id',v_attempt.id,'test_id',v_attempt.test_id,
      'attempt_number',v_attempt.attempt_number,'status',v_attempt.status,
      'score',v_attempt.score,'max_score',v_attempt.max_score,'accuracy',v_attempt.accuracy,
      'correct_count',v_attempt.correct_count,'incorrect_count',v_attempt.incorrect_count,
      'unanswered_count',v_attempt.unanswered_count,'questions_attempted',v_attempt.questions_attempted,
      'time_taken_seconds',v_attempt.time_taken_seconds,'submitted_at',v_attempt.submitted_at),
    'test',jsonb_build_object('id',v_test.id,'title',v_test.title,'mode',v_test.mode,
      'show_solutions',v_test.show_solutions,'source_live_test_id',v_test.source_live_test_id),
    'questions',v_questions,'history',v_history
  );
end;
$$;

create or replace function public.student_reattempt_test(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid:=auth.uid();
  v_attempt public.test_attempts%rowtype;
  v_test public.tests%rowtype;
  v_target_test uuid;
  v_new_attempt uuid;
  v_number integer;
begin
  if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_attempt from public.test_attempts where id=p_attempt_id and student_id=v_student;
  if not found or v_attempt.status not in ('submitted','auto_submitted') then
    raise exception 'Only a completed attempt can be reattempted';
  end if;
  select * into v_test from public.tests where id=v_attempt.test_id;
  v_target_test:=v_test.id;

  -- A live test is never reopened: reattempt it as a private practice copy.
  if v_test.mode='live' then
    insert into public.tests(exam_id,paper_id,subject_id,title,description,mode,creation_type,status,
      duration_seconds,total_marks,instructions,result_visibility,shuffle_questions,shuffle_options,
      show_solutions,created_by,published_at,source_live_test_id)
    values(v_test.exam_id,v_test.paper_id,v_test.subject_id,'Practice · '||v_test.title,
      coalesce(v_test.description,'Practice copy of a completed live test'),'practice','generated','published',
      v_test.duration_seconds,v_test.total_marks,v_test.instructions,'after_submission',
      v_test.shuffle_questions,v_test.shuffle_options,true,v_student,now(),v_test.id)
    returning id into v_target_test;

    insert into public.test_questions(test_id,question_id,question_version_id,section_title,position,marks,negative_marks,is_compulsory)
    select v_target_test,question_id,question_version_id,section_title,position,marks,negative_marks,is_compulsory
    from public.test_questions where test_id=v_test.id order by position;

    insert into public.test_question_answer_keys(test_question_id,answer_key,evaluation_rules)
    select newq.id,oldk.answer_key,oldk.evaluation_rules
    from public.test_questions oldq
    join public.test_question_answer_keys oldk on oldk.test_question_id=oldq.id
    join public.test_questions newq on newq.test_id=v_target_test and newq.question_id=oldq.question_id
    where oldq.test_id=v_test.id;
  end if;

  select coalesce(max(attempt_number),0)+1 into v_number
  from public.test_attempts where test_id=v_target_test and student_id=v_student;
  insert into public.test_attempts(test_id,student_id,attempt_number,status,expires_at,max_score)
  values(v_target_test,v_student,v_number,'in_progress',
    now()+make_interval(secs=>v_test.duration_seconds),v_test.total_marks)
  returning id into v_new_attempt;

  insert into public.student_responses(attempt_id,test_question_id)
  select v_new_attempt,id from public.test_questions where test_id=v_target_test;

  return jsonb_build_object('test_id',v_target_test,'attempt_id',v_new_attempt,
    'duration_seconds',v_test.duration_seconds,'attempt_number',v_number);
end;
$$;

revoke all on function public.mm_response_is_correct(jsonb,jsonb) from public,anon;
revoke all on function public.student_submit_practice_test(uuid) from public,anon;
revoke all on function public.student_get_attempt_result(uuid) from public,anon;
revoke all on function public.student_reattempt_test(uuid) from public,anon;
grant execute on function public.student_submit_practice_test(uuid) to authenticated;
grant execute on function public.student_get_attempt_result(uuid) to authenticated;
grant execute on function public.student_reattempt_test(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
