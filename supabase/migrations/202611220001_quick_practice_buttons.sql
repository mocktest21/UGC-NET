create or replace function public.student_get_quick_practice_distribution(p_question_count integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_student uuid:=auth.uid(); v_exam uuid; v_result jsonb;
begin
 if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select id into v_exam from public.exams where code='UGC_NET' and is_active=true limit 1;
 if v_exam is null then raise exception 'UGC NET is not available'; end if;
 with eligible as (
  select q.id,coalesce(p.name,'Paper') paper_name,coalesce(s.name,'Uncategorised') subject_name,
   coalesce(u.name,'Uncategorised') unit_name,
   coalesce(q.source_label,case when q.source_type='previous_year' then 'PYQ' else 'Other' end) source_name
  from public.questions q join public.papers p on p.id=q.paper_id
  left join public.subjects s on s.id=q.subject_id left join public.units u on u.id=q.unit_id
  join lateral(select v.id from public.question_versions v where v.question_id=q.id order by v.version_number desc limit 1)v on true
  join public.question_version_answer_keys ak on ak.question_version_id=v.id
  where q.exam_id=v_exam and q.status='approved'
   and not exists(select 1 from public.test_questions tq join public.tests t on t.id=tq.test_id where tq.question_id=q.id and t.mode='live' and t.status='published' and t.ends_at>now())
 ), picked as(select * from eligible order by random() limit greatest(1,least(300,p_question_count))),
 pc as(select jsonb_agg(jsonb_build_object('name',paper_name,'count',n) order by paper_name) j from(select paper_name,count(*) n from picked group by paper_name)x),
 uc as(select jsonb_agg(jsonb_build_object('name',subject_name||' · '||unit_name,'count',n) order by subject_name,unit_name) j from(select subject_name,unit_name,count(*) n from picked group by subject_name,unit_name)x),
 sc as(select jsonb_agg(jsonb_build_object('name',source_name,'count',n) order by source_name) j from(select source_name,count(*) n from picked group by source_name)x)
 select jsonb_build_object('available',(select count(*) from eligible),'selected',(select count(*) from picked),'papers',coalesce((select j from pc),'[]'::jsonb),'units',coalesce((select j from uc),'[]'::jsonb),'sources',coalesce((select j from sc),'[]'::jsonb)) into v_result;
 return v_result;
end; $$;

create or replace function public.student_start_quick_practice(p_kind text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_student uuid:=auth.uid(); v_exam uuid; v_count integer; v_target integer; v_duration integer; v_test uuid; v_attempt uuid; v_marks numeric;
begin
 if v_student is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_kind not in('ten','twenty','bookmarked','surprise') then raise exception 'Invalid quick practice mode'; end if;
 select id into v_exam from public.exams where code='UGC_NET' and is_active=true limit 1;
 if v_exam is null then raise exception 'UGC NET is not available'; end if;
 v_target:=case p_kind when 'ten' then 10 when 'twenty' then 20 when 'bookmarked' then 20 else floor(random()*21)::integer+10 end;
 create temporary table if not exists mm_quick_pool(question_id uuid primary key,version_id uuid not null,paper_id uuid,subject_id uuid,marks numeric,negative_marks numeric,pick_order integer) on commit drop;
 truncate pg_temp.mm_quick_pool;
 insert into pg_temp.mm_quick_pool(question_id,version_id,paper_id,subject_id,marks,negative_marks,pick_order)
 select q.id,v.id,q.paper_id,q.subject_id,v.default_marks,v.default_negative_marks,row_number() over(order by random())::integer
 from public.questions q
 join lateral(select qv.* from public.question_versions qv where qv.question_id=q.id order by qv.version_number desc limit 1)v on true
 join public.question_version_answer_keys ak on ak.question_version_id=v.id
 where q.exam_id=v_exam and q.status='approved'
 and(p_kind<>'bookmarked' or exists(select 1 from public.bookmarks b where b.student_id=v_student and b.question_id=q.id))
 and not exists(select 1 from public.test_questions ltq join public.tests lt on lt.id=ltq.test_id where ltq.question_id=q.id and lt.mode='live' and lt.status='published' and lt.ends_at>now())
 order by random() limit v_target;
 select count(*) into v_count from pg_temp.mm_quick_pool;
 if v_count=0 then if p_kind='bookmarked' then raise exception 'You do not have any eligible bookmarked questions yet.'; else raise exception 'No approved questions are available for Quick Practice right now.'; end if; end if;
 v_duration:=case p_kind when 'ten' then 600 when 'twenty' then 1200 else greatest(60,v_count*60) end;
 select coalesce(sum(marks),0) into v_marks from pg_temp.mm_quick_pool;
 insert into public.tests(exam_id,title,description,mode,creation_type,status,duration_seconds,total_marks,created_by,published_at,shuffle_questions,shuffle_options,show_solutions)
 values(v_exam,case p_kind when 'ten' then 'Quick Practice · 10 Questions' when 'twenty' then 'Quick Practice · 20 Questions' when 'bookmarked' then 'Bookmarked Practice' else 'Surprise Me' end,
 case p_kind when 'bookmarked' then 'Practice using only your bookmarked questions.' when 'surprise' then 'A random mix of questions, units, difficulty levels and question types.' else 'Mixed Paper 1 and Paper 2 quick practice.' end,
 'practice','generated','published',v_duration,v_marks,v_student,now(),true,true,true) returning id into v_test;
 insert into public.test_questions(test_id,question_id,question_version_id,section_title,position,marks,negative_marks,is_compulsory)
 select v_test,question_id,version_id,'Quick Practice',pick_order,marks,negative_marks,true from pg_temp.mm_quick_pool order by pick_order;
 insert into public.test_question_answer_keys(test_question_id,answer_key,evaluation_rules)
 select tq.id,ak.answer_key,ak.evaluation_rules from public.test_questions tq join public.question_version_answer_keys ak on ak.question_version_id=tq.question_version_id where tq.test_id=v_test;
 insert into public.test_attempts(test_id,student_id,attempt_number,status,expires_at,max_score)
 values(v_test,v_student,1,'in_progress',now()+make_interval(secs=>v_duration),v_marks) returning id into v_attempt;
 insert into public.student_responses(attempt_id,test_question_id) select v_attempt,id from public.test_questions where test_id=v_test;
 return jsonb_build_object('test_id',v_test,'attempt_id',v_attempt,'question_count',v_count,'duration_seconds',v_duration);
end; $$;
revoke all on function public.student_get_quick_practice_distribution(integer) from public,anon;
revoke all on function public.student_start_quick_practice(text) from public,anon;
grant execute on function public.student_get_quick_practice_distribution(integer) to authenticated;
grant execute on function public.student_start_quick_practice(text) to authenticated;