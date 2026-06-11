-- =========================================================
-- [업데이트] 마스터 관리자 기능
-- Supabase SQL Editor 에 붙여넣고 Run 하세요.
-- 아래 'CHANGE_ME_마스터비밀번호' 를 원하는 비밀번호로 바꿔서 실행하세요.
-- =========================================================

-- 1) 설정 테이블 (마스터 비밀번호 보관)
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
-- 정책 없음 = anon 직접 접근 차단 (함수로만 접근)

-- 2) 마스터 비밀번호 설정  ← 여기 값을 원하는 비밀번호로 변경!
insert into public.app_config(key, value)
values ('master_pin', 'CHANGE_ME_마스터비밀번호')
on conflict (key) do update set value = excluded.value;

-- 3) 마스터 검증
create or replace function public.master_verify(p_master text)
returns boolean
language sql security definer set search_path = public as $$
  select exists(select 1 from public.app_config where key='master_pin' and value = p_master);
$$;

-- 4) 마스터: 전체 이벤트 목록 (각 이벤트의 admin_pin, 참가자 수 포함)
create or replace function public.master_list_events(p_master text)
returns table(
  id uuid, name text, type text, join_code text,
  r32_locked boolean, final_locked boolean, actual jsonb,
  admin_pin text, pred_count bigint, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.master_verify(p_master) then raise exception 'BAD_MASTER'; end if;
  return query
    select e.id, e.name, e.type, e.join_code, e.r32_locked, e.final_locked, e.actual,
           e.admin_pin,
           (select count(*) from public.predictions p where p.event_id = e.id) as pred_count,
           e.created_at
    from public.events e
    order by e.created_at desc;
end; $$;

grant execute on function
  public.master_verify(text),
  public.master_list_events(text)
to anon, authenticated;
