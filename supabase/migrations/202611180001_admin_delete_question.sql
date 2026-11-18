-- Secure admin deletion for unused question-bank records.
-- Questions referenced by any test are intentionally protected and cannot be deleted.
begin;
create or replace function public.admin_delete_question(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_status public.question_status;
  v_version_ids uuid[];
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if v_admin is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  select status into v_status from public.questions where id=p_question_id for update;
  if not found then raise exception 'Question not found'; end if;

  if exists(select 1 from public.test_questions where question_id=p_question_id) then
    raise exception 'This question is already attached to a test and is protected from deletion. Archive it instead.';
  end if;

  select array_agg(id) into v_version_ids from public.question_versions where question_id=p_question_id;
  if coalesce(cardinality(v_version_ids),0)>0 then
    delete from public.question_version_answer_keys where question_version_id=any(v_version_ids);
  end if;
  delete from public.question_answer_keys where question_id=p_question_id;
  delete from public.question_versions where question_id=p_question_id;
  delete from public.questions where id=p_question_id;

  insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details)
  values(v_admin,'question_deleted','question',p_question_id,
    jsonb_build_object('previous_status',v_status,'deleted_at',now()));
  return jsonb_build_object('deleted',true,'question_id',p_question_id);
end;
$$;
revoke all on function public.admin_delete_question(uuid) from public,anon;
grant execute on function public.admin_delete_question(uuid) to authenticated;
commit;
