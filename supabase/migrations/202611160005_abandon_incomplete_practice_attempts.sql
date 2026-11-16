-- Mark explicitly exited practice sessions as abandoned. Abandoned attempts are never graded or included in completed analytics.
begin;

create or replace function public.student_abandon_practice_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_status public.attempt_status;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  update public.test_attempts
  set status = 'abandoned'::public.attempt_status,
      submitted_at = null,
      score = null,
      accuracy = null,
      correct_count = 0,
      incorrect_count = 0,
      unanswered_count = 0,
      questions_attempted = 0,
      result_published_at = null
  where id = p_attempt_id
    and student_id = v_student
    and status = 'in_progress'
  returning status into v_status;

  if not found then
    select status into v_status
    from public.test_attempts
    where id = p_attempt_id and student_id = v_student;

    if not found then
      raise exception 'Attempt not found';
    end if;

    if v_status in ('submitted','auto_submitted') then
      raise exception 'A submitted attempt cannot be abandoned';
    end if;
  end if;

  return jsonb_build_object('attempt_id', p_attempt_id, 'status', v_status);
end;
$$;

revoke all on function public.student_abandon_practice_attempt(uuid) from public, anon;
grant execute on function public.student_abandon_practice_attempt(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
