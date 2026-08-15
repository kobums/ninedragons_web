// 쇼텐토텐 메시지·상태 타입

export type STSide = 'south' | 'north';

export type STPhase =
  | 'lobby'
  | 'play'
  | 'claim'
  | 'draw'
  | 'recruiter_draw'
  | 'recruiter_return'
  | 'game_over';

export type STMode = 'basic' | 'tactic';

// 전술 카드 종류. undefined/'' 는 일반 클랜 카드.
export type STTactic =
  | 'joker'
  | 'spy'
  | 'shield'
  | 'blind'
  | 'mud'
  | 'recruiter'
  | 'strategist'
  | 'banshee'
  | 'traitor';

export type STMessageType =
  // 클라 → 서버
  | 'st_join_game'
  | 'st_rejoin_game'
  | 'st_play_card'
  | 'st_play_ruse'
  | 'st_claim_stone'
  | 'st_end_turn'
  | 'st_draw'
  | 'st_pass'
  | 'st_recruiter_draw'
  | 'st_recruiter_return'
  | 'st_rematch'
  // 서버 → 클라
  | 'st_player_joined'
  | 'st_waiting_player'
  | 'st_game_start'
  | 'st_game_state'
  | 'st_event'
  | 'st_game_over'
  | 'st_rematch_offer'
  | 'st_opponent_disconnected'
  | 'st_opponent_reconnected'
  | 'st_session_expired'
  | 'st_error';

export interface STMessage {
  type: STMessageType;
  payload?: unknown;
}

// 카드 한 장. 클랜 카드는 color 0~5, rank 1~9. 전술 카드는 tactic 만 유효.
export interface STCard {
  color: number;
  rank: number;
  tactic?: STTactic;
}

export interface STStoneView {
  index: number;
  yourCards: STCard[];
  oppCards: STCard[];
  owner: 'you' | 'opponent' | '';
  claimable: boolean;
  blind: boolean;
  mud: boolean;
  required: number;
}

export interface STGameState {
  gameId: string;
  yourSide: STSide;
  tacticMode: boolean;
  phase: STPhase;
  currentSide: STSide;
  deckCount: number;
  tacticDeckCount: number;
  discard?: STCard[];
  yourHand: STCard[];
  opponentHandCount: number;
  stones: STStoneView[];
  southName: string;
  northName: string;
  yourStoneCount: number;
  oppStoneCount: number;
  yourPlayedTactics: number;
  oppPlayedTactics: number;
  canPass: boolean;
  recruiterDraws: number;
  recruiterReturns: number;
  opponentConnected: boolean;
}

export interface STEvent {
  kind: 'card_played' | 'stone_claimed' | 'turn_passed' | 'ruse_played';
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

// 전술 카드 한글 이름 (툴팁·안내문용)
export const ST_TACTIC_NAMES: Record<STTactic, string> = {
  joker: '조커',
  spy: '스파이',
  shield: '방패병',
  blind: '눈가리개',
  mud: '진흙탕',
  recruiter: '모병관',
  strategist: '전략가',
  banshee: '밴시',
  traitor: '배신자',
};

// 전술 카드 축약 라벨 (카드 위 표기)
export const ST_TACTIC_LABELS: Record<STTactic, string> = {
  joker: 'J',
  spy: 'S7',
  shield: '방',
  blind: '합',
  mud: '4+',
  recruiter: '모',
  strategist: '전',
  banshee: '밴',
  traitor: '배',
};
