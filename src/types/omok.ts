// 오목 메시지·상태 타입

export type OmokColor = 'black' | 'white';

// 교차점 상태 (0 빈, 1 흑, 2 백)
export type OmokStone = 0 | 1 | 2;

export type OmokMessageType =
  // 클라 → 서버
  | 'om_join_game'
  | 'om_rejoin_game'
  | 'om_move'
  | 'om_rematch'
  // 서버 → 클라
  | 'om_player_joined'
  | 'om_waiting_player'
  | 'om_game_state'
  | 'om_event'
  | 'om_game_over'
  | 'om_rematch_offer'
  | 'om_opponent_disconnected'
  | 'om_opponent_reconnected'
  | 'om_session_expired'
  | 'om_error';

export interface OmokMessage {
  type: OmokMessageType;
  payload?: unknown;
}

export interface OmokCell {
  row: number;
  col: number;
}

// 완전 공개 정보 게임 — yourColor 외에는 양측 동일한 스냅샷
export interface OmokGameState {
  gameId: string;
  yourColor: OmokColor;
  currentColor: OmokColor;
  blackName: string;
  whiteName: string;
  // 15×15, 항상 가득 채워져 온다 (0빈 1흑 2백)
  board: OmokStone[][];
  moveCount: number;
  lastMove: OmokCell | null;
  opponentConnected: boolean;
}

export interface OmokEvent {
  kind: 'joined' | 'placed' | 'game_over';
  seat?: OmokColor;
  name: string;
  message: string;
}

export interface OmokGameOver {
  // 무승부(만패)는 빈 문자열
  winner: OmokColor | '';
  winnerName: string;
  reason: 'five' | 'draw' | 'forfeit';
  // 승리 5목 좌표 — 무승부·이탈 승은 []
  line: OmokCell[];
}

export const OMOK_BOARD_SIZE = 15;

// games.ts 등록은 통합자 담당 — 등록 전까지 셸 상수는 여기서 관리한다.
export const OMOK_WS_PATH = '/ws/omok';
export const OMOK_LOG_PREFIX = '[Omok] WebSocket';
// sessionStorage 키. 값을 바꾸면 기존 재접속 세션이 끊기므로 불변으로 둔다.
export const OMOK_SESSION_KEY = 'omok_session_id';
