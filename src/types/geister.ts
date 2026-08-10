// 가이스터 메시지·상태 타입

export type GSSide = 'south' | 'north';

export type GSPhase = 'lobby' | 'setup' | 'play' | 'game_over';

export type GSMessageType =
  // 클라 → 서버
  | 'gs_join_game'
  | 'gs_rejoin_game'
  | 'gs_submit_setup'
  | 'gs_move'
  // 서버 → 클라
  | 'gs_player_joined'
  | 'gs_waiting_player'
  | 'gs_game_state'
  | 'gs_event'
  | 'gs_game_over'
  | 'gs_opponent_disconnected'
  | 'gs_opponent_reconnected'
  | 'gs_session_expired'
  | 'gs_error';

export interface GSMessage {
  type: GSMessageType;
  payload?: unknown;
}

export interface GSCell {
  row: number;
  col: number;
}

// 서버가 마스킹해 보낸 유령. 상대 유령은 good 이 없다.
export interface GSGhostView {
  id: number;
  side: GSSide;
  row: number;
  col: number;
  good?: boolean;
  captured?: boolean;
  escaped?: boolean;
}

export interface GSCapturedView {
  good: boolean;
}

export interface GSGameState {
  gameId: string;
  yourSide: GSSide;
  phase: GSPhase;
  currentSide: GSSide;
  southName: string;
  northName: string;
  yourReady: boolean;
  opponentReady: boolean;
  ghosts: GSGhostView[];
  capturedBySouth: GSCapturedView[];
  capturedByNorth: GSCapturedView[];
  opponentConnected: boolean;
}

export interface GSEvent {
  kind: 'move' | 'capture' | 'escape';
  side: GSSide;
  from?: GSCell;
  to?: GSCell;
  good?: boolean;
}

export interface GSGameOver {
  winner: GSSide;
  winnerName: string;
  reason: 'escape' | 'captured_all_good' | 'fed_all_evil';
  ghosts: GSGhostView[];
}
