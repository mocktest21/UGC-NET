-- MockMaster Test Builder: secure admin test creation and publishing.
-- Run this migration in Supabase SQL Editor after the core schema and question-bank RPC migrations.
begin;

create or replace function public.admin_create_test(
  p_test jsonb,
  p_questions jsonb,
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test_id uuid;
  v_admin uuid := auth.uid();
  v_question jsonb;
  v_question_id uuid;
  v_version_id uuid;
  v_test_question_id uuid;
  v_position integer := 0;
  v_total_marks numeric(10,2) := 0;
  v_mode public.test_mode;
  v_status public.test_status := 'draft';
  v_duration integer;
  v_count integer;
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_admin is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Questions must be supplied as an array';
  end if;
  v_count := jsonb_array_length(p_questions);
  if v_count < 1 or v_count > 300 then
    raise exception 'A test must contain between 1 and 300 questions';
  end if;
  if coalesce(trim(p_test->>'title'),'') = '' then
    raise exception 'Test title is required';
  end if;
  v_duration := coalesce(nullif(p_test->>'duration_seconds','')::integer,0);
  if v_duration < 60 or v_duration > 21600 then
    raise exception 'Duration must be between 1 minute and 6 hours';
  end if;
  v_mode := coalesce(nullif(p_test->>'mode','')::public.test_mode,'practice');
  if p_publish and v_mode='live' and (nullif(p_test->>'starts_at','') is null or nullif(p_test->>'ends_at','') is null) then
    raise exception 'Live tests require a start and end date/time before publishing';
  end if;
  if p_publish and v_mode='live' and (p_test->>'ends_at')::timestamptz <= (p_test->>'starts_at')::timestamptz then
    raise exception 'Live test end time must be after its start time';
  end if;

  insert into public.tests(
    exam_id,paper_id,subject_id,title,description,mode,creation_type,status,
    duration_seconds,total_marks,instructions,starts_at,ends_at,result_visibility,
    max_attempts,shuffle_questions,shuffle_options,show_solutions,created_by,published_at
  ) values (
    nullif(p_test->>'exam_id','')::uuid,
    nullif(p_test->>'paper_id','')::uuid,
    nullif(p_test->>'subject_id','')::uuid,
    trim(p_test->>'title'),
    nullif(trim(coalesce(p_test->>'description','')),''),
    v_mode,'admin',case when p_publish then 'published'::public.test_status else v_status end,
    v_duration,0,
    coalesce(p_test->'instructions','[]'::jsonb),
    nullif(p_test->>'starts_at','')::timestamptz,
    nullif(p_test->>'ends_at','')::timestamptz,
    coalesce(nullif(p_test->>'result_visibility',''),'after_submission'),
    nullif(p_test->>'max_attempts','')::integer,
    coalesce((p_test->>'shuffle_questions')::boolean,false),
    coalesce((p_test->>'shuffle_options')::boolean,false),
    coalesce((p_test->>'show_solutions')::boolean,true),
    v_admin,case when p_publish then now() else null end
  ) returning id into v_test_id;

  for v_question in select value from jsonb_array_elements(p_questions) loop
    v_question_id := (v_question->>'question_id')::uuid;
    v_position := v_position + 1;
    if not exists(select 1 from public.questions q where q.id=v_question_id and q.status='approved') then
      raise exception 'Only approved questions can be added to a test. Question % is not approved.',v_question_id;
    end if;
    select v.id into v_version_id
    from public.question_versions v
    join public.questions q on q.id=v.question_id
    where q.id=v_question_id
    order by v.version_number desc limit 1;
    if v_version_id is null then
      raise exception 'Question % has no saved version',v_question_id;
    end if;
    if not exists(select 1 from public.question_version_answer_keys k where k.question_version_id=v_version_id) then
      raise exception 'Question % has no answer key for its latest version',v_question_id;
    end if;
    insert into public.test_questions(test_id,question_id,question_version_id,section_title,position,marks,negative_marks,is_compulsory)
    values(
      v_test_id,v_question_id,v_version_id,
      coalesce(nullif(trim(v_question->>'section_title'),''),'General'),
      v_position,
      coalesce(nullif(v_question->>'marks','')::numeric,2),
      coalesce(nullif(v_question->>'negative_marks','')::numeric,0),
      coalesce((v_question->>'is_compulsory')::boolean,true)
    ) returning id into v_test_question_id;
    insert into public.test_question_answer_keys(test_question_id,answer_key,evaluation_rules)
    select v_test_question_id,k.answer_key,k.evaluation_rules
    from public.question_version_answer_keys k where k.question_version_id=v_version_id;
    v_total_marks := v_total_marks + coalesce(nullif(v_question->>'marks','')::numeric,2);
  end loop;

  update public.tests set total_marks=v_total_marks where id=v_test_id;
  insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details)
  values(v_admin,case when p_publish then 'test_created_and_published' else 'test_created_draft' end,
    'test',v_test_id,jsonb_build_object('question_count',v_count,'mode',v_mode));
  return v_test_id;
end;
$$;

create or replace function public.admin_publish_test(p_test_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.tests%rowtype;
  v_count integer;
  v_admin uuid := auth.uid();
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select * into v_test from public.tests where id=p_test_id for update;
  if not found then raise exception 'Test not found'; end if;
  if v_test.status <> 'draft' then raise exception 'Only draft tests can be published'; end if;
  select count(*) into v_count from public.test_questions where test_id=p_test_id;
  if v_count < 1 then raise exception 'Add at least one question before publishing'; end if;
  if v_test.mode='live' and (v_test.starts_at is null or v_test.ends_at is null or v_test.ends_at<=v_test.starts_at) then
    raise exception 'Live tests require a valid start and end date/time';
  end if;
  update public.tests set status='published',published_at=now() where id=p_test_id;
  insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details)
  values(v_admin,'test_published','test',p_test_id,jsonb_build_object('question_count',v_count));
end;
$$;

revoke all on function public.admin_create_test(jsonb,jsonb,boolean) from public,anon;
revoke all on function public.admin_publish_test(uuid) from public,anon;
grant execute on function public.admin_create_test(jsonb,jsonb,boolean) to authenticated;
grant execute on function public.admin_publish_test(uuid) to authenticated;

commit;
