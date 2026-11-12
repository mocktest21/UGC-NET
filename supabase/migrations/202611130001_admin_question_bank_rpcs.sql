-- MockMaster Module 3: secure admin question-bank RPCs
-- Run once in Supabase SQL Editor after RESET_AND_INSTALL_MOCKMASTER.sql.
begin;

create or replace function public.admin_create_question(
  p_question jsonb,
  p_version jsonb,
  p_answer_key jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_version_id uuid;
  v_user_id uuid := auth.uid();
  v_type public.question_type;
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_type := (p_question->>'question_type')::public.question_type;
  if p_question->>'exam_id' is null or p_question->>'paper_id' is null
     or p_question->>'subject_id' is null or coalesce(p_version->'prompt'->'stem'->>'text','') = '' then
    raise exception 'Exam, paper, subject and question text are required';
  end if;
  if jsonb_typeof(coalesce(p_version->'options','[]'::jsonb)) <> 'array'
     or jsonb_typeof(p_answer_key) <> 'object' then
    raise exception 'Invalid options or answer key structure';
  end if;

  insert into public.questions(
    exam_id,paper_id,subject_id,unit_id,topic_id,question_type,difficulty,
    language_code,source_label,source_year,source_type,tags,status,created_by,updated_by
  ) values (
    (p_question->>'exam_id')::uuid,
    (p_question->>'paper_id')::uuid,
    (p_question->>'subject_id')::uuid,
    nullif(p_question->>'unit_id','')::uuid,
    nullif(p_question->>'topic_id','')::uuid,
    v_type,
    nullif(p_question->>'difficulty','')::public.difficulty_level,
    coalesce(nullif(p_question->>'language_code',''),'en'),
    nullif(p_question->>'source_label',''),
    nullif(p_question->>'source_year','')::integer,
    coalesce(nullif(p_question->>'source_type',''),'admin_created'),
    array(select jsonb_array_elements_text(coalesce(p_question->'tags','[]'::jsonb))),
    'draft',v_user_id,v_user_id
  ) returning id into v_question_id;

  insert into public.question_versions(
    question_id,version_number,question_type,prompt,options,stimulus,explanation,
    default_marks,default_negative_marks,created_by
  ) values (
    v_question_id,1,v_type,
    coalesce(p_version->'prompt','{}'::jsonb),
    coalesce(p_version->'options','[]'::jsonb),
    p_version->'stimulus',
    p_version->'explanation',
    coalesce(nullif(p_version->>'default_marks','')::numeric,2),
    coalesce(nullif(p_version->>'default_negative_marks','')::numeric,0),
    v_user_id
  ) returning id into v_version_id;

  insert into public.question_version_answer_keys(question_version_id,answer_key,evaluation_rules)
  values(v_version_id,p_answer_key,coalesce(p_version->'evaluation_rules','{}'::jsonb));

  insert into public.question_answer_keys(question_id,current_version_id,answer_key,evaluation_rules,updated_by)
  values(v_question_id,v_version_id,p_answer_key,coalesce(p_version->'evaluation_rules','{}'::jsonb),v_user_id);

  return v_question_id;
end;
$$;

create or replace function public.admin_stage_question_import(
  p_filename text,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be a JSON array';
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count = 0 or v_count > 5000 then
    raise exception 'Import must contain between 1 and 5000 rows';
  end if;

  insert into public.question_import_batches(
    source_filename,status,total_rows,uploaded_by,validation_report
  ) values (
    left(coalesce(p_filename,'question-import.xlsx'),255),
    'needs_review',v_count,v_user_id,
    jsonb_build_object('stage','uploaded_from_admin_question_bank')
  ) returning id into v_batch_id;

  insert into public.question_import_items(batch_id,row_number,raw_data,parsed_data,validation_errors,status)
  select v_batch_id, ordinality::integer, value, value, '[]'::jsonb, 'pending'
  from jsonb_array_elements(p_rows) with ordinality;

  return v_batch_id;
end;
$$;

revoke all on function public.admin_create_question(jsonb,jsonb,jsonb) from public, anon;
revoke all on function public.admin_stage_question_import(text,jsonb) from public, anon;
grant execute on function public.admin_create_question(jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.admin_stage_question_import(text,jsonb) to authenticated;

commit;
