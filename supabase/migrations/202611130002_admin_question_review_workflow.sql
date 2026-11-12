-- MockMaster Module 3A: controlled question review workflow
begin;

create or replace function public.admin_set_question_status(
  p_question_id uuid,
  p_status public.question_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status public.question_status;
  v_admin uuid := auth.uid();
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select status into v_old_status from public.questions where id=p_question_id for update;
  if not found then raise exception 'Question not found'; end if;

  if p_status = 'approved' and not exists (
    select 1 from public.question_versions v
    join public.question_version_answer_keys k on k.question_version_id=v.id
    where v.question_id=p_question_id
  ) then
    raise exception 'A question must have a saved answer key before approval';
  end if;

  if v_old_status = p_status then return; end if;
  if not (
    (v_old_status='draft' and p_status in ('in_review','archived')) or
    (v_old_status='in_review' and p_status in ('draft','approved','archived')) or
    (v_old_status='approved' and p_status in ('in_review','archived')) or
    (v_old_status='archived' and p_status='draft')
  ) then
    raise exception 'Invalid question status transition: % to %',v_old_status,p_status;
  end if;

  update public.questions set status=p_status,updated_by=v_admin,updated_at=now() where id=p_question_id;
  insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details)
  values(v_admin,'question_status_changed','question',p_question_id,
    jsonb_build_object('from',v_old_status,'to',p_status));
end;
$$;

revoke all on function public.admin_set_question_status(uuid,public.question_status) from public,anon;
grant execute on function public.admin_set_question_status(uuid,public.question_status) to authenticated;

commit;
