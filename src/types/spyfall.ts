// 스파이폴 메시지·상태 타입 — 와이어 계약(spec-spyfall.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type SPPhase = 'waiting' | 'playing' | 'voting' | 'game_over';

export type SPMessageType =
  // 클라 → 서버
  | 'sp_join_game'
  | 'sp_fill_bots'
  | 'sp_start'
  | 'sp_set_timer'
  | 'sp_set_category'
  | 'sp_guess'
  | 'sp_vote'
  | 'sp_rejoin'
  // 서버 → 클라
  | 'sp_player_joined'
  | 'sp_game_state'
  | 'sp_event'
  | 'sp_game_over'
  | 'sp_opponent_disconnected'
  | 'sp_reconnected'
  | 'sp_session_expired'
  | 'sp_error';

export interface SPMessage {
  type: SPMessageType;
  payload?: unknown;
}

export interface SPPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // voting 단계에서 제출 여부 (누구를 찍었는지는 votes 공개 목록에)
  voted: boolean;
}

// 공개 투표 한 건
export interface SPVoteEntry {
  voter: number;
  target: number;
}

export type SPWinner = 'spy' | 'citizen';

export type SPReason =
  | 'guess_right' // 스파이 추리 적중 → 스파이 승
  | 'guess_wrong' // 스파이 추리 실패 → 시민팀 승
  | 'vote_caught' // 단독 최다 득표 = 스파이 → 시민팀 승
  | 'vote_missed'; // 오지목·동표 → 스파이 승

export interface SPResult {
  winner: SPWinner;
  spySeat: number;
  category: string;
  location: string;
  reason: SPReason;
  // 스파이가 추리했을 때만 채워진다 ('' = 추리 없음)
  guessedLocation: string;
  // 단독 최다 득표 좌석 (없으면 -1)
  topSeat: number;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// 스파이 여부는 본인에게만, location 은 비스파이에게만 채워진다)
export interface SPGameState {
  gameId: string;
  phase: SPPhase;
  hostSeat: number;
  yourSeat: number;
  timerMinutes: number;
  // 대기실 host 선택 (기본 '랜덤')과 시작 시 확정 카테고리
  categoryChoice: string;
  category: string;
  // playing 중 unixMillis, 그 외 0 — 프론트가 카운트다운 계산
  endsAt: number;
  // 확정 카테고리 단어 24개 (playing 부터)
  locations?: string[] | null;
  isSpy: boolean;
  // 비스파이만 채워진다 (스파이·waiting 은 '')
  location: string;
  players: SPPlayerView[];
  votes?: SPVoteEntry[] | null;
  result?: SPResult | null;
}

export type SPEventKind =
  | 'joined'
  | 'left'
  | 'started'
  | 'guess'
  | 'vote_begin'
  | 'game_over'
  | 'bot_takeover';

export interface SPEvent {
  kind: SPEventKind;
  seat?: number;
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const SP_SESSION_KEY = 'sp_session_id';

export const SP_MIN_PLAYERS = 3;
export const SP_MAX_PLAYERS = 8;

// host 가 대기실에서 고르는 타이머 (분)
export const SP_TIMER_CHOICES = [3, 5, 8] as const;

// host 가 대기실에서 고르는 카테고리 (서버 계약과 동일 표기)
export const SP_CATEGORY_RANDOM = '랜덤';
export const SP_CATEGORY_CHOICES = [
  SP_CATEGORY_RANDOM,
  '장소',
  '직업',
  '과일',
  '음식',
  '동물',
  '스포츠',
] as const;

// 종료 사유 한글 라벨
export const SP_REASON_LABEL: Record<SPReason, string> = {
  guess_right: '스파이가 정답을 알아냈습니다',
  guess_wrong: '스파이의 추리가 빗나갔습니다',
  vote_caught: '투표로 스파이를 검거했습니다',
  vote_missed: '투표가 스파이를 놓쳤습니다',
};
