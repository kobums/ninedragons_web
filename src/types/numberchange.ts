export type TeamColor = 'team1' | 'team2';

export type NCMessageType =
  | 'nc_join_game'
  | 'nc_game_start'
  | 'nc_submit_blocks'
  | 'nc_select_block'
  | 'nc_round_result'
  | 'nc_game_over'
  | 'nc_error'
  | 'nc_player_joined'
  | 'nc_waiting_player'
  | 'nc_use_hidden';

export interface NCMessage {
  type: NCMessageType;
  payload?: any;
}

export interface NCJoinGamePayload {
  playerName: string;
  team?: TeamColor;
}

export interface NCSubmitBlocksPayload {
  block1: number;
  block2: number;
  useHidden?: boolean;
  selectedBlockChoice?: number; // 히든 사용 시 선택 (1: 블록1, 2: 블록2)
}

export interface NCRoundResultPayload {
  round: number;
  team1Block1: number;
  team1Block2: number;
  team1Total: number;
  team2Block1: number;
  team2Block2: number;
  team2Total: number;
  winner: TeamColor | '';
  team1Score: number;
  team2Score: number;
  team1Hidden: boolean;
  team2Hidden: boolean;
  // 교환된 블록 정보
  team1ReceivedBlock: number;
  team2ReceivedBlock: number;
  nextTeam: TeamColor;
}

export interface NCGameOverPayload {
  winner: TeamColor | '';
  team1Score: number;
  team2Score: number;
  reason: 'score_limit' | 'rounds_complete' | 'overtime';
}

export interface NCGameStartPayload {
  yourTeam: TeamColor;
  firstTeam: TeamColor;
  team1Name: string;
  team2Name: string;
}

export interface NCErrorPayload {
  message: string;
}

export interface NCRoundHistory {
  round: number;
  team1Block1: number;
  team1Block2: number;
  team1Total: number;
  team2Block1: number;
  team2Block2: number;
  team2Total: number;
  winner: TeamColor | '';
  team1Hidden: boolean;
  team2Hidden: boolean;
}

export interface NCGameState {
  gameId: string | null;
  yourTeam: TeamColor | null;
  currentRound: number;
  team1Score: number;
  team2Score: number;
  team1Name: string; // 팀1 플레이어 이름
  team2Name: string; // 팀2 플레이어 이름
  availableBlocks: number[]; // 내 팀의 사용 가능한 블록
  usedBlocks: number[]; // 내 팀이 사용한 블록
  opponentAvailableBlocks: number[]; // 추정되는 상대 팀 블록 (공개된 정보 기반)
  roundHistory: NCRoundHistory[];
  currentTeam: TeamColor | null;
  isGameStarted: boolean;
  isGameOver: boolean;
  winner: TeamColor | '';
  error: string | null;
  isWaiting: boolean;
  hasUsedHidden: boolean; // 내 팀이 히든 찬스를 사용했는지
  opponentHasUsedHidden: boolean; // 상대 팀이 히든 찬스를 사용했는지
  selectedBlock1Index: number | null; // 선택한 블록1의 인덱스
  selectedBlock2Index: number | null; // 선택한 블록2의 인덱스
  hasSubmitted: boolean; // 내가 이번 라운드에 제출했는지
  opponentUsedHiddenNotification: boolean; // 상대가 히든 사용 알림 표시 여부
  opponentUsedHiddenThisRound: boolean; // 상대가 이번 라운드에 히든 사용했는지
  showHiddenBlockSelection: boolean; // 히든 사용 시 블록 선택 UI 표시 여부
  selectedBlockChoice: number | null; // 히든 사용 시 선택 (1: 블록1, 2: 블록2)
  pendingSubmitUseHidden: boolean | null; // 제출 대기 중인 히든 옵션
}
