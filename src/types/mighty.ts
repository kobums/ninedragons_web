// 마이티 메시지·상태 타입 — 와이어 계약(spec-mighty.md)과 1:1 대응.
// 메시지 타입명·payload 필드명·카드 인코딩은 백엔드와 공유하므로 변경 금지.

// 카드 인코딩: "<S><R>" (S ∈ S/D/C/H, R ∈ 2..14, A=14) 또는 조커 "JK".
export type MTCard = string;

export type MTSuit = 'S' | 'D' | 'C' | 'H';
// 입찰·기루다에는 노기루(N)가 추가된다
export type MTBidSuit = MTSuit | 'N';

export type MTPhase =
  | 'waiting'
  | 'bidding'
  | 'kitty'
  | 'friend'
  | 'play'
  | 'game_over';

export type MTMessageType =
  // 클라 → 서버
  | 'mt_join_game'
  | 'mt_fill_bots'
  | 'mt_rejoin'
  | 'mt_bid'
  | 'mt_pass'
  | 'mt_kitty'
  | 'mt_friend'
  | 'mt_play'
  // 서버 → 클라
  | 'mt_player_joined'
  | 'mt_game_state'
  | 'mt_event'
  | 'mt_game_over'
  | 'mt_opponent_disconnected'
  | 'mt_reconnected'
  | 'mt_session_expired'
  | 'mt_error';

export interface MTMessage {
  type: MTMessageType;
  payload?: unknown;
}

export interface MTPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  handCount: number;
  passed: boolean;
  isDeclarer: boolean;
  friendRevealed: boolean;
  tricksWon: number;
  capturedPoints: number;
}

export interface MTBid {
  seat: number;
  suit: MTBidSuit;
  count: number;
}

export interface MTContract {
  declarer: number;
  suit: MTBidSuit;
  count: number;
}

export type MTFriendType = 'card' | 'first_trick' | 'none' | '';

export interface MTFriendInfo {
  type: MTFriendType;
  card?: MTCard;
  revealed: boolean;
  // 미공개면 -1
  seat: number;
}

export interface MTTrickCard {
  seat: number;
  card: MTCard;
}

export interface MTLastTrick {
  winner: number;
  cards: MTTrickCard[];
}

export interface MTResult {
  win: boolean;
  declarerPoints: number;
  defenderPoints: number;
  contract: MTContract;
  friendSeat: number;
  declarerTeam: string[];
  defenderTeam: string[];
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// 남의 손패는 개수만, 키티는 주공에게만 보인다)
export interface MTGameState {
  gameId: string;
  phase: MTPhase;
  yourSeat: number;
  players: MTPlayerView[];
  // 문양별·숫자 내림차순 정렬, JK 맨 앞 (서버 정렬 그대로 표시)
  yourHand: MTCard[];
  bidding: { turn: number; best: MTBid | null };
  contract: MTContract | null;
  // 주공에게만, kitty 단계에서만 채워진다
  yourKitty: MTCard[] | null;
  friend: MTFriendInfo;
  trickNo: number;
  currentTurn: number;
  ledSuit: '' | MTSuit;
  jokerCallActive: boolean;
  trick: MTTrickCard[];
  lastTrick: MTLastTrick | null;
  result: MTResult | null;
}

export type MTEventKind =
  | 'joined'
  | 'left'
  | 'bid'
  | 'pass'
  | 'redeal'
  | 'contract'
  | 'kitty_done'
  | 'friend_set'
  | 'friend_revealed'
  | 'play'
  | 'joker_call'
  | 'trick_won'
  | 'bot_takeover';

// 이벤트 부가 필드는 kind 마다 다르므로 전부 옵셔널로 둔다
export interface MTEvent {
  kind: MTEventKind;
  seat?: number;
  name?: string;
  suit?: string;
  count?: number;
  card?: MTCard;
  winner?: number;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const MT_SESSION_KEY = 'mt_session_id';
