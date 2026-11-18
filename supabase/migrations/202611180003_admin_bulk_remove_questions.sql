-- Batch removal for admin question bank.
-- Unused questions are permanently deleted; test-linked questions are archived.
-- Historical tests and attempts remain unchanged.
begin;

create or replace function public.admin_bulk_remove_questions(p_question_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_deleted integer := 0;
  v_archived integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_error text;
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_question_ids is null or cardinality(p_question_ids)=0 then
    raise exception 'Select at least one question';
  end if;
  if cardinality(p_question_ids)>500 then
    raise exception 'Bulk removal is limited to 500 questions per request';
  end if;

  foreach v_id in array (select array_agg(distinct x) from unnest(p_question_ids) as x)
  loop
    begin
      perform public.admin_delete_question(v_id);
      v_deleted := v_deleted + 1;
    exception when others then
      get stacked diagnostics v_error = message_text;
      if position('already attached to a test' in v_error)>0 then
        begin
          perform public.admin_set_question_status(v_id,'archived'::public.question_status);
          v_archived := v_archived + 1;
        exception when others then
          get stacked diagnostics v_error = message_text;
          v_errors := v_errors || jsonb_build_array(jsonb_build_object('question_id',v_id,'message',v_error));
        end;
      else
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('question_id',v_id,'message',v_error));
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'deleted',v_deleted,
    'archived',v_archived,
    'failed',jsonb_array_length(v_errors),
    'errors',v_errors
  );
end;
$$;

revoke all on function public.admin_bulk_remove_questions(uuid[]) from public,anon;
grant execute on function public.admin_bulk_remove_questions(uuid[]) to authenticated;

notify pgrst,'reload schema';
commit;
