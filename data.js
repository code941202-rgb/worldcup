/* 2026 북중미 월드컵 본선 48개국 (2025.12.5 조추첨 확정 기준)
   id: 고유키, name: 한글명, flag: 국기 이모지, group: 조, pos: 조 내 순번 */
const TEAMS = [
  // Group A
  { id: "MEX", name: "멕시코",        flag: "🇲🇽", group: "A", pos: 1 },
  { id: "RSA", name: "남아프리카공화국", flag: "🇿🇦", group: "A", pos: 2 },
  { id: "KOR", name: "대한민국",      flag: "🇰🇷", group: "A", pos: 3 },
  { id: "CZE", name: "체코",          flag: "🇨🇿", group: "A", pos: 4 },
  // Group B
  { id: "CAN", name: "캐나다",        flag: "🇨🇦", group: "B", pos: 1 },
  { id: "BIH", name: "보스니아",      flag: "🇧🇦", group: "B", pos: 2 },
  { id: "QAT", name: "카타르",        flag: "🇶🇦", group: "B", pos: 3 },
  { id: "SUI", name: "스위스",        flag: "🇨🇭", group: "B", pos: 4 },
  // Group C
  { id: "BRA", name: "브라질",        flag: "🇧🇷", group: "C", pos: 1 },
  { id: "MAR", name: "모로코",        flag: "🇲🇦", group: "C", pos: 2 },
  { id: "HAI", name: "아이티",        flag: "🇭🇹", group: "C", pos: 3 },
  { id: "SCO", name: "스코틀랜드",    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C", pos: 4 },
  // Group D
  { id: "USA", name: "미국",          flag: "🇺🇸", group: "D", pos: 1 },
  { id: "PAR", name: "파라과이",      flag: "🇵🇾", group: "D", pos: 2 },
  { id: "AUS", name: "호주",          flag: "🇦🇺", group: "D", pos: 3 },
  { id: "TUR", name: "튀르키예",      flag: "🇹🇷", group: "D", pos: 4 },
  // Group E
  { id: "GER", name: "독일",          flag: "🇩🇪", group: "E", pos: 1 },
  { id: "CUW", name: "쿠라소",        flag: "🇨🇼", group: "E", pos: 2 },
  { id: "CIV", name: "코트디부아르",  flag: "🇨🇮", group: "E", pos: 3 },
  { id: "ECU", name: "에콰도르",      flag: "🇪🇨", group: "E", pos: 4 },
  // Group F
  { id: "NED", name: "네덜란드",      flag: "🇳🇱", group: "F", pos: 1 },
  { id: "JPN", name: "일본",          flag: "🇯🇵", group: "F", pos: 2 },
  { id: "SWE", name: "스웨덴",        flag: "🇸🇪", group: "F", pos: 3 },
  { id: "TUN", name: "튀니지",        flag: "🇹🇳", group: "F", pos: 4 },
  // Group G
  { id: "BEL", name: "벨기에",        flag: "🇧🇪", group: "G", pos: 1 },
  { id: "EGY", name: "이집트",        flag: "🇪🇬", group: "G", pos: 2 },
  { id: "IRN", name: "이란",          flag: "🇮🇷", group: "G", pos: 3 },
  { id: "NZL", name: "뉴질랜드",      flag: "🇳🇿", group: "G", pos: 4 },
  // Group H
  { id: "ESP", name: "스페인",        flag: "🇪🇸", group: "H", pos: 1 },
  { id: "CPV", name: "카보베르데",    flag: "🇨🇻", group: "H", pos: 2 },
  { id: "KSA", name: "사우디아라비아", flag: "🇸🇦", group: "H", pos: 3 },
  { id: "URU", name: "우루과이",      flag: "🇺🇾", group: "H", pos: 4 },
  // Group I
  { id: "FRA", name: "프랑스",        flag: "🇫🇷", group: "I", pos: 1 },
  { id: "SEN", name: "세네갈",        flag: "🇸🇳", group: "I", pos: 2 },
  { id: "IRQ", name: "이라크",        flag: "🇮🇶", group: "I", pos: 3 },
  { id: "NOR", name: "노르웨이",      flag: "🇳🇴", group: "I", pos: 4 },
  // Group J
  { id: "ARG", name: "아르헨티나",    flag: "🇦🇷", group: "J", pos: 1 },
  { id: "ALG", name: "알제리",        flag: "🇩🇿", group: "J", pos: 2 },
  { id: "AUT", name: "오스트리아",    flag: "🇦🇹", group: "J", pos: 3 },
  { id: "JOR", name: "요르단",        flag: "🇯🇴", group: "J", pos: 4 },
  // Group K
  { id: "POR", name: "포르투갈",      flag: "🇵🇹", group: "K", pos: 1 },
  { id: "COD", name: "콩고DR",        flag: "🇨🇩", group: "K", pos: 2 },
  { id: "UZB", name: "우즈베키스탄",  flag: "🇺🇿", group: "K", pos: 3 },
  { id: "COL", name: "콜롬비아",      flag: "🇨🇴", group: "K", pos: 4 },
  // Group L
  { id: "ENG", name: "잉글랜드",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L", pos: 1 },
  { id: "CRO", name: "크로아티아",    flag: "🇭🇷", group: "L", pos: 2 },
  { id: "GHA", name: "가나",          flag: "🇬🇭", group: "L", pos: 3 },
  { id: "PAN", name: "파나마",        flag: "🇵🇦", group: "L", pos: 4 },
];

const TEAM_MAP = Object.fromEntries(TEAMS.map(t => [t.id, t]));

/* 32강 대진 구조: 16경기 → 16강 8경기 → 8강 4경기 → 4강 2경기 → 결승 1경기 → 우승
   라운드 정의. 각 라운드는 slot 개수를 가진다. */
const ROUNDS = [
  { key: "r32", title: "32강", slots: 32 },
  { key: "r16", title: "16강", slots: 16 },
  { key: "r8",  title: "8강",  slots: 8 },
  { key: "r4",  title: "4강",  slots: 4 },
  { key: "r2",  title: "결승", slots: 2 },
];

const PROFILE_DEFAULT_NAMES = { me: "나", rival: "후배", actual: "실제결과" };

/* =========================================================
   실제 2026 월드컵 32강 대진 구조 (FIFA 공식)
   - 각 칸은 정해진 "조별 순위" 자리를 가짐
   - 경기 시간은 한국시간(KST) 기준
   - R32_MATCHES 는 브래킷 진행 순서대로 정렬되어 있어,
     인접한 두 경기의 승자가 다음 라운드에서 만난다.
   ========================================================= */

// 헬퍼: 슬롯 정의
function winSlot(g) { return { label: `${g}조 1위`, groups: [g] }; }
function ruSlot(g)  { return { label: `${g}조 2위`, groups: [g] }; }
function thirdSlot(arr) { return { label: `3위 ${arr.join("/")}`, groups: arr, third: true }; }

// 32강 16경기 (브래킷 순서대로). no=공식 경기번호, kst=한국시간, venue=개최도시
const R32_MATCHES = [
  { no: 74, kst: "6/30 05:30", venue: "폭스버러",   a: winSlot("E"),  b: thirdSlot(["A","B","C","D","F"]) },
  { no: 77, kst: "7/1 06:00",  venue: "뉴저지",     a: winSlot("I"),  b: thirdSlot(["C","D","F","G","H"]) },
  { no: 73, kst: "6/29 04:00", venue: "LA",         a: ruSlot("A"),   b: ruSlot("B") },
  { no: 75, kst: "6/30 10:00", venue: "과달루페",   a: winSlot("F"),  b: ruSlot("C") },
  { no: 83, kst: "7/3 08:00",  venue: "토론토",     a: ruSlot("K"),   b: ruSlot("L") },
  { no: 84, kst: "7/3 04:00",  venue: "LA",         a: winSlot("H"),  b: ruSlot("J") },
  { no: 81, kst: "7/2 09:00",  venue: "샌타클래라", a: winSlot("D"),  b: thirdSlot(["B","E","F","I","J"]) },
  { no: 82, kst: "7/2 05:00",  venue: "시애틀",     a: winSlot("G"),  b: thirdSlot(["A","E","H","I","J"]) },
  { no: 76, kst: "6/30 02:00", venue: "휴스턴",     a: winSlot("C"),  b: ruSlot("F") },
  { no: 78, kst: "7/1 02:00",  venue: "알링턴",     a: ruSlot("E"),   b: ruSlot("I") },
  { no: 79, kst: "7/1 10:00",  venue: "멕시코시티", a: winSlot("A"),  b: thirdSlot(["C","E","F","H","I"]) },
  { no: 80, kst: "7/2 01:00",  venue: "애틀랜타",   a: winSlot("L"),  b: thirdSlot(["E","H","I","J","K"]) },
  { no: 86, kst: "7/4 07:00",  venue: "마이애미",   a: winSlot("J"),  b: ruSlot("H") },
  { no: 88, kst: "7/4 03:00",  venue: "알링턴",     a: ruSlot("D"),   b: ruSlot("G") },
  { no: 85, kst: "7/3 12:00",  venue: "밴쿠버",     a: winSlot("B"),  b: thirdSlot(["E","F","G","I","J"]) },
  { no: 87, kst: "7/4 10:30",  venue: "캔자스시티", a: winSlot("K"),  b: thirdSlot(["D","E","I","J","L"]) },
];

// 32개 슬롯 평탄화 (r32 배열 인덱스와 1:1 대응)
const SLOTS = [];
R32_MATCHES.forEach(m => { SLOTS.push(m.a); SLOTS.push(m.b); });

// 이후 라운드 경기 시간 (한국시간). 각 라운드의 경기(match) 순서대로
const ROUND_TIMES = {
  r16: ["7/5 06:00","7/5 02:00","7/7 04:00","7/7 09:00","7/6 05:00","7/6 09:00","7/8 01:00","7/8 05:00"],
  r8:  ["7/10 05:00","7/11 04:00","7/12 06:00","7/12 10:00"],
  r4:  ["7/15 04:00","7/16 04:00"],
  r2:  ["7/20 04:00"],
};
const ROUND_VENUES = {
  r16: ["필라델피아","휴스턴","알링턴","시애틀","뉴저지","멕시코시티","애틀랜타","밴쿠버"],
  r8:  ["폭스버러","LA","마이애미","캔자스시티"],
  r4:  ["알링턴","애틀랜타"],
  r2:  ["뉴저지"],
};
