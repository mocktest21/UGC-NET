-- Show the full approved question-bank size for each unit in dashboard analytics.
-- Attempted remains date-filtered to the student's selected reporting period.
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
     'id',pp.id,'name',pp.name,
     'tests',(select count(*) from filtered pa where pa.paper_id=pp.id),
     'average',(select round(avg(pa.score/pa.max_score*100),1) from filtered pa where pa.paper_id=pp.id and pa.score is not null and pa.max_score>0),
     'accuracy',(select case when count(*) filter(where fr.is_correct is not null)>0 then round(100.0*count(*) filter(where fr.is_correct=true)/count(*) filter(where fr.is_correct is not null),1) else null end
       from filtered_response fr join filtered pa on pa.id=fr.attempt_id where pa.paper_id=pp.id),
     'correct',(select count(*) from filtered_response fr join filtered pa on pa.id=fr.attempt_id where pa.paper_id=pp.id and fr.is_correct=true),
     'incorrect',(select count(*) from filtered_response fr join filtered pa on pa.id=fr.attempt_id where pa.paper_id=pp.id and fr.is_correct=false)
   ) order by pp.name),'[]'::jsonb) as rows
   from public.papers pp
   where exists(select 1 from filtered f where f.paper_id=pp.id)
 ),
 units as (
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,'name',u.name,'paperName',u.paper_name,'attempted',u.attempted,'total',u.total,
    'correct',u.correct,'accuracy',u.accuracy,'coverage',u.coverage
   ) order by u.attempted desc,u.name),'[]'::jsonb) as rows
   from (
    select q.unit_id as id,coalesce(max(un.name),'Unlabelled') as name,
      coalesce(string_agg(distinct pp.name,' / '),'Paper') as paper_name,
      (select count(*) from public.questions allq where allq.unit_id=q.unit_id and allq.status='approved') as total,
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

notify pgrst,'reload schema';
commit;
