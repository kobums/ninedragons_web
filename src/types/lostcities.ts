// 로스트 시티 메시지·상태 타입

export type LCSide = 'south' | 'north';

export type LCPhase = 'lobby' | 'play' | 'game_over';

export type LCColor = 'red' | 'green' | 'blue' | 'white' | 'yellow';

export const LC_COLORS: LCColor[] = ['red', 'green', 'blue', 'white', 'yellow'];

export const LC_COLOR_LABEL: Record<LCColor, string> = {
  red: '화산',
  green: '정글',
  blue: '바다',
  white: '설원',
  yellow: '사막',
};

// Value 0 = 투자 카드
export const LC_WAGER = 0;

export type LCMessageType =
  // 클라 → 서버
  | 'lc_join_game'
  | 'lc_rejoin_game'
  | 'lc_move'
  // 서버 → 클라
  | 'lc_player_joined'
  | 'lc_waiting_player'
  | 'lc_game_state'
  | 'lc_event'
  | 'lc_rematch'
  | 'lc_game_over'
  | 'lc_rematch_offer'
  | 'lc_opponent_disconnected'
  | 'lc_opponent_reconnected'
  | 'lc_session_expired'
  | 'lc_error';

export interface LCMessage {
  type: LCMessageType;
  payload?: unknown;
}

export interface LCCard {
  id: number;
  color: LCColor;
  value: number;
}

export interface LCGameState {
  gameId: string;
  yourSide: LCSide;
  phase: LCPhase;
  currentSide: LCSide;
  southName: string;
  northName: string;
  yourHand: LCCard[];
  opponentHandCount: number;
  deckCount: number;
  southExpeditions: Partial<Record<LCColor, LCCard[]>>;
  northExpeditions: Partial<Record<LCColor, LCCard[]>>;
  discards: Partial<Record<LCColor, LCCard[]>>;
  southScore: number;
  northScore: number;
  opponentConnected: boolean;
}

export interface LCEvent {
  kind: 'play' | 'discard' | 'draw';
  side: LCSide;
  card?: LCCard;
  source?: string;
}

export interface LCGameOver {
  winner: LCSide | '';
  winnerName: string;
  reason: 'score';
  southScore: number;
  northScore: number;
}
