// 더 마인드 메시지·상태 타입 — 와이어 계약(spec-mind.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 세트에 이은 두 번째 "차례 없는" 실시간 게임이다. currentSeat 가 아예 없고
// 누구든 아무 때나 mi_play 를 보내며, 허브가 도착 순서대로 판정한다.
//
// 협력 게임이지만 리액션이 없다 — 규칙상 소통 금지가 이 게임의 전부라
// 서버에도 mi_react 가 존재하지 않는다. (의도적 부재이므로 추가 금지)

export type MIPhase =
  | 'waiting'
  // 라운드 시작 3초 카운트다운 (endsAt 기준)
  | 'ready'
  | 'playing'
  | 'round_end'
  | 'game_over';

export type MIMessageType =
  // 클라 → 서버
  | 'mi_join_game'
  | 'mi_fill_bots'
  | 'mi_start'
  | 'mi_rejoin'
  // 카드 지정이 없다 — 내 최저 카드를 낸다 (오름차순 게임이라 최저 외엔 낼 이유가 없다)
  | 'mi_play'
  | 'mi_star_propose'
  | 'mi_star_accept'
  | 'mi_star_decline'
  // 서버 → 클라
  | 'mi_player_joined'
  | 'mi_spectate_joined'
  | 'mi_game_state'
  | 'mi_event'
  | 'mi_game_over'
  | 'mi_player_disconnected'
  | 'mi_player_reconnected'
  | 'mi_session_expired'
  | 'mi_error';

export interface MIMessage {
  type: MIMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 손패 숫자는 공개되지 않고 장수만 공개된다
export interface MIPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  handCount: number;
}

// 진행 중인 수리검 투표. 20초(endsAt)가 지나거나 한 명이라도 거절하면 무산.
export interface MIStarVote {
  proposer: number;
  // 찬성한 좌석들 (제안자 포함 여부는 서버 판단 — 프론트는 그대로 표시만 한다)
  accepted: number[];
  endsAt: number;
}

// 실수로 터진 카드 한 장 — 누구 손에서 나왔는지까지 공개된다
export interface MIBurnedCard {
  seat: number;
  card: number;
}

// 직전 실수 — 누가 무엇을 냈고 그보다 작은 어떤 카드들이 터졌는지.
// 이 게임에서 가장 중요한 연출이라 보드가 스냅샷으로 직접 크게 그린다.
export interface MILastMistake {
  seat: number;
  played: number;
  burned: MIBurnedCard[];
  message?: string;
}

// 협력 게임이라 승패는 전원 공동이다 — 몇 라운드까지 갔는지가 기록.
export interface MIResult {
  cleared: boolean;
  round: number;
  message?: string;
}

export interface MIGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: MIPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계별 마감 시각 (unixMillis, 없으면 0).
  // ready 에서는 3초 카운트다운, 그 밖에는 전체·라운드 캡을 뜻한다.
  endsAt: number;
  round: number;
  maxRound: number;
  lives: number;
  stars: number;
  // 직전에 나온 수 (0 = 아직 아무도 내지 않음)
  lastPlayed: number;
  // 중앙에 쌓인 순서대로. 빈 []
  pile?: number[];
  // 본인만 받는다 — 타인·관전자에게는 키 자체가 없다. 오름차순. 빈 []
  yourHand?: number[];
  players?: MIPlayerView[];
  starVote?: MIStarVote | null;
  lastMistake?: MILastMistake | null;
  result?: MIResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface MIEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// mi_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')
// 으로 그리고, 이 페이로드는 신호 + 결과 보조로만 쓴다.
export interface MIGameOverPayload {
  cleared?: boolean;
  round?: number;
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const MI_SESSION_KEY = 'mi_session_id';

export const MI_MIN_PLAYERS = 2;
export const MI_MAX_PLAYERS = 4;
// mi_fill_bots 는 3인까지 채우고 즉시 시작한다
export const MI_BOT_FILL_TARGET = 3;

// 인원별 최종 라운드 — 서버 maxRound 가 진실이고 이 표는 대기실 안내용이다
export const MI_MAX_ROUND_BY_PLAYERS: Record<number, number> = {
  2: 12,
  3: 10,
  4: 8,
};

// 수리검 투표 제한 (서버 endsAt 이 진실이고, 이 값은 안내 문구용)
export const MI_STAR_VOTE_MS = 20_000;

// 라운드 보상 — 3·6·9 마치면 생명 +1, 2·5·8 마치면 수리검 +1
export const MI_LIFE_REWARD_ROUNDS: readonly number[] = [3, 6, 9];
export const MI_STAR_REWARD_ROUNDS: readonly number[] = [2, 5, 8];

// 방금 마친 라운드의 보상 문구 ('' 면 보상 없음)
export const miRewardText = (round: number): string => {
  if (MI_LIFE_REWARD_ROUNDS.includes(round)) return '❤️ 생명 +1';
  if (MI_STAR_REWARD_ROUNDS.includes(round)) return '⭐ 수리검 +1';
  return '';
};

// 남은 초(올림). endsAt 이 0 이거나 지났으면 0.
export const miSeconds = (endsAt: number, now: number): number =>
  endsAt > now ? Math.ceil((endsAt - now) / 1000) : 0;
