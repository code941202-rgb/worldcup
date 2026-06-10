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
