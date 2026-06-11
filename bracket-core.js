/* =========================================================
   브래킷 공용 로직 (참가자/관리자 화면 공유)
   - 상태 생성, 검증, 채점, 렌더링 헬퍼
   ========================================================= */

const CORE = (() => {
  const ORDER = ["r32", "r16", "r8", "r4", "r2"];

  function emptyBracket() {
    return {
      r32: new Array(32).fill(null),
      r16: new Array(16).fill(null),
      r8:  new Array(8).fill(null),
      r4:  new Array(4).fill(null),
      r2:  new Array(2).fill(null),
      champion: null,
    };
  }

  function normalize(b) {
    const nb = emptyBracket();
    if (!b) return nb;
    const copy = (src, dst) => { if (Array.isArray(src)) for (let i = 0; i < dst.length; i++) dst[i] = src[i] ?? null; };
    copy(b.r32, nb.r32); copy(b.r16, nb.r16); copy(b.r8, nb.r8); copy(b.r4, nb.r4); copy(b.r2, nb.r2);
    nb.champion = b.champion ?? null;
    return nb;
  }

  // 상위 라운드 cascade 검증
  function validate(b) {
    for (let r = 0; r < ORDER.length - 1; r++) {
      const cur = b[ORDER[r]], next = b[ORDER[r + 1]];
      for (let i = 0; i < next.length; i++) {
        const a = cur[2 * i], c = cur[2 * i + 1];
        if (next[i] !== a && next[i] !== c) next[i] = null;
      }
    }
    const f = b.r2;
    if (b.champion !== f[0] && b.champion !== f[1]) b.champion = null;
    return b;
  }

  // 채점: 예측 vs 실제
  // 라운드별 적중 + 우승 가중치 3. 반환: {result, totalHit, totalPossible, rate, champHit}
  function score(predict, actual) {
    const result = {};
    let totalHit = 0, totalPossible = 0;
    const rounds = [
      { key: "r32", label: "32강 진출" },
      { key: "r16", label: "16강 진출" },
      { key: "r8",  label: "8강 진출" },
      { key: "r4",  label: "4강 진출" },
      { key: "r2",  label: "결승 진출" },
    ];
    rounds.forEach(r => {
      const actSet = new Set((actual[r.key] || []).filter(Boolean));
      const predSet = new Set((predict[r.key] || []).filter(Boolean));
      let hit = 0;
      predSet.forEach(id => { if (actSet.has(id)) hit++; });
      result[r.key] = { label: r.label, hit, possible: actSet.size, predicted: predSet.size };
      totalHit += hit; totalPossible += actSet.size;
    });
    const champHit = (predict.champion && predict.champion === actual.champion) ? 1 : 0;
    const champPossible = actual.champion ? 1 : 0;
    result.champion = { label: "우승 적중", hit: champHit, possible: champPossible, predicted: predict.champion ? 1 : 0 };
    totalHit += champHit * 3; totalPossible += champPossible * 3;
    const rate = totalPossible > 0 ? Math.round((totalHit / totalPossible) * 100) : 0;
    return { result, totalHit, totalPossible, rate, champHit: !!champHit };
  }

  // 실제 결과가 입력되었는지
  function hasData(b) { return b && Array.isArray(b.r32) && b.r32.some(Boolean); }

  return { ORDER, emptyBracket, normalize, validate, score, hasData };
})();
