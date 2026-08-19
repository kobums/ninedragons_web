// 티츄 메시지·상태 타입 + 카드 인코딩 헬퍼
// 와이어 계약(spec-tichu.md)과 필드명·타입명이 1:1 — 백엔드와 공유하므로 바꾸지 말 것.

export const TC_SESSION_KEY = 'tc_session_id';

// 카드 인코딩: "<S><R>" (S ∈ G/B/U/R, R ∈ 2..14) 또는 특수 "MAH"/"DOG"/"PHX"/"DRG"
export type TichuCard = string;

export type TichuPhase =
  | 'waiting'
  | 'grand'
  | 'exchange'
  | 'play'
  | 'hand_end'
  | 'game_over';

export type TichuComboKind =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'fullhouse'
  | 'pairseq'
  | 'bomb'
  | 'bomb_sf'
  | 'dog';

export type TichuEventKind =
  | 'joined'
  | 'left'
  | 'grand'
  | 'tichu'
  | 'exchanged'
  | 'play'
  | 'pass'
  | 'trick_won'
  | 'bomb'
  | 'dog'
  | 'wish'
  | 'wish_done'
  | 'player_out'
  | 'dragon_given'
  | 'hand_end'
  | 'bot_takeover'
  | 'react';

export type TichuMessageType =
  // 클라 → 서버
  | 'tc_join_game'
  | 'tc_set_target'
  | 'tc_fill_bots'
  | 'tc_call_grand'
  | 'tc_call_tichu'
  | 'tc_exchange'
  | 'tc_play'
  | 'tc_pass'
  | 'tc_dragon_give'
  | 'tc_ready'
  | 'tc_rejoin'
  | 'tc_react'
  // 서버 → 클라
  | 'tc_player_joined'
  | 'tc_spectate_joined'
  | 'tc_game_state'
  | 'tc_event'
  | 'tc_game_over'
  | 'tc_opponent_disconnected'
  | 'tc_reconnected'
  | 'tc_session_expired'
  | 'tc_error';

export interface TichuMessage {
  type: TichuMessageType;
  payload?: unknown;
}

export interface TichuPlayer {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  handCount: number;
  tichu: '' | 'tichu' | 'grand';
  out: boolean;
  // 0 = 아직 안 남, 1~4 = 아웃 순위
  outRank: 0 | 1 | 2 | 3 | 4;
  ready: boolean;
}

export interface TichuTrickPlay {
  seat: number;
  cards: TichuCard[];
  combo: TichuComboKind;
}

export interface TichuScores {
  team02: number;
  team13: number;
}

export interface TichuHandResult {
  team02Delta: number;
  team13Delta: number;
  detail: string;
}

// tc_game_state payload (은닉형 개인화 스냅샷 — 남의 손패는 개수만)
export interface TichuGameState {
  gameId: string;
  phase: TichuPhase;
  targetScore: number;
  yourSeat: number;
  players: TichuPlayer[];
  yourHand: TichuCard[];
  exchangeDone: boolean;
  grandAnswered: boolean;
  scores: TichuScores;
  handNo: number;
  currentTurn: number; // seat | -1
  trick: TichuTrickPlay[];
  lastPlay: TichuTrickPlay | null;
  wishRank: number; // 0 | 2..14
  dragonPendingSeat: number; // seat | -1
  handResult: TichuHandResult | null;
  winnerTeam: '' | '02' | '13';
  // 사설 방 코드 (공용 로비는 '' 또는 생략 — 구버전 서버 호환)
  roomCode?: string;
  // 관전자 수 (구버전 서버는 생략)
  spectators?: number;
}

export interface TichuEvent {
  kind: TichuEventKind;
  seat?: number;
  // kind 'react' 에서 서버가 실어주는 표시 이름
  name?: string;
  message: string;
}

// tc_game_over payload — 최종 화면은 마지막 스냅샷(phase: 'game_over')을 주로 쓰므로
// 서버가 무엇을 담아 보내든 깨지지 않게 느슨하게 받는다.
export interface TichuGameOver {
  winnerTeam?: '02' | '13';
  scores?: TichuScores;
  players?: TichuPlayer[];
}

// ---------------- 카드 헬퍼 ----------------

export type TichuSuit = 'G' | 'B' | 'U' | 'R';

export const TC_SPECIALS = ['MAH', 'DOG', 'PHX', 'DRG'] as const;
export type TichuSpecial = (typeof TC_SPECIALS)[number];

export const isSpecialCard = (card: TichuCard): card is TichuSpecial =>
  (TC_SPECIALS as readonly string[]).includes(card);

export const cardSuit = (card: TichuCard): TichuSuit | null =>
  isSpecialCard(card) ? null : (card[0] as TichuSuit);

export const cardRank = (card: TichuCard): number =>
  isSpecialCard(card) ? 0 : Number.parseInt(card.slice(1), 10);

// 11=J, 12=Q, 13=K, 14=A
export const rankLabel = (rank: number): string => {
  switch (rank) {
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    case 14:
      return 'A';
    default:
      return String(rank);
  }
};

export const COMBO_LABELS: Record<TichuComboKind, string> = {
  single: '싱글',
  pair: '페어',
  triple: '트리플',
  straight: '스트레이트',
  fullhouse: '풀하우스',
  pairseq: '연속 페어',
  bomb: '폭탄',
  bomb_sf: '무늬 폭탄',
  dog: '개',
};

export const teamOfSeat = (seat: number): '02' | '13' =>
  seat % 2 === 0 ? '02' : '13';
