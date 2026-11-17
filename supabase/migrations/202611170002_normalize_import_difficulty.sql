-- Normalize Excel difficulty values inside the database as a final safeguard.
-- This also protects imports from stale browser bundles that still send title-case values.
begin;

create or replace function public.admin_import_questions_bulk(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_index integer := 0;
  v_added integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_error text;
  v_row_number integer;
  v_difficulty text;
begin
  if not public.is_mockmaster_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Import items must be a JSON array';
  end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Each import batch must contain between 1 and 100 questions';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_index := v_index + 1;
    v_row_number := coalesce(nullif(v_item->>'row_number','')::integer, v_index);
    begin
      v_difficulty := lower(trim(coalesce(v_item #>> '{question,difficulty}', 'moderate')));
      if v_difficulty not in ('easy', 'moderate', 'hard') then
        v_difficulty := 'moderate';
      end if;
      v_item := jsonb_set(v_item, '{question,difficulty}', to_jsonb(v_difficulty), true);

      perform public.admin_create_question(
        v_item->'question',
        v_item->'version',
        v_item->'answer_key'
      );
      v_added := v_added + 1;
    exception when others then
      get stacked diagnostics v_error = message_text;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('row_number', v_row_number, 'message', v_error)
      );
    end;
  end loop;

  return jsonb_build_object(
    'added', v_added,
    'failed', jsonb_array_length(v_errors),
    'errors', v_errors
  );
end;
$$;

revoke all on function public.admin_import_questions_bulk(jsonb) from public, anon;
grant execute on function public.admin_import_questions_bulk(jsonb) to authenticated;

commit;
