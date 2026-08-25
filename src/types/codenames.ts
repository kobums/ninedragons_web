// 코드네임 메시지·상태 타입 — 와이어 계약(spec-codenames.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type CNPhase = 'waiting' | 'clue' | 'guess' | 'game_over';

export type CNTeam = 'red' | 'blue';

export type CNRole = 'spymaster' | 'agent';

// 키 카드·공개 카드의 색 (board 의 color 는 미공개 시 '')
export type CNCardColor = 'red' | 'blue' | 'neutral' | 'assassin';

export type CNMessageType =
  // 클라 → 서버
  | 'cn_join_game'
  | 'cn_fill_bots'
  | 'cn_start'
  | 'cn_rejoin'
  | 'cn_clue'
  | 'cn_pick'
  | 'cn_end_turn'
  | 'cn_react'
  // 서버 → 클라 (표준 세트 + cn_game_state)
  | 'cn_player_joined'
  | 'cn_spectate_joined'
  | 'cn_game_state'
  | 'cn_event'
  | 'cn_game_over'
  | 'cn_player_disconnected'
  | 'cn_player_reconnected'
  | 'cn_session_expired'
  | 'cn_error';

export interface CNMessage {
  type: CNMessageType;
  payload?: unknown;
}

export interface CNPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 대기 중에는 비어 있을 수 있다 (클라가 입장 순 미리보기로 보완)
  team: CNTeam | '';
  role: CNRole | '';
}

// 보드 카드 한 장 — 은닉 핵심: revealed 전에는 color 가 빈 값
export interface CNBoardCard {
  word: string;
  revealed: boolean;
  color: CNCardColor | '';
}

// 현재 힌트 — guess 단계 동안 유지 (remaining = 남은 추리 기회)
export interface CNClue {
  word: string;
  count: number;
  remaining: number;
}

export interface CNClueHistoryEntry {
  team: CNTeam;
  word: string;
  count: number;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷
// (은닉은 keyCard 뿐 — 스파이마스터에게만 오고, 요원·관전자는 부재.
//  반드시 ?? [] 방어)
export interface CNGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: CNPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (구버전 서버는 생략)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — 카운트다운 표시용
  endsAt: number;
  currentTeam: CNTeam;
  yourTeam: CNTeam | '';
  yourRole: CNRole | '';
  // 스파이마스터에게만 — 25칸 전체 색 배치 (omitempty, 반드시 ?? [] 방어)
  keyCard?: CNCardColor[];
  board: CNBoardCard[];
  clue?: CNClue | null;
  clueHistory?: CNClueHistoryEntry[];
  redLeft: number;
  blueLeft: number;
  players: CNPlayerView[];
  winner: CNTeam | '';
  loseReason?: 'assassin' | '';
}

// 서버 이벤트 — kind 목록은 백엔드 재량이라 열지 않고,
// 표시 문구는 서버 message 우선 + joined/left 만 클라 조립한다.
export interface CNEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// cn_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')
// 으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface CNGameOverPayload {
  winner?: CNTeam | '';
  loseReason?: 'assassin' | '';
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const CN_SESSION_KEY = 'cn_session_id';

export const CN_MIN_PLAYERS = 4;
export const CN_MAX_PLAYERS = 8;
// cn_fill_bots 가 채우는 목표 인원
export const CN_BOT_FILL_TARGET = 6;

// 힌트 숫자 후보 (1~9)
export const CN_CLUE_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const CN_TEAM_LABEL: Record<CNTeam, string> = {
  red: '빨간 팀',
  blue: '파란 팀',
};

export const CN_TEAM_MARK: Record<CNTeam, string> = {
  red: '🔴',
  blue: '🔵',
};

export const CN_ROLE_LABEL: Record<CNRole, string> = {
  spymaster: '팀장',
  agent: '팀원',
};

export function cnTeamLabel(team: CNTeam | ''): string {
  return team ? CN_TEAM_LABEL[team] : '';
}

// 대기실 팀·역할 미리보기 — 서버가 team 을 채워 보내면 그대로 쓰고,
// 비어 있으면 입장 순(좌석 순) 번갈아 배정(적,청,적,청...)으로 유추한다.
// 스파이마스터는 팀 내 첫 좌석 — 단 사람 우선(봇뿐이면 첫 봇).
// 실제 배정은 서버(cn_start)가 확정하므로 어디까지나 미리보기다.
export function cnPreviewTeams(players: CNPlayerView[]): {
  red: CNPlayerView[];
  blue: CNPlayerView[];
  spymasterSeat: (team: CNPlayerView[]) => number;
} {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const assigned = sorted.some((p) => p.team !== '');
  const red: CNPlayerView[] = [];
  const blue: CNPlayerView[] = [];
  sorted.forEach((p, i) => {
    const team = assigned ? p.team : i % 2 === 0 ? 'red' : 'blue';
    if (team === 'red') red.push(p);
    else if (team === 'blue') blue.push(p);
  });
  const spymasterSeat = (team: CNPlayerView[]): number => {
    const declared = team.find((p) => p.role === 'spymaster');
    if (declared) return declared.seat;
    const human = team.find((p) => !p.bot);
    return human?.seat ?? team[0]?.seat ?? -1;
  };
  return { red, blue, spymasterSeat };
}
