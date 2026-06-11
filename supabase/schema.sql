-- =========================================================
-- 2026 월드컵 승부예측 - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 하세요.
-- =========================================================

-- ---------- 테이블 ----------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'etc',   -- 'school' | 'staff' | 'etc'
  join_code   text unique not null,
  admin_pin   text not null,                 -- 관리자 PIN (4~8자리)
  r32_locked  boolean not null default false,-- 1차(32강) 마감 여부
  final_locked boolean not null default false,-- 2차(전체) 마감 여부
  actual      jsonb,                         -- 실제 결과 bracket
  created_at  timestamptz not null default now()
);

create table if not exists public.predictions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null,                 -- 참가자 이름
  bracket     jsonb not null,                -- {r32,r16,r8,r4,r2,champion}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_id, name)
);

create index if not exists idx_pred_event on public.predictions(event_id);

-- ---------- RLS ----------
alter table public.events enable row level security;
alter table public.predictions enable row level security;

-- 직접 테이블 접근은 막고(정책 없음 = 거부), 아래 view/RPC 로만 접근
-- 참가자 예측은 누구나 조회 가능(랭킹/관리자 대시보드용)
drop policy if exists pred_select on public.predictions;
create policy pred_select on public.predictions for select using (true);

-- ---------- 이벤트 공개 뷰 (admin_pin 노출 방지) ----------
-- 보안: 전체 목록은 공개하지 않는다. 코드를 아는 사람만 RPC로 단건 조회.
create or replace view public.event_list as
  select id, name, type, join_code, r32_locked, final_locked, actual, created_at
  from public.events;

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

-- =========================================================
-- RPC 함수 (SECURITY DEFINER: RLS 우회, 서버에서 검증)
-- =========================================================

-- 이벤트 생성 → join_code 반환
create or replace function public.create_event(p_name text, p_type text, p_pin text)
returns public.event_list
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_row public.event_list;
begin
  if length(coalesce(p_pin,'')) < 4 then
    raise exception 'PIN_TOO_SHORT';
  end if;
  v_code := upper(substring(md5(random()::text) from 1 for 6));
  insert into public.events(name, type, join_code, admin_pin)
  values (p_name, coalesce(p_type,'etc'), v_code, p_pin)
  returning id, name, type, join_code, r32_locked, final_locked, actual, created_at
  into v_row;
  return v_row;
end; $$;

-- 참가자 예측 저장(업서트). 마감 상태를 서버에서 강제.
create or replace function public.upsert_prediction(p_event uuid, p_name text, p_bracket jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ev public.events;
  v_existing jsonb;
  v_bracket jsonb := p_bracket;
begin
  select * into v_ev from public.events where id = p_event;
  if not found then raise exception 'NO_EVENT'; end if;
  if v_ev.final_locked then raise exception 'LOCKED_FINAL'; end if;

  select bracket into v_existing from public.predictions
    where event_id = p_event and name = p_name;

  if v_ev.r32_locked then
    if v_existing is null then
      raise exception 'LOCKED_R32_NEW';  -- 1차 마감 후 신규 참가 불가
    end if;
    -- 32강은 기존 것 유지(수정 불가), 16강~우승만 갱신
    v_bracket := jsonb_set(v_bracket, '{r32}', coalesce(v_existing->'r32','[]'::jsonb));
  end if;

  insert into public.predictions(event_id, name, bracket)
  values (p_event, p_name, v_bracket)
  on conflict (event_id, name)
  do update set bracket = excluded.bracket, updated_at = now();
end; $$;

-- 관리자 PIN 확인
create or replace function public.admin_verify(p_event uuid, p_pin text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  select (admin_pin = p_pin) into v_ok from public.events where id = p_event;
  return coalesce(v_ok, false);
end; $$;

-- 관리자: 마감 토글 (which: 'r32' | 'final')
create or replace function public.admin_set_lock(p_event uuid, p_pin text, p_which text, p_value boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_verify(p_event, p_pin) then raise exception 'BAD_PIN'; end if;
  if p_which = 'r32' then
    update public.events set r32_locked = p_value where id = p_event;
  elsif p_which = 'final' then
    update public.events set final_locked = p_value where id = p_event;
  else
    raise exception 'BAD_WHICH';
  end if;
end; $$;

-- 관리자: 실제 결과 저장
create or replace function public.admin_set_actual(p_event uuid, p_pin text, p_bracket jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_verify(p_event, p_pin) then raise exception 'BAD_PIN'; end if;
  update public.events set actual = p_bracket where id = p_event;
end; $$;

-- 관리자: 참가자 예측 삭제
create or replace function public.admin_delete_prediction(p_event uuid, p_pin text, p_pred uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_verify(p_event, p_pin) then raise exception 'BAD_PIN'; end if;
  delete from public.predictions where id = p_pred and event_id = p_event;
end; $$;

-- 관리자: 이벤트 전체 삭제 (예측도 함께 삭제됨)
create or replace function public.admin_delete_event(p_event uuid, p_pin text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_verify(p_event, p_pin) then raise exception 'BAD_PIN'; end if;
  delete from public.events where id = p_event;
end; $$;

grant execute on function
  public.create_event(text,text,text),
  public.get_event_by_code(text),
  public.get_event(uuid),
  public.upsert_prediction(uuid,text,jsonb),
  public.admin_verify(uuid,text),
  public.admin_set_lock(uuid,text,text,boolean),
  public.admin_set_actual(uuid,text,jsonb),
  public.admin_delete_prediction(uuid,text,uuid),
  public.admin_delete_event(uuid,text)
to anon, authenticated;
