export type PlayerColor = 'blue' | 'red';

export type MessageType =
  | 'join_game'
  | 'game_start'
  | 'play_tile'
  | 'tile_played'
  | 'round_result'
  | 'game_over'
  | 'timeout'
  | 'error'
  | 'player_joined'
  | 'waiting_player'
  | 'rejoin_game'
  | 'game_state'
  | 'opponent_disconnected'
  | 'opponent_reconnected'
  | 'session_expired';

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface JoinGamePayload {
  playerName: string;
  color?: PlayerColor;
}

export interface PlayTilePayload {
  tile: number;
}

export interface RoundResultPayload {
  round: number;
  blueTile: number;
  redTile: number;
  winner: PlayerColor | '';
  blueWins: number;
  redWins: number;
  nextPlayer: PlayerColor;
}

export interface GameOverPayload {
  winner: PlayerColor | '';
  blueWins: number;
  redWins: number;
}

export interface GameStartPayload {
  firstPlayer: PlayerColor;
  yourColor: PlayerColor;
  blueName: string;
  redName: string;
}

export interface ErrorPayload {
  message: string;
}

export interface TilePlayedPayload {
  color: PlayerColor;
  tile: number;
  round: number;
  nextPlayer: PlayerColor;
  waitingFor: PlayerColor;
  blueTilePlayed: boolean;
  redTilePlayed: boolean;
}

export interface RoundHistory {
  round: number;
  blueTile: number;
  redTile: number;
  winner: PlayerColor | '';
}

export interface RejoinGamePayload {
  sessionId: string;
}

export interface OpponentDisconnectedPayload {
  message: string;
  graceSeconds: number;
}

// 재접속 시 서버가 내려주는 게임 전체 상태
export interface GameStatePayload {
  gameId: string;
  yourColor: PlayerColor;
  currentRound: number;
  blueWins: number;
  redWins: number;
  blueName: string;
  redName: string;
  currentPlayer: PlayerColor;
  blueUsedTiles: number[];
  redUsedTiles: number[];
  blueRoundTile: number | null;
  redRoundTile: number | null;
  roundHistory: RoundHistory[] | null;
  opponentConnected: boolean;
}

export interface GameState {
  gameId: string | null;
  yourColor: PlayerColor | null;
  currentRound: number;
  blueWins: number;
  redWins: number;
  blueName: string; // 블루 플레이어 이름
  redName: string; // 레드 플레이어 이름
  availableTiles: number[];
  usedTiles: number[];
  opponentUsedTiles: number[]; // 상대방이 사용한 타일 히스토리
  roundHistory: RoundHistory[]; // 모든 라운드 히스토리
  currentRoundTiles: { blue?: number; red?: number }; // 현재 라운드에서 플레이된 타일
  currentPlayer: PlayerColor | null;
  isGameStarted: boolean;
  isGameOver: boolean;
  lastRoundResult: RoundResultPayload | null;
  winner: PlayerColor | '';
  error: string | null;
  isWaiting: boolean;
  opponentDisconnected: boolean; // 상대방이 재접속 대기 중인지
}
