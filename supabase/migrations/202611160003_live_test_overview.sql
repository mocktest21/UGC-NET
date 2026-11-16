-- Student-facing overview metrics for scheduled live tests.
begin;

create or replace function public.student_get_live_test_overview(p_test_ids uuid[])
returns table(
  test_id uuid,
  participant_count bigint,
  my_score numeric,
  my_rank bigint,
  my_attempt_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  return query
  with eligible_tests as (
    select t.id
    from public.tests t
    where t.id=any(coalesce(p_test_ids,'{}'::uuid[]))
      and t.mode='live'
      and t.status='published'
      and (
        public.is_mockmaster_admin()
        or exists(
          select 1 from public.student_exam_preferences p
          where p.student_id=v_student and p.exam_id=t.exam_id
        )
      )
  ),
  all_attempts as (
    select a.test_id,a.student_id,a.status,a.score,a.max_score,a.submitted_at
    from public.test_attempts a
    join eligible_tests et on et.id=a.test_id
  ),
  best_scores as (
    select distinct on (aa.test_id,aa.student_id)
      aa.test_id,aa.student_id,aa.score,aa.max_score
    from all_attempts aa
    where aa.status in ('submitted','auto_submitted')
      and aa.result_published_at is not null
      and aa.score is not null
    order by aa.test_id,aa.student_id,aa.score desc,aa.submitted_at asc
  ),
  ranked_scores as (
    select bs.test_id,bs.student_id,bs.score,
      dense_rank() over(partition by bs.test_id order by bs.score desc) as score_rank
    from best_scores bs
  )
  select et.id,
    (select count(distinct aa.student_id) from all_attempts aa where aa.test_id=et.id),
    (select rs.score from ranked_scores rs where rs.test_id=et.id and rs.student_id=v_student),
    (select rs.score_rank from ranked_scores rs where rs.test_id=et.id and rs.student_id=v_student),
    (select aa.status::text from all_attempts aa where aa.test_id=et.id and aa.student_id=v_student order by aa.submitted_at desc nulls last limit 1)
  from eligible_tests et;
end;
$$;

revoke all on function public.student_get_live_test_overview(uuid[]) from public,anon;
grant execute on function public.student_get_live_test_overview(uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
