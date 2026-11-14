-- Multi-unit support for student-generated practice tests.
begin;

create or replace function public.student_start_practice_test(
  p_exam_id uuid,
  p_paper_id uuid,
  p_subject_id uuid default null,
  p_unit_ids uuid[] default null,
  p_question_count integer default 50,
  p_duration_seconds integer default 3000,
  p_language_code text default 'en',
  p_source text default 'all'
)
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
begin
  if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_question_count < 1 or p_question_count > 300 then raise exception 'Question count must be between 1 and 300'; end if;
  if p_duration_seconds < 60 or p_duration_seconds > 21600 then raise exception 'Duration must be between 1 minute and 6 hours'; end if;
  if p_source not in ('all','pyq','expected') then raise exception 'Invalid question source'; end if;

  create temporary table if not exists mm_practice_pool(question_id uuid primary key, version_id uuid, marks numeric, negative_marks numeric, pick_order integer) on commit drop;
  truncate pg_temp.mm_practice_pool;

  insert into pg_temp.mm_practice_pool(question_id,version_id,marks,negative_marks,pick_order)
  with eligible as (
    select q.id, v.id as version_id, v.default_marks, v.default_negative_marks,
      exists(
        select 1 from public.student_responses sr
        join public.test_questions old_tq on old_tq.id=sr.test_question_id
        join public.test_attempts old_a on old_a.id=sr.attempt_id
        where old_a.student_id=v_student and old_a.status in ('submitted','auto_submitted')
          and old_tq.question_id=q.id
      ) as seen
    from public.questions q
    join lateral (
      select qv.* from public.question_versions qv
      where qv.question_id=q.id order by qv.version_number desc limit 1
    ) v on true
    join public.question_version_answer_keys ak on ak.question_version_id=v.id
    where q.status='approved' and q.exam_id=p_exam_id and q.paper_id=p_paper_id
      and (p_subject_id is null or q.subject_id=p_subject_id)
      and (coalesce(cardinality(p_unit_ids),0)=0 or q.unit_id=any(p_unit_ids))
      and (p_language_code is null or q.language_code=p_language_code)
      and (p_source='all' or (p_source='pyq' and q.source_type='previous_year') or (p_source='expected' and q.source_type='admin_created'))
      and not exists (
        select 1 from public.test_questions live_tq
        join public.tests live_t on live_t.id=live_tq.test_id
        where live_tq.question_id=q.id and live_t.mode='live' and live_t.status='published'
          and live_t.ends_at is not null and live_t.ends_at>now()
      )
  ), unseen as (
    select * from eligible where not seen order by random() limit p_question_count
  ), repeated as (
    select * from eligible where seen
      and (select count(*) from unseen)<p_question_count
    order by random() limit greatest(0,p_question_count-(select count(*) from unseen))
  ), picked as (
    select * from unseen union all select * from repeated
  )
  select id,version_id,default_marks,default_negative_marks,row_number() over(order by random())::integer
  from picked;

  select count(*) into v_count from pg_temp.mm_practice_pool;
  if v_count=0 then raise exception 'No eligible approved questions match these filters'; end if;

  insert into public.tests(exam_id,paper_id,subject_id,title,mode,creation_type,status,duration_seconds,total_marks,created_by,published_at,shuffle_questions,shuffle_options,show_solutions)
  values(p_exam_id,p_paper_id,p_subject_id,'Personalised Practice · '||to_char(now(),'YYYY-MM-DD HH24:MI'),
    'practice','generated','published',p_duration_seconds,
    (select coalesce(sum(marks),0) from pg_temp.mm_practice_pool),v_student,now(),true,true,true)
  returning id into v_test_id;

  insert into public.test_questions(test_id,question_id,question_version_id,section_title,position,marks,negative_marks,is_compulsory)
  select v_test_id,question_id,version_id,'Practice',pick_order,marks,negative_marks,true
  from pg_temp.mm_practice_pool order by pick_order;

  insert into public.test_question_answer_keys(test_question_id,answer_key,evaluation_rules)
  select tq.id,ak.answer_key,ak.evaluation_rules
  from public.test_questions tq
  join public.question_version_answer_keys ak on ak.question_version_id=tq.question_version_id
  where tq.test_id=v_test_id;

  insert into public.test_attempts(test_id,student_id,attempt_number,status,expires_at,max_score)
  values(v_test_id,v_student,1,'in_progress',now()+make_interval(secs=>p_duration_seconds),
    (select total_marks from public.tests where id=v_test_id))
  returning id into v_attempt_id;

  insert into public.student_responses(attempt_id,test_question_id)
  select v_attempt_id,id from public.test_questions where test_id=v_test_id;

  return jsonb_build_object('test_id',v_test_id,'attempt_id',v_attempt_id,'question_count',v_count);
end;
$$;



revoke all on function public.student_start_practice_test(uuid,uuid,uuid,uuid[],integer,integer,text,text) from public,anon;
grant execute on function public.student_start_practice_test(uuid,uuid,uuid,uuid[],integer,integer,text,text) to authenticated;

commit;
