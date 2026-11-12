-- MockMaster schema and UGC NET seed verification
-- Read-only checks. Run after both Module 2 migrations in Supabase SQL Editor.
do $$
declare
  v_exam uuid;
  v_paper1 uuid;
  v_paper2 uuid;
  v_paper1_units integer;
  v_commerce_units integer;
  v_management_units integer;
  v_subjects integer;
begin
  select id into v_exam from public.exams where code='UGC_NET';
  if v_exam is null then raise exception 'UGC_NET exam seed missing'; end if;

  select id into v_paper1 from public.papers where exam_id=v_exam and code='PAPER_1';
  select id into v_paper2 from public.papers where exam_id=v_exam and code='PAPER_2';
  if v_paper1 is null or v_paper2 is null then raise exception 'UGC NET Paper 1 or Paper 2 missing'; end if;

  select count(*) into v_subjects from public.subjects where paper_id=v_paper2 and code in ('008','017');
  if v_subjects <> 2 then raise exception 'Expected Commerce (008) and Management (017) under Paper 2; found %',v_subjects; end if;

  select count(*) into v_paper1_units
  from public.units u join public.subjects s on s.id=u.subject_id
  where s.paper_id=v_paper1 and s.code='00';
  select count(*) into v_commerce_units
  from public.units u join public.subjects s on s.id=u.subject_id
  where s.paper_id=v_paper2 and s.code='008';
  select count(*) into v_management_units
  from public.units u join public.subjects s on s.id=u.subject_id
  where s.paper_id=v_paper2 and s.code='017';

  if v_paper1_units <> 10 then raise exception 'Paper 1 expected 10 units; found %',v_paper1_units; end if;
  if v_commerce_units <> 10 then raise exception 'Commerce expected 10 units; found %',v_commerce_units; end if;
  if v_management_units <> 10 then raise exception 'Management expected 10 units; found %',v_management_units; end if;

  raise notice 'MockMaster UGC NET seed verified: Paper 1=10 units, Commerce=10 units, Management=10 units.';
end $$;

-- Inspect the configured hierarchy.
select e.name as examination,p.name as paper,p.is_compulsory,s.code as subject_code,s.name as subject,
       u.unit_number,u.name as unit
from public.exams e
join public.papers p on p.exam_id=e.id
join public.subjects s on s.paper_id=p.id
left join public.units u on u.subject_id=s.id
where e.code='UGC_NET'
order by p.display_order,s.display_order,u.unit_number;
