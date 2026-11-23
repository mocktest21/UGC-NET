-- Fixed, prebuilt UGC NET full-length tests (50 Paper 1 + 100 Paper 2).
begin;
alter table public.tests add column if not exists test_category text not null default 'regular' check(test_category in ('regular','full_length'));
create table if not exists public.full_length_test_items(
 id uuid primary key default gen_random_uuid(), test_id uuid not null references public.tests(id) on delete cascade,
 position integer not null check(position between 1 and 150), paper_id uuid not null references public.papers(id),
 subject_id uuid not null references public.subjects(id), raw_row jsonb not null check(jsonb_typeof(raw_row)='object'),
 resolved_question_id uuid references public.questions(id), created_at timestamptz not null default now(), unique(test_id,position)
);
alter table public.full_length_test_items enable row level security;
revoke all on public.full_length_test_items from anon,authenticated;

create or replace function public.admin_create_full_length_draft(p_test jsonb,p_rows jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=auth.uid(); v_id uuid; v_exam uuid; v_p1 uuid; v_p2 uuid; v_s2 uuid; v_n1 int; v_n2 int; v_row jsonb; v_pos int:=0;
begin
 if not public.is_mockmaster_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if v_admin is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if coalesce(trim(p_test->>'title'),'')='' then raise exception 'Test title is required'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<>150 then raise exception 'A Full-Length Test must contain exactly 150 questions'; end if;
 v_exam:=nullif(p_test->>'exam_id','')::uuid; v_p1:=nullif(p_test->>'paper1_id','')::uuid; v_p2:=nullif(p_test->>'paper2_id','')::uuid; v_s2:=nullif(p_test->>'paper2_subject_id','')::uuid;
 if v_exam is null or v_p1 is null or v_p2 is null or v_s2 is null then raise exception 'Exam, Paper 1, Paper 2 and Paper 2 subject are required'; end if;
 select count(*) into v_n1 from jsonb_array_elements(p_rows) r where nullif(r->>'paper_id','')::uuid=v_p1;
 select count(*) into v_n2 from jsonb_array_elements(p_rows) r where nullif(r->>'paper_id','')::uuid=v_p2;
 if v_n1<>50 or v_n2<>100 then raise exception 'Question split must be exactly 50 for Paper 1 and 100 for Paper 2'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where nullif(r->>'exam_id','')::uuid is distinct from v_exam or nullif(r->>'subject_id','')::uuid is null or coalesce(trim(r->>'question'),'')='' or coalesce(trim(r->>'correct_answer'),'')='') then raise exception 'Every row must contain matching exam, subject, question and correct answer'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where (nullif(r->>'paper_id','')::uuid=v_p1 and nullif(r->>'subject_id','')::uuid is distinct from (select s.id from public.subjects s where s.paper_id=v_p1 limit 1)) or (nullif(r->>'paper_id','')::uuid=v_p2 and nullif(r->>'subject_id','')::uuid is distinct from v_s2)) then raise exception 'Paper 1 or Paper 2 subject mapping does not match the selected test configuration'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where nullif(r->>'paper_id','')::uuid not in (v_p1,v_p2)) then raise exception 'Only Paper 1 and Paper 2 questions are allowed'; end if;
 insert into public.tests(exam_id,paper_id,subject_id,title,description,mode,creation_type,status,duration_seconds,total_marks,instructions,result_visibility,max_attempts,shuffle_questions,shuffle_options,show_solutions,created_by,test_category)
 values(v_exam,null,v_s2,trim(p_test->>'title'),nullif(trim(coalesce(p_test->>'description','')),''),'practice','admin','draft',10800,0,'["Paper 1: 50 questions","Paper 2: 100 questions","Total duration: 180 minutes"]'::jsonb,'after_submission',null,false,false,true,v_admin,'full_length') returning id into v_id;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  v_pos:=v_pos+1; insert into public.full_length_test_items(test_id,position,paper_id,subject_id,raw_row) values(v_id,v_pos,(v_row->>'paper_id')::uuid,(v_row->>'subject_id')::uuid,v_row);
 end loop;
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details) values(v_admin,'full_length_test_draft_created','test',v_id,jsonb_build_object('question_count',150,'paper_1',50,'paper_2',100));
 return v_id;
end; $$;

create or replace function public.admin_publish_full_length_test(p_test_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=auth.uid(); v_test public.tests%rowtype; v_item record; v_raw jsonb; v_stem text; v_opts jsonb; v_answer jsonb; v_q uuid; v_ver uuid; v_tq uuid; v_existing record; v_added int:=0; v_dupes int:=0; v_pos int:=0; v_marks numeric; v_neg numeric; v_correct text; v_type public.question_type;
begin
 if not public.is_mockmaster_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into v_test from public.tests where id=p_test_id and test_category='full_length' for update;
 if not found then raise exception 'Full-Length Test not found'; end if;
 if v_test.status<>'draft' then raise exception 'Only draft Full-Length Tests can be published'; end if;
 if (select count(*) from public.full_length_test_items where test_id=p_test_id)<>150 then raise exception 'Exactly 150 uploaded questions are required'; end if;
 if (select count(*) from public.full_length_test_items where test_id=p_test_id and paper_id=(select id from public.papers where exam_id=v_test.exam_id and code='PAPER_1' limit 1))<>50 or (select count(*) from public.full_length_test_items where test_id=p_test_id and paper_id=(select id from public.papers where exam_id=v_test.exam_id and code='PAPER_2' limit 1))<>100 then raise exception 'Question split must be exactly 50 Paper 1 and 100 Paper 2'; end if;
 for v_item in select * from public.full_length_test_items where test_id=p_test_id order by position for update loop
  v_raw:=v_item.raw_row; v_stem:=trim(coalesce(v_raw->>'question',''));
  v_opts:=case when jsonb_typeof(v_raw->'options_json')='array' then v_raw->'options_json' else (select coalesce(jsonb_agg(jsonb_build_object('id',x.k,'text',regexp_replace(trim(x.val),'^[A-D][.)-][[:space:]]*','')) order by x.ord),'[]'::jsonb) from (values('A',v_raw->>'option_a',1),('B',v_raw->>'option_b',2),('C',v_raw->>'option_c',3),('D',v_raw->>'option_d',4)) x(k,val,ord) where nullif(trim(x.val),'') is not null) end;
  v_correct:=upper(trim(coalesce(v_raw->>'correct_answer','')));
  if jsonb_typeof(v_raw->'answer_key_json')='object' then v_answer:=v_raw->'answer_key_json'; else v_answer:=jsonb_build_object('correct_option_id',v_correct); end if;
  if jsonb_array_length(v_opts)<2 or v_answer='{}'::jsonb or v_answer is null then raise exception 'Question row % has invalid options or answer key',v_item.position; end if;
  select q.id,qv.id as version_id into v_existing from public.questions q join lateral(select vv.id,vv.prompt from public.question_versions vv where vv.question_id=q.id order by vv.version_number desc limit 1) qv on true
  where q.exam_id=v_test.exam_id and q.paper_id=v_item.paper_id and q.subject_id=v_item.subject_id and q.unit_id is not distinct from nullif(v_raw->>'unit_id','')::uuid
  and lower(regexp_replace(coalesce(qv.prompt->'stem'->>'text',''),'[[:space:]]+',' ','g'))=lower(regexp_replace(v_stem,'[[:space:]]+',' ','g')) order by q.created_at limit 1;
  if v_existing.id is not null then v_q:=v_existing.id; v_ver:=v_existing.version_id; v_dupes:=v_dupes+1;
   if not exists(select 1 from public.question_version_answer_keys where question_version_id=v_ver) then raise exception 'Duplicate question at row % has no saved answer key',v_item.position; end if;
  else
   v_type:='single_choice'::public.question_type;
   insert into public.questions(exam_id,paper_id,subject_id,unit_id,topic_id,question_type,difficulty,language_code,source_label,source_year,source_type,tags,status,created_by,updated_by)
   values(v_test.exam_id,v_item.paper_id,v_item.subject_id,nullif(v_raw->>'unit_id','')::uuid,nullif(v_raw->>'topic_id','')::uuid,v_type,
    case when lower(coalesce(v_raw->>'difficulty','moderate')) in ('easy','moderate','hard') then lower(coalesce(v_raw->>'difficulty','moderate'))::public.difficulty_level else 'moderate'::public.difficulty_level end,
    coalesce(nullif(v_raw->>'language_code',''),'en'),nullif(v_raw->>'source_label',''),nullif(v_raw->>'source_year','')::integer,coalesce(nullif(v_raw->>'source_type',''),'admin_created'),array[]::text[],'approved'::public.question_status,v_admin,v_admin) returning id into v_q;
   insert into public.question_versions(question_id,version_number,question_type,prompt,options,stimulus,explanation,default_marks,default_negative_marks,created_by)
   values(v_q,1,v_type,jsonb_build_object('stem',jsonb_build_object('text',v_stem,'html',null),'instructions',coalesce(v_raw->>'question_format','single_mcq'),'assets','[]'::jsonb),v_opts,case when nullif(v_raw->>'stimulus','') is not null then jsonb_build_object('text',v_raw->>'stimulus') else null end,case when nullif(v_raw->>'explanation','') is not null then jsonb_build_object('text',v_raw->>'explanation') else null end,coalesce(nullif(v_raw->>'marks','')::numeric,2),coalesce(nullif(v_raw->>'negative_marks','')::numeric,0),v_admin) returning id into v_ver;
   insert into public.question_version_answer_keys(question_version_id,answer_key,evaluation_rules) values(v_ver,v_answer,'{}'::jsonb);
   insert into public.question_answer_keys(question_id,current_version_id,answer_key,evaluation_rules,updated_by) values(v_q,v_ver,v_answer,'{}'::jsonb,v_admin); v_added:=v_added+1;
  end if;
  v_pos:=v_pos+1; v_marks:=coalesce(nullif(v_raw->>'marks','')::numeric,2); v_neg:=coalesce(nullif(v_raw->>'negative_marks','')::numeric,0);
  insert into public.test_questions(test_id,question_id,question_version_id,section_title,position,marks,negative_marks,is_compulsory) values(p_test_id,v_q,v_ver,case when v_item.paper_id=(select id from public.papers where exam_id=v_test.exam_id and code='PAPER_1' limit 1) then 'Paper 1' else 'Paper 2' end,v_pos,v_marks,v_neg,true) returning id into v_tq;
  insert into public.test_question_answer_keys(test_question_id,answer_key,evaluation_rules) select v_tq,answer_key,evaluation_rules from public.question_version_answer_keys where question_version_id=v_ver;
  update public.full_length_test_items set resolved_question_id=v_q where id=v_item.id;
 end loop;
 update public.tests set status='published',published_at=now(),total_marks=(select coalesce(sum(marks),0) from public.test_questions where test_id=p_test_id) where id=p_test_id;
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details) values(v_admin,'full_length_test_published','test',p_test_id,jsonb_build_object('question_count',150,'new_questions',v_added,'duplicates_reused',v_dupes));
 return jsonb_build_object('test_id',p_test_id,'question_count',150,'added_to_question_bank',v_added,'duplicates_reused',v_dupes);
end; $$;

create or replace function public.student_start_full_length_test(p_test_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_student uuid:=auth.uid(); v_test public.tests%rowtype; v_attempt uuid; v_num int;
begin
 if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into v_test from public.tests where id=p_test_id and test_category='full_length' and status='published';
 if not found then raise exception 'Published Full-Length Test not found'; end if;
 if (select count(*) from public.test_questions where test_id=p_test_id)<>150 then raise exception 'This Full-Length Test is not ready to attempt'; end if;
 select coalesce(max(attempt_number),0)+1 into v_num from public.test_attempts where test_id=p_test_id and student_id=v_student;
 insert into public.test_attempts(test_id,student_id,attempt_number,status,expires_at,max_score) values(p_test_id,v_student,v_num,'in_progress',now()+make_interval(secs=>v_test.duration_seconds),v_test.total_marks) returning id into v_attempt;
 insert into public.student_responses(attempt_id,test_question_id) select v_attempt,id from public.test_questions where test_id=p_test_id order by position;
 return jsonb_build_object('test_id',p_test_id,'attempt_id',v_attempt,'duration_seconds',v_test.duration_seconds,'question_count',150);
end; $$;

revoke all on function public.admin_create_full_length_draft(jsonb,jsonb) from public,anon;
revoke all on function public.admin_publish_full_length_test(uuid) from public,anon;
revoke all on function public.student_start_full_length_test(uuid) from public,anon;
grant execute on function public.admin_create_full_length_draft(jsonb,jsonb) to authenticated;
grant execute on function public.admin_publish_full_length_test(uuid) to authenticated;
grant execute on function public.student_start_full_length_test(uuid) to authenticated;
notify pgrst,'reload schema';
commit;