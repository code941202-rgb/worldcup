-- =========================================================
-- [업데이트] 이벤트 비공개화: 코드를 아는 사람만 입장
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. (기존 schema.sql 위에 덧붙이는 변경)
-- =========================================================

-- 전체 목록 공개 권한 회수 (홈에서 목록/코드가 안 보이게)
revoke all on public.event_list from anon, authenticated;

-- 코드로 이벤트 단건 조회 (참여용)
create or replace function public.get_event_by_code(p_code text)
returns public.event_list
language sql security definer set search_path = public as $$
  select id, name, type, join_code, r32_locked, final_locked, actual, created_at
  from public.events where join_code = upper(p_code) limit 1;
$$;

-- id로 이벤트 단건 조회 (링크 입장용)
create or replace function public.get_event(p_event uuid)
returns public.event_list
language sql security definer set search_path = public as $$
  select id, name, type, join_code, r32_locked, final_locked, actual, created_at
  from public.events where id = p_event limit 1;
$$;

grant execute on function
  public.get_event_by_code(text),
  public.get_event(uuid)
to anon, authenticated;
