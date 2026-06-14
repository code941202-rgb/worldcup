-- =========================================================
-- [업데이트] 마스터 관리자 기능
-- 사용법:
--  1) 아래 'PUT_YOUR_MASTER_PASSWORD_HERE' 를 원하는 비밀번호(영문/숫자 권장)로 바꾸세요.
--  2) 이 파일 전체를 복사해 Supabase SQL Editor 에 붙여넣고 RUN 하세요.
--     (일부만 드래그하지 말고, 편집창을 비운 뒤 전체를 붙여넣고 실행)
-- =========================================================

-- 1) 설정 테이블 (마스터 비밀번호 보관)
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;

-- 2) 마스터 비밀번호 설정  <-- 따옴표 안 값을 원하는 비밀번호로 변경!
insert into public.app_config (key, value)
values ('master_pin', 'PUT_YOUR_MASTER_PASSWORD_HERE')
on conflict (key) do update set value = excluded.value;

-- 3) 마스터 검증 함수
create or replace function public.master_verify(p_master text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_config
    where key = 'master_pin' and value = p_master
  );
$$;

-- 4) 마스터: 전체 이벤트 목록 (admin_pin, 참가자 수 포함)
create or replace function public.master_list_events(p_master text)
returns table (
  id uuid, name text, type text, join_code text,
  r32_locked boolean, final_locked boolean, actual jsonb,
  admin_pin text, pred_count bigint, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.master_verify(p_master) then
    raise exception 'BAD_MASTER';
  end if;
  return query
    select e.id, e.name, e.type, e.join_code,
           e.r32_locked, e.final_locked, e.actual, e.admin_pin,
           (select count(*) from public.predictions p where p.event_id = e.id) as pred_count,
           e.created_at
    from public.events e
    order by e.created_at desc;
end;
$$;

-- 5) 실행 권한 부여
grant execute on function public.master_verify(text) to anon, authenticated;
grant execute on function public.master_list_events(text) to anon, authenticated;

-- 6) PostgREST 스키마 캐시 즉시 갱신
notify pgrst, 'reload schema';
