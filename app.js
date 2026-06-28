/* =========================================================
   2026 월드컵 승부예측 - 멀티유저 앱 (Supabase 연동)
   ========================================================= */

const ORDER = CORE.ORDER;

// 현재 세션 상태
let App = {
  event: null,        // 현재 이벤트 (event_list row)
  isAdmin: false,
  adminPin: null,
  playerName: null,   // 참가자 이름
  bracket: CORE.emptyBracket(), // 편집 중인 내 예측
  myPredId: null,
  predictions: [],    // 이벤트 전체 예측 (순위/관리자용)
  eventFilter: "all",
  selectedChip: null,
};

/* ===================== 화면 전환 ===================== */
function show(id) {
  ["screenHome", "screenEvent", "screenMaster"].forEach(s => document.getElementById(s).classList.toggle("hidden", s !== id));
}
function goHome() {
  App.event = null; App.isAdmin = false; App.adminPin = null; App.playerName = null;
  history.replaceState(null, "", location.origin + location.pathname);
  document.getElementById("headerSub").textContent = "이벤트를 만들거나 참여 코드로 입장하세요";
  show("screenHome");
  if (!DB.configured()) { document.getElementById("setupWarn").classList.remove("hidden"); }
  else document.getElementById("setupWarn").classList.add("hidden");
  renderRecent();
}

/* ----- 최근 입장 이벤트 (이 기기 localStorage) ----- */
const RECENT_KEY = "wc2026-recent-events";
function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function addRecent(ev) {
  let list = getRecent().filter(x => x.id !== ev.id);
  list.unshift({ id: ev.id, name: ev.name, type: ev.type, code: ev.join_code });
  list = list.slice(0, 8);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}
function removeRecent(id) {
  const list = getRecent().filter(x => x.id !== id);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
  renderRecent();
}
function renderRecent() {
  const wrap = document.getElementById("recentWrap");
  const listEl = document.getElementById("recentList");
  const list = getRecent();
  if (!list.length) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  listEl.innerHTML = list.map(e => {
    const ico = e.type === "school" ? "🏫" : e.type === "staff" ? "🏢" : "🎯";
    const typeLabel = e.type === "school" ? "학교" : e.type === "staff" ? "직원" : "기타";
    return `<div class="event-item" data-id="${e.id}">
      <span class="ico">${ico}</span>
      <div class="meta"><div class="nm">${escapeHtml(e.name)}</div>
        <div class="sub">코드 ${e.code} · ${typeLabel}</div></div>
      <button class="btn" data-forget="${e.id}" style="padding:4px 9px;font-size:12px;">✕</button>
    </div>`;
  }).join("");
  listEl.querySelectorAll(".event-item").forEach(el => {
    el.addEventListener("click", (ev) => { if (ev.target.dataset.forget !== undefined) return; enterEvent(el.dataset.id); });
  });
  listEl.querySelectorAll("[data-forget]").forEach(b => b.addEventListener("click", (ev) => { ev.stopPropagation(); removeRecent(b.dataset.forget); }));
}

/* ===================== 이벤트 입장 ===================== */
async function enterEvent(eventId) {
  try {
    const ev = await DB.getEvent(eventId);
    if (!ev) { toast("이벤트를 찾을 수 없어요."); return; }
    App.event = ev;
    App.isAdmin = false; App.adminPin = null;
    App.playerName = null; App.bracket = CORE.emptyBracket(); App.myPredId = null;
    addRecent(ev);
    history.replaceState(null, "", `${location.origin}${location.pathname}?e=${ev.id}`);
    renderEventHeader();
    switchTab("predict");
    document.getElementById("predictArea").classList.add("hidden");
    document.getElementById("nameCard").classList.remove("hidden");
    document.getElementById("playerName").value = "";
    document.getElementById("adminPanel").classList.add("hidden");
    document.getElementById("adminLoginCard").classList.remove("hidden");
    show("screenEvent");
    await refreshPredictions();
  } catch (e) { toast(e.message); }
}

async function joinByCode() {
  const code = document.getElementById("joinCode").value.trim().toUpperCase();
  if (!code) { toast("참여 코드를 입력하세요."); return; }
  try {
    const ev = await DB.getEventByCode(code);
    if (!ev) { toast("그 코드의 이벤트가 없어요."); return; }
    enterEvent(ev.id);
  } catch (e) { toast(e.message); }
}

function renderEventHeader() {
  const ev = App.event;
  document.getElementById("evName").textContent = ev.name;
  document.getElementById("evCode").textContent = ev.join_code;
  document.getElementById("evIcon").textContent = ev.type === "school" ? "🏫" : ev.type === "staff" ? "🏢" : "🎯";
  const state = ev.final_locked ? "🔒 최종 마감됨" : ev.r32_locked ? "🔒 32강 마감 (16강~ 진행)" : "🟢 진행 중";
  document.getElementById("evLockState").textContent = state;
  document.getElementById("headerSub").textContent = ev.name;
}

/* ===================== 탭 ===================== */
function switchTab(tab) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("tabPredict").classList.toggle("hidden", tab !== "predict");
  document.getElementById("tabRank").classList.toggle("hidden", tab !== "rank");
  document.getElementById("tabAdmin").classList.toggle("hidden", tab !== "admin");
  if (tab === "rank") renderRanking();
  if (tab === "admin" && App.isAdmin) renderAdminPanel();
}

/* ===================== 새 이벤트 생성 ===================== */
async function createEvent() {
  const name = document.getElementById("newEventName").value.trim();
  const type = document.getElementById("newEventType").value;
  const pin = document.getElementById("newEventPin").value.trim();
  if (!name) { toast("이벤트 이름을 입력하세요."); return; }
  if (pin.length < 4) { toast("PIN은 4자리 이상이어야 해요."); return; }
  try {
    const ev = await DB.createEvent(name, type, pin);
    toast(`이벤트 생성! 참여코드: ${ev.join_code}`);
    // 입력칸 비우기
    document.getElementById("newEventName").value = "";
    document.getElementById("newEventPin").value = "";
    // 마스터 목록 갱신 (가능하면)
    if (masterPin) { await loadMasterEvents(); }
    // 생성한 이벤트로 바로 관리자 입장 + 공유창
    await enterEvent(ev.id);
    App.isAdmin = true; App.adminPin = pin;
    document.getElementById("adminLoginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    switchTab("admin");
    openShareEvent();
  } catch (e) { toast(e.message); }
}

/* ===================== 예측 데이터 로드 ===================== */
async function refreshPredictions() {
  try {
    App.predictions = await DB.listPredictions(App.event.id);
  } catch (e) { App.predictions = []; }
}

/* ===================== 참가자: 예측 시작 ===================== */
async function startPredict() {
  const name = document.getElementById("playerName").value.trim();
  if (!name) { toast("이름을 입력하세요."); return; }
  App.playerName = name;
  try {
    const mine = await DB.getMyPrediction(App.event.id, name);
    if (mine) { App.bracket = CORE.normalize(mine.bracket); App.myPredId = mine.id; }
    else { App.bracket = CORE.emptyBracket(); App.myPredId = null; }
  } catch (e) { App.bracket = CORE.emptyBracket(); }
  CORE.validate(App.bracket);
  document.getElementById("nameCard").classList.add("hidden");
  document.getElementById("predictArea").classList.remove("hidden");
  document.getElementById("editingName").textContent = name;
  renderStageHint();
  renderBracket();
  renderPool();
}

function stage() {
  // 현재 단계: r32 마감 전이면 '1차', 마감 후면 '2차'
  if (App.event.final_locked) return "closed";
  if (App.event.r32_locked) return "phase2";
  return "phase1";
}
function renderStageHint() {
  const s = stage();
  const hint = document.getElementById("stageHint");
  const banner = document.getElementById("lockBanner");
  const poolSection = document.getElementById("poolSection");
  if (s === "phase1") {
    hint.textContent = "[1차] 32강 16경기에 진출국을 배치하고 승자를 골라 우승까지 예측하세요.";
    banner.innerHTML = "";
    poolSection.classList.remove("hidden");
  } else if (s === "phase2") {
    hint.textContent = "[2차] 32강은 마감되어 수정할 수 없어요. 16강부터 우승까지 승자를 고르세요.";
    banner.innerHTML = `<div class="lock-banner">🔒 1차(32강)가 마감되었습니다. 32강 배치는 고정되고 16강 이후만 수정 가능해요.</div>`;
    poolSection.classList.add("hidden");
  } else {
    hint.textContent = "이 이벤트는 최종 마감되었습니다. 결과는 순위·통계 탭에서 확인하세요.";
    banner.innerHTML = `<div class="lock-banner">🔒 최종 마감됨 — 더 이상 수정할 수 없습니다.</div>`;
    poolSection.classList.add("hidden");
  }
}
function editable() { return stage() !== "closed"; }
function r32Editable() { return stage() === "phase1"; }

/* ===================== 배치/승자 (참가자) ===================== */
function placeSeed(slotIndex, teamId) {
  if (!r32Editable()) { toast("32강은 더 이상 수정할 수 없어요."); return; }
  const slot = SLOTS[slotIndex];
  if (slot) {
    const t = TEAM_MAP[teamId];
    if (!slot.groups.includes(t.group)) { toast(`이 자리는 '${slot.label}' 자리예요. ${t.group}조 팀은 올 수 없어요.`); return; }
  }
  const b = App.bracket;
  const ex = b.r32.indexOf(teamId);
  if (ex !== -1 && ex !== slotIndex) b.r32[ex] = null;
  b.r32[slotIndex] = teamId;
  App.selectedChip = null;
  CORE.validate(b); renderBracket(); renderPool();
}
function removeSeed(slotIndex) {
  if (!r32Editable()) { toast("32강은 더 이상 수정할 수 없어요."); return; }
  App.bracket.r32[slotIndex] = null;
  CORE.validate(App.bracket); renderBracket(); renderPool();
}
function pickWinner(roundKey, slotIndex) {
  if (!editable()) { toast("마감되어 수정할 수 없어요."); return; }
  if (roundKey === "r32" && !r32Editable()) {
    // 2차에서는 32강 승자 선택은 허용(16강 진출). 단 r32 배치 자체는 고정.
  }
  const b = App.bracket;
  const team = b[roundKey][slotIndex];
  if (!team) return;
  const ri = ORDER.indexOf(roundKey);
  const matchIndex = Math.floor(slotIndex / 2);
  if (ri < ORDER.length - 1) b[ORDER[ri + 1]][matchIndex] = team;
  else b.champion = team;
  CORE.validate(b); renderBracket();
}
function autoFill() {
  if (!r32Editable()) { toast("32강은 더 이상 수정할 수 없어요."); return; }
  const b = App.bracket;
  const r32 = new Array(32).fill(null);
  const usedThirds = new Set();
  SLOTS.forEach((slot, idx) => {
    if (slot.third) return;
    const g = slot.groups[0];
    const pos = slot.label.includes("1위") ? 1 : 2;
    const team = TEAMS.find(t => t.group === g && t.pos === pos);
    if (team) r32[idx] = team.id;
  });
  SLOTS.forEach((slot, idx) => {
    if (!slot.third) return;
    const cand = slot.groups.filter(g => !usedThirds.has(g));
    const pick = cand[Math.floor(Math.random() * cand.length)] || slot.groups[0];
    usedThirds.add(pick);
    const team = TEAMS.find(t => t.group === pick && t.pos === 3);
    if (team) r32[idx] = team.id;
  });
  b.r32 = r32; b.r16 = new Array(16).fill(null); b.r8 = new Array(8).fill(null);
  b.r4 = new Array(4).fill(null); b.r2 = new Array(2).fill(null); b.champion = null;
  renderBracket(); renderPool();
  toast("32강을 자동 배치했어요. 승자를 클릭해 진행하세요.");
}
function resetMine() {
  if (!editable()) { toast("마감되어 초기화할 수 없어요."); return; }
  if (!confirm("내 예측을 초기화할까요?")) return;
  if (r32Editable()) App.bracket = CORE.emptyBracket();
  else { // 2차에선 32강 유지, 이후만 리셋
    App.bracket.r16 = new Array(16).fill(null); App.bracket.r8 = new Array(8).fill(null);
    App.bracket.r4 = new Array(4).fill(null); App.bracket.r2 = new Array(2).fill(null); App.bracket.champion = null;
  }
  renderBracket(); renderPool(); toast("초기화 완료");
}

async function submitMine() {
  if (!editable()) { toast("마감되어 제출할 수 없어요."); return; }
  if (!App.playerName) { toast("이름을 먼저 입력하세요."); return; }
  try {
    await DB.savePrediction(App.event.id, App.playerName, App.bracket);
    await refreshPredictions();
    toast("제출 완료! 순위·통계 탭에서 확인하세요.");
  } catch (e) { toast(e.message); }
}

/* ===================== 브래킷 렌더링 ===================== */
function matchInfo(roundKey, matchIndex) {
  if (roundKey === "r32" && typeof R32_MATCHES !== "undefined") {
    const m = R32_MATCHES[matchIndex];
    return m ? { kst: m.kst, venue: m.venue } : null;
  }
  if (typeof ROUND_TIMES !== "undefined" && ROUND_TIMES[roundKey])
    return { kst: ROUND_TIMES[roundKey][matchIndex], venue: (ROUND_VENUES[roundKey] || [])[matchIndex] };
  return null;
}
function slotHTML(roundKey, idx, teamId, winnerOfMatch, placeable) {
  if (!teamId) {
    let label = placeable ? "빈칸" : "—";
    if (placeable && SLOTS[idx]) label = SLOTS[idx].label;
    return `<div class="slot empty" data-round="${roundKey}" data-idx="${idx}" data-placeable="${placeable ? 1 : 0}">
      <span class="flag">+</span><span class="name slotlabel">${label}</span></div>`;
  }
  const t = TEAM_MAP[teamId];
  let cls = "slot";
  if (winnerOfMatch === teamId) cls += " winner";
  else if (winnerOfMatch) cls += " loser";
  const rmBtn = placeable ? `<button class="rm" title="제거" data-rm="${idx}">✕</button>` : "";
  return `<div class="${cls}" data-round="${roundKey}" data-idx="${idx}" data-team="${teamId}" data-placeable="${placeable ? 1 : 0}">
    <span class="flag">${t.flag}</span><span class="name">${t.name}</span>${rmBtn}</div>`;
}

// 공용 브래킷 렌더러 (대상 element, bracket, 옵션)
function buildBracketHTML(b, opts) {
  opts = opts || {};
  const placeableRound = opts.interactive && r32Editable();
  let html = "";
  // 우승
  html += `<div class="round champion"><div class="round-title">🏆 우승</div><div class="matches">`;
  if (b.champion) {
    const t = TEAM_MAP[b.champion];
    html += `<div class="champion-box"><div class="label">CHAMPION</div><div class="flag">${t.flag}</div><div class="name">${t.name}</div></div>`;
  } else {
    html += `<div class="champion-box"><div class="label">CHAMPION</div><div class="empty">${opts.interactive ? "결승 승자를 클릭" : "미정"}</div></div>`;
  }
  html += `</div></div>`;

  for (let rIdx = ROUNDS.length - 1; rIdx >= 0; rIdx--) {
    const round = ROUNDS[rIdx];
    const arr = b[round.key];
    const nextArr = rIdx < ORDER.length - 1 ? b[ORDER[rIdx + 1]] : null;
    const placeable = opts.interactive && round.key === "r32" && r32Editable();
    html += `<div class="round"><div class="round-title">${round.title}</div><div class="matches">`;
    for (let m = 0; m < arr.length / 2; m++) {
      const s0 = 2 * m, s1 = 2 * m + 1;
      let winner = round.key === "r2" ? b.champion : (nextArr ? nextArr[m] : null);
      const info = matchInfo(round.key, m);
      const timeHTML = info && info.kst ? `<div class="mtime">🕐 ${info.kst}${info.venue ? " · " + info.venue : ""}</div>` : "";
      html += `<div class="match">${timeHTML}`;
      html += slotHTML(round.key, s0, arr[s0], winner, placeable);
      html += slotHTML(round.key, s1, arr[s1], winner, placeable);
      html += `</div>`;
    }
    html += `</div></div>`;
  }
  return html;
}

function renderBracket() {
  const wrap = document.getElementById("bracket");
  wrap.innerHTML = buildBracketHTML(App.bracket, { interactive: true });
  attachBracketEvents(wrap);
  highlightEligible();
}

// 선택된 칩이 들어갈 수 있는 빈 32강 칸을 형광 강조
function highlightEligible() {
  const wrap = document.getElementById("bracket");
  if (!wrap) return;
  wrap.classList.remove("picking");
  wrap.querySelectorAll(".slot.eligible").forEach(s => s.classList.remove("eligible"));
  if (!App.selectedChip || !r32Editable()) return;
  const team = TEAM_MAP[App.selectedChip];
  if (!team) return;
  let any = false;
  wrap.querySelectorAll('.slot.empty[data-round="r32"]').forEach(slot => {
    const idx = parseInt(slot.dataset.idx, 10);
    const def = SLOTS[idx];
    if (def && def.groups.includes(team.group)) { slot.classList.add("eligible"); any = true; }
  });
  if (any) wrap.classList.add("picking");
}

function attachBracketEvents(wrap) {
  wrap.querySelectorAll(".slot").forEach(slot => {
    const roundKey = slot.dataset.round;
    const idx = parseInt(slot.dataset.idx, 10);
    const placeable = slot.dataset.placeable === "1";
    const team = slot.dataset.team;
    slot.addEventListener("click", (e) => {
      if (e.target.dataset.rm !== undefined) return;
      if (placeable && !team) { if (App.selectedChip) { placeSeed(idx, App.selectedChip); App.selectedChip = null; } return; }
      if (team) pickWinner(roundKey, idx);
    });
    const rm = slot.querySelector(".rm");
    if (rm) rm.addEventListener("click", (e) => { e.stopPropagation(); removeSeed(idx); });
    if (placeable) {
      slot.addEventListener("dragover", (e) => { e.preventDefault(); slot.classList.add("dragover"); });
      slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));
      slot.addEventListener("drop", (e) => { e.preventDefault(); slot.classList.remove("dragover");
        const id = e.dataTransfer.getData("text/plain"); if (id) placeSeed(idx, id); });
    }
  });
}

function renderPool() {
  const used = new Set(App.bracket.r32.filter(Boolean));
  const q = (document.getElementById("poolSearch").value || "").trim().toLowerCase();
  const poolEl = document.getElementById("pool");
  const groups = [...new Set(TEAMS.map(t => t.group))];
  let html = "";
  groups.forEach(g => {
    const teams = TEAMS.filter(t => t.group === g).sort((a, b) => a.pos - b.pos);
    let chips = "";
    teams.forEach(t => {
      const match = !q || t.name.toLowerCase().includes(q) || t.group.toLowerCase() === q || (t.group + t.pos).toLowerCase() === q;
      if (!match) return;
      const isUsed = used.has(t.id);
      const isSel = App.selectedChip === t.id;
      chips += `<div class="chip ${isUsed ? "used" : ""} ${isSel ? "selected" : ""}" draggable="${!isUsed}" data-team="${t.id}">
        <span class="flag">${t.flag}</span><span class="cname">${t.name}</span></div>`;
    });
    if (!chips) return;
    html += `<div class="grp-col"><div class="grp-head">${g}조</div>${chips}</div>`;
  });
  poolEl.innerHTML = html;
  document.getElementById("poolCount").textContent = `(${used.size}/32 배치 · 총 48개국)`;
  poolEl.querySelectorAll(".chip").forEach(chip => {
    const id = chip.dataset.team;
    if (chip.classList.contains("used")) return;
    chip.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", id); });
    chip.addEventListener("click", () => {
      App.selectedChip = (App.selectedChip === id) ? null : id;
      renderPool();
      highlightEligible();
      toast(App.selectedChip ? `${TEAM_MAP[id].name} 선택됨 — 형광색 칸을 누르세요` : "선택 해제");
    });
  });
}

/* ===================== 순위 · 통계 ===================== */
function getActual() {
  return App.event && App.event.actual ? CORE.normalize(App.event.actual) : null;
}
function computeScores() {
  const actual = getActual();
  return App.predictions.map(p => {
    const b = CORE.normalize(p.bracket);
    const sc = actual ? CORE.score(b, actual) : null;
    return { id: p.id, name: p.name, bracket: b, score: sc };
  });
}
function renderRanking() {
  const actual = getActual();
  const note = document.getElementById("rankNote");
  const list = document.getElementById("rankList");
  const cards = document.getElementById("statCards");

  if (!App.predictions.length) {
    cards.innerHTML = ""; list.innerHTML = `<p class="muted">아직 제출된 예측이 없어요.</p>`; note.textContent = ""; return;
  }
  if (!actual) {
    note.textContent = "실제 결과가 아직 입력되지 않아 적중률을 계산할 수 없어요. (관리자 탭에서 입력)";
  } else {
    note.textContent = "각 라운드 실제 진출팀 중 맞힌 수로 채점하고, 우승 적중은 가중치 3배입니다.";
  }

  let scored = computeScores();
  const mode = document.getElementById("rankMode").value;
  const onlyChamp = document.getElementById("onlyChamp").checked;
  const q = (document.getElementById("rankSearch").value || "").trim().toLowerCase();

  // 선택된 모드에 맞는 적중률(%) 계산
  //  - r32(1차): 실제 결과와 '같은 칸에 같은 팀'이 들어간 개수 / 32
  //  - total(2차): 전체 라운드 합산(우승 가중치 3)
  const r32ExactHit = (s) => {
    if (!actual) return 0;
    let hit = 0;
    for (let i = 0; i < 32; i++) {
      if (actual.r32[i] && s.bracket.r32[i] && s.bracket.r32[i] === actual.r32[i]) hit++;
    }
    return hit;
  };
  const rateOf = (s) => {
    if (!actual) return 0;
    if (mode === "r32") return Math.round((r32ExactHit(s) / 32) * 100);
    return s.score.rate;
  };

  if (!actual) {
    note.textContent = "실제 결과가 아직 입력되지 않아 적중률을 계산할 수 없어요. (관리자 탭에서 입력)";
  } else if (mode === "r32") {
    note.textContent = "1차: 실제 결과와 '같은 칸에 같은 나라'를 맞힌 개수 ÷ 32 로 계산합니다. (위치까지 정확히 일치해야 적중)";
  } else {
    note.textContent = "2차: 전체 라운드 적중을 합산하고, 우승 적중은 가중치 3배로 계산합니다.";
  }

  // 통계 카드 (선택 모드 기준)
  if (actual) {
    const rates = scored.map(rateOf);
    const avg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
    const best = scored.slice().sort((a, b) => rateOf(b) - rateOf(a))[0];
    const champCount = scored.filter(s => s.score.champHit).length;
    const modeLabel = mode === "r32" ? "32강" : "전체";
    cards.innerHTML = `
      <div class="stat-box"><div class="big">${App.predictions.length}</div><div class="lbl">참가자 수</div></div>
      <div class="stat-box"><div class="big">${avg}%</div><div class="lbl">평균 적중률 (${modeLabel})</div></div>
      <div class="stat-box"><div class="big">${best ? rateOf(best) + "%" : "-"}</div><div class="lbl">최고 (${best ? escapeHtml(best.name) : "-"})</div></div>
      <div class="stat-box"><div class="big">${champCount}</div><div class="lbl">우승국 적중자</div></div>`;
  } else {
    cards.innerHTML = `<div class="stat-box"><div class="big">${App.predictions.length}</div><div class="lbl">참가자 수</div></div>`;
  }

  // 필터
  if (onlyChamp && actual) scored = scored.filter(s => s.score.champHit);
  if (q) scored = scored.filter(s => s.name.toLowerCase().includes(q));

  // 정렬
  if (actual) {
    scored.sort((a, b) => {
      if (mode === "r32") return r32ExactHit(b) - r32ExactHit(a);
      return b.score.totalHit - a.score.totalHit || b.score.rate - a.score.rate;
    });
  } else {
    scored.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (!scored.length) { list.innerHTML = `<p class="muted">조건에 맞는 참가자가 없어요.</p>`; return; }

  list.innerHTML = scored.map((s, i) => {
    const champTeam = s.bracket.champion ? TEAM_MAP[s.bracket.champion] : null;
    const champHtml = champTeam ? `${champTeam.flag} ${champTeam.name}` : "미정";
    let rateHtml = "";
    if (actual) {
      const detail = mode === "r32" ? `${r32ExactHit(s)}/32 정확` : `총점 ${s.score.totalHit}`;
      rateHtml = `<div class="rate">${rateOf(s)}%<small> ${detail}</small></div>`;
    } else {
      rateHtml = `<div class="rate" style="font-size:13px;color:var(--muted);">제출됨</div>`;
    }
    const champPill = (actual && s.score.champHit) ? `<span class="pill hit">우승적중</span>` : "";
    return `<div class="rank-row ${i === 0 && actual ? "top1" : ""}" data-id="${s.id}">
      <div class="pos">${actual ? (i + 1) : "•"}</div>
      <div class="pname">${escapeHtml(s.name)}${champPill}<div class="sub champ">🏆 ${champHtml}</div></div>
      ${rateHtml}
    </div>`;
  }).join("");

  list.querySelectorAll(".rank-row").forEach(row => {
    row.addEventListener("click", () => openDetail(row.dataset.id));
  });
}

function openDetail(predId) {
  const p = App.predictions.find(x => x.id === predId);
  if (!p) return;
  const b = CORE.normalize(p.bracket);
  const actual = getActual();
  document.getElementById("detailName").textContent = `${p.name} 님의 예측`;
  let summary = "";
  if (actual) {
    // 32강: 위치까지 정확히 일치한 칸 수 / 32
    let r32exact = 0;
    for (let i = 0; i < 32; i++) if (actual.r32[i] && b.r32[i] && b.r32[i] === actual.r32[i]) r32exact++;
    const sc = CORE.score(b, actual);
    const r32rate = Math.round((r32exact / 32) * 100);
    summary = `32강 정확도 ${r32rate}% (${r32exact}/32) · 우승 ${sc.champHit ? "적중 ✅" : "실패 ❌"} · 초록=정답위치 / 빨강=오답`;
  } else {
    const champ = b.champion ? TEAM_MAP[b.champion] : null;
    summary = `예측 우승국: ${champ ? champ.flag + " " + champ.name : "미정"}`;
  }
  document.getElementById("detailSummary").textContent = summary;
  document.getElementById("detailBracket").innerHTML = buildBracketHTML(b, { interactive: false });

  // 실제 결과와 비교해 32강 각 칸을 정답(초록)/오답(빨강)으로 표시
  if (actual) {
    const wrap = document.getElementById("detailBracket");
    wrap.querySelectorAll('.slot[data-round="r32"]').forEach(slot => {
      const idx = parseInt(slot.dataset.idx, 10);
      const team = slot.dataset.team;
      slot.classList.remove("winner", "loser");
      if (!team) return;
      if (actual.r32[idx] && team === actual.r32[idx]) slot.classList.add("cmp-correct");
      else slot.classList.add("cmp-wrong");
    });
  }
  showModal("detailModal");
}

/* ===================== 관리자 ===================== */
async function adminLogin() {
  const pin = document.getElementById("adminPin").value.trim();
  if (!pin) { toast("PIN을 입력하세요."); return; }
  try {
    const ok = await DB.adminVerify(App.event.id, pin);
    if (!ok) { toast("PIN이 올바르지 않아요."); return; }
    App.isAdmin = true; App.adminPin = pin;
    document.getElementById("adminLoginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    renderAdminPanel();
    toast("관리자 로그인 완료");
  } catch (e) { toast(e.message); }
}

async function renderAdminPanel() {
  await refreshEvent();
  await refreshPredictions();
  const ev = App.event;
  const st = document.getElementById("adminLockState");
  st.innerHTML = `
    <div class="lock-banner ${ev.r32_locked ? "" : "open"}">1차(32강): <b>${ev.r32_locked ? "마감됨 🔒" : "진행중 🟢"}</b></div>
    <div class="lock-banner ${ev.final_locked ? "" : "open"}">2차(전체): <b>${ev.final_locked ? "마감됨 🔒" : "진행중 🟢"}</b>
      &nbsp; 실제결과: <b>${ev.actual ? "입력됨 ✅" : "미입력"}</b></div>`;
  document.getElementById("btnLockR32").textContent = ev.r32_locked ? "🔓 1차(32강) 마감 해제" : "🔒 1차(32강) 마감";
  document.getElementById("btnLockFinal").textContent = ev.final_locked ? "🔓 2차(전체) 마감 해제" : "🔒 2차(전체) 마감";

  const listEl = document.getElementById("adminPredList");
  document.getElementById("adminCount").textContent = `(${App.predictions.length}명)`;
  if (!App.predictions.length) { listEl.innerHTML = `<p class="muted">아직 제출이 없어요.</p>`; return; }
  const actual = getActual();
  const scored = computeScores();
  listEl.innerHTML = scored.map(s => {
    const champ = s.bracket.champion ? TEAM_MAP[s.bracket.champion] : null;
    const rate = actual ? `${s.score.rate}%` : "—";
    return `<div class="admin-pred-row">
      <span class="nm">${escapeHtml(s.name)}</span>
      <span class="muted" style="font-size:12px;">🏆 ${champ ? champ.flag + champ.name : "미정"}</span>
      <span style="font-weight:700;">${rate}</span>
      <button class="btn" data-view="${s.id}" style="padding:5px 10px;">보기</button>
      <button class="btn danger" data-del="${s.id}" style="padding:5px 10px;">삭제</button>
    </div>`;
  }).join("");
  listEl.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => openDetail(b.dataset.view)));
  listEl.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => adminDelete(b.dataset.del)));
}

async function refreshEvent() {
  try { const ev = await DB.getEvent(App.event.id); if (ev) { App.event = ev; renderEventHeader(); } } catch (e) {}
}

async function toggleLock(which) {
  const cur = which === "r32" ? App.event.r32_locked : App.event.final_locked;
  const next = !cur;
  const msg = which === "r32"
    ? (next ? "1차(32강)를 마감할까요? 참가자는 32강을 더 못 바꿉니다." : "1차 마감을 해제할까요?")
    : (next ? "2차(전체)를 마감할까요? 모든 수정이 잠깁니다." : "2차 마감을 해제할까요?");
  if (!confirm(msg)) return;
  try {
    await DB.adminSetLock(App.event.id, App.adminPin, which, next);
    toast("적용됐어요.");
    renderAdminPanel();
  } catch (e) { toast(e.message); }
}

// 관리자: 실제 결과 입력 → 본인이 직접 브래킷을 채워서 저장
let editingActual = false;
async function editActual() {
  await refreshEvent(); // 최신 저장본을 불러와 이어서 편집
  editingActual = true;
  App.playerName = "__actual__";
  App.bracket = getActual() || CORE.emptyBracket();
  // 실제결과 입력은 마감과 무관하게 항상 편집 가능
  switchTab("predict");
  document.getElementById("nameCard").classList.add("hidden");
  document.getElementById("predictArea").classList.remove("hidden");
  document.getElementById("editingName").textContent = "🎯 실제 결과";
  document.getElementById("stageHint").textContent = "[관리자] 확정된 결과만 먼저 입력해도 됩니다. 나중에 다시 열어 이어서 수정·저장할 수 있어요.";
  document.getElementById("lockBanner").innerHTML = `<div class="lock-banner open">🎯 실제 결과 입력 모드 — 저장하면 적중률이 갱신돼요. (여러 번 수정 가능)</div>`;
  document.getElementById("poolSection").classList.remove("hidden");
  renderBracketActual();
  renderPoolActual();
}

// 실제결과 모드 전용 렌더 (편집 항상 허용)
function renderBracketActual() {
  const wrap = document.getElementById("bracket");
  wrap.innerHTML = buildBracketActualHTML(App.bracket);
  attachBracketEventsActual(wrap);
  highlightEligibleActual();
}
function highlightEligibleActual() {
  const wrap = document.getElementById("bracket");
  if (!wrap) return;
  wrap.classList.remove("picking");
  wrap.querySelectorAll(".slot.eligible").forEach(s => s.classList.remove("eligible"));
  if (!App.selectedChip) return;
  const team = TEAM_MAP[App.selectedChip];
  if (!team) return;
  let any = false;
  wrap.querySelectorAll('.slot.empty[data-round="r32"]').forEach(slot => {
    const idx = parseInt(slot.dataset.idx, 10);
    const def = SLOTS[idx];
    if (def && def.groups.includes(team.group)) { slot.classList.add("eligible"); any = true; }
  });
  if (any) wrap.classList.add("picking");
}
function buildBracketActualHTML(b) {
  // r32 항상 배치 가능
  let html = "";
  html += `<div class="round champion"><div class="round-title">🏆 우승</div><div class="matches">`;
  if (b.champion) { const t = TEAM_MAP[b.champion]; html += `<div class="champion-box"><div class="label">CHAMPION</div><div class="flag">${t.flag}</div><div class="name">${t.name}</div></div>`; }
  else html += `<div class="champion-box"><div class="label">CHAMPION</div><div class="empty">결승 승자를 클릭</div></div>`;
  html += `</div></div>`;
  for (let rIdx = ROUNDS.length - 1; rIdx >= 0; rIdx--) {
    const round = ROUNDS[rIdx], arr = b[round.key];
    const nextArr = rIdx < ORDER.length - 1 ? b[ORDER[rIdx + 1]] : null;
    const placeable = round.key === "r32";
    html += `<div class="round"><div class="round-title">${round.title}</div><div class="matches">`;
    for (let m = 0; m < arr.length / 2; m++) {
      const s0 = 2 * m, s1 = 2 * m + 1;
      let winner = round.key === "r2" ? b.champion : (nextArr ? nextArr[m] : null);
      const info = matchInfo(round.key, m);
      const timeHTML = info && info.kst ? `<div class="mtime">🕐 ${info.kst}${info.venue ? " · " + info.venue : ""}</div>` : "";
      html += `<div class="match">${timeHTML}`;
      html += slotHTML(round.key, s0, arr[s0], winner, placeable);
      html += slotHTML(round.key, s1, arr[s1], winner, placeable);
      html += `</div>`;
    }
    html += `</div></div>`;
  }
  return html;
}
function attachBracketEventsActual(wrap) {
  wrap.querySelectorAll(".slot").forEach(slot => {
    const roundKey = slot.dataset.round;
    const idx = parseInt(slot.dataset.idx, 10);
    const placeable = slot.dataset.placeable === "1";
    const team = slot.dataset.team;
    slot.addEventListener("click", (e) => {
      if (e.target.dataset.rm !== undefined) return;
      if (placeable && !team) { if (App.selectedChip) { placeSeedActual(idx, App.selectedChip); App.selectedChip = null; } return; }
      if (team) pickWinnerActual(roundKey, idx);
    });
    const rm = slot.querySelector(".rm");
    if (rm) rm.addEventListener("click", (e) => { e.stopPropagation(); App.bracket.r32[idx] = null; CORE.validate(App.bracket); renderBracketActual(); renderPoolActual(); });
    if (placeable) {
      slot.addEventListener("dragover", (e) => { e.preventDefault(); slot.classList.add("dragover"); });
      slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));
      slot.addEventListener("drop", (e) => { e.preventDefault(); slot.classList.remove("dragover");
        const id = e.dataTransfer.getData("text/plain"); if (id) placeSeedActual(idx, id); });
    }
  });
}
function placeSeedActual(slotIndex, teamId) {
  const slot = SLOTS[slotIndex];
  if (slot) { const t = TEAM_MAP[teamId]; if (!slot.groups.includes(t.group)) { toast(`이 자리는 '${slot.label}' 자리예요.`); return; } }
  const b = App.bracket;
  const ex = b.r32.indexOf(teamId); if (ex !== -1 && ex !== slotIndex) b.r32[ex] = null;
  b.r32[slotIndex] = teamId; App.selectedChip = null; CORE.validate(b); renderBracketActual(); renderPoolActual();
}
function pickWinnerActual(roundKey, slotIndex) {
  const b = App.bracket; const team = b[roundKey][slotIndex]; if (!team) return;
  const ri = ORDER.indexOf(roundKey); const mi = Math.floor(slotIndex / 2);
  if (ri < ORDER.length - 1) b[ORDER[ri + 1]][mi] = team; else b.champion = team;
  CORE.validate(b); renderBracketActual();
}
function renderPoolActual() {
  const used = new Set(App.bracket.r32.filter(Boolean));
  const q = (document.getElementById("poolSearch").value || "").trim().toLowerCase();
  const poolEl = document.getElementById("pool");
  const groups = [...new Set(TEAMS.map(t => t.group))];
  let html = "";
  groups.forEach(g => {
    const teams = TEAMS.filter(t => t.group === g).sort((a, b) => a.pos - b.pos);
    let chips = "";
    teams.forEach(t => {
      const match = !q || t.name.toLowerCase().includes(q) || t.group.toLowerCase() === q;
      if (!match) return;
      const isUsed = used.has(t.id), isSel = App.selectedChip === t.id;
      chips += `<div class="chip ${isUsed ? "used" : ""} ${isSel ? "selected" : ""}" draggable="${!isUsed}" data-team="${t.id}">
        <span class="flag">${t.flag}</span><span class="cname">${t.name}</span></div>`;
    });
    if (!chips) return;
    html += `<div class="grp-col"><div class="grp-head">${g}조</div>${chips}</div>`;
  });
  poolEl.innerHTML = html;
  document.getElementById("poolCount").textContent = `(${used.size}/32 배치)`;
  poolEl.querySelectorAll(".chip").forEach(chip => {
    const id = chip.dataset.team; if (chip.classList.contains("used")) return;
    chip.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", id); });
    chip.addEventListener("click", () => { App.selectedChip = (App.selectedChip === id) ? null : id; renderPoolActual(); highlightEligibleActual(); });
  });
}
async function saveActual() {
  try {
    await DB.adminSetActual(App.event.id, App.adminPin, App.bracket);
    await refreshEvent();
    editingActual = false;
    toast("실제 결과를 저장했어요. 적중률이 계산됩니다.");
    switchTab("admin");
  } catch (e) { toast(e.message); }
}

async function adminDelete(predId) {
  const p = App.predictions.find(x => x.id === predId);
  if (!p) return;
  if (!confirm(`'${p.name}' 님의 예측을 삭제할까요?`)) return;
  try {
    await DB.adminDeletePrediction(App.event.id, App.adminPin, predId);
    await refreshPredictions(); renderAdminPanel();
    toast("삭제했어요.");
  } catch (e) { toast(e.message); }
}

async function adminDeleteEvent() {
  if (!confirm(`이벤트 '${App.event.name}'와 모든 예측을 영구 삭제할까요? 되돌릴 수 없어요.`)) return;
  try {
    await DB.adminDeleteEvent(App.event.id, App.adminPin);
    toast("이벤트를 삭제했어요.");
    goHome();
  } catch (e) { toast(e.message); }
}

/* ===================== 마스터 관리자 ===================== */
let masterPin = null;
let masterEvents = [];

function openMaster() {
  if (!DB.configured()) { toast("Supabase 설정이 필요해요."); return; }
  show("screenMaster");
  document.getElementById("headerSub").textContent = "마스터 관리자";
  if (masterPin) { document.getElementById("masterLoginCard").classList.add("hidden"); document.getElementById("masterPanel").classList.remove("hidden"); loadMasterEvents(); }
  else { document.getElementById("masterLoginCard").classList.remove("hidden"); document.getElementById("masterPanel").classList.add("hidden"); document.getElementById("masterPin").value = ""; }
}

async function masterLogin() {
  const pin = document.getElementById("masterPin").value.trim();
  if (!pin) { toast("마스터 비밀번호를 입력하세요."); return; }
  try {
    const ok = await DB.masterVerify(pin);
    if (!ok) { toast("마스터 비밀번호가 올바르지 않아요."); return; }
    masterPin = pin;
    document.getElementById("masterLoginCard").classList.add("hidden");
    document.getElementById("masterPanel").classList.remove("hidden");
    await loadMasterEvents();
    toast("마스터 로그인 완료");
  } catch (e) { toast(e.message); }
}

async function loadMasterEvents() {
  const listEl = document.getElementById("masterEventList");
  listEl.innerHTML = `<p class="muted">불러오는 중…</p>`;
  try {
    masterEvents = await DB.masterListEvents(masterPin) || [];
    renderMasterEvents();
  } catch (e) { listEl.innerHTML = `<p class="muted">불러오지 못했어요: ${escapeHtml(e.message)}</p>`; }
}

function renderMasterEvents() {
  const listEl = document.getElementById("masterEventList");
  const q = (document.getElementById("masterSearch").value || "").trim().toLowerCase();
  let list = masterEvents;
  if (q) list = list.filter(e => e.name.toLowerCase().includes(q) || (e.join_code || "").toLowerCase().includes(q));
  if (!list.length) { listEl.innerHTML = `<p class="muted">${masterEvents.length ? "검색 결과가 없어요." : "아직 만든 이벤트가 없어요."}</p>`; return; }
  listEl.innerHTML = list.map(e => {
    const ico = e.type === "school" ? "🏫" : e.type === "staff" ? "🏢" : "🎯";
    const typeLabel = e.type === "school" ? "학교" : e.type === "staff" ? "직원" : "기타";
    const lock = e.final_locked ? `<span class="badge lock">최종마감</span>`
      : e.r32_locked ? `<span class="badge lock">32강마감</span>` : `<span class="badge open">진행중</span>`;
    const actual = e.actual ? `<span class="badge open">결과입력</span>` : "";
    return `<div class="event-item" data-id="${e.id}">
      <span class="ico">${ico}</span>
      <div class="meta">
        <div class="nm">${escapeHtml(e.name)} <span class="badge ${e.type}">${typeLabel}</span></div>
        <div class="sub">코드 ${e.join_code} · PIN ${escapeHtml(e.admin_pin)} · 참가 ${e.pred_count}명</div>
      </div>
      ${lock} ${actual}
    </div>`;
  }).join("");
  listEl.querySelectorAll(".event-item").forEach(el => {
    const id = el.dataset.id;
    const ev = masterEvents.find(x => x.id === id);
    el.addEventListener("click", () => enterEventAsAdmin(ev));
  });
}

// 마스터가 클릭 → 그 이벤트에 관리자 권한으로 바로 입장
async function enterEventAsAdmin(ev) {
  await enterEvent(ev.id);
  App.isAdmin = true;
  App.adminPin = ev.admin_pin;
  document.getElementById("adminLoginCard").classList.add("hidden");
  document.getElementById("adminPanel").classList.remove("hidden");
  switchTab("admin");
}

/* ===================== 공유 ===================== */
function openShareEvent() {
  const url = `${location.origin}${location.pathname}?e=${App.event.id}`;
  document.getElementById("shareLink").value = url;
  document.getElementById("shareCodeText").textContent = App.event.join_code;
  showModal("shareModal");
}

/* ===================== 유틸 ===================== */
function showModal(id) { document.getElementById(id).classList.add("show"); }
function closeModals() { document.querySelectorAll(".overlay").forEach(o => o.classList.remove("show")); }
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ===================== 제출/저장 버튼 분기 ===================== */
function handleSubmit() {
  if (editingActual) saveActual();
  else submitMine();
}

/* ===================== 초기화 / 이벤트 바인딩 ===================== */
async function init() {
  // 홈
  document.getElementById("btnHome").addEventListener("click", goHome);
  document.getElementById("btnMaster").addEventListener("click", openMaster);
  document.getElementById("appTitle").addEventListener("click", goHome);
  document.getElementById("btnJoin").addEventListener("click", joinByCode);
  document.getElementById("btnCreateEvent").addEventListener("click", createEvent);
  document.getElementById("joinCode").addEventListener("keydown", (e) => { if (e.key === "Enter") joinByCode(); });

  // 탭
  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // 예측
  document.getElementById("btnStartPredict").addEventListener("click", startPredict);
  document.getElementById("btnAuto").addEventListener("click", autoFill);
  document.getElementById("btnReset").addEventListener("click", resetMine);
  document.getElementById("btnSubmit").addEventListener("click", handleSubmit);
  document.getElementById("poolSearch").addEventListener("input", () => editingActual ? renderPoolActual() : renderPool());

  // 관리자
  document.getElementById("btnAdminLogin").addEventListener("click", adminLogin);
  document.getElementById("btnLockR32").addEventListener("click", () => toggleLock("r32"));
  document.getElementById("btnLockFinal").addEventListener("click", () => toggleLock("final"));
  document.getElementById("btnEditActual").addEventListener("click", editActual);
  document.getElementById("btnRefreshAdmin").addEventListener("click", renderAdminPanel);
  document.getElementById("btnDeleteEvent").addEventListener("click", adminDeleteEvent);

  // 순위 필터
  document.getElementById("rankMode").addEventListener("change", renderRanking);
  document.getElementById("onlyChamp").addEventListener("change", renderRanking);
  document.getElementById("rankSearch").addEventListener("input", renderRanking);

  // 마스터 관리자
  document.getElementById("btnMasterLogin").addEventListener("click", masterLogin);
  document.getElementById("masterPin").addEventListener("keydown", (e) => { if (e.key === "Enter") masterLogin(); });
  document.getElementById("masterSearch").addEventListener("input", renderMasterEvents);
  document.getElementById("btnMasterRefresh").addEventListener("click", loadMasterEvents);

  // 공유
  document.getElementById("btnShareEvent").addEventListener("click", openShareEvent);
  document.getElementById("btnCopyLink").addEventListener("click", () => {
    const ta = document.getElementById("shareLink"); ta.select();
    navigator.clipboard.writeText(ta.value).then(() => toast("링크 복사 완료!")).catch(() => { document.execCommand("copy"); toast("링크 복사 완료!"); });
  });

  // 모달 닫기
  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModals));
  document.querySelectorAll(".overlay").forEach(o => o.addEventListener("click", (e) => { if (e.target === o) closeModals(); }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

  // 링크로 이벤트 직접 입장
  const params = new URLSearchParams(location.search);
  const eid = params.get("e");
  if (DB.configured() && eid) { await enterEvent(eid); return; }
  goHome();
}

document.addEventListener("DOMContentLoaded", init);
