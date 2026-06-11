/* =========================================================
   Supabase 접근 래퍼 (REST/RPC)
   - 외부 SDK 없이 fetch 로 직접 호출
   ========================================================= */

const DB = (() => {
  function configured() {
    return typeof SUPABASE_URL === "string" &&
           SUPABASE_URL.startsWith("http") &&
           typeof SUPABASE_ANON_KEY === "string" &&
           SUPABASE_ANON_KEY.length > 20;
  }

  function headers() {
    return {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    };
  }

  // RPC 호출
  async function rpc(fn, args) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(args || {}),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(parseErr(txt));
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // 테이블/뷰 조회
  async function select(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  function parseErr(txt) {
    try {
      const o = JSON.parse(txt);
      const m = o.message || o.hint || o.details || txt;
      const map = {
        PIN_TOO_SHORT: "PIN은 4자리 이상이어야 합니다.",
        NO_EVENT: "이벤트를 찾을 수 없습니다.",
        LOCKED_FINAL: "이미 최종 마감되어 제출할 수 없습니다.",
        LOCKED_R32_NEW: "32강이 마감되어 신규 참가가 불가합니다.",
        BAD_PIN: "관리자 PIN이 올바르지 않습니다.",
      };
      for (const k in map) if (String(m).includes(k)) return map[k];
      return m;
    } catch { return txt; }
  }

  return {
    configured,

    // ----- 이벤트 -----
    async createEvent(name, type, pin) {
      return rpc("create_event", { p_name: name, p_type: type, p_pin: pin });
    },
    async listEvents() {
      return select("event_list?select=*&order=created_at.desc");
    },
    async getEvent(id) {
      const rows = await select(`event_list?id=eq.${id}&select=*`);
      return rows[0] || null;
    },
    async getEventByCode(code) {
      const rows = await select(`event_list?join_code=eq.${encodeURIComponent(code)}&select=*`);
      return rows[0] || null;
    },

    // ----- 예측 -----
    async listPredictions(eventId) {
      return select(`predictions?event_id=eq.${eventId}&select=id,name,bracket,updated_at&order=updated_at.desc`);
    },
    async getMyPrediction(eventId, name) {
      const rows = await select(
        `predictions?event_id=eq.${eventId}&name=eq.${encodeURIComponent(name)}&select=id,name,bracket`);
      return rows[0] || null;
    },
    async savePrediction(eventId, name, bracket) {
      return rpc("upsert_prediction", { p_event: eventId, p_name: name, p_bracket: bracket });
    },

    // ----- 관리자 -----
    async adminVerify(eventId, pin) {
      return rpc("admin_verify", { p_event: eventId, p_pin: pin });
    },
    async adminSetLock(eventId, pin, which, value) {
      return rpc("admin_set_lock", { p_event: eventId, p_pin: pin, p_which: which, p_value: value });
    },
    async adminSetActual(eventId, pin, bracket) {
      return rpc("admin_set_actual", { p_event: eventId, p_pin: pin, p_bracket: bracket });
    },
    async adminDeletePrediction(eventId, pin, predId) {
      return rpc("admin_delete_prediction", { p_event: eventId, p_pin: pin, p_pred: predId });
    },
  };
})();
