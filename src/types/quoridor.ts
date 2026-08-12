// 쿼리도 메시지·상태 타입

export type QDSide = 'south' | 'north';

export type QDPhase = 'lobby' | 'play' | 'game_over';

export type QDMessageType =
  // 클라 → 서버
  | 'qd_join_game'
  | 'qd_rejoin_game'
  | 'qd_move'
  | 'qd_place_wall'
  // 서버 → 클라
  | 'qd_player_joined'
  | 'qd_waiting_player'
  | 'qd_game_state'
  | 'qd_event'
  | 'qd_game_over'
  | 'qd_opponent_disconnected'
  | 'qd_opponent_reconnected'
  | 'qd_session_expired'
  | 'qd_error';

export interface QDMessage {
  type: QDMessageType;
  payload?: unknown;
}

export interface QDCell {
  row: number;
  col: number;
}

export type QDOrientation = 'h' | 'v';

// 벽. 앵커 (row, col)은 0~7 범위의 교차점 좌표.
// 가로는 행 row/row+1 사이에서 열 col·col+1 에, 세로는 열 col/col+1 사이에서
// 행 row·row+1 에 걸친다.
export interface QDWall {
  row: number;
  col: number;
  orientation: QDOrientation;
}

// 완전 공개 정보 게임 — yourSide 외에는 양측 동일한 스냅샷
export interface QDGameState {
  gameId: string;
  yourSide: QDSide;
  phase: QDPhase;
  currentSide: QDSide;
  southName: string;
  northName: string;
  southPawn: QDCell;
  northPawn: QDCell;
  southWalls: number;
  northWalls: number;
  walls: QDWall[];
  // 현재 차례 진영의 합법 폰 이동 칸 (점프·대각 우회 포함)
  legalMoves: QDCell[];
  opponentConnected: boolean;
}

export interface QDEvent {
  kind: 'move' | 'wall';
  side: QDSide;
  from?: QDCell;
  to?: QDCell;
  wall?: QDWall;
}

export interface QDGameOver {
  winner: QDSide;
  winnerName: string;
  reason: 'reach_goal';
}
