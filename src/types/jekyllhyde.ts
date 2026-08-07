// 지킬 앤 하이드 메시지·상태 타입

export type JHRole = 'jekyll' | 'hyde';

export type JHSuit = 'pride' | 'wrath' | 'greed' | 'potion';

export type JHPhase =
  | 'lobby'
  | 'exchange'
  | 'lead'
  | 'declare'
  | 'follow'
  | 'pride_steal'
  | 'greed_exchange'
  | 'game_over';

export type JHMessageType =
  // 클라 → 서버
  | 'jh_join_game'
  | 'jh_rejoin_game'
  | 'jh_exchange_cards'
  | 'jh_play_card'
  | 'jh_declare_suit'
  | 'jh_steal_trick'
  | 'jh_greed_cards'
  // 서버 → 클라
  | 'jh_player_joined'
  | 'jh_waiting_player'
  | 'jh_game_start'
  | 'jh_game_state'
  | 'jh_event'
  | 'jh_game_over'
  | 'jh_opponent_disconnected'
  | 'jh_opponent_reconnected'
  | 'jh_session_expired'
  | 'jh_error';

export interface JHMessage {
  type: JHMessageType;
  payload?: unknown;
}

// 카드. 악 카드는 value 1~7, 물약은 2~5 이며 표기·비교 모두 "N+" (반 끗 위).
export interface JHCard {
  id: number;
  suit: JHSuit;
  value: number;
}

// 완성된 트릭 (2장, 공개 정보)
export interface JHTrick {
  lead: JHCard;
  follow: JHCard;
}

export interface JHRoundResult {
  round: number;
  jekyllTricks: number;
  hydeTricks: number;
  moved: number;
  marker: number;
}

export interface JHGameState {
  gameId: string;
  yourRole: JHRole;
  phase: JHPhase;
  round: number;
  marker: number;
  jekyllName: string;
  hydeName: string;

  rankOrder: JHSuit[];
  leader: JHRole;
  tableLead?: JHCard;
  tableFollow?: JHCard;
  declaredSuit?: JHSuit;

  yourHand: JHCard[];
  oppHandCount: number;

  yourTricks: JHTrick[];
  oppTricks: JHTrick[];

  yourTurn: boolean;
  legalIndices?: number[];

  exchangeCount: number;
  mustIncludePotion: boolean;
  youSubmitted: boolean;
  oppSubmitted: boolean;
  greedPickCount: number;

  roundResults: JHRoundResult[];
  opponentConnected: boolean;
}

export interface JHEvent {
  kind:
    | 'round_start'
    | 'card_played'
    | 'suit_declared'
    | 'trick_resolved'
    | 'rank_reset'
    | 'trick_stolen'
    | 'greed_exchanged'
    | 'round_result';
  role?: JHRole;
  card?: JHCard;
  leadCard?: JHCard;
  followCard?: JHCard;
  winner?: JHRole;
  effect?: JHSuit;
  suit?: JHSuit;
  trickIndex?: number;
  round?: number;
  jekyllTricks?: number;
  hydeTricks?: number;
  moved?: number;
  marker?: number;
}

export interface JHGameOver {
  winner: JHRole;
  reason: 'corrupted' | 'survived' | 'forfeit';
  marker: number;
  jekyllName: string;
  hydeName: string;
  roundResults: JHRoundResult[];
}

export interface JHPlayerJoined {
  yourRole: JHRole;
  gameId: string;
  sessionId: string;
}

// 트랙 이동 칸 수 (0 = 지킬 홈, 10 = 하이드 홈)
export const JH_TRACK_LENGTH = 10;
