// 스카이폴(클래식 마피아) 메시지·상태 타입 — 와이어 계약(spec-skyfall.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type SFRole = '' | 'mafia' | 'police' | 'doctor' | 'citizen';

export type SFPhase =
  | 'waiting'
  | 'night'
  | 'day_result'
  | 'day_vote'
  | 'execution'
  | 'game_over';

export type SFMessageType =
  // 클라 → 서버
  | 'sf_join_game'
  | 'sf_fill_bots'
  | 'sf_start'
  | 'sf_rejoin'
  | 'sf_night_action'
  | 'sf_vote'
  // 서버 → 클라
  | 'sf_player_joined'
  | 'sf_game_state'
  | 'sf_event'
  | 'sf_game_over'
  | 'sf_opponent_disconnected'
  | 'sf_reconnected'
  | 'sf_session_expired'
  | 'sf_error';

export interface SFMessage {
  type: SFMessageType;
  payload?: unknown;
}

export interface SFPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  alive: boolean;
  // 처형·게임 종료로 공개된 경우만 채워진다. 그 외 ''.
  role: SFRole;
}

// night 단계에서만 채워진다
export interface SFNightInfo {
  yourActionDone: boolean;
  // 아직 제출하지 않은 생존 역할자 수 — 역할 목록을 노출하면 밤 사망자의
  // 비공개 역할이 추론되므로 인원수만 온다
  pendingCount: number;
}

// 경찰에게만 — 직전 밤 조사 결과 (낮 동안 유지)
export interface SFInvestigation {
  seat: number;
  isMafia: boolean;
}

// day_result 부터의 밤 결과 발표. saved 면 seat -1 (대상 비공개).
export interface SFAnnouncement {
  kind: 'killed' | 'saved';
  seat: number;
}

// 공개 투표 — 기권은 target -1
export interface SFVoteEntry {
  voter: number;
  target: number;
}

// execution 단계 — 무처형이면 seat -1 (role 없음)
export interface SFExecution {
  seat: number;
  role?: SFRole;
}

export type SFWinner = '' | 'mafia' | 'citizen';

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// mafiaSeats 는 마피아에게만, investigation 은 경찰에게만 온다)
export interface SFGameState {
  gameId: string;
  phase: SFPhase;
  dayNo: number;
  // 밤 행동·낮 투표 마감 시각 (unixMillis, 그 외 0) — 카운트다운 표시용
  endsAt: number;
  hostSeat: number;
  yourSeat: number;
  yourRole: SFRole;
  // 마피아에게만 — 그 외에는 생략(undefined)
  mafiaSeats?: number[];
  players: SFPlayerView[];
  night?: SFNightInfo | null;
  investigation?: SFInvestigation | null;
  announcement?: SFAnnouncement | null;
  votes?: SFVoteEntry[] | null;
  execution?: SFExecution | null;
  winner: SFWinner;
}

export type SFEventKind =
  | 'joined'
  | 'left'
  | 'started'
  | 'night_begin'
  | 'day_result'
  | 'vote_begin'
  | 'executed'
  | 'no_execution'
  | 'bot_takeover'
  | 'game_over';

export interface SFEvent {
  kind: SFEventKind;
  seat?: number;
  // 서버가 실어주는 표시 이름 — 퇴장자처럼 스냅샷에서 이미 빠진 좌석용
  name?: string;
  message?: string;
}

// sf_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over',
// 전원 역할 공개)으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface SFGameOverPayload {
  winner?: SFWinner;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const SF_SESSION_KEY = 'sf_session_id';

export const SF_MIN_PLAYERS = 6;
export const SF_MAX_PLAYERS = 10;

// 역할 한글 라벨 (빈 역할은 미공개)
export const SF_ROLE_LABEL: Record<Exclude<SFRole, ''>, string> = {
  mafia: '마피아',
  police: '경찰',
  doctor: '의사',
  citizen: '시민',
};
