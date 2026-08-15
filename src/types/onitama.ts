// 오니타마 메시지·상태 타입 + 카드 정의 (룰 데이터 — 서버 otCardDeck 미러)

export type OTSide = 'south' | 'north';

export type OTPhase = 'lobby' | 'play' | 'game_over';

export type OTMessageType =
  // 클라 → 서버
  | 'ot_join_game'
  | 'ot_rejoin_game'
  | 'ot_move'
  | 'ot_pass'
  // 서버 → 클라
  | 'ot_player_joined'
  | 'ot_waiting_player'
  | 'ot_game_state'
  | 'ot_event'
  | 'ot_rematch'
  | 'ot_game_over'
  | 'ot_rematch_offer'
  | 'ot_opponent_disconnected'
  | 'ot_opponent_reconnected'
  | 'ot_session_expired'
  | 'ot_error';

export interface OTMessage {
  type: OTMessageType;
  payload?: unknown;
}

export interface OTCell {
  row: number;
  col: number;
}

export interface OTPiece {
  id: number;
  side: OTSide;
  master: boolean;
  row: number;
  col: number;
}

export interface OTLegalMove {
  card: string;
  from: OTCell;
  to: OTCell;
}

export interface OTGameState {
  gameId: string;
  yourSide: OTSide;
  phase: OTPhase;
  currentSide: OTSide;
  southName: string;
  northName: string;
  pieces: OTPiece[];
  southHand: string[];
  northHand: string[];
  waitingCard: string;
  legalMoves: OTLegalMove[];
  opponentConnected: boolean;
}

export interface OTEvent {
  kind: 'move' | 'capture' | 'pass';
  side: OTSide;
  card: string;
  from?: OTCell;
  to?: OTCell;
  master?: boolean;
}

export interface OTGameOver {
  winner: OTSide;
  winnerName: string;
  reason: 'capture_master' | 'reach_temple';
}

// ==================== 카드 정의 ====================

// 오프셋은 남쪽(내) 시점: forward = 상대 방향, right = 오른쪽.
export interface OTCardDef {
  label: string;
  moves: Array<{ forward: number; right: number }>;
}

export const OT_CARDS: Record<string, OTCardDef> = {
  tiger: { label: '호랑이', moves: [{ forward: 2, right: 0 }, { forward: -1, right: 0 }] },
  crab: {
    label: '게',
    moves: [
      { forward: 1, right: 0 },
      { forward: 0, right: -2 },
      { forward: 0, right: 2 },
    ],
  },
  monkey: {
    label: '원숭이',
    moves: [
      { forward: 1, right: -1 },
      { forward: 1, right: 1 },
      { forward: -1, right: -1 },
      { forward: -1, right: 1 },
    ],
  },
  crane: {
    label: '학',
    moves: [
      { forward: 1, right: 0 },
      { forward: -1, right: -1 },
      { forward: -1, right: 1 },
    ],
  },
  dragon: {
    label: '용',
    moves: [
      { forward: 1, right: -2 },
      { forward: 1, right: 2 },
      { forward: -1, right: -1 },
      { forward: -1, right: 1 },
    ],
  },
  elephant: {
    label: '코끼리',
    moves: [
      { forward: 1, right: -1 },
      { forward: 1, right: 1 },
      { forward: 0, right: -1 },
      { forward: 0, right: 1 },
    ],
  },
  mantis: {
    label: '사마귀',
    moves: [
      { forward: 1, right: -1 },
      { forward: 1, right: 1 },
      { forward: -1, right: 0 },
    ],
  },
  boar: {
    label: '멧돼지',
    moves: [
      { forward: 1, right: 0 },
      { forward: 0, right: -1 },
      { forward: 0, right: 1 },
    ],
  },
  frog: {
    label: '개구리',
    moves: [
      { forward: 0, right: -2 },
      { forward: 1, right: -1 },
      { forward: -1, right: 1 },
    ],
  },
  rabbit: {
    label: '토끼',
    moves: [
      { forward: 1, right: 1 },
      { forward: 0, right: 2 },
      { forward: -1, right: -1 },
    ],
  },
  goose: {
    label: '거위',
    moves: [
      { forward: 1, right: -1 },
      { forward: 0, right: -1 },
      { forward: 0, right: 1 },
      { forward: -1, right: 1 },
    ],
  },
  rooster: {
    label: '수탉',
    moves: [
      { forward: 1, right: 1 },
      { forward: 0, right: 1 },
      { forward: 0, right: -1 },
      { forward: -1, right: -1 },
    ],
  },
  horse: {
    label: '말',
    moves: [
      { forward: 1, right: 0 },
      { forward: 0, right: -1 },
      { forward: -1, right: 0 },
    ],
  },
  ox: {
    label: '황소',
    moves: [
      { forward: 1, right: 0 },
      { forward: 0, right: 1 },
      { forward: -1, right: 0 },
    ],
  },
  eel: {
    label: '뱀장어',
    moves: [
      { forward: 1, right: -1 },
      { forward: 0, right: 1 },
      { forward: -1, right: -1 },
    ],
  },
  cobra: {
    label: '코브라',
    moves: [
      { forward: 1, right: 1 },
      { forward: 0, right: -1 },
      { forward: -1, right: 1 },
    ],
  },
};
