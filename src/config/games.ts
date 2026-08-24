// 게임 레지스트리 — 게임의 메타 정보(선택 카드·WS 경로·세션 키·룰 요약)를
// 한 곳에 모은다. 새 게임을 추가할 때 여기와 App.tsx 분기, 게임 폴더만
// 만들면 된다 (기존에는 7곳을 고쳐야 했다).

export type GameId =
  | 'ninedragons'
  | 'numberchange'
  | 'davinci'
  | 'schottentotten'
  | 'jekyllhyde'
  | 'geister'
  | 'quoridor'
  | 'onitama'
  | 'lostcities'
  | 'cantstop'
  | 'tichu'
  | 'mighty'
  | 'skyfall'
  | 'spyfall'
  | 'loveletter'
  | 'omok'
  | 'skull'
  | 'codenames'
  | 'yacht'
  | 'indianpoker'
  | 'nothanks'
  | 'lasvegas'
  | 'coup'
  | 'nimmt'
  | 'ciaociao'
  | 'cockroach'
  | 'insider'
  | 'dalmuti'
  | 'kraken'
  | 'skullking'
  | 'crew'
  | 'justone'
  | 'set'
  | 'kittens'
  | 'mind'
  | 'reformation'
  | 'saboteur'
  | 'avalon';

// 게임 카테고리 — 선택 화면 필터 칩. 한 게임이 여러 개를 가질 수 있다.
// 목록 순서가 곧 칩 표시 순서다.
export const GAME_CATEGORIES = [
  '전략',
  '추리',
  '정체 은닉',
  '블러핑',
  '트릭테이킹',
  '협력',
  '주사위',
  '단어',
  '실시간',
] as const;

export type GameCategory = (typeof GAME_CATEGORIES)[number];

export interface RuleSection {
  heading?: string;
  items: string[];
}

export interface GameMeta {
  title: string;
  tag: string;
  description: string;
  // 사람이 읽는 인원 표기 ('3~7인'). 필터는 아래 min/max 를 쓴다.
  players: string;
  minPlayers: number;
  maxPlayers: number;
  categories: GameCategory[];
  duration: string;
  // 게임 화면의 실제 배경 무드 (정보 팝업 등 오버레이 테마 기준)
  mood: 'dark' | 'cream';
  wsPath: string;
  logPrefix: string;
  // sessionStorage 키. 값을 바꾸면 기존 재접속 세션이 끊기므로 불변으로 둔다.
  sessionKey: string;
  rules: RuleSection[];
}

export const GAMES: Record<GameId, GameMeta> = {
  ninedragons: {
    mood: 'cream',
    title: '구룡투',
    tag: '전략 · 심리전',
    description: '전략적 타일 배치 게임',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['전략'],
    duration: '5분',
    wsPath: '/ws',
    logPrefix: '[NineDragons] WebSocket',
    sessionKey: 'ninedragons_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '1~9 타일 아홉 장으로 아홉 라운드를 겨룹니다.',
          '매 라운드 서로 타일 한 장씩 내고, 높은 숫자가 이깁니다.',
          '단, 1은 9를 이깁니다. 같은 숫자는 무승부입니다.',
          '한 번 낸 타일은 다시 쓸 수 없고, 라운드 승자가 다음 라운드 선공입니다.',
        ],
      },
      {
        heading: '승리',
        items: ['5라운드를 먼저 이기거나, 9라운드 종료 시 더 많이 이긴 쪽이 승리합니다.'],
      },
    ],
  },
  numberchange: {
    mood: 'cream',
    title: '넘버체인지',
    tag: '계산 · 교환',
    description: '숫자 블록 합계 대결 게임',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['전략'],
    duration: '5-10분',
    wsPath: '/ws/numberchange',
    logPrefix: '[NumberChange] WebSocket',
    sessionKey: 'numberchange_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '각 팀은 1~7 블록 두 벌(14개)로 시작합니다.',
          '매 라운드 블록 두 개를 골라 동시에 제출하고, 합계가 큰 쪽이 1점을 얻습니다.',
          '라운드가 끝나면 서로 상대가 낸 블록 중 큰 것을 받아옵니다 — 블록이 계속 오갑니다.',
        ],
      },
      {
        heading: '히든 찬스 (게임당 1회)',
        items: [
          '제출할 때 히든을 쓰면 내 블록이 가려집니다.',
          '상대는 내 블록을 보지 못한 채 받아올 블록을 골라야 합니다.',
        ],
      },
      {
        heading: '승리',
        items: ['7점을 먼저 얻거나, 12라운드 종료 시 다득점 팀이 승리합니다. 동점이면 연장전입니다.'],
      },
    ],
  },
  davinci: {
    mood: 'cream',
    title: '다빈치 코드',
    tag: '추리 · 심리전',
    description: '숫자 타일 추리 게임',
    players: '2~4인',
    minPlayers: 2,
    maxPlayers: 4,
    categories: ['추리', '블러핑'],
    duration: '10-15분',
    wsPath: '/ws/davinci',
    logPrefix: '[DaVinci] WebSocket',
    sessionKey: 'davinci_session_id',
    rules: [
      {
        heading: '준비',
        items: [
          '검정·흰색 0~11 숫자 타일 24장과 조커(★) 2장을 사용합니다.',
          '2~3인은 4장, 4인은 3장을 원하는 색으로 골라 가져옵니다.',
          '타일은 왼쪽부터 오름차순으로 놓입니다(같은 숫자는 검정이 왼쪽). 조커는 원하는 위치에 놓고, 이후 옮길 수 없습니다.',
        ],
      },
      {
        heading: '내 차례',
        items: [
          '더미에서 원하는 색 타일을 한 장 뽑습니다.',
          '상대의 비공개 타일 하나를 지목해 값을 추리합니다 (조커는 ★로 추리).',
          '성공: 그 타일이 공개됩니다. 계속 추리하거나 멈출 수 있고, 멈추면 뽑은 타일은 비공개로 내 줄에 들어갑니다.',
          '실패: 뽑은 타일이 공개된 채로 내 줄에 들어갑니다.',
          '더미가 없으면 뽑기 없이 바로 추리하고, 실패하면 내 타일 하나를 골라 공개합니다.',
        ],
      },
      {
        heading: '승리',
        items: ['타일이 전부 공개된 사람은 탈락합니다. 마지막까지 비공개 타일을 지킨 사람이 승리합니다.'],
      },
    ],
  },
  schottentotten: {
    mood: 'cream',
    title: '쇼텐토텐',
    tag: '전략 · 족보',
    description: '국경석을 둔 카드 진형 대결',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['전략'],
    duration: '15-20분',
    wsPath: '/ws/schottentotten',
    logPrefix: '[SchottenTotten] WebSocket',
    sessionKey: 'schottentotten_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '6색 1~9 클랜 카드 54장, 국경석 9개, 손패 6장으로 시작합니다.',
          '내 차례에 카드 한 장을 미완성 국경석 앞에 놓고, 더미에서 한 장 보충합니다.',
          '각 국경석은 양쪽이 3장씩 놓아 진형을 완성해 겨룹니다.',
        ],
      },
      {
        heading: '진형 서열 (높은 순)',
        items: [
          '컬러런(같은 색 연속 3장) > 트리플(같은 숫자 3장) > 컬러(같은 색 3장) > 런(연속 3장) > 합계.',
          '같은 진형이면 합계가 큰 쪽, 그것도 같으면 먼저 완성한 쪽이 이깁니다.',
        ],
      },
      {
        heading: '승리',
        items: ['국경석 5개를 가져오거나, 인접한 국경석 3개를 연속으로 가져오면 승리합니다.'],
      },
      {
        heading: '전술 카드 모드 (선택)',
        items: [
          '특수 카드 10장이 담긴 전술 덱이 추가되고, 손패는 7장이 됩니다. 드로우할 때 클랜/전술 덱을 고릅니다.',
          '전술 카드는 상대보다 1장 초과해서 쓸 수 없습니다.',
          '정예병 — 조커(색·숫자 자유, 진영당 1장), 스파이(7 고정·색 자유), 방패병(1~3·색 자유). 값은 항상 가장 유리하게 판정됩니다.',
          '전투 모드 — 눈가리개(그 돌은 합계로만 비교), 진흙탕(그 돌은 양쪽 4장 필요).',
          '계략 — 모병관(3장 뽑고 2장 덱 밑으로), 전략가(내 카드 이동·버림), 밴시(상대 카드 버림), 배신자(상대 클랜 카드 강탈). 쓴 카드는 공개 버린 더미로 갑니다.',
          '낼 수 있는 클랜 카드가 없으면 패스할 수 있습니다.',
        ],
      },
    ],
  },
  jekyllhyde: {
    mood: 'cream',
    title: '지킬 앤 하이드',
    tag: '트릭테이킹 · 심리전',
    description: '인격을 건 카드 트릭 대결',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['트릭테이킹', '전략'],
    duration: '15-20분',
    wsPath: '/ws/jekyllhyde',
    logPrefix: '[JekyllHyde] WebSocket',
    sessionKey: 'jekyllhyde_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '악 3색(오만·분노·탐욕) 1~7 카드 21장 + 물약 4장(2⁺~5⁺), 총 25장으로 3라운드를 겨룹니다.',
          '라운드마다 10장을 받고, 라운드 수만큼(1/2/3장) 서로 카드를 교환한 뒤 트릭을 반복합니다.',
        ],
      },
      {
        heading: '트릭 판정',
        items: [
          '같은 색이면 높은 숫자가 이깁니다.',
          '다른 색이면 더 나중에 처음 등장한 색이 강합니다 (색 서열은 라운드 중 등장 순서로 정해집니다).',
          '물약은 같은 숫자보다 반 끗 위입니다 (2⁺는 2를 이기고 3에 집니다).',
        ],
      },
      {
        heading: '물약 효과 (트릭에 물약이 1장일 때, 함께 나온 색 발동)',
        items: [
          '오만: 트릭 승자가 패자의 트릭 하나를 빼앗습니다.',
          '분노: 색 서열이 초기화됩니다.',
          '탐욕: 서로 손에서 2장씩 골라 맞교환합니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '라운드가 끝나면 트릭 수 차이만큼 마커가 하이드 쪽으로 갑니다.',
          '마커가 하이드 홈에 도달하면 하이드 승리, 3라운드를 버티면 지킬 승리입니다.',
        ],
      },
    ],
  },
  geister: {
    mood: 'cream',
    title: '가이스터',
    tag: '심리전 · 기물',
    description: '유령 정체를 숨긴 탈출 대결',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['전략', '블러핑'],
    duration: '10-15분',
    wsPath: '/ws/geister',
    logPrefix: '[Geister] WebSocket',
    sessionKey: 'geister_session_id',
    rules: [
      {
        heading: '준비',
        items: [
          '6×6 보드에서 각자 유령 8개(좋은 유령 4 + 나쁜 유령 4)로 시작합니다.',
          '자기 쪽 뒷 2줄 가운데 8칸에 좋은 유령의 위치를 비밀리에 정합니다. 상대는 내 유령의 정체를 모릅니다.',
        ],
      },
      {
        heading: '진행',
        items: [
          '내 차례에 유령 하나를 상하좌우 한 칸 움직입니다.',
          '상대 유령 칸으로 이동하면 잡습니다. 잡힌 유령의 색은 양쪽 모두에게 공개됩니다.',
          '내 좋은 유령이 상대편 모서리(탈출구)에 있으면, 다음 내 차례에 보드 밖으로 탈출시킬 수 있습니다. 상대는 그 사이 잡을 기회가 있습니다.',
        ],
      },
      {
        heading: '승리 (셋 중 하나)',
        items: [
          '내 좋은 유령 1개가 탈출한다.',
          '상대의 좋은 유령 4개를 모두 잡는다.',
          '내 나쁜 유령 4개를 상대가 모두 잡는다 — 일부러 잡히게 유도하는 것도 전략입니다.',
        ],
      },
    ],
  },
  quoridor: {
    mood: 'cream',
    title: '쿼리도',
    tag: '전략 · 길막기',
    description: '벽으로 길을 막는 경주 대결',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['전략'],
    duration: '10-20분',
    wsPath: '/ws/quoridor',
    logPrefix: '[Quoridor] WebSocket',
    sessionKey: 'quoridor_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '9×9 보드에서 각자 폰 1개와 벽 10개로 시작합니다.',
          '내 차례에 폰을 상하좌우 한 칸 움직이거나, 벽 하나를 놓습니다.',
          '폰이 서로 마주 보면 뛰어넘습니다. 뒤가 벽이나 보드 끝이면 대각선으로 돌아갑니다.',
        ],
      },
      {
        heading: '벽',
        items: [
          '벽은 칸 사이 홈에 두 칸 길이로 놓이며, 다른 벽과 겹치거나 교차할 수 없습니다.',
          '어느 쪽이든 목표 줄까지 가는 길을 완전히 막는 벽은 놓을 수 없습니다.',
        ],
      },
      {
        heading: '승리',
        items: ['상대편 맨 끝 줄의 아무 칸에 먼저 도착하면 승리합니다.'],
      },
    ],
  },
  onitama: {
    mood: 'cream',
    title: '오니타마',
    tag: '전략 · 무술 카드',
    description: '이동 카드가 순환하는 기물 대결',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['전략'],
    duration: '5-15분',
    wsPath: '/ws/onitama',
    logPrefix: '[Onitama] WebSocket',
    sessionKey: 'onitama_session_id',
    rules: [
      {
        heading: '준비',
        items: [
          '5×5 보드에서 각자 마스터 1개(★)와 제자 4개로 시작합니다.',
          '이동 카드 16종 중 5장만 사용합니다 — 각자 2장, 나머지 1장은 대기 카드.',
        ],
      },
      {
        heading: '진행',
        items: [
          '내 차례에 손의 카드 한 장을 골라, 그 카드에 그려진 방향으로 내 기물 하나를 움직입니다.',
          '상대 기물 칸으로 이동하면 잡습니다. 내 기물 위로는 못 갑니다.',
          '쓴 카드는 대기 카드와 교환됩니다 — 내가 쓴 카드는 곧 상대 손에 들어갑니다.',
          '둘 수 있는 수가 하나도 없으면 카드 한 장만 교환하고 차례를 넘깁니다.',
        ],
      },
      {
        heading: '승리 (둘 중 하나)',
        items: [
          '상대 마스터를 잡는다 (돌의 길).',
          '내 마스터가 상대 사원(뒷줄 중앙 칸)에 도달한다 (개울의 길).',
        ],
      },
    ],
  },
  lostcities: {
    mood: 'cream',
    title: '로스트 시티',
    tag: '카드 · 탐험',
    description: '탐험대에 카드를 쌓는 수집 대결',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['전략'],
    duration: '15-20분',
    wsPath: '/ws/lostcities',
    logPrefix: '[LostCities] WebSocket',
    sessionKey: 'lostcities_session_id',
    rules: [
      {
        heading: '준비',
        items: [
          '탐험지 5색 × 12장(투자 3 + 숫자 2~10) = 60장. 각자 8장으로 시작합니다.',
        ],
      },
      {
        heading: '내 차례 (놓거나 버리고 → 뽑기)',
        items: [
          '손의 카드 한 장을 같은 색 내 탐험대에 놓거나, 그 색 버림 더미에 버립니다.',
          '탐험대에는 오름차순으로만 놓을 수 있습니다. 투자(×) 카드는 숫자를 놓기 전에만 가능합니다.',
          '그다음 덱이나 아무 버림 더미 맨 위에서 한 장 뽑습니다. 방금 버린 카드는 바로 가져올 수 없습니다.',
        ],
      },
      {
        heading: '점수',
        items: [
          '시작한 탐험대마다 (숫자 합 − 20) × (1 + 투자 카드 수) 점. 시작 자체가 빚입니다!',
          '카드 8장 이상인 탐험대는 +20점 보너스.',
        ],
      },
      {
        heading: '종료',
        items: ['덱의 마지막 카드를 뽑는 순간 게임이 끝나고, 총점이 높은 쪽이 승리합니다.'],
      },
    ],
  },
  cantstop: {
    mood: 'cream',
    title: '캔트 스톱',
    tag: '주사위 · 운시험',
    description: '멈출 타이밍을 겨루는 등반 대결',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['주사위'],
    duration: '15-20분',
    wsPath: '/ws/cantstop',
    logPrefix: '[CantStop] WebSocket',
    sessionKey: 'cantstop_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '2~12 합계 컬럼 11개를 오릅니다. 가운데(7)가 가장 길고 양끝(2·12)이 가장 짧습니다.',
          '내 차례에 주사위 4개를 굴려 두 개씩 두 쌍으로 나누고, 그 합의 컬럼을 한 칸씩 오릅니다.',
          '한 턴에 임시 마커는 3개까지 — 이미 3개를 쓴 뒤에는 그 컬럼들만 오를 수 있습니다.',
        ],
      },
      {
        heading: '멈출 것인가, 굴릴 것인가',
        items: [
          '굴릴 때마다 선택: 더 굴려 더 오르거나, 멈춰서 지금까지의 전진을 확정합니다.',
          '굴렸는데 쓸 수 있는 조합이 없으면 버스트 — 이번 턴의 전진을 전부 잃습니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '멈출 때 꼭대기에 닿은 컬럼은 완등 — 양쪽 모두에게 닫힙니다.',
          '컬럼 3개를 먼저 완등하면 승리합니다.',
        ],
      },
    ],
  },
  tichu: {
    mood: 'cream',
    title: '티츄',
    tag: '팀전 · 클라이밍',
    description: '2:2 팀으로 겨루는 카드 클라이밍',
    players: '4인',
    minPlayers: 4,
    maxPlayers: 4,
    categories: ['트릭테이킹'],
    duration: '30-60분',
    wsPath: '/ws/tichu',
    logPrefix: '[Tichu] WebSocket',
    sessionKey: 'tc_session_id',
    rules: [
      {
        heading: '준비',
        items: [
          '4가지 무늬 2~A 52장 + 특수 카드 4장(참새·개·봉황·용)을 씁니다.',
          '마주 앉은 두 명이 한 팀입니다 (좌석 0·2 vs 1·3).',
          '8장을 받고 그랜드 티츄(성공 +200/실패 -200)를 선언할 수 있습니다. 이후 6장을 더 받고, 다른 세 명에게 카드를 1장씩 넘겨 교환합니다.',
          '첫 카드를 내기 전까지 티츄(성공 +100/실패 -100)를 선언할 수 있습니다. 성공 조건은 내가 그 핸드에서 1등으로 털기입니다.',
        ],
      },
      {
        heading: '진행 (클라이밍)',
        items: [
          '참새(1) 소지자가 선공. 싱글·페어·트리플·풀하우스·스트레이트(5장+)·연속 페어를 냅니다.',
          '다음 사람은 같은 형태의 더 높은 조합을 내거나 패스합니다. 전원이 패스하면 마지막에 낸 사람이 트릭을 가져가고 새로 리드합니다.',
          '폭탄(같은 숫자 4장, 같은 무늬 스트레이트)은 차례와 무관하게 낼 수 있고 무엇이든 이깁니다.',
        ],
      },
      {
        heading: '특수 카드',
        items: [
          '참새(1): 내면서 숫자 하나를 소원으로 부를 수 있습니다 — 그 숫자로 이길 수 있는 사람은 반드시 내야 합니다.',
          '개: 리드를 파트너에게 넘깁니다.',
          '봉황: 싱글로는 직전 카드보다 반 끗 위, 조합에서는 와일드카드 (-25점).',
          '용: 가장 강한 싱글 (+25점). 용으로 먹은 트릭은 상대팀에게 줘야 합니다.',
        ],
      },
      {
        heading: '점수',
        items: [
          '3명이 손을 털면 핸드 종료. 5=5점, 10·K=10점, 용 +25, 봉황 -25.',
          '같은 팀이 1·2등이면 원투 피니시 — 카드 점수 대신 +200점.',
          '목표 점수(500 또는 1000)에 먼저 도달한 팀이 승리합니다.',
        ],
      },
    ],
  },
  mighty: {
    mood: 'dark',
    title: '마이티',
    tag: '트릭테이킹 · 공약',
    description: '공약과 프렌드의 5인 트릭테이킹',
    players: '5인',
    minPlayers: 5,
    maxPlayers: 5,
    categories: ['트릭테이킹'],
    duration: '10-20분',
    wsPath: '/ws/mighty',
    logPrefix: '[Mighty] WebSocket',
    sessionKey: 'mt_session_id',
    rules: [
      {
        heading: '준비와 공약',
        items: [
          '조커 포함 53장. 10장씩 받고 3장은 키티로 남습니다.',
          '점수 카드는 10·J·Q·K·A, 총 20장입니다.',
          '돌아가며 공약(기루다 무늬 + 딸 점수 카드 수, 최소 13·노기루는 12)을 올립니다. 최후의 1인이 주공이 됩니다.',
          '주공은 키티 3장을 가져와 3장을 버리고(버린 점수 카드는 주공팀 것), 기루다를 확정합니다 (변경 시 공약 +1).',
        ],
      },
      {
        heading: '프렌드',
        items: [
          '주공은 카드 하나를 지목해 프렌드를 정합니다 (보통 마이티). 그 카드를 가진 사람이 몰래 주공 편이 됩니다.',
          '첫 트릭 승자를 프렌드로 하거나, 노프렌드도 가능합니다.',
          '프렌드는 지목된 카드가 실제로 나올 때 공개됩니다.',
        ],
      },
      {
        heading: '트릭',
        items: [
          '주공부터 10트릭. 리드 무늬를 따라내야 하며, 없으면 아무 카드나 냅니다.',
          '강한 순서: 마이티(♠A, 기루다가 ♠면 ♦A) > 조커 > 기루다 > 리드 무늬. 높은 숫자가 이깁니다.',
          '조커로 리드하면 무늬를 지정합니다. 단, 첫 트릭과 마지막 트릭에서 조커는 가장 약합니다.',
          '조커콜(♣3, 기루다가 ♣면 ♠3)을 리드하며 선언하면 조커 소지자는 조커를 내야 하고, 그 조커는 힘을 잃습니다.',
        ],
      },
      {
        heading: '승부',
        items: [
          '주공팀(주공+프렌드)이 딴 점수 카드가 공약 이상이면 성공, 미달이면 수비팀 승리입니다.',
        ],
      },
    ],
  },
  skyfall: {
    mood: 'dark',
    title: '마피아',
    tag: '마피아 · 심리전',
    description: '역할을 숨긴 마피아 심리전',
    players: '6~10인',
    minPlayers: 6,
    maxPlayers: 10,
    categories: ['정체 은닉', '추리'],
    duration: '15-30분',
    wsPath: '/ws/skyfall',
    logPrefix: '[Skyfall] WebSocket',
    sessionKey: 'sf_session_id',
    rules: [
      {
        heading: '준비',
        items: [
          '6~10명이 참가하며 역할이 비밀리에 배정됩니다 — 마피아 2~3, 경찰 1, 의사 1, 나머지는 시민.',
          '마피아는 서로가 누구인지 압니다. 다른 사람은 자기 역할만 압니다.',
          '토론은 같은 공간(또는 음성)에서 하고, 앱은 역할·밤 행동·투표를 진행합니다.',
        ],
      },
      {
        heading: '밤',
        items: [
          '마피아: 제거할 사람을 지목합니다 (여럿이면 다수결).',
          '경찰: 한 명을 조사해 마피아인지 확인합니다 (결과는 나만 봅니다).',
          '의사: 한 명을 치료합니다 — 마피아의 표적과 일치하면 살립니다.',
        ],
      },
      {
        heading: '낮',
        items: [
          '밤의 결과가 발표됩니다. 토론 후 처형할 사람에게 공개 투표하세요 (기권 가능).',
          '최다 득표자가 처형되고 역할이 공개됩니다. 동표면 아무도 처형되지 않습니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '시민팀: 마피아를 전부 처형하면 승리합니다.',
          '마피아팀: 마피아 수가 남은 시민팀 수 이상이 되면 승리합니다.',
        ],
      },
    ],
  },
  spyfall: {
    mood: 'dark',
    title: '스파이폴',
    tag: '스파이 · 추리',
    description: '스파이만 정답을 모르는 질문 게임',
    players: '3~8인',
    minPlayers: 3,
    maxPlayers: 8,
    categories: ['정체 은닉', '추리', '단어'],
    duration: '5-10분',
    wsPath: '/ws/spyfall',
    logPrefix: '[Spyfall] WebSocket',
    sessionKey: 'sp_session_id',
    rules: [
      {
        heading: '준비',
        items: [
          '3~8명이 참가합니다. 호스트가 카테고리(장소·직업·과일·음식·동물·스포츠·영화·나라·브랜드 또는 랜덤)를 고릅니다.',
          '카테고리의 24개 단어 중 하나가 정답으로 정해지고, 스파이 1명을 제외한 전원이 정답을 알게 됩니다.',
          '스파이는 자신이 스파이라는 것만 알고, 정답은 모릅니다.',
          '질문과 대화는 같은 공간(또는 음성)에서 나눕니다 — 앱은 카드·타이머·투표를 진행합니다.',
        ],
      },
      {
        heading: '진행',
        items: [
          '타이머(3/5/8분) 동안 서로 정답에 대해 질문을 주고받으세요. 너무 노골적이면 스파이에게 정답을 들키고, 너무 모호하면 당신이 의심받습니다.',
          '스파이는 타이머 중 언제든 정답을 추리할 수 있습니다 — 맞히면 즉시 스파이 승리, 틀리면 즉시 패배입니다.',
        ],
      },
      {
        heading: '투표와 승리',
        items: [
          '타이머가 끝나면 전원이 스파이로 의심되는 사람에게 공개 투표합니다 (제한 시간 1분, 마감 전 변경 가능).',
          '단독 최다 득표자가 스파이면 시민팀 승리, 그 외(오지목·동표)는 스파이 승리입니다.',
        ],
      },
    ],
  },
  loveletter: {
    mood: 'cream',
    title: '러브레터',
    tag: '카드 추리 · 소품',
    description: '16장의 카드로 공주의 마음을 얻는 추리전',
    players: '2~4인',
    minPlayers: 2,
    maxPlayers: 4,
    categories: ['추리'],
    duration: '10-20분',
    wsPath: '/ws/loveletter',
    logPrefix: '[LoveLetter] WebSocket',
    sessionKey: 'lv_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '매 턴 1장을 뽑아 손의 2장 중 1장을 내고 효과를 적용합니다.',
          '카드: 1경비병(값 추측, 맞으면 탈락) · 2사제(손패 엿보기) · 3남작(비교, 낮은 쪽 탈락) · 4시녀(보호) · 5왕자(버리고 새로 뽑기) · 6왕(교환) · 7백작부인(왕·왕자와 함께면 강제) · 8공주(버리면 탈락).',
          '덱이 떨어지면 남은 손패가 높은 사람이, 혼자 남으면 그 사람이 라운드 승리입니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '라운드 승리마다 토큰 1개 — 2인 7개, 3인 5개, 4인 4개를 먼저 모으면 승리합니다.',
          '버린 카드는 전원에게 공개됩니다 — 카드 카운팅이 핵심입니다.',
        ],
      },
    ],
  },
  omok: {
    mood: 'cream',
    title: '오목',
    tag: '클래식 · 2인',
    description: '다섯 개의 돌을 먼저 이으면 승리',
    players: '2인',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['전략'],
    duration: '5-15분',
    wsPath: '/ws/omok',
    logPrefix: '[Omok] WebSocket',
    sessionKey: 'omok_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '15×15 바둑판에 흑과 백이 번갈아 돌을 놓습니다 (먼저 입장한 사람이 흑, 흑 선공).',
          '가로·세로·대각선으로 5개 이상 이으면 즉시 승리합니다 (금수 없음).',
          '판이 가득 차면 무승부입니다.',
        ],
      },
    ],
  },
  skull: {
    mood: 'dark',
    title: '스컬',
    tag: '배팅 · 심리전',
    description: '장미와 해골, 허세의 배팅 심리전',
    players: '3~6인',
    minPlayers: 3,
    maxPlayers: 6,
    categories: ['블러핑'],
    duration: '10-20분',
    wsPath: '/ws/skull',
    logPrefix: '[Skull] WebSocket',
    sessionKey: 'sk_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '각자 장미 3장·해골 1장의 원판을 가집니다. 전원이 1장을 비공개로 내려놓고 시작합니다.',
          '차례에 카드를 더 내려놓거나, "장미 N장을 뒤집겠다"고 배팅합니다. 배팅이 시작되면 레이즈 또는 패스만 가능합니다.',
          '최고 배팅자는 자기 더미를 전부 뒤집은 뒤 상대 더미를 골라 뒤집습니다. 해골이 나오면 실패 — 내 카드 1장을 잃습니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '장미만 N장 뒤집으면 1점 — 2점을 먼저 얻으면 승리합니다.',
          '카드를 전부 잃으면 탈락하고, 혼자 남아도 승리합니다.',
        ],
      },
    ],
  },
  codenames: {
    mood: 'dark',
    title: '코드네임',
    tag: '팀전 · 단어 추리',
    description: '한 단어 힌트로 아군 단어를 찾는 팀 대결',
    players: '4~8인',
    minPlayers: 4,
    maxPlayers: 8,
    categories: ['단어', '추리'],
    duration: '15-25분',
    wsPath: '/ws/codenames',
    logPrefix: '[Codenames] WebSocket',
    sessionKey: 'cn_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '25개 단어 중 적팀 9 · 청팀 8 · 중립 7 · 암살자 1 — 배치는 각 팀 스파이마스터만 봅니다.',
          '스파이마스터가 "단어 하나 + 숫자" 힌트를 내면(음성 추천, 앱에 기록) 요원들이 아군 단어를 추측합니다. 숫자+1번까지 계속할 수 있습니다.',
          '중립이나 상대 단어를 고르면 턴이 넘어가고, 암살자를 고르면 그 팀이 즉시 패배합니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '자기 팀 단어를 모두 먼저 찾으면 승리합니다.',
          '팀 배정은 입장 순서로 번갈아, 스파이마스터는 팀의 첫 사람이 맡습니다.',
        ],
      },
    ],
  },
  yacht: {
    mood: 'cream',
    title: '요트 다이스',
    tag: '주사위 · 족보',
    description: '주사위 다섯 개로 족보를 채우는 점수 대결',
    players: '2~4인',
    minPlayers: 2,
    maxPlayers: 4,
    categories: ['주사위'],
    duration: '10-20분',
    wsPath: '/ws/yacht',
    logPrefix: '[Yacht] WebSocket',
    sessionKey: 'yt_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '턴마다 주사위 5개를 최대 3번 굴립니다 — 원하는 주사위는 홀드하고 나머지만 다시 굴립니다.',
          '13칸 족보(1~6 눈합, 트리플, 포카드, 풀하우스 25, 스몰 30, 라지 40, 요트 50, 찬스) 중 빈 칸 하나에 기록합니다. 0점 기록도 가능합니다.',
          '상단(1~6) 합계가 63점 이상이면 보너스 +35점.',
        ],
      },
      {
        heading: '승리',
        items: ['13라운드가 끝나면 총점이 가장 높은 사람이 승리합니다 (동점은 공동 우승).'],
      },
    ],
  },
  indianpoker: {
    mood: 'dark',
    title: '인디언 포커',
    tag: '배팅 · 역은닉',
    description: '내 카드만 못 보는 배팅 심리전',
    players: '2~6인',
    minPlayers: 2,
    maxPlayers: 6,
    categories: ['블러핑'],
    duration: '10-15분',
    wsPath: '/ws/indianpoker',
    logPrefix: '[IndianPoker] WebSocket',
    sessionKey: 'ip_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '각자 카드 1장을 받는데, 남의 카드는 보이고 내 카드만 안 보입니다.',
          '매 라운드 전원 1칩 안테 후, 차례로 콜 / 레이즈(+1~3, 라운드당 3회) / 폴드를 선택합니다.',
          '전원 콜이면 쇼다운 — 가장 높은 숫자가 팟을 가져갑니다 (동점은 나눠 가짐). 혼자 남으면 카드 공개 없이 팟을 가져갑니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '카드는 1~10 각 4장, 시작 칩은 20개입니다. 칩이 떨어지면 탈락합니다.',
          '10라운드 후 칩이 가장 많은 사람이 승리합니다 (동점 공동 우승).',
        ],
      },
    ],
  },
  nothanks: {
    mood: 'cream',
    title: '노 땡스!',
    tag: '푸시 유어 럭 · 소품',
    description: '카드를 받을까, 칩을 낼까 — 눈치 소품',
    players: '3~7인',
    minPlayers: 3,
    maxPlayers: 7,
    categories: ['전략'],
    duration: '10-15분',
    wsPath: '/ws/nothanks',
    logPrefix: '[NoThanks] WebSocket',
    sessionKey: 'nt_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '3~35 카드 중 9장을 비밀리에 뺀 24장으로 진행하고, 각자 칩 11개로 시작합니다.',
          '공개된 카드를 가져가거나, 칩 1개를 카드에 얹고 패스합니다. 칩이 없으면 무조건 가져가야 합니다.',
          '카드를 가져가면 얹힌 칩도 전부 가져옵니다.',
        ],
      },
      {
        heading: '점수',
        items: [
          '덱이 떨어지면 종료 — 카드 숫자 합에서 칩 수를 뺀 점수가 가장 낮은 사람이 승리합니다.',
          '연속된 카드 묶음은 가장 작은 숫자만 점수로 칩니다 (22·23·24 = 22점).',
        ],
      },
    ],
  },
  lasvegas: {
    mood: 'dark',
    title: '라스베가스',
    tag: '주사위 · 배팅',
    description: '여섯 카지노에 주사위를 걸어 지폐를 쓸어담기',
    players: '2~5인',
    minPlayers: 2,
    maxPlayers: 5,
    categories: ['주사위'],
    duration: '15-25분',
    wsPath: '/ws/lasvegas',
    logPrefix: '[LasVegas] WebSocket',
    sessionKey: 'vg_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '카지노 1~6에 지폐가 깔립니다. 각자 주사위 8개로 시작합니다.',
          '차례에 주사위를 전부 굴려, 한 눈을 골라 그 눈의 주사위 전부를 해당 카지노에 배치합니다.',
          '전원이 주사위를 소진하면 정산 — 카지노마다 가장 많이 배치한 사람이 큰 지폐를 가져갑니다.',
        ],
      },
      {
        heading: '핵심',
        items: [
          '배치 수가 같은 사람끼리는 서로 상쇄되어 아무것도 못 받습니다!',
          '4라운드 후 총액이 가장 많은 사람이 승리합니다.',
        ],
      },
    ],
  },
  coup: {
    mood: 'dark',
    title: '쿠',
    tag: '블러핑 · 정체 은닉',
    description: '거짓 주장과 도전이 오가는 궁정 음모전',
    players: '2~6인',
    minPlayers: 2,
    maxPlayers: 6,
    categories: ['정체 은닉', '블러핑'],
    duration: '10-20분',
    wsPath: '/ws/coup',
    logPrefix: '[Coup] WebSocket',
    sessionKey: 'cp_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '각자 비공개 역할 카드 2장과 칩 2개로 시작합니다. 카드 2장을 모두 잃으면 탈락합니다.',
          '차례에 액션을 선택합니다 — 수입(+1), 해외원조(+2), 세금(공작, +3), 암살(3칩), 강탈(사령관), 교환(대사), 쿠(7칩, 차단 불가).',
          '역할이 필요한 액션은 카드가 없어도 "주장"할 수 있습니다 — 거짓말이 핵심입니다!',
        ],
      },
      {
        heading: '도전과 차단',
        items: [
          '누구든 역할 주장에 도전할 수 있습니다. 진짜였으면 도전자가, 거짓이면 주장자가 카드를 잃습니다.',
          '해외원조는 공작, 암살은 백작부인, 강탈은 사령관/대사 주장으로 차단할 수 있습니다 (차단도 도전 가능).',
          '칩이 10개 이상이면 반드시 쿠를 해야 합니다. 마지막까지 살아남으면 승리!',
        ],
      },
    ],
  },
  nimmt: {
    mood: 'cream',
    title: '6 님트',
    tag: '동시 선택 · 카드',
    description: '여섯 번째 카드를 피하는 소머리 눈치싸움',
    players: '2~10인',
    minPlayers: 2,
    maxPlayers: 10,
    categories: ['전략'],
    duration: '10-15분',
    wsPath: '/ws/nimmt',
    logPrefix: '[Nimmt] WebSocket',
    sessionKey: 'nm_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '1~104 카드를 10장씩 받고, 4개 행에 시작 카드가 놓입니다.',
          '매 트릭 전원이 동시에 1장을 골라 일괄 공개 — 낮은 카드부터 자기보다 작은 행 끝 중 가장 큰 행에 붙습니다.',
          '행의 6번째 카드가 되면 그 행 5장을 벌점으로 가져갑니다. 모든 행보다 작으면 행 하나를 골라 가져갑니다.',
        ],
      },
      {
        heading: '점수',
        items: [
          '카드마다 소머리 벌점이 있습니다 (5의 배수 2, 10의 배수 3, 11의 배수 5, 55는 7).',
          '10트릭 후 소머리가 가장 적은 사람이 승리합니다.',
        ],
      },
    ],
  },
  ciaociao: {
    mood: 'cream',
    title: '차오차오',
    tag: '주사위 블러핑 · 소품',
    description: '거짓 선언으로 다리를 건너는 담력 승부',
    players: '2~4인',
    minPlayers: 2,
    maxPlayers: 4,
    categories: ['주사위', '블러핑'],
    duration: '10-15분',
    wsPath: '/ws/ciaociao',
    logPrefix: '[CiaoCiao] WebSocket',
    sessionKey: 'cc_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '각자 말 3개로 시작합니다. 다리 7칸을 건너 말 2개를 먼저 통과시키면 승리합니다.',
          '차례에 주사위(1·2·3·4·X·X)를 컵 속에서 굴려 나만 확인하고, 1~4 중 하나를 선언합니다.',
          'X가 나왔으면 반드시 거짓으로 선언해야 합니다. 숫자가 나왔어도 다르게 선언할 수 있습니다.',
        ],
      },
      {
        heading: '의심',
        items: [
          '선언 후 10초 동안 누구든 의심할 수 있습니다. 아무도 의심하지 않으면 선언한 만큼 전진합니다.',
          '의심이 맞으면 선언자의 말이, 틀리면 의심자의 말이 다리에서 떨어집니다 (부활 없음).',
          '말을 전부 잃으면 탈락 — 담력과 거짓말이 승부를 가릅니다!',
        ],
      },
    ],
  },
  cockroach: {
    mood: 'cream',
    title: '바퀴벌레 포커',
    tag: '블러핑 · 카드 전달',
    description: '"이건 쥐다" — 진실 혹은 거짓 카드 떠넘기기',
    players: '3~6인',
    minPlayers: 3,
    maxPlayers: 6,
    categories: ['블러핑'],
    duration: '10-20분',
    wsPath: '/ws/cockroach',
    logPrefix: '[Cockroach] WebSocket',
    sessionKey: 'cr_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '동물 8종 카드를 전부 나눠 갖습니다. 차례에 카드 1장을 뒤집어 대상에게 건네며 동물을 선언합니다 — 거짓말 가능!',
          '받은 사람은 "참이다/거짓이다"로 판정하거나, 몰래 확인한 뒤 새 선언으로 다른 사람에게 넘길 수 있습니다.',
          '판정이 틀리면 그 카드를 자기 앞에 공개로 쌓고, 맞히면 건넨 사람 앞에 쌓입니다.',
        ],
      },
      {
        heading: '패배',
        items: [
          '같은 동물 4장이 자기 앞에 모이면 즉시 패배 — 나머지 전원 승리!',
          '자기 차례에 낼 손패가 없어도 패배합니다.',
        ],
      },
    ],
  },
  insider: {
    mood: 'dark',
    title: '인사이더',
    tag: '정체 은닉 · 스무고개',
    description: '정답을 유도한 내부자를 찾아내는 협력 추리',
    players: '4~8인',
    minPlayers: 4,
    maxPlayers: 8,
    categories: ['정체 은닉', '단어'],
    duration: '10-15분',
    wsPath: '/ws/insider',
    logPrefix: '[Insider] WebSocket',
    sessionKey: 'id_session_id',
    rules: [
      {
        heading: '역할',
        items: [
          '마스터 1명(전원에게 공개), 인사이더 1명(비공개), 나머지는 시민입니다.',
          '제시어는 마스터와 인사이더만 봅니다 — 인사이더는 아는 척하지 않으면서 정답을 유도해야 합니다.',
          '질문과 대답은 같은 공간(또는 음성)에서 — 앱은 역할·제시어·타이머·투표를 진행합니다.',
        ],
      },
      {
        heading: '진행',
        items: [
          '질문 타임 5분 — 스무고개로 제시어를 맞힙니다. 마스터는 예/아니오로만 답하고, 정답이 나오면 [정답 나옴]을 누릅니다.',
          '토론 타임 2분 — "정답을 맞힌 사람이 인사이더인가?"를 토론합니다.',
          '투표 — 전원이 인사이더로 의심되는 1명을 지목합니다. 최다 득표자가 인사이더면 시민 승리, 아니면 인사이더 승리!',
          '5분 안에 정답을 못 맞히면 인사이더 포함 전원 패배입니다.',
        ],
      },
    ],
  },
  dalmuti: {
    mood: 'cream',
    title: '위대한 달무티',
    tag: '클라이밍 · 계급',
    description: '손패를 먼저 털어 계급의 정점에 오르기',
    players: '4~8인',
    minPlayers: 4,
    maxPlayers: 8,
    categories: ['트릭테이킹'],
    duration: '15-25분',
    wsPath: '/ws/dalmuti',
    logPrefix: '[Dalmuti] WebSocket',
    sessionKey: 'dm_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '1~12 숫자 카드(숫자만큼의 장수)와 조커 2장을 전원이 나눠 갖습니다. 숫자가 낮을수록 강합니다.',
          '리드는 같은 숫자 여러 장을 세트로 냅니다. 이후 사람은 같은 장수의 더 낮은 숫자만 낼 수 있고, 패스도 가능합니다.',
          '전원이 연속으로 패스하면 마지막 제출자가 새 리드를 잡습니다.',
        ],
      },
      {
        heading: '조커와 점수',
        items: [
          '조커는 와일드 — 세트에 섞으면 그 숫자로 취급합니다 (7·7·조커 = 7 석 장).',
          '손패를 먼저 턴 순서대로 순위가 정해지고, 1등부터 높은 점수를 받습니다.',
          '3핸드를 마친 뒤 총점이 가장 높은 사람이 승리합니다.',
        ],
      },
    ],
  },
  kraken: {
    mood: 'dark',
    title: '노 터치 크라켄',
    tag: '정체 은닉 · 카드 뒤집기',
    description: '보물을 다 찾을까, 크라켄을 깨울까',
    players: '4~8인',
    minPlayers: 4,
    maxPlayers: 8,
    categories: ['정체 은닉', '블러핑'],
    duration: '10-20분',
    wsPath: '/ws/kraken',
    logPrefix: '[Kraken] WebSocket',
    sessionKey: 'kr_session_id',
    rules: [
      {
        heading: '진영',
        items: [
          '탐험대와 해골로 나뉩니다. 해골끼리도 서로를 모릅니다.',
          '역할은 인원수보다 많은 풀에서 뽑아 나눠주므로, 실제 진영 인원 구성은 아무도 확신할 수 없습니다.',
          '토론은 같은 공간(또는 음성)에서 — 앱은 역할·손패·지목·선언을 진행합니다.',
        ],
      },
      {
        heading: '진행 (4라운드)',
        items: [
          '인원 N명이면 보물 N장, 크라켄 1장, 나머지는 꽝인 5N장 덱을 씁니다.',
          '라운드마다 남은 카드를 다시 섞어 5장 → 4장 → 3장 → 2장씩 나눠 갖고, 내 카드만 내용을 봅니다.',
          '지목권자는 다른 사람의 뒷면 카드 1장을 골라 공개시킵니다. 지목권은 그 카드 주인에게 넘어갑니다.',
          '라운드마다 정확히 인원수만큼 공개하면 카드를 회수해 다음 라운드로 넘어갑니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '보물을 전부 찾아내면 탐험대 승리!',
          '크라켄이 열리거나 4라운드가 끝날 때까지 보물을 다 못 찾으면 해골 승리입니다.',
          '손패 구성을 선언해 정보를 줄 수 있습니다 — 물론 거짓말도 가능합니다.',
        ],
      },
    ],
  },
  skullking: {
    mood: 'dark',
    title: '스컬킹',
    tag: '비드 · 트릭테이킹',
    description: '몇 판 이길지 선언하고 정확히 맞히는 해적 승부',
    players: '2~8인',
    minPlayers: 2,
    maxPlayers: 8,
    categories: ['트릭테이킹'],
    duration: '20-30분',
    wsPath: '/ws/skullking',
    logPrefix: '[SkullKing] WebSocket',
    sessionKey: 'kg_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '1라운드에 1장, 2라운드에 2장… 라운드 수만큼 카드를 받습니다.',
          '먼저 이번 라운드에 몇 판(트릭) 이길지 비공개로 선언하고, 전원이 제출하면 함께 공개합니다.',
          '리드 무늬가 있으면 따라내야 합니다. 다만 특수 카드는 언제든 낼 수 있습니다.',
        ],
      },
      {
        heading: '카드 서열',
        items: [
          '검정(해적기)은 상시 트럼프라 다른 색 숫자를 모두 이깁니다.',
          '스컬킹 💀 > 해적 🏴‍☠️ > 인어 🧜‍♀️ > 숫자 순이지만, 인어는 스컬킹을 잡습니다 (가위바위보).',
          '탈출 🏳️은 항상 집니다 — 일부러 트릭을 피할 때 씁니다.',
        ],
      },
      {
        heading: '점수',
        items: [
          '선언을 정확히 맞히면 선언 1당 20점, 틀리면 빗나간 만큼 10점씩 깎입니다.',
          '0을 선언해 지켜내면 라운드 × 10점, 실패하면 그만큼 잃습니다.',
          '맞힌 경우에만 보너스 — 인어로 스컬킹을 잡으면 +50, 스컬킹으로 해적을 잡으면 장당 +30.',
        ],
      },
    ],
  },
  crew: {
    mood: 'dark',
    title: '더 크루',
    tag: '협력 · 트릭테이킹',
    description: '말없이 손발 맞춰 임무를 완수하는 우주 원정',
    players: '3~5인',
    minPlayers: 3,
    maxPlayers: 5,
    categories: ['협력', '트릭테이킹'],
    duration: '20-30분',
    wsPath: '/ws/crew',
    logPrefix: '[Crew] WebSocket',
    sessionKey: 'cw_session_id',
    rules: [
      {
        heading: '협력 게임',
        items: [
          '편이 갈리지 않습니다 — 전원이 한 팀으로 함께 이기거나 함께 집니다.',
          '4색 1~9 카드와 트럼프인 로켓 1~4로 트릭을 겨룹니다. 로켓 4를 가진 사람이 사령관이자 첫 리드입니다.',
          '리드한 색이 손에 있으면 반드시 따라내야 합니다. 없으면 아무 카드나 낼 수 있습니다.',
        ],
      },
      {
        heading: '임무',
        items: [
          '임무 카드가 각자에게 배정됩니다 — 담당자가 그 카드가 들어간 트릭을 이겨야 합니다.',
          '엉뚱한 사람이 그 트릭을 이기면 즉시 실패! 카드가 다 떨어졌는데 임무가 남아도 실패입니다.',
          '임무를 다 완수하면 다음 단계로, 5단계까지 마치면 클리어입니다.',
        ],
      },
      {
        heading: '소통 제약',
        items: [
          '이 게임의 핵심 — 상의가 금지됩니다. 임무마다 딱 한 번, 카드 한 장을 공개할 수 있을 뿐입니다.',
          '공개할 때 그 색에서 최고인지, 최저인지, 하나뿐인지를 밝혀야 하며 거짓말은 불가능합니다.',
          '공개는 트릭이 시작되기 전에만 할 수 있습니다.',
        ],
      },
    ],
  },
  justone: {
    mood: 'cream',
    title: '저스트 원',
    tag: '협력 · 단어 추리',
    description: '겹치면 지워진다 — 나만 떠올릴 단서 하나',
    players: '3~7인',
    minPlayers: 3,
    maxPlayers: 7,
    categories: ['협력', '단어', '추리'],
    duration: '15-20분',
    wsPath: '/ws/justone',
    logPrefix: '[JustOne] WebSocket',
    sessionKey: 'jo_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '한 명이 출제자가 되고, 나머지 전원에게만 제시어가 공개됩니다.',
          '출제자를 뺀 각자가 제시어를 떠올리게 할 단어를 하나씩 비공개로 적습니다.',
          '출제자는 살아남은 단서만 보고 정답을 한 번 맞힙니다. 넘길 수도 있습니다.',
        ],
      },
      {
        heading: '겹치면 지워진다',
        items: [
          '같은 단서를 낸 사람이 둘 이상이면 그 단서는 전부 지워집니다 — 이 게임의 핵심입니다.',
          '제시어와 같거나 제시어를 포함하는 단서도 지워집니다.',
          '너무 뻔한 단어는 겹치고, 너무 특이한 단어는 안 통합니다. 그 사이를 노리세요.',
        ],
      },
      {
        heading: '점수',
        items: [
          '전원이 한 팀입니다 — 맞히면 +1점, 틀리면 -1점, 넘기면 0점.',
          '철자가 조금 달라도 통했다면, 출제자 외 누구든 정답으로 인정해 줄 수 있습니다.',
          '모든 라운드가 끝나면 총점으로 등급이 매겨집니다.',
        ],
      },
    ],
  },
  set: {
    mood: 'cream',
    title: '세트',
    tag: '실시간 · 패턴 인식',
    description: '먼저 보는 사람이 가져간다 — 눈싸움 순발력',
    players: '1~8인',
    minPlayers: 1,
    maxPlayers: 8,
    categories: ['실시간', '추리'],
    duration: '10-15분',
    wsPath: '/ws/set',
    logPrefix: '[Set] WebSocket',
    sessionKey: 'se_session_id',
    rules: [
      {
        heading: '세트란',
        items: [
          '카드마다 모양·개수·채움·색 네 가지 속성이 있습니다.',
          '카드 3장을 골랐을 때 네 속성이 각각 전부 같거나 전부 다르면 세트입니다.',
          '예를 들어 빨강 1개·초록 2개·보라 3개인데 모양과 채움이 모두 같다면 세트입니다.',
        ],
      },
      {
        heading: '진행',
        items: [
          '차례가 없습니다 — 바닥에 깔린 카드에서 먼저 찾는 사람이 가져갑니다.',
          '카드 3장을 고르면 바로 제출됩니다. 성공하면 +1점, 카드가 채워집니다.',
          '틀리면 -1점에 5초 동안 손이 묶이니, 확신이 설 때 누르세요.',
        ],
      },
      {
        heading: '종료',
        items: [
          '덱이 비고 바닥에도 세트가 없으면 끝납니다. 점수가 가장 높은 사람이 승리합니다.',
          '혼자서도 시작할 수 있어 연습용으로 좋습니다.',
        ],
      },
    ],
  },
  kittens: {
    mood: 'cream',
    title: '익스플로딩 키튼',
    tag: '카드 · 폭탄 돌리기',
    description: '폭탄을 뽑으면 끝 — 마지막까지 살아남기',
    players: '2~5인',
    minPlayers: 2,
    maxPlayers: 5,
    categories: ['전략'],
    duration: '10-20분',
    wsPath: '/ws/kittens',
    logPrefix: '[Kittens] WebSocket',
    sessionKey: 'ek_session_id',
    rules: [
      {
        heading: '진행',
        items: [
          '차례에 카드를 원하는 만큼 낸 뒤, 덱에서 1장을 뽑으면 차례가 끝납니다.',
          '뽑은 카드가 💣 폭탄 고양이면 🛡 해체 카드를 써야 살아남습니다. 없으면 탈락!',
          '해체를 쓰면 폭탄을 덱 아무 곳에나 몰래 되꽂습니다 — 다음 사람을 노려보세요.',
        ],
      },
      {
        heading: '카드',
        items: [
          '⏭ 건너뛰기(뽑지 않고 차례 종료) · ⚔️ 공격(다음 사람이 두 번) · 🔀 섞기 · 🔮 미리보기(맨 위 3장을 나만 봄)',
          '🙏 호의(상대가 카드 한 장을 줌) · 같은 고양이 카드 2장(상대 카드 무작위로 뺏기)',
          '🚫 안돼는 남이 낸 카드를 무효로 만듭니다. 안돼 위에 안돼를 겹칠 수 있어 짝수면 다시 유효해집니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '폭탄은 인원수보다 하나 적게 들어 있습니다 — 마지막 한 명이 남으면 그 사람이 승리합니다.',
        ],
      },
    ],
  },
  mind: {
    mood: 'dark',
    title: '더 마인드',
    tag: '협력 · 실시간 감각',
    description: '말 한마디 없이 오름차순을 맞추는 텔레파시',
    players: '2~4인',
    minPlayers: 2,
    maxPlayers: 4,
    categories: ['협력', '실시간'],
    duration: '15-20분',
    wsPath: '/ws/mind',
    logPrefix: '[Mind] WebSocket',
    sessionKey: 'mi_session_id',
    rules: [
      {
        heading: '규칙은 하나뿐',
        items: [
          '1~100 카드를 나눠 갖고, 전원이 힘을 합쳐 낮은 수부터 순서대로 냅니다.',
          '차례가 없습니다 — 누구든 아무 때나 낼 수 있습니다.',
          '누군가 낸 카드보다 작은 카드를 다른 사람이 들고 있었다면 실수 — 그 카드들이 터지고 생명이 하나 줄어듭니다.',
        ],
      },
      {
        heading: '말하지 않기',
        items: [
          '대화·손짓·숫자 암시 전부 금지입니다. 오직 "지금이다" 하는 감각으로만 맞춥니다.',
          '숫자가 클수록 오래 기다리는 것 — 그 침묵의 길이가 유일한 신호입니다.',
          '그래서 이 게임에는 리액션 버튼조차 없습니다.',
        ],
      },
      {
        heading: '생명과 수리검',
        items: [
          '생명이 0이 되면 패배, 마지막 라운드를 넘기면 클리어입니다.',
          '라운드 3·6·9를 넘기면 생명이, 2·5·8을 넘기면 수리검이 하나씩 늘어납니다.',
          '수리검은 전원이 찬성하면 발동 — 각자 최저 카드를 공개하고 버립니다.',
        ],
      },
    ],
  },
  reformation: {
    mood: 'dark',
    title: '쿠: 리포메이션',
    tag: '블러핑 · 진영',
    description: '두 진영으로 갈린 궁정 — 국고를 노리는 음모전',
    players: '2~10인',
    minPlayers: 2,
    maxPlayers: 10,
    categories: ['정체 은닉', '블러핑'],
    duration: '15-25분',
    wsPath: '/ws/reformation',
    logPrefix: '[Reformation] WebSocket',
    sessionKey: 'rf_session_id',
    rules: [
      {
        heading: '기본은 쿠와 같습니다',
        items: [
          '비공개 역할 카드 2장과 칩 2개로 시작하고, 카드를 모두 잃으면 탈락합니다.',
          '역할이 없어도 주장할 수 있습니다 — 도전당하면 진실이 드러납니다.',
          '칩이 10개 이상이면 반드시 쿠를 해야 합니다.',
        ],
      },
      {
        heading: '진영',
        items: [
          '모두가 충성파 ⚜️ 또는 개혁파 ⚒️에 속하고, 진영은 전원에게 공개됩니다.',
          '같은 진영끼리는 강탈·암살·쿠를 할 수 없습니다 — 누구와 한 편인지가 판을 바꿉니다.',
          '살아남은 전원이 같은 진영이 되면 그 진영 전원이 함께 승리합니다.',
        ],
      },
      {
        heading: '국고와 개종',
        items: [
          '진영 바꾸기(칩 1개)와 남의 진영 바꾸기(칩 2개)로 판을 뒤집을 수 있습니다. 쓴 칩은 국고에 쌓입니다.',
          '횡령으로 국고를 통째로 가져올 수 있습니다 — 다만 "나는 공작이 아니다"를 증명해야 합니다.',
          '개종과 횡령 선언 자체는 도전·차단 대상이 아닙니다.',
        ],
      },
    ],
  },
  saboteur: {
    mood: 'dark',
    title: '사보타지',
    tag: '정체 은닉 · 길 놓기',
    description: '금맥까지 길을 잇는 광부와, 몰래 막는 파괴꾼',
    players: '3~10인',
    minPlayers: 3,
    maxPlayers: 10,
    categories: ['정체 은닉', '전략'],
    duration: '20-30분',
    wsPath: '/ws/saboteur',
    logPrefix: '[Saboteur] WebSocket',
    sessionKey: 'sb_session_id',
    rules: [
      {
        heading: '두 진영',
        items: [
          '광부는 출발점에서 금맥까지 길을 이으면 승리합니다.',
          '파괴꾼은 카드가 다 떨어질 때까지 길을 막으면 승리합니다.',
          '역할은 인원수보다 많은 풀에서 뽑아 나눠주므로, 파괴꾼이 정확히 몇 명인지는 아무도 모릅니다.',
        ],
      },
      {
        heading: '차례',
        items: [
          '카드를 한 장 쓰고 한 장 뽑습니다. 낼 게 없으면 버려도 됩니다.',
          '길 타일은 이미 이어진 길에 맞닿아야 하고, 인접한 변의 통로 모양이 맞아야 놓을 수 있습니다.',
          '막다른 타일 뒤로는 길이 이어지지 않습니다 — 티 나지 않게 막는 데 쓰입니다.',
        ],
      },
      {
        heading: '행동 카드',
        items: [
          '⛏🛒🏮 장비를 부수면 그 사람은 길 타일을 놓을 수 없습니다. 수리 카드로 고칠 수 있습니다.',
          '🗺 지도로 목표 타일 하나를 몰래 확인하고, 낙석으로 이미 놓인 타일을 걷어낼 수 있습니다.',
          '목표는 세 곳 중 하나에만 금이 있습니다 — 길이 닿으면 그 자리에서 공개됩니다.',
        ],
      },
    ],
  },
  avalon: {
    mood: 'dark',
    title: '아발론',
    tag: '정체 은닉 · 원정',
    description: '멀린과 암살자의 원정 심리전',
    players: '5~10인',
    minPlayers: 5,
    maxPlayers: 10,
    categories: ['정체 은닉', '추리'],
    duration: '15-30분',
    wsPath: '/ws/avalon',
    logPrefix: '[Avalon] WebSocket',
    sessionKey: 'av_session_id',
    rules: [
      {
        heading: '준비',
        items: [
          '5~10명이 선의 세력과 악의 세력으로 나뉩니다 (악은 5~6인 2명, 7~9인 3명, 10인 4명).',
          '악끼리는 서로를 알고, 선의 멀린은 악이 누구인지 봅니다.',
          '토론은 같은 공간(또는 음성)에서 — 앱은 지명·투표·원정 카드를 진행합니다.',
        ],
      },
      {
        heading: '원정 (5라운드)',
        items: [
          '리더가 돌아가며 원정대를 지명하고, 전원이 공개 찬반 투표합니다. 과반 찬성이면 원정을 떠납니다.',
          '연속 5번 부결되면 악의 세력이 즉시 승리합니다.',
          '원정대원은 비밀리에 성공/실패 카드를 냅니다 — 실패는 악만 낼 수 있고, 실패 1장이면 원정 실패입니다 (7인 이상의 4라운드만 2장 필요).',
        ],
      },
      {
        heading: '승리',
        items: [
          '원정 3회 실패 → 악의 승리.',
          '원정 3회 성공 → 암살 단계: 암살자가 멀린을 지목합니다. 맞히면 악의 역전승, 빗나가면 선의 승리입니다.',
        ],
      },
    ],
  },
};

export const GAME_IDS = Object.keys(GAMES) as GameId[];
