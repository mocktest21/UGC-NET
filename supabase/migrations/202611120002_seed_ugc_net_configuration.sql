-- MockMaster: initial UGC NET examination configuration
-- Idempotent seed. Run only AFTER 202611120001_mockmaster_core_schema.sql.
-- Syllabus source: UGC NET Bureau updated syllabus index (applicable from June 2019 onward)
-- and NTA UGC-NET June 2026 subject list. Review official notices before each exam cycle.

begin;

insert into public.exams(code,name,description,is_active,display_order)
values (
 'UGC_NET',
 'UGC-NET',
 'National Eligibility Test conducted by the National Testing Agency.',
 true, 10
)
on conflict(code) do update set
 name=excluded.name,
 description=excluded.description,
 is_active=true;

-- Paper 1 is compulsory for every candidate. Paper 2 is chosen by subject.
insert into public.papers(exam_id,code,name,description,is_compulsory,display_order,is_active)
select e.id,v.code,v.name,v.description,v.is_compulsory,v.display_order,true
from public.exams e
cross join (values
 ('PAPER_1','Paper 1','Common General Paper on Teaching and Research Aptitude; compulsory for all UGC-NET candidates.',true,1),
 ('PAPER_2','Paper 2','Subject-specific paper selected by the candidate.',true,2)
) as v(code,name,description,is_compulsory,display_order)
where e.code='UGC_NET'
on conflict(exam_id,code) do update set
 name=excluded.name,
 description=excluded.description,
 is_compulsory=excluded.is_compulsory,
 display_order=excluded.display_order,
 is_active=true;

-- Internal Paper 1 subject node keeps the taxonomy consistent. The student UI should show Paper 1 directly.
-- Paper 2 subjects use the current NTA three-digit subject codes; syllabus legacy codes are retained in description.
insert into public.subjects(exam_id,paper_id,code,name,description,is_active,display_order)
select e.id,p.id,v.code,v.name,v.description,true,v.display_order
from public.exams e
join public.papers p on p.exam_id=e.id
cross join (values
 ('PAPER_1','00','General Paper','Common Paper 1 syllabus: Teaching and Research Aptitude. UGC syllabus subject code 00.',1),
 ('PAPER_2','008','Commerce','UGC-NET Paper 2 subject. NTA June 2026 subject code 008; legacy UGC syllabus code 08.',1),
 ('PAPER_2','017','Management','UGC-NET Paper 2 subject. NTA June 2026 subject code 017; legacy UGC syllabus code 17.',2)
) as v(paper_code,code,name,description,display_order)
join public.papers pp on pp.exam_id=e.id and pp.code=v.paper_code
where e.code='UGC_NET' and p.id=pp.id
on conflict(paper_id,code) do update set
 name=excluded.name,
 description=excluded.description,
 is_active=true,
 display_order=excluded.display_order;

-- Official Paper 1 unit titles (10 units).
with unit_seed(subject_code,unit_number,name) as (
 values
 ('00',1,'Teaching Aptitude'),
 ('00',2,'Research Aptitude'),
 ('00',3,'Comprehension'),
 ('00',4,'Communication'),
 ('00',5,'Mathematical Reasoning and Aptitude'),
 ('00',6,'Logical Reasoning'),
 ('00',7,'Data Interpretation'),
 ('00',8,'Information and Communication Technology (ICT)'),
 ('00',9,'People, Development and Environment'),
 ('00',10,'Higher Education System')
)
insert into public.units(subject_id,unit_number,code,name,description,is_active,display_order)
select s.id,u.unit_number,'UNIT_'||lpad(u.unit_number::text,2,'0'),u.name,'UGC-NET Paper 1 syllabus unit.',true,u.unit_number
from public.exams e
join public.papers p on p.exam_id=e.id and p.code='PAPER_1'
join unit_seed u on true
join public.subjects s on s.paper_id=p.id and s.code='00'
where e.code='UGC_NET'
on conflict(subject_id,unit_number) do update set
 code=excluded.code,name=excluded.name,description=excluded.description,is_active=true,display_order=excluded.display_order;

-- Official Commerce syllabus unit titles (10 units).
with unit_seed(subject_code,unit_number,name) as (
 values
 ('008',1,'Business Environment and International Business'),
 ('008',2,'Accounting and Auditing'),
 ('008',3,'Business Economics'),
 ('008',4,'Business Finance'),
 ('008',5,'Business Statistics and Research Methods'),
 ('008',6,'Business Management and Human Resource Management'),
 ('008',7,'Banking and Financial Institutions'),
 ('008',8,'Marketing Management'),
 ('008',9,'Legal Aspects of Business'),
 ('008',10,'Income-tax and Corporate Tax Planning')
)
insert into public.units(subject_id,unit_number,code,name,description,is_active,display_order)
select s.id,u.unit_number,'UNIT_'||lpad(u.unit_number::text,2,'0'),u.name,'UGC-NET Commerce Paper 2 syllabus unit.',true,u.unit_number
from public.exams e
join public.papers p on p.exam_id=e.id and p.code='PAPER_2'
join unit_seed u on true
join public.subjects s on s.paper_id=p.id and s.code=u.subject_code
where e.code='UGC_NET'
on conflict(subject_id,unit_number) do update set
 code=excluded.code,name=excluded.name,description=excluded.description,is_active=true,display_order=excluded.display_order;

-- Official Management syllabus unit titles (10 units).
with unit_seed(subject_code,unit_number,name) as (
 values
 ('017',1,'Management: Concept, Process, Theories and Approaches'),
 ('017',2,'Organisational Behaviour'),
 ('017',3,'Human Resource Management'),
 ('017',4,'Accounting and Financial Statement Analysis'),
 ('017',5,'Financial Management'),
 ('017',6,'Strategic Management'),
 ('017',7,'Marketing Management'),
 ('017',8,'Statistics and Research Methods for Management'),
 ('017',9,'International Business'),
 ('017',10,'Entrepreneurship Development')
)
insert into public.units(subject_id,unit_number,code,name,description,is_active,display_order)
select s.id,u.unit_number,'UNIT_'||lpad(u.unit_number::text,2,'0'),u.name,'UGC-NET Management Paper 2 syllabus unit.',true,u.unit_number
from public.exams e
join public.papers p on p.exam_id=e.id and p.code='PAPER_2'
join public.subjects s on s.paper_id=p.id and s.code=u.subject_code
join unit_seed u on true
where e.code='UGC_NET'
on conflict(subject_id,unit_number) do update set
 code=excluded.code,name=excluded.name,description=excluded.description,is_active=true,display_order=excluded.display_order;

commit;
