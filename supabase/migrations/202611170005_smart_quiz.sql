-- Smart Quiz: retry every currently unresolved incorrect question in one focused practice attempt.
begin;

create or replace function public.student_start_smart_quiz()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_test_id uuid;
  v_attempt_id uuid;
  v_count integer;
  v_duration integer;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  create temporary table if not exists mm_smart_quiz_pool(
    question_id uuid primary key,
    version_id uuid not null,
    marks numeric(8,2) not null,
    negative_marks numeric(8,2) not null,
    pick_order integer not null
  ) on commit drop;
  truncate pg_temp.mm_smart_quiz_pool;

  insert into pg_temp.mm_smart_quiz_pool(question_id,version_id,marks,negative_marks,pick_order)
  with unresolved as (
    select distinct tq.question_id
    from public.student_responses sr
    join public.test_attempts a on a.id=sr.attempt_id
    join public.test_questions tq on tq.id=sr.test_question_id
    where a.student_id=v_student
      and a.status in ('submitted','auto_submitted')
      and sr.is_correct=false
      and not exists (
        select 1
        from public.student_responses good_sr
        join public.test_attempts good_a on good_a.id=good_sr.attempt_id
        join public.test_questions good_tq on good_tq.id=good_sr.test_question_id
        where good_a.student_id=v_student
          and good_a.status in ('submitted','auto_submitted')
          and good_tq.question_id=tq.question_id
          and good_sr.is_correct=true
      )
  ), latest as (
    select q.id as question_id, v.id as version_id,
      v.default_marks as marks, v.default_negative_marks as negative_marks
    from unresolved u
    join public.questions q on q.id=u.question_id
    join lateral (
      select qv.* from public.question_versions qv
      where qv.question_id=q.id
      order by qv.version_number desc limit 1
    ) v on true
    join public.question_version_answer_keys ak on ak.question_version_id=v.id
  )
  select question_id,version_id,marks,negative_marks,
    row_number() over(order by question_id)::integer
  from latest;

  select count(*) into v_count from pg_temp.mm_smart_quiz_pool;
  if v_count=0 then
    raise exception 'No incorrect questions are waiting in your Personal Notebook.';
  end if;

  v_duration:=least(21600,greatest(60,v_count*60));

  insert into public.tests(
    title,description,mode,creation_type,status,duration_seconds,total_marks,
    created_by,published_at,shuffle_questions,shuffle_options,show_solutions
  )
  values(
    'Smart Quiz · '||to_char(now(),'YYYY-MM-DD HH24:MI'),
    'A focused quiz made from your unresolved incorrect questions in Personal Notebook.',
    'practice','generated','published',v_duration,
    (select coalesce(sum(marks),0) from pg_temp.mm_smart_quiz_pool),
    v_student,now(),false,false,true
  )
  returning id into v_test_id;

  insert into public.test_questions(
    test_id,question_id,question_version_id,section_title,position,marks,negative_marks,is_compulsory
  )
  select v_test_id,question_id,version_id,'Smart Quiz',pick_order,marks,negative_marks,true
  from pg_temp.mm_smart_quiz_pool order by pick_order;

  insert into public.test_question_answer_keys(test_question_id,answer_key,evaluation_rules)
  select tq.id,ak.answer_key,ak.evaluation_rules
  from public.test_questions tq
  join public.question_version_answer_keys ak on ak.question_version_id=tq.question_version_id
  where tq.test_id=v_test_id;

  insert into public.test_attempts(test_id,student_id,attempt_number,status,expires_at,max_score)
  values(
    v_test_id,v_student,1,'in_progress',
    now()+make_interval(secs=>v_duration),
    (select total_marks from public.tests where id=v_test_id)
  )
  returning id into v_attempt_id;

  insert into public.student_responses(attempt_id,test_question_id)
  select v_attempt_id,id from public.test_questions where test_id=v_test_id;

  return jsonb_build_object(
    'test_id',v_test_id,'attempt_id',v_attempt_id,
    'question_count',v_count,'duration_seconds',v_duration
  );
end;
$$;

revoke all on function public.student_start_smart_quiz() from public,anon;
grant execute on function public.student_start_smart_quiz() to authenticated;

-- A question leaves Incorrect History as soon as the student has answered it correctly
-- in any completed attempt, including a Smart Quiz attempt.
create or replace function public.student_get_personal_notebook()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_student uuid:=auth.uid(); v_result jsonb;
begin
 if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
 with bookmarked as (
  select q.id,qv.prompt,qv.stimulus,qv.options,
   coalesce(s.name,'Subject not tagged') as subject,coalesce(u.name,'Unit not tagged') as unit
  from public.bookmarks b
  join public.questions q on q.id=b.question_id
  left join public.subjects s on s.id=q.subject_id
  left join public.units u on u.id=q.unit_id
  left join lateral (select prompt,stimulus,options from public.question_versions v where v.question_id=q.id order by version_number desc limit 1) qv on true
  where b.student_id=v_student
  order by b.created_at desc
 ),
 incorrect as (
  select distinct on (q.id) q.id,qv.prompt,qv.stimulus,qv.options,
   coalesce(s.name,'Subject not tagged') as subject,coalesce(u.name,'Unit not tagged') as unit,
   sr.response,t.title as test_title,a.submitted_at as date,
   (select count(distinct a2.id) from public.student_responses sr2
    join public.test_attempts a2 on a2.id=sr2.attempt_id
    join public.test_questions tq2 on tq2.id=sr2.test_question_id
    where a2.student_id=v_student and a2.status in ('submitted','auto_submitted')
      and tq2.question_id=q.id and sr2.is_correct=false) as wrong_count
  from public.student_responses sr
  join public.test_attempts a on a.id=sr.attempt_id and a.student_id=v_student
  join public.test_questions tq on tq.id=sr.test_question_id
  join public.questions q on q.id=tq.question_id
  join public.tests t on t.id=a.test_id
  left join public.subjects s on s.id=q.subject_id
  left join public.units u on u.id=q.unit_id
  left join lateral (select prompt,stimulus,options from public.question_versions v where v.question_id=q.id order by version_number desc limit 1) qv on true
  where a.status in ('submitted','auto_submitted') and sr.is_correct=false
    and not exists (
      select 1 from public.student_responses good_sr
      join public.test_attempts good_a on good_a.id=good_sr.attempt_id
      join public.test_questions good_tq on good_tq.id=good_sr.test_question_id
      where good_a.student_id=v_student
        and good_a.status in ('submitted','auto_submitted')
        and good_tq.question_id=q.id and good_sr.is_correct=true
    )
  order by q.id,a.submitted_at desc
 )
 select jsonb_build_object(
  'bookmarks',coalesce((select jsonb_agg(to_jsonb(bookmarked)) from bookmarked),'[]'::jsonb),
  'incorrect',coalesce((select jsonb_agg(jsonb_build_object(
   'id',incorrect.id,'prompt',incorrect.prompt,'stimulus',incorrect.stimulus,'options',incorrect.options,
   'subject',incorrect.subject,'unit',incorrect.unit,'response',incorrect.response,
   'testTitle',incorrect.test_title,'date',incorrect.date,'wrongCount',incorrect.wrong_count
  )) from incorrect),'[]'::jsonb)
 ) into v_result;
 return v_result;
end;
$$;

notify pgrst,'reload schema';
commit;
