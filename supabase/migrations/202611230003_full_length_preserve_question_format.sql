create or replace function public.prepare_full_length_question_row()
returns trigger
language plpgsql
set search_path=''
as $$
declare v_text text;
begin
 v_text:=concat_ws(E'\n\n',
   nullif(trim(coalesce(new.raw_row->>'question','')),''),
   nullif(trim(coalesce(new.raw_row->>'stimulus','')),''),
   case when nullif(trim(coalesce(new.raw_row->>'list_i','')),'') is not null then 'List I:'||E'\n'||trim(new.raw_row->>'list_i') end,
   case when nullif(trim(coalesce(new.raw_row->>'list_ii','')),'') is not null then 'List II:'||E'\n'||trim(new.raw_row->>'list_ii') end
 );
 new.raw_row:=jsonb_set(new.raw_row,'{question}',to_jsonb(v_text),true);
 return new;
end;
$$;
drop trigger if exists full_length_question_row_prepare on public.full_length_test_items;
create trigger full_length_question_row_prepare
before insert on public.full_length_test_items
for each row execute function public.prepare_full_length_question_row();
