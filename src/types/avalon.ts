// 아발론 메시지·상태 타입 — 와이어 계약(spec-avalon.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type AVRole = '' | 'merlin' | 'good' | 'assassin' | 'evil';

export type AVPhase =
  | 'waiting'
  | 'team_pick'
  | 'team_vote'
  | 'quest'
  | 'assassin'
  | 'game_over';

export type AVMessageType =
  // 클라 → 서버
  | 'av_join_game'
  | 'av_fill_bots'
  | 'av_start'
  | 'av_rejoin'
  | 'av_pick'
  | 'av_team_vote'
  | 'av_quest'
  | 'av_assassinate'
  // 서버 → 클라
  | 'av_player_joined'
  | 'av_game_state'
  | 'av_event'
  | 'av_game_over'
  | 'av_opponent_disconnected'
  | 'av_reconnected'
  | 'av_session_expired'
  | 'av_error';

export interface AVMessage {
  type: AVMessageType;
  payload?: unknown;
}

export interface AVPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 현재 제안/확정 원정대에 포함됐는지
  onTeam: boolean;
  // team_vote 제출 여부 (찬반 내용은 해소 후 teamVotes 로 일괄 공개)
  votedTeam: boolean;
  // quest 카드 제출 여부 (성공/실패 내용은 비공개 — 집계만 발표)
  questDone: boolean;
  // 게임 종료 공개 시만 채워진다. 그 외 ''.
  role: AVRole;
}

// team_vote 해소 후 일괄 공개되는 찬반 한 건
export interface AVTeamVote {
  voter: number;
  approve: boolean;
}

// 직전 원정 결과 발표 — 누가 실패를 냈는지는 비공개, 집계만
export interface AVQuestResult {
  fails: number;
  size: number;
}

export type AVWinner = '' | 'good' | 'evil';

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// evilSeats 는 악 진영·멀린에게만, yourRole 은 본인 것만 온다)
export interface AVGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: AVPhase;
  hostSeat: number;
  yourSeat: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — 카운트다운 표시용
  endsAt: number;
  yourRole: AVRole;
  // 악 진영 + 멀린에게만 — 그 외에는 생략(undefined)
  evilSeats?: number[];
  players: AVPlayerView[];
  // 현재 라운드 1..5
  round: number;
  // 라운드별 원정 인원 (인원수에 따른 5칸 테이블)
  questSizes: number[];
  // 완료된 라운드별 결과 ('good' = 원정 성공, 'evil' = 원정 실패)
  results: ('good' | 'evil')[];
  leaderSeat: number;
  // 연속 부결 수 0..4 — 5회째 부결이면 악 즉시 승리로 게임이 끝난다
  rejectCount: number;
  // 제안 중/확정된 원정대 좌석 목록
  team: number[];
  // team_vote 해소 후 일괄 공개 (해소 전에는 votedTeam 만)
  teamVotes?: AVTeamVote[] | null;
  lastQuest?: AVQuestResult | null;
  winner: AVWinner;
  // game_over 에서 암살자가 지목한 좌석 (지목 없으면 -1)
  assassinTarget: number;
}

// 서버 이벤트 — kind 목록은 백엔드 재량이라 열지 않고,
// 표시 문구는 서버 message 우선 + joined/left 만 클라 조립한다.
export interface AVEvent {
  kind: string;
  seat?: number;
  // 서버가 실어주는 표시 이름 — 퇴장자처럼 스냅샷에서 이미 빠진 좌석용
  name?: string;
  message?: string;
}

// av_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over',
// 전원 역할 공개)으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface AVGameOverPayload {
  winner?: AVWinner;
  // 서버가 실어주면 우선 사용 (없으면 스냅샷에서 사유를 유추)
  reason?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const AV_SESSION_KEY = 'av_session_id';

export const AV_MIN_PLAYERS = 5;
export const AV_MAX_PLAYERS = 10;

// 역할 한글 라벨 (빈 역할은 미공개) — 원시 코드 노출 금지
export const AV_ROLE_LABEL: Record<Exclude<AVRole, ''>, string> = {
  merlin: '멀린',
  good: '선의 기사',
  assassin: '암살자',
  evil: '악의 하수인',
};

export const AV_FACTION_LABEL: Record<Exclude<AVWinner, ''>, string> = {
  good: '선의 세력',
  evil: '악의 세력',
};

// 악 진영 여부 (역할 → 진영)
export function isEvilRole(role: AVRole): boolean {
  return role === 'evil' || role === 'assassin';
}
