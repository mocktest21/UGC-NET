-- Bulk approval for selected questions in the administrator question bank.
begin;

create or replace function public.admin_bulk_approve_questions(p_question_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_approved integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_error text;
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_question_ids is null or cardinality(p_question_ids) = 0 then
    raise exception 'Select at least one question';
  end if;
  if cardinality(p_question_ids) > 500 then
    raise exception 'Bulk approval is limited to 500 questions per request';
  end if;

  foreach v_question_id in array p_question_ids
  loop
    begin
      perform public.admin_set_question_status(v_question_id, 'approved'::public.question_status);
      v_approved := v_approved + 1;
    exception when others then
      get stacked diagnostics v_error = message_text;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('question_id', v_question_id, 'message', v_error)
      );
    end;
  end loop;

  return jsonb_build_object(
    'approved', v_approved,
    'failed', jsonb_array_length(v_errors),
    'errors', v_errors
  );
end;
$$;

revoke all on function public.admin_bulk_approve_questions(uuid[]) from public, anon;
grant execute on function public.admin_bulk_approve_questions(uuid[]) to authenticated;

commit;
