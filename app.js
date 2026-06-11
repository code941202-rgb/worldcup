/* =========================================================
   2026 월드컵 승부예측 - 앱 로직
   ========================================================= */

const STORAGE_KEY = "wc2026-prediction-v1";

/* ---------- 상태 ---------- */
function emptyProfile(name) {
  return {
    name,
    r32: new Array(32).fill(null), // 사용자가 배치하는 시드
    r16: new Array(16).fill(null), // 각 경기 승자
    r8:  new Array(8).fill(null),
    r4:  new Array(4).fill(null),
    r2:  new Array(2).fill(null),
    champion: null,
  };
}

let state = {
  current: "me",
  profiles: {
    me: emptyProfile(PROFILE_DEFAULT_NAMES.me),
    rival: emptyProfile(PROFILE_DEFAULT_NAMES.rival),
    actual: emptyProfile(PROFILE_DEFAULT_NAMES.actual),
  },
};

let selectedChip = null; // 클릭 배치용으로 선택된 팀 id

/* ---------- 저장 / 로드 ---------- */
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.profiles) {
      // 안전 병합
      ["me", "rival", "actual"].forEach(k => {
        const p = parsed.profiles[k];
        if (p) state.profiles[k] = normalizeProfile(p, PROFILE_DEFAULT_NAMES[k]);
      });
      if (parsed.current) state.current = parsed.current;
    }
  } catch (e) {}
}
function normalizeProfile(p, fallbackName) {
  const np = emptyProfile(p.name || fallbackName);
  const copyArr = (src, dst) => {
    if (Array.isArray(src)) for (let i = 0; i < dst.length; i++) dst[i] = src[i] ?? null;
  };
  copyArr(p.r32, np.r32);
  copyArr(p.r16, np.r16);
  copyArr(p.r8, np.r8);
  copyArr(p.r4, np.r4);
  copyArr(p.r2, np.r2);
  np.champion = p.champion ?? null;
  return np;
}

/* ---------- 유효성 검사 (상위 라운드 cascade) ---------- */
const ORDER = ["r32", "r16", "r8", "r4", "r2"];
function validate(profile) {
  for (let r = 0; r < ORDER.length - 1; r++) {
    const cur = profile[ORDER[r]];
    const next = profile[ORDER[r + 1]];
    for (let i = 0; i < next.length; i++) {
      const a = cur[2 * i];
      const b = cur[2 * i + 1];
      if (next[i] !== a && next[i] !== b) next[i] = null;
    }
  }
  // 우승: 결승 두 팀 중 하나여야 함
  const finalists = profile.r2;
  if (profile.champion !== finalists[0] && profile.champion !== finalists[1]) {
    profile.champion = null;
  }
}

/* ---------- 배치 / 제거 / 승자 선택 ---------- */
function cur() { return state.profiles[state.current]; }

function placeSeed(slotIndex, teamId) {
  const p = cur();
  // 슬롯 자리 제약 검증
  const slot = (typeof SLOTS !== "undefined") ? SLOTS[slotIndex] : null;
  if (slot) {
    const t = TEAM_MAP[teamId];
    if (!slot.groups.includes(t.group)) {
      toast(`이 자리는 '${slot.label}' 자리예요. ${t.group}조 팀은 올 수 없어요.`);
      return;
    }
  }
  // 이미 다른 칸에 있으면 제거 (중복 방지)
  const existing = p.r32.indexOf(teamId);
  if (existing !== -1 && existing !== slotIndex) p.r32[existing] = null;
  p.r32[slotIndex] = teamId;
  validate(p);
  save(); render();
}

function removeSeed(slotIndex) {
  const p = cur();
  p.r32[slotIndex] = null;
  validate(p);
  save(); render();
}

function pickWinner(roundKey, slotIndex) {
  const p = cur();
  const team = p[roundKey][slotIndex];
  if (!team) return;
  const ri = ORDER.indexOf(roundKey);
  const matchIndex = Math.floor(slotIndex / 2);
  if (ri < ORDER.length - 1) {
    p[ORDER[ri + 1]][matchIndex] = team;
  } else {
    // 결승 → 우승
    p.champion = team;
  }
  validate(p);
  save(); render();
}

/* ---------- 자동 32강 배치 (실제 대진 구조 기준) ----------
   각 슬롯의 자리(1위/2위/3위 후보 조)에 맞춰 팀을 채운다.
   3위 자리는 8개이며, 후보 조의 3위 팀들을 겹치지 않게 배정한다. */
function autoFill() {
  const p = cur();
  const r32 = new Array(32).fill(null);
  const usedThirds = new Set();

  // 1·2위 자리 먼저 채우기
  SLOTS.forEach((slot, idx) => {
    if (slot.third) return;
    const g = slot.groups[0];
    const pos = slot.label.includes("1위") ? 1 : 2;
    const team = TEAMS.find(t => t.group === g && t.pos === pos);
    if (team) r32[idx] = team.id;
  });

  // 3위 자리 채우기: 후보 조 중 아직 안 쓴 조의 3위 팀 배정
  SLOTS.forEach((slot, idx) => {
    if (!slot.third) return;
    const candGroups = slot.groups.filter(g => !usedThirds.has(g));
    const pick = candGroups[Math.floor(Math.random() * candGroups.length)] || slot.groups[0];
    usedThirds.add(pick);
    const team = TEAMS.find(t => t.group === pick && t.pos === 3);
    if (team) r32[idx] = team.id;
  });

  p.r32 = r32;
  p.r16 = new Array(16).fill(null);
  p.r8 = new Array(8).fill(null);
  p.r4 = new Array(4).fill(null);
  p.r2 = new Array(2).fill(null);
  p.champion = null;
  save(); render();
  toast("실제 대진 구조로 32강을 자동 배치했어요. 경기 승자를 클릭해 진행하세요.");
}
function sameGroup(a, b) {
  if (!a || !b) return false;
  return TEAM_MAP[a].group === TEAM_MAP[b].group;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ---------- 렌더링 ---------- */
function render() {
  renderProfilesUI();
  renderBracket();
  renderPool();
}

function renderProfilesUI() {
  document.querySelectorAll(".profile-btn").forEach(btn => {
    const p = btn.dataset.p;
    btn.classList.toggle("active", p === state.current);
    const nameEl = btn.querySelector(".pname");
    if (nameEl) nameEl.textContent = state.profiles[p].name;
  });
  document.getElementById("editingName").textContent = cur().name;
}

function slotHTML(roundKey, idx, teamId, winnerOfMatch, placeable) {
  if (!teamId) {
    let label = placeable ? "빈칸" : "—";
    if (placeable && typeof SLOTS !== "undefined" && SLOTS[idx]) label = SLOTS[idx].label;
    return `<div class="slot empty" data-round="${roundKey}" data-idx="${idx}" data-placeable="${placeable ? 1 : 0}">
      <span class="flag">+</span><span class="name slotlabel">${label}</span></div>`;
  }
  const t = TEAM_MAP[teamId];
  let cls = "slot";
  if (winnerOfMatch === teamId) cls += " winner";
  else if (winnerOfMatch) cls += " loser";
  const rmBtn = placeable ? `<button class="rm" title="제거" data-rm="${idx}">✕</button>` : "";
  return `<div class="${cls}" data-round="${roundKey}" data-idx="${idx}" data-team="${teamId}" data-placeable="${placeable ? 1 : 0}">
    <span class="flag">${t.flag}</span>
    <span class="name">${t.name}</span>
    ${rmBtn}
  </div>`;
}

// 라운드/경기 인덱스로 경기 시간·장소 정보 반환
function matchInfo(roundKey, matchIndex) {
  if (roundKey === "r32" && typeof R32_MATCHES !== "undefined") {
    const m = R32_MATCHES[matchIndex];
    return m ? { kst: m.kst, venue: m.venue, no: m.no } : null;
  }
  if (typeof ROUND_TIMES !== "undefined" && ROUND_TIMES[roundKey]) {
    return { kst: ROUND_TIMES[roundKey][matchIndex], venue: (ROUND_VENUES[roundKey] || [])[matchIndex] };
  }
  return null;
}

function renderBracket() {
  const p = cur();
  const wrap = document.getElementById("bracket");
  let html = "";

  // 우승 행 (맨 위)
  html += `<div class="round champion"><div class="round-title">🏆 우승</div><div class="matches">`;
  if (p.champion) {
    const t = TEAM_MAP[p.champion];
    html += `<div class="champion-box"><div class="label">CHAMPION</div>
      <div class="flag">${t.flag}</div><div class="name">${t.name}</div></div>`;
  } else {
    html += `<div class="champion-box"><div class="label">CHAMPION</div>
      <div class="empty">결승 승자를 클릭하세요</div></div>`;
  }
  html += `</div></div>`;

  // 라운드 행: 위에서부터 결승 → ... → 32강 순으로 출력
  for (let rIdx = ROUNDS.length - 1; rIdx >= 0; rIdx--) {
    const round = ROUNDS[rIdx];
    const arr = p[round.key];
    const nextArr = rIdx < ORDER.length - 1 ? p[ORDER[rIdx + 1]] : null;
    const placeable = round.key === "r32";
    html += `<div class="round"><div class="round-title">${round.title}</div><div class="matches">`;
    for (let m = 0; m < arr.length / 2; m++) {
      const s0 = 2 * m, s1 = 2 * m + 1;
      let winner = null;
      if (round.key === "r2") winner = p.champion;
      else if (nextArr) winner = nextArr[m];
      const info = matchInfo(round.key, m);
      const timeHTML = info && info.kst
        ? `<div class="mtime">🕐 ${info.kst}${info.venue ? " · " + info.venue : ""}</div>`
        : "";
      html += `<div class="match">`;
      html += timeHTML;
      html += slotHTML(round.key, s0, arr[s0], winner, placeable);
      html += slotHTML(round.key, s1, arr[s1], winner, placeable);
      html += `</div>`;
    }
    html += `</div></div>`;
  }

  wrap.innerHTML = html;
  attachBracketEvents();
}

function attachBracketEvents() {
  document.querySelectorAll(".slot").forEach(slot => {
    const roundKey = slot.dataset.round;
    const idx = parseInt(slot.dataset.idx, 10);
    const placeable = slot.dataset.placeable === "1";
    const team = slot.dataset.team;

    // 클릭
    slot.addEventListener("click", (e) => {
      if (e.target.dataset.rm !== undefined) return; // 제거버튼은 별도
      if (placeable && !team) {
        // 빈 r32 칸 → 선택된 칩 배치
        if (selectedChip) { placeSeed(idx, selectedChip); selectedChip = null; }
        return;
      }
      if (team) pickWinner(roundKey, idx);
    });

    // 제거 버튼
    const rm = slot.querySelector(".rm");
    if (rm) rm.addEventListener("click", (e) => { e.stopPropagation(); removeSeed(idx); });

    // 드래그 앤 드롭 (r32만)
    if (placeable) {
      slot.addEventListener("dragover", (e) => { e.preventDefault(); slot.classList.add("dragover"); });
      slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));
      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        slot.classList.remove("dragover");
        const id = e.dataTransfer.getData("text/plain");
        if (id) placeSeed(idx, id);
      });
    }
  });
}

function renderPool() {
  const p = cur();
  const used = new Set(p.r32.filter(Boolean));
  const q = (document.getElementById("poolSearch").value || "").trim().toLowerCase();
  const poolEl = document.getElementById("pool");
  const groups = [...new Set(TEAMS.map(t => t.group))]; // A..L
  let html = "";

  groups.forEach(g => {
    const teams = TEAMS.filter(t => t.group === g).sort((a, b) => a.pos - b.pos);
    let chips = "";
    teams.forEach(t => {
      const match = !q || t.name.toLowerCase().includes(q) || t.group.toLowerCase() === q || (t.group + t.pos).toLowerCase() === q;
      if (!match) return;
      const isUsed = used.has(t.id);
      const isSel = selectedChip === t.id;
      chips += `<div class="chip ${isUsed ? "used" : ""} ${isSel ? "selected" : ""}"
        draggable="${!isUsed}" data-team="${t.id}">
        <span class="flag">${t.flag}</span>
        <span class="cname">${t.name}</span>
      </div>`;
    });
    if (!chips) return; // 검색결과 없으면 해당 조 숨김
    html += `<div class="grp-col"><div class="grp-head">${g}조</div>${chips}</div>`;
  });

  poolEl.innerHTML = html;
  document.getElementById("poolCount").textContent = `(${used.size}/32 배치 · 총 48개국)`;

  poolEl.querySelectorAll(".chip").forEach(chip => {
    const id = chip.dataset.team;
    if (chip.classList.contains("used")) return;
    chip.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", id); });
    chip.addEventListener("click", () => {
      selectedChip = (selectedChip === id) ? null : id;
      renderPool();
      toast(selectedChip ? `${TEAM_MAP[id].name} 선택됨 — 빈 칸을 클릭하세요` : "선택 해제");
    });
  });
}

/* ---------- 프로필 전환 / 이름변경 / 초기화 ---------- */
function switchProfile(p) {
  state.current = p;
  selectedChip = null;
  save(); render();
}
function renameCurrent() {
  const name = prompt("프로필 이름을 입력하세요:", cur().name);
  if (name && name.trim()) { cur().name = name.trim(); save(); render(); }
}
function resetCurrent() {
  if (!confirm(`'${cur().name}'의 예측을 모두 초기화할까요?`)) return;
  state.profiles[state.current] = emptyProfile(cur().name);
  selectedChip = null;
  save(); render();
  toast("초기화 완료");
}

/* ---------- 공유 / 가져오기 ---------- */
function encodeProfile(p) {
  const payload = { v: 1, name: p.name, r32: p.r32, r16: p.r16, r8: p.r8, r4: p.r4, r2: p.r2, champion: p.champion };
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}
function decodeProfile(code) {
  const json = decodeURIComponent(atob(code.trim()));
  return JSON.parse(json);
}
function shareURL(code) {
  const base = location.origin + location.pathname;
  return `${base}?d=${code}`;
}
function openShare() {
  const code = encodeProfile(cur());
  document.getElementById("shareCode").value = code;
  document.getElementById("shareLink").value = shareURL(code);
  document.getElementById("shareProfileName").textContent = cur().name;
  showModal("shareModal");
}
function doImport(code, target) {
  try {
    const data = decodeProfile(code);
    state.profiles[target] = normalizeProfile(data, PROFILE_DEFAULT_NAMES[target]);
    validate(state.profiles[target]);
    save();
    closeModals();
    if (state.current === target) render(); else { state.current = target; render(); }
    toast(`'${state.profiles[target].name}' 예측을 ${PROFILE_DEFAULT_NAMES[target]} 칸에 불러왔어요`);
  } catch (e) {
    alert("코드를 해석할 수 없습니다. 올바른 공유 코드인지 확인하세요.");
  }
}

/* ---------- 승률 비교 ---------- */
function scoreAgainstActual(predict, actual) {
  // 라운드별: 예측 진출팀 중 실제 진출팀과 일치하는 수
  const result = {};
  let totalHit = 0, totalPossible = 0;
  const rounds = [
    { key: "r32", label: "32강 진출", weight: 1 },
    { key: "r16", label: "16강 진출", weight: 1 },
    { key: "r8",  label: "8강 진출",  weight: 1 },
    { key: "r4",  label: "4강 진출",  weight: 1 },
    { key: "r2",  label: "결승 진출", weight: 1 },
  ];
  rounds.forEach(r => {
    const actSet = new Set(actual[r.key].filter(Boolean));
    const predSet = new Set(predict[r.key].filter(Boolean));
    let hit = 0;
    predSet.forEach(id => { if (actSet.has(id)) hit++; });
    const possible = actSet.size; // 실제 진출 팀 수 기준
    result[r.key] = { label: r.label, hit, possible, predicted: predSet.size };
    totalHit += hit;
    totalPossible += possible;
  });
  // 우승 적중
  const champHit = (predict.champion && predict.champion === actual.champion) ? 1 : 0;
  const champPossible = actual.champion ? 1 : 0;
  result.champion = { label: "우승 적중", hit: champHit, possible: champPossible, predicted: predict.champion ? 1 : 0 };
  totalHit += champHit * 3; // 우승은 가중치 3
  totalPossible += champPossible * 3;
  const rate = totalPossible > 0 ? Math.round((totalHit / totalPossible) * 100) : 0;
  return { result, totalHit, totalPossible, rate };
}

function openCompare() {
  const actual = state.profiles.actual;
  const hasActual = actual.r32.some(Boolean);
  const body = document.getElementById("compareBody");
  if (!hasActual) {
    body.innerHTML = `<div class="verdict">먼저 <b>실제결과</b> 프로필에 실제 대진과 결과를 입력하세요.<br/>
      (상단 '실제결과' 선택 → 32강 배치 → 경기 승자 클릭)</div>`;
    showModal("compareModal");
    return;
  }
  const me = scoreAgainstActual(state.profiles.me, actual);
  const rival = scoreAgainstActual(state.profiles.rival, actual);

  let verdict;
  if (me.rate > rival.rate) verdict = `🏆 <b>${state.profiles.me.name}</b> 우세! (${me.rate}% vs ${rival.rate}%)`;
  else if (rival.rate > me.rate) verdict = `🏆 <b>${state.profiles.rival.name}</b> 우세! (${rival.rate}% vs ${me.rate}%)`;
  else verdict = `🤝 무승부! (둘 다 ${me.rate}%)`;

  const card = (cls, name, sc) => {
    const wrong = sc.totalPossible - sc.totalHit;
    return `<div class="cmp-card ${cls}">
      <h3><span class="dot"></span>${name}</h3>
      <div class="winrate">${sc.rate}%<small> 적중률</small></div>
      <div class="cmp-stats">
        <span>✅ 적중 <span class="ok">${sc.totalHit}</span></span>
        <span>❌ 빗나감 <span class="no">${wrong < 0 ? 0 : wrong}</span></span>
        <span>총점 ${sc.totalHit}/${sc.totalPossible}</span>
      </div>
      <div class="bar"><span style="width:${sc.rate}%"></span></div>
    </div>`;
  };

  let rows = "";
  ["r32", "r16", "r8", "r4", "r2", "champion"].forEach(k => {
    const m = me.result[k], rv = rival.result[k];
    rows += `<tr>
      <td class="round-label">${m.label}</td>
      <td>${m.hit} / ${m.possible}</td>
      <td>${rv.hit} / ${rv.possible}</td>
    </tr>`;
  });

  body.innerHTML = `
    <div class="cmp-cards">
      ${card("me", state.profiles.me.name, me)}
      ${card("rival", state.profiles.rival.name, rival)}
    </div>
    <div class="verdict">${verdict}</div>
    <table class="breakdown">
      <thead><tr><th>라운드</th><th>${state.profiles.me.name}</th><th>${state.profiles.rival.name}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="muted" style="margin-top:12px;">※ 각 라운드는 '실제 진출 팀 중 맞힌 수'로 채점하며, 우승 적중은 가중치 3배로 계산합니다.</p>
  `;
  showModal("compareModal");
}

/* ---------- 모달 / 토스트 유틸 ---------- */
function showModal(id) { document.getElementById(id).classList.add("show"); }
function closeModals() { document.querySelectorAll(".overlay").forEach(o => o.classList.remove("show")); }
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- URL 링크로 받은 예측 처리 ---------- */
function handleIncomingLink() {
  const params = new URLSearchParams(location.search);
  const code = params.get("d");
  if (!code) return;
  try {
    const data = decodeProfile(code);
    const name = data.name || "공유된 예측";
    // 어느 프로필로 불러올지 선택
    const target = pickImportTarget(name);
    if (target) {
      state.profiles[target] = normalizeProfile(data, PROFILE_DEFAULT_NAMES[target]);
      validate(state.profiles[target]);
      state.current = target;
      save();
      toast(`'${name}' 예측을 ${PROFILE_DEFAULT_NAMES[target]} 칸에 불러왔어요`);
    }
  } catch (e) {
    alert("링크의 예측 데이터를 읽을 수 없습니다.");
  }
  // 주소창에서 ?d= 제거 (새로고침 시 재적용 방지)
  history.replaceState(null, "", location.origin + location.pathname);
}
function pickImportTarget(name) {
  const ans = prompt(
    `링크로 '${name}'의 예측을 받았어요. 어디에 저장할까요?\n\n` +
    `1 = 후배\n2 = 나\n3 = 실제결과\n\n번호를 입력하세요 (취소하면 안 불러옴):`,
    "1"
  );
  if (ans === null) return null;
  const map = { "1": "rival", "2": "me", "3": "actual" };
  return map[ans.trim()] || "rival";
}

/* ---------- 이벤트 바인딩 ---------- */
function init() {
  load();
  handleIncomingLink();
  render();

  document.querySelectorAll(".profile-btn").forEach(btn => {
    btn.addEventListener("click", () => switchProfile(btn.dataset.p));
  });
  document.getElementById("btnRename").addEventListener("click", renameCurrent);
  document.getElementById("btnAuto").addEventListener("click", autoFill);
  document.getElementById("btnReset").addEventListener("click", resetCurrent);
  document.getElementById("btnCompare").addEventListener("click", openCompare);
  document.getElementById("btnShare").addEventListener("click", openShare);
  document.getElementById("btnImport").addEventListener("click", () => {
    document.getElementById("importTarget").value = state.current === "actual" ? "actual" : (state.current === "me" ? "me" : "rival");
    showModal("importModal");
  });
  document.getElementById("poolSearch").addEventListener("input", renderPool);

  document.getElementById("btnCopyCode").addEventListener("click", () => {
    const ta = document.getElementById("shareCode");
    ta.select();
    navigator.clipboard.writeText(ta.value).then(() => toast("코드를 복사했어요!"))
      .catch(() => { document.execCommand("copy"); toast("코드를 복사했어요!"); });
  });
  document.getElementById("btnCopyLink").addEventListener("click", () => {
    const ta = document.getElementById("shareLink");
    ta.select();
    navigator.clipboard.writeText(ta.value).then(() => toast("링크를 복사했어요!"))
      .catch(() => { document.execCommand("copy"); toast("링크를 복사했어요!"); });
  });
  document.getElementById("btnDownload").addEventListener("click", () => {
    const p = cur();
    const payload = { v: 1, name: p.name, r32: p.r32, r16: p.r16, r8: p.r8, r4: p.r4, r2: p.r2, champion: p.champion };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worldcup2026-${p.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("파일로 저장했어요");
  });
  document.getElementById("btnDoImport").addEventListener("click", () => {
    const code = document.getElementById("importCode").value;
    const target = document.getElementById("importTarget").value;
    if (!code.trim()) { alert("공유 코드를 붙여넣으세요."); return; }
    doImport(code, target);
  });

  // 파일 내보내기/가져오기
  document.getElementById("btnImportFile").addEventListener("click", () => document.getElementById("fileInput").click());
  document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const target = document.getElementById("importTarget").value;
        state.profiles[target] = normalizeProfile(data, PROFILE_DEFAULT_NAMES[target]);
        validate(state.profiles[target]);
        save(); closeModals(); switchProfile(target);
        toast("파일에서 불러왔어요");
      } catch (err) { alert("JSON 파일을 읽을 수 없습니다."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModals));
  document.querySelectorAll(".overlay").forEach(o => o.addEventListener("click", (e) => { if (e.target === o) closeModals(); }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });
}

document.addEventListener("DOMContentLoaded", init);
