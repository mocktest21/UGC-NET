-- Student analytics endpoints: all aggregation happens in PostgreSQL, without PostgREST row caps.
begin;

create or replace function public.student_get_dashboard_analytics(
  p_from timestamptz default null,
  p_to timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_student uuid:=auth.uid(); v_result jsonb;
begin
 if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
 with all_attempts as (
   select a.* from public.test_attempts a
   where a.student_id=v_student and a.status in ('submitted','auto_submitted')
 ),
 filtered as (
   select a.*,t.title,t.paper_id from all_attempts a
   left join public.tests t on t.id=a.test_id
   where (p_from is null or coalesce(a.submitted_at,a.started_at)>=p_from)
     and (p_to is null or coalesce(a.submitted_at,a.started_at)<=p_to)
 ),
 all_response as (
   select sr.*,tq.question_id,tq.test_id
   from public.student_responses sr
   join all_attempts a on a.id=sr.attempt_id
   join public.test_questions tq on tq.id=sr.test_question_id
 ),
 filtered_response as (
   select fr.* from all_response fr join filtered f on f.id=fr.attempt_id
 ),
 overall as (
   select
    (select count(*) from all_attempts) as attempts,
    (select coalesce(sum(a.questions_attempted+a.unanswered_count),0) from all_attempts a) as total_questions,
    (select count(distinct r.question_id) from all_response r where r.response is not null and r.response<>'null'::jsonb and r.response<>'""'::jsonb) as unique_questions,
    (select case when count(*) filter(where r.is_correct is not null)>0 then round(100.0*count(*) filter(where r.is_correct=true)/count(*) filter(where r.is_correct is not null),1) else null end from all_response r) as accuracy,
    (select round(avg(a.score/a.max_score*100),1) from all_attempts a where a.score is not null and a.max_score>0) as average_score,
    (select round(avg(r.time_spent_seconds)) from all_response r where r.response is not null and r.response<>'null'::jsonb and r.response<>'""'::jsonb) as average_time
 ),
 recent as (
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',f.id,'test_id',f.test_id,'title',coalesce(f.title,'Mock test'),
    'score',f.score,'max_score',f.max_score,'accuracy',f.accuracy,
    'correct_count',f.correct_count,'incorrect_count',f.incorrect_count,
    'unanswered_count',f.unanswered_count,'questions_attempted',f.questions_attempted,
    'status',f.status,'started_at',f.started_at,'submitted_at',f.submitted_at,
    'time_taken_seconds',f.time_taken_seconds
   ) order by coalesce(f.submitted_at,f.started_at) desc),'[]'::jsonb) as rows
   from (select * from filtered order by coalesce(submitted_at,started_at) desc limit 20) f
 ),
 papers as (
   select coalesce(jsonb_agg(jsonb_build_object(
     'id',p.id,'name',p.name,'tests',p.tests,'average',p.average,'accuracy',p.accuracy,'correct',p.correct,'incorrect',p.incorrect
   ) order by p.name),'[]'::jsonb) as rows
   from (
     select pa.paper_id as id,coalesce(max(pp.name),'Paper') as name,count(distinct pa.id) as tests,
       round(avg(pa.score/pa.max_score*100) filter(where pa.score is not null and pa.max_score>0),1) as average,
       count(*) filter(where pr.is_correct=true) as correct,
       count(*) filter(where pr.is_correct=false) as incorrect,
       case when count(*) filter(where pr.is_correct is not null)>0 then round(100.0*count(*) filter(where pr.is_correct=true)/count(*) filter(where pr.is_correct is not null),1) else null end as accuracy
     from filtered pa
     join public.papers pp on pp.id=pa.paper_id
     left join filtered_response pr on pr.attempt_id=pa.id
     where pa.paper_id is not null
     group by pa.paper_id
   ) p
 ),
 units as (
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,'name',u.name,'paperName',u.paper_name,'attempted',u.attempted,'total',u.total,
    'correct',u.correct,'accuracy',u.accuracy,'coverage',u.coverage
   ) order by u.attempted desc,u.name),'[]'::jsonb) as rows
   from (
    select q.unit_id as id,coalesce(max(un.name),'Unlabelled') as name,
      coalesce(string_agg(distinct pp.name,' / '),'Paper') as paper_name,
      count(distinct q.id) as total,
      count(distinct q.id) filter(where exists(
       select 1 from filtered_response fr where fr.question_id=q.id and fr.response is not null and fr.response<>'null'::jsonb and fr.response<>'""'::jsonb
      )) as attempted,
      count(distinct q.id) filter(where exists(
       select 1 from filtered_response fr where fr.question_id=q.id and fr.is_correct=true
      )) as correct,
      case when count(*) filter(where fr.is_correct is not null)>0 then round(100.0*count(*) filter(where fr.is_correct=true)/count(*) filter(where fr.is_correct is not null),1) else 0 end as accuracy,
      case when count(distinct q.id)>0 then round(100.0*count(distinct q.id) filter(where exists(
       select 1 from filtered_response fr2 where fr2.question_id=q.id and fr2.response is not null and fr2.response<>'null'::jsonb and fr2.response<>'""'::jsonb
      ))/count(distinct q.id),1) else 0 end as coverage
    from public.questions q
    join public.test_questions tq on tq.question_id=q.id
    join filtered fa on fa.test_id=tq.test_id
    left join public.units un on un.id=q.unit_id
    left join public.papers pp on pp.id=fa.paper_id
    left join filtered_response fr on fr.question_id=q.id
    where q.unit_id is not null
    group by q.unit_id
   ) u
 ),
 preferences as (
  select coalesce(jsonb_agg(jsonb_build_object('exam_id',p.exam_id,'selected_subject_id',p.selected_subject_id,'name',e.name)),'[]'::jsonb) as rows
  from public.student_exam_preferences p left join public.exams e on e.id=p.exam_id
  where p.student_id=v_student
 )
 select jsonb_build_object(
  'overall',(select to_jsonb(overall) from overall),
  'attempts',(select rows from recent),
  'papers',(select rows from papers),
  'units',(select rows from units),
  'exams',(select rows from preferences)
 ) into v_result;
 return v_result;
end;
$$;

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

revoke all on function public.student_get_dashboard_analytics(timestamptz,timestamptz) from public,anon;
revoke all on function public.student_get_personal_notebook() from public,anon;
grant execute on function public.student_get_dashboard_analytics(timestamptz,timestamptz) to authenticated;
grant execute on function public.student_get_personal_notebook() to authenticated;
notify pgrst,'reload schema';
commit;
