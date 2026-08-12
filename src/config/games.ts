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
  | 'quoridor';

export interface RuleSection {
  heading?: string;
  items: string[];
}

export interface GameMeta {
  title: string;
  tag: string;
  description: string;
  players: string;
  duration: string;
  // 게임 선택 카드 색 (크림-다크 교차 리듬)
  cardTheme: 'dark' | 'cream';
  wsPath: string;
  logPrefix: string;
  // sessionStorage 키. 값을 바꾸면 기존 재접속 세션이 끊기므로 불변으로 둔다.
  sessionKey: string;
  rules: RuleSection[];
}

export const GAMES: Record<GameId, GameMeta> = {
  ninedragons: {
    title: '구룡투',
    tag: '전략 · 심리전',
    description: '전략적 타일 배치 게임',
    players: '2인',
    duration: '5분',
    cardTheme: 'dark',
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
    title: '넘버체인지',
    tag: '계산 · 교환',
    description: '숫자 블록 합계 대결 게임',
    players: '2인',
    duration: '5-10분',
    cardTheme: 'cream',
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
    title: '다빈치 코드',
    tag: '추리 · 심리전',
    description: '숫자 타일 추리 게임',
    players: '2~4인',
    duration: '10-15분',
    cardTheme: 'dark',
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
    title: '쇼텐토텐',
    tag: '전략 · 족보',
    description: '국경석을 둔 카드 진형 대결',
    players: '2인',
    duration: '15-20분',
    cardTheme: 'cream',
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
    title: '지킬 앤 하이드',
    tag: '트릭테이킹 · 심리전',
    description: '인격을 건 카드 트릭 대결',
    players: '2인',
    duration: '15-20분',
    cardTheme: 'dark',
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
    title: '가이스터',
    tag: '심리전 · 기물',
    description: '유령 정체를 숨긴 탈출 대결',
    players: '2인',
    duration: '10-15분',
    cardTheme: 'cream',
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
    title: '쿼리도',
    tag: '전략 · 길막기',
    description: '벽으로 길을 막는 경주 대결',
    players: '2인',
    duration: '10-20분',
    cardTheme: 'dark',
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
};

export const GAME_IDS = Object.keys(GAMES) as GameId[];
