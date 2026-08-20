// 러브레터 메시지·상태 타입 — 와이어 계약(spec-loveletter.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type LVPhase = 'waiting' | 'playing' | 'round_end' | 'game_over';

export type LVMessageType =
  // 클라 → 서버
  | 'lv_join_game'
  | 'lv_fill_bots'
  | 'lv_start'
  | 'lv_rejoin'
  | 'lv_play'
  | 'lv_react'
  // 서버 → 클라
  | 'lv_player_joined'
  | 'lv_spectate_joined'
  | 'lv_game_state'
  | 'lv_event'
  | 'lv_private'
  | 'lv_game_over'
  | 'lv_player_disconnected'
  | 'lv_player_reconnected'
  | 'lv_session_expired'
  | 'lv_error';

export interface LVMessage {
  type: LVMessageType;
  payload?: unknown;
}

export interface LVPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  alive: boolean;
  protected: boolean;
  tokens: number;
  // 버린 카드 값 목록 (시간순) — 전원 공개, 카운팅 요소
  discards: number[];
}

export interface LVRoundResult {
  winnerSeat: number;
  reason: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷
// (은닉은 yourHand 뿐 — 관전자·타인에게는 부재)
export interface LVGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: LVPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (구버전 서버는 생략)
  spectators?: number;
  // 턴 마감 시각 (unixMillis, 없으면 0) — 카운트다운 표시용
  endsAt: number;
  // 내 손패 1~2장 (관전자·타인은 부재 — 반드시 ?? [] 방어)
  yourHand?: number[];
  currentSeat: number;
  deckCount: number;
  tokens: number[];
  targetTokens: number;
  players: LVPlayerView[];
  // round_end 동안만 채워진다
  roundResult?: LVRoundResult | null;
  // 2인전 공개 제거 카드
  removedFaceUp?: number[];
}

// 서버 이벤트 — kind 목록은 백엔드 재량이라 열지 않고,
// 표시 문구는 서버 message 우선 + joined/left 만 클라 조립한다.
export interface LVEvent {
  kind: string;
  seat?: number;
  name?: string;
  targetSeat?: number;
  message?: string;
}

// 사제 열람·남작 비교 결과 — 당사자에게만 오는 개인 이벤트
export interface LVPrivateInfo {
  kind: 'priest' | 'baron';
  message: string;
}

// lv_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')
// 으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface LVGameOverPayload {
  winnerSeat?: number;
  winnerName?: string;
  reason?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const LV_SESSION_KEY = 'lv_session_id';

export const LV_MIN_PLAYERS = 2;
export const LV_MAX_PLAYERS = 4;

// 카드 메타 — 값·인물 이름·한 줄 효과·장수 (원시 코드 노출 금지, 전부 한글)
export interface LVCardMeta {
  name: string;
  effect: string;
  count: number;
}

export const LV_CARDS: Record<number, LVCardMeta> = {
  1: { name: '경비병', effect: '대상의 손패 값을 추측(1 제외) — 맞으면 탈락', count: 5 },
  2: { name: '사제', effect: '대상의 손패를 나만 몰래 봅니다', count: 2 },
  3: { name: '남작', effect: '대상과 손패 비교 — 낮은 쪽이 탈락합니다', count: 2 },
  4: { name: '시녀', effect: '다음 내 턴까지 보호받습니다', count: 2 },
  5: { name: '왕자', effect: '대상(자신 가능)이 손패를 버리고 새로 뽑습니다', count: 2 },
  6: { name: '왕', effect: '대상과 손패를 교환합니다', count: 1 },
  7: { name: '백작부인', effect: '왕·왕자와 함께 있으면 반드시 내야 합니다', count: 1 },
  8: { name: '공주', effect: '버리게 되면 즉시 탈락합니다', count: 1 },
};

// 카드 이름 (알 수 없는 값 방어 — 원시 숫자 노출 대신 '?')
export function lvCardName(value: number): string {
  return LV_CARDS[value]?.name ?? '?';
}

// 대상 지정이 필요한 카드 (4 시녀·7 백작부인·8 공주는 대상 없음)
export function lvNeedsTarget(value: number): boolean {
  return value === 1 || value === 2 || value === 3 || value === 5 || value === 6;
}

// 자신을 대상으로 지정할 수 있는 카드 (왕자만)
export function lvCanTargetSelf(value: number): boolean {
  return value === 5;
}

// 경비병 추측 후보 (1 제외)
export const LV_GUARD_GUESSES = [2, 3, 4, 5, 6, 7, 8];

// 백작부인 강제 — 손에 7과 5/6이 함께 있으면 7만 낼 수 있다
export function lvCountessForced(hand: number[]): boolean {
  return hand.includes(7) && (hand.includes(5) || hand.includes(6));
}

// 라운드 결과 사유 코드 → 한글 (모르는 코드는 빈 문자열 — 원시 코드 노출 금지)
const LV_REASON_LABEL: Record<string, string> = {
  last_standing: '홀로 생존',
  survivor: '홀로 생존',
  highest: '가장 높은 손패',
  highest_card: '가장 높은 손패',
  highest_hand: '가장 높은 손패',
  deck_empty: '가장 높은 손패',
  discard_sum: '버린 카드 합 우세',
  tiebreak: '버린 카드 합 우세',
};

export function lvReasonLabel(reason: string): string {
  return LV_REASON_LABEL[reason] ?? '';
}
