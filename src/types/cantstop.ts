// 캔트 스톱 메시지·상태 타입

export type CSSide = 'south' | 'north';

export type CSPhase = 'lobby' | 'play' | 'game_over';

// 컬럼(합) 목록: 2~12
export const CS_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// 컬럼 길이: 7이 13칸으로 가장 길고 양끝이 3칸 (서버 csColLen 미러)
export const csColLen = (col: number) => 13 - 2 * Math.abs(7 - col);

export type CSMessageType =
  // 클라 → 서버
  | 'cs_join_game'
  | 'cs_rejoin_game'
  | 'cs_roll'
  | 'cs_choose'
  | 'cs_stop'
  // 서버 → 클라
  | 'cs_player_joined'
  | 'cs_waiting_player'
  | 'cs_game_state'
  | 'cs_event'
  | 'cs_rematch'
  | 'cs_game_over'
  | 'cs_rematch_offer'
  | 'cs_opponent_disconnected'
  | 'cs_opponent_reconnected'
  | 'cs_session_expired'
  | 'cs_error';

export interface CSMessage {
  type: CSMessageType;
  payload?: unknown;
}

export interface CSOption {
  sums: number[];
}

export interface CSGameState {
  gameId: string;
  yourSide: CSSide;
  phase: CSPhase;
  currentSide: CSSide;
  southName: string;
  northName: string;
  southProgress: Record<string, number>;
  northProgress: Record<string, number>;
  claimed: Record<string, CSSide>;
  temp: Record<string, number>;
  dice?: number[];
  options?: CSOption[];
  canRoll: boolean;
  canStop: boolean;
  opponentConnected: boolean;
}

export interface CSEvent {
  kind: 'roll' | 'advance' | 'bust' | 'bank' | 'claim';
  side: CSSide;
  dice?: number[];
  sums?: number[];
  col?: number;
}

export interface CSGameOver {
  winner: CSSide;
  winnerName: string;
  reason: 'claimed_three';
  claimedCols: number[];
}
