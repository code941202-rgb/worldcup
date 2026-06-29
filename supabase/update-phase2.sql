-- =========================================================
-- [업데이트] 2차(16강~우승) 이벤트 규칙
--  - 32강 마감(r32_locked) 후에는, 참가자의 32강은 '실제 결과(actual)의 32강'으로 고정
--  - 참가자는 16강~우승만 선택. 32강 마감 후에도 신규 참가 허용(실제 32강 기준)
-- Supabase SQL Editor 에 전체 붙여넣고 RUN 하세요.
-- =========================================================

create or replace function public.upsert_prediction(p_event uuid, p_name text, p_bracket jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ev public.events;
  v_existing jsonb;
  v_bracket jsonb := p_bracket;
  v_actual_r32 jsonb;
begin
  select * into v_ev from public.events where id = p_event;
  if not found then raise exception 'NO_EVENT'; end if;
  if v_ev.final_locked then raise exception 'LOCKED_FINAL'; end if;

  select bracket into v_existing from public.predictions
    where event_id = p_event and name = p_name;

  if v_ev.r32_locked then
    -- 실제 결과에 32강이 입력되어 있으면 그것을 32강 기준으로 고정 (2차 모드)
    v_actual_r32 := case when v_ev.actual ? 'r32' then v_ev.actual->'r32' else null end;
    if v_actual_r32 is not null then
      v_bracket := jsonb_set(v_bracket, '{r32}', v_actual_r32);
    elsif v_existing is not null then
      -- 실제 32강이 아직 없으면 기존(1차) 32강 유지
      v_bracket := jsonb_set(v_bracket, '{r32}', coalesce(v_existing->'r32','[]'::jsonb));
    else
      raise exception 'LOCKED_R32_NEW';
    end if;
  end if;

  insert into public.predictions(event_id, name, bracket)
  values (p_event, p_name, v_bracket)
  on conflict (event_id, name)
  do update set bracket = excluded.bracket, updated_at = now();
end; $$;
