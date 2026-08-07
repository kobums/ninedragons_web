// 쇼텐토텐 메시지·상태 타입

export type STSide = 'south' | 'north';

export type STPhase = 'lobby' | 'play' | 'claim' | 'game_over';

export type STMessageType =
  // 클라 → 서버
  | 'st_join_game'
  | 'st_rejoin_game'
  | 'st_play_card'
  | 'st_claim_stone'
  | 'st_end_turn'
  // 서버 → 클라
  | 'st_player_joined'
  | 'st_waiting_player'
  | 'st_game_start'
  | 'st_game_state'
  | 'st_event'
  | 'st_game_over'
  | 'st_opponent_disconnected'
  | 'st_opponent_reconnected'
  | 'st_session_expired'
  | 'st_error';

export interface STMessage {
  type: STMessageType;
  payload?: unknown;
}

// 클랜 카드. color 0~5, rank 1~9. 돌에 놓인 카드는 모두 공개 정보다.
export interface STCard {
  color: number;
  rank: number;
}

export interface STStoneView {
  index: number;
  yourCards: STCard[];
  oppCards: STCard[];
  owner: 'you' | 'opponent' | '';
  claimable: boolean;
}

export interface STGameState {
  gameId: string;
  yourSide: STSide;
  phase: STPhase;
  currentSide: STSide;
  deckCount: number;
  yourHand: STCard[];
  opponentHandCount: number;
  stones: STStoneView[];
  southName: string;
  northName: string;
  yourStoneCount: number;
  oppStoneCount: number;
  opponentConnected: boolean;
}

export interface STEvent {
  kind: 'card_played' | 'stone_claimed' | 'turn_passed';
  side: STSide;
  stoneIndex?: number;
  card?: STCard;
}

export interface STGameOver {
  winner: STSide | '';
  reason: 'five_stones' | 'three_adjacent' | 'stalemate' | 'forfeit';
  southName: string;
  northName: string;
  southCount: number;
  northCount: number;
}

export interface STPlayerJoined {
  yourSide: STSide;
  gameId: string;
  sessionId: string;
}
