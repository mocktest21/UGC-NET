-- Score-only leaderboard for completed scheduled live tests.
begin;

create or replace function public.student_get_live_test_leaderboard(p_test_id uuid)
returns table(
  leaderboard_rank bigint,
  student_id uuid,
  student_name text,
  score numeric,
  max_score numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_test public.tests%rowtype;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select * into v_test
  from public.tests
  where id=p_test_id and mode='live' and status='published';

  if not found then
    raise exception 'Live test not found';
  end if;

  if v_test.ends_at is null or now()<v_test.ends_at then
    raise exception 'Leaderboard will be available after the live test ends';
  end if;

  if not public.is_mockmaster_admin()
     and exists(select 1 from public.student_exam_preferences p0 where p0.student_id=v_student)
     and not exists(
       select 1 from public.student_exam_preferences p
       where p.student_id=v_student and p.exam_id=v_test.exam_id
     ) then
    raise exception 'This leaderboard is not available for your exam profile';
  end if;

  return query
  with best_attempts as (
    select distinct on (a.student_id)
      a.student_id,a.score,a.max_score,a.submitted_at
    from public.test_attempts a
    where a.test_id=p_test_id
      and a.status in ('submitted','auto_submitted')
      and a.result_published_at is not null
      and a.score is not null
    order by a.student_id,a.score desc,a.submitted_at asc
  ),
  named_scores as (
    select b.student_id,
      coalesce(nullif(trim(p.full_name),''),'Student')::text as display_name,
      b.score,b.max_score
    from best_attempts b
    left join public.profiles p on p.id=b.student_id
  ),
  ranked as (
    select dense_rank() over(order by n.score desc) as score_rank,
      n.student_id,n.display_name,n.score,n.max_score
    from named_scores n
  )
  select r.score_rank,r.student_id,r.display_name,r.score,r.max_score
  from ranked r
  order by r.score_rank,r.display_name;
end;
$$;

revoke all on function public.student_get_live_test_leaderboard(uuid) from public,anon;
grant execute on function public.student_get_live_test_leaderboard(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
