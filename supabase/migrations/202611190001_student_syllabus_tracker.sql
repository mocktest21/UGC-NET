-- Student Syllabus Tracker: approved question-bank coverage and unique student attempts.
begin;

create or replace function public.student_get_syllabus_tracker()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_exam uuid;
  v_selected_subject uuid;
  v_result jsonb;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select id into v_exam from public.exams where code='UGC_NET' and is_active=true limit 1;
  if v_exam is null then
    raise exception 'UGC-NET configuration is unavailable';
  end if;

  select selected_subject_id into v_selected_subject
  from public.student_exam_preferences
  where student_id=v_student and exam_id=v_exam;

  with chosen_subjects as (
    select s.id as subject_id, s.name as subject_name, p.id as paper_id,
           p.code as paper_code, p.name as paper_name
    from public.subjects s
    join public.papers p on p.id=s.paper_id
    where s.exam_id=v_exam and s.is_active=true and p.is_active=true
      and (
        (p.code='PAPER_1')
        or (p.code='PAPER_2' and s.id=v_selected_subject)
      )
  ),
  student_latest as (
    select distinct on (tq.question_id)
      tq.question_id, sr.is_correct
    from public.test_attempts a
    join public.student_responses sr on sr.attempt_id=a.id
    join public.test_questions tq on tq.id=sr.test_question_id
    where a.student_id=v_student
      and sr.response is not null
      and sr.response <> 'null'::jsonb
      and sr.response <> '""'::jsonb
      and sr.response <> '{}'::jsonb
      and sr.response <> '[]'::jsonb
    order by tq.question_id, sr.last_saved_at desc, a.started_at desc
  ),
  unit_stats as (
    select cs.paper_code, cs.paper_name, cs.subject_id, cs.subject_name,
      u.id as unit_id, u.name as unit_name, u.unit_number, u.display_order,
      count(q.id)::integer as total_questions,
      count(q.id) filter(where sl.question_id is not null)::integer as attempted_questions,
      count(q.id) filter(where sl.is_correct=true)::integer as correct_questions,
      count(q.id) filter(where sl.is_correct=false)::integer as incorrect_questions
    from chosen_subjects cs
    join public.units u on u.subject_id=cs.subject_id and u.is_active=true
    left join public.questions q on q.unit_id=u.id and q.status='approved'
      and q.exam_id=v_exam and q.paper_id=cs.paper_id and q.subject_id=cs.subject_id
    left join student_latest sl on sl.question_id=q.id
    group by cs.paper_code,cs.paper_name,cs.subject_id,cs.subject_name,
      u.id,u.name,u.unit_number,u.display_order
  ),
  paper_stats as (
    select cs.paper_code, cs.paper_name, cs.subject_id, cs.subject_name,
      count(q.id)::integer as total_questions,
      count(q.id) filter(where sl.question_id is not null)::integer as attempted_questions,
      count(q.id) filter(where sl.is_correct=true)::integer as correct_questions,
      count(q.id) filter(where sl.is_correct=false)::integer as incorrect_questions
    from chosen_subjects cs
    left join public.questions q on q.exam_id=v_exam and q.paper_id=cs.paper_id
      and q.subject_id=cs.subject_id and q.status='approved'
    left join student_latest sl on sl.question_id=q.id
    group by cs.paper_code,cs.paper_name,cs.subject_id,cs.subject_name
  )
  select jsonb_build_object(
    'selected_subject_id',v_selected_subject,
    'papers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'paper_code',ps.paper_code,'paper_name',ps.paper_name,
        'subject_id',ps.subject_id,'subject_name',ps.subject_name,
        'total_questions',ps.total_questions,
        'attempted_questions',ps.attempted_questions,
        'remaining_questions',greatest(0,ps.total_questions-ps.attempted_questions),
        'correct_questions',ps.correct_questions,
        'incorrect_questions',ps.incorrect_questions,
        'completion',case when ps.total_questions>0 then round(100.0*ps.attempted_questions/ps.total_questions,1) else 0 end,
        'accuracy',case when ps.attempted_questions>0 then round(100.0*ps.correct_questions/ps.attempted_questions,1) else 0 end,
        'units',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',us.unit_id,'name',us.unit_name,'unit_number',us.unit_number,
            'total_questions',us.total_questions,
            'attempted_questions',us.attempted_questions,
            'remaining_questions',greatest(0,us.total_questions-us.attempted_questions),
            'correct_questions',us.correct_questions,
            'incorrect_questions',us.incorrect_questions,
            'completion',case when us.total_questions>0 then round(100.0*us.attempted_questions/us.total_questions,1) else 0 end,
            'accuracy',case when us.attempted_questions>0 then round(100.0*us.correct_questions/us.attempted_questions,1) else 0 end
          ) order by us.display_order,us.unit_number,us.unit_name)
          from unit_stats us where us.subject_id=ps.subject_id
        ),'[]'::jsonb)
      ) order by case ps.paper_code when 'PAPER_1' then 1 else 2 end)
      from paper_stats ps
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.student_get_syllabus_tracker() from public, anon;
grant execute on function public.student_get_syllabus_tracker() to authenticated;
notify pgrst,'reload schema';
commit;
