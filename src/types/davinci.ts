// 다빈치코드 메시지·상태 타입

export type DVTileColor = 'black' | 'white';

export type DVPhase =
  | 'lobby'
  | 'joker_setup'
  | 'draw'
  | 'guess'
  | 'continue_choice'
  | 'place_drawn_joker'
  | 'reveal_own'
  | 'game_over';

export type DVMessageType =
  // 클라 → 서버
  | 'dv_join_lobby'
  | 'dv_leave_lobby'
  | 'dv_start_game'
  | 'dv_rejoin_game'
  | 'dv_place_joker'
  | 'dv_draw_tile'
  | 'dv_guess'
  | 'dv_continue_choice'
  | 'dv_reveal_own'
  // 서버 → 클라
  | 'dv_lobby_state'
  | 'dv_game_state'
  | 'dv_event'
  | 'dv_game_over'
  | 'dv_player_disconnected'
  | 'dv_player_reconnected'
  | 'dv_session_expired'
  | 'dv_error';

export interface DVMessage {
  type: DVMessageType;
  payload?: unknown;
}

// 조커 추리·값 표기용
export const DV_JOKER_VALUE = -1;

// 서버가 마스킹해 보낸 타일 뷰. 남의 비공개 타일은 value/joker 가 없다.
export interface DVTileView {
  id: number;
  color: DVTileColor;
  value?: number;
  joker?: boolean;
  revealed: boolean;
}

export interface DVPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  eliminated: boolean;
  tiles: DVTileView[];
}

export interface DVLobbyPlayer {
  seat: number;
  name: string;
  connected: boolean;
}

export interface DVLobbyState {
  gameId: string;
  yourSeat: number;
  sessionId: string;
  hostSeat: number;
  players: DVLobbyPlayer[];
  canStart: boolean;
}

export interface DVGameState {
  gameId: string;
  yourSeat: number;
  phase: DVPhase;
  currentSeat: number;
  deckCount: number;
  deckBlackCount: number;
  deckWhiteCount: number;
  playerCount: number;
  pendingJokerSeats?: number[];
  yourPendingJokers?: DVTileView[];
  drawnTile?: DVTileView;
  players: DVPlayerView[];
}

export interface DVEvent {
  kind:
    | 'game_started'
    | 'joker_placed'
    | 'tile_drawn'
    | 'guess_made'
    | 'turn_stopped'
    | 'tile_revealed'
    | 'player_eliminated'
    | 'player_forfeited';
  guesserSeat?: number;
  targetSeat?: number;
  tileIndex?: number;
  guessedValue?: number;
  correct?: boolean;
  seat?: number;
  color?: DVTileColor;
  value?: number;
}

export interface DVGameOver {
  winnerSeat: number;
  winnerName: string;
  reason: 'last_standing' | 'forfeit_win';
  players: DVPlayerView[];
}
