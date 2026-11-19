-- Analytics v2: aggregates completed UGC-NET attempts across all test sources.
-- Keeps the existing dashboard and syllabus tracker RPC contracts unchanged.
begin;

create or replace function public.student_get_analytics_v2(
  p_from timestamptz default null,
  p_to timestamptz default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_subject uuid;
  v_exam uuid;
  v_result jsonb;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select id into v_exam from public.exams where code = 'UGC_NET' and is_active = true limit 1;
  select selected_subject_id into v_subject
  from public.student_exam_preferences
  where student_id = v_student and exam_id = v_exam;

  with chosen_subjects as (
    select s.id, s.paper_id, p.code as paper_code, p.name as paper_name, s.name as subject_name
    from public.subjects s
    join public.papers p on p.id = s.paper_id
    where s.exam_id = v_exam and s.is_active and p.is_active
      and (p.code = 'PAPER_1' or (p.code = 'PAPER_2' and s.id = v_subject))
  ),
  completed as (
    select a.id, a.test_id, a.started_at, a.submitted_at, a.time_taken_seconds,
           a.score, a.max_score, a.correct_count, a.incorrect_count, a.unanswered_count,
           a.questions_attempted, a.status, t.title
    from public.test_attempts a
    join public.tests t on t.id = a.test_id and t.exam_id = v_exam
    where a.student_id = v_student
      and a.status in ('submitted','auto_submitted')
      and (p_from is null or coalesce(a.submitted_at,a.started_at) >= p_from)
      and (p_to is null or coalesce(a.submitted_at,a.started_at) <= p_to)
  ),
  response_rows as (
    select a.id as attempt_id, a.test_id, coalesce(a.submitted_at,a.started_at) as activity_at,
           sr.id as response_id, sr.response, sr.is_correct, sr.time_spent_seconds,
           tq.question_id, q.paper_id, q.subject_id, q.unit_id, q.topic_id, q.difficulty
    from completed a
    join public.student_responses sr on sr.attempt_id = a.id
    join public.test_questions tq on tq.id = sr.test_question_id
    join public.questions q on q.id = tq.question_id
    join chosen_subjects cs on cs.id = q.subject_id and cs.paper_id = q.paper_id
    where sr.response is not null
      and sr.response <> 'null'::jsonb
      and sr.response <> '""'::jsonb
      and sr.response <> '{}'::jsonb
      and sr.response <> '[]'::jsonb
  ),
  answered as (
    select * from response_rows where is_correct is not null
  ),
  overall as (
    select
      (select count(*) from completed) as completed_tests,
      count(*) as answered_responses,
      count(*) filter (where is_correct = true) as correct_answers,
      count(*) filter (where is_correct = false) as incorrect_answers,
      count(distinct question_id) as unique_questions_attempted,
      case when count(*) > 0 then round(100.0 * count(*) filter (where is_correct = true) / count(*),1) else null end as accuracy,
      case when count(*) filter (where time_spent_seconds is not null and time_spent_seconds > 0) > 0
        then round(avg(time_spent_seconds) filter (where time_spent_seconds is not null and time_spent_seconds > 0),1) else null end as average_time_per_question
    from answered
  ),
  paper_stats as (
    select cs.paper_code, cs.paper_name, cs.subject_name,
      count(a.response_id) as attempted,
      count(a.response_id) filter(where a.is_correct = true) as correct,
      count(a.response_id) filter(where a.is_correct = false) as incorrect,
      case when count(a.response_id)>0 then round(100.0*count(a.response_id) filter(where a.is_correct=true)/count(a.response_id),1) else null end as accuracy
    from chosen_subjects cs
    left join answered a on a.subject_id=cs.id
    group by cs.paper_code,cs.paper_name,cs.subject_name
  ),
  unit_stats as (
    select u.id, u.name, u.unit_number, cs.paper_name,
      count(a.response_id) as attempted,
      count(a.response_id) filter(where a.is_correct=true) as correct,
      count(a.response_id) filter(where a.is_correct=false) as incorrect,
      case when count(a.response_id)>0 then round(100.0*count(a.response_id) filter(where a.is_correct=true)/count(a.response_id),1) else null end as accuracy
    from public.units u
    join chosen_subjects cs on cs.id=u.subject_id
    left join answered a on a.unit_id=u.id
    where u.is_active
    group by u.id,u.name,u.unit_number,u.display_order,cs.paper_name
  ),
  topic_stats as (
    select tp.id,tp.name,u.id as unit_id,u.name as unit_name,
      count(a.response_id) as attempted,
      count(a.response_id) filter(where a.is_correct=true) as correct,
      count(a.response_id) filter(where a.is_correct=false) as incorrect,
      case when count(a.response_id)>0 then round(100.0*count(a.response_id) filter(where a.is_correct=true)/count(a.response_id),1) else null end as accuracy
    from public.topics tp
    join public.units u on u.id=tp.unit_id
    join chosen_subjects cs on cs.id=u.subject_id
    left join answered a on a.topic_id=tp.id
    where tp.is_active and u.is_active
    group by tp.id,tp.name,u.id,u.name,tp.display_order
  ),
  difficulty_stats as (
    select coalesce(difficulty::text,'unclassified') as difficulty,
      count(*) as attempted,
      count(*) filter(where is_correct=true) as correct,
      count(*) filter(where is_correct=false) as incorrect
    from answered group by difficulty
  ),
  daily_stats as (
    select (activity_at at time zone 'Asia/Kolkata')::date as activity_date,
      count(distinct question_id) as questions,
      array_agg(distinct question_id::text) as question_ids
    from response_rows
    group by (activity_at at time zone 'Asia/Kolkata')::date
  ),
  attempt_list as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'title',coalesce(title,'Mock test'),'started_at',started_at,
      'submitted_at',submitted_at,'status',status,'time_taken_seconds',time_taken_seconds,
      'score',score,'max_score',max_score,'correct_count',correct_count,
      'incorrect_count',incorrect_count,'unanswered_count',unanswered_count,
      'questions_attempted',questions_attempted
    ) order by coalesce(submitted_at,started_at) desc),'[]'::jsonb) as items
    from completed
  )
  select jsonb_build_object(
    'overall',(select to_jsonb(overall) from overall),
    'papers',coalesce((select jsonb_agg(to_jsonb(paper_stats) order by paper_code) from paper_stats),'[]'::jsonb),
    'units',coalesce((select jsonb_agg(to_jsonb(unit_stats) order by paper_name,unit_number,name) from unit_stats),'[]'::jsonb),
    'topics',coalesce((select jsonb_agg(to_jsonb(topic_stats) order by unit_name,name) from topic_stats),'[]'::jsonb),
    'difficulty',coalesce((select jsonb_agg(to_jsonb(difficulty_stats) order by difficulty) from difficulty_stats),'[]'::jsonb),
    'consistency',coalesce((select jsonb_agg(to_jsonb(daily_stats) order by activity_date) from daily_stats),'[]'::jsonb),
    'attempts',(select items from attempt_list),
    'selected_subject_id',v_subject
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.student_get_analytics_v2(timestamptz,timestamptz) from public, anon;
grant execute on function public.student_get_analytics_v2(timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
