// 인사이더 메시지·상태 타입 — 와이어 계약(spec-insider.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type IDRole = '' | 'master' | 'insider' | 'citizen';

export type IDPhase =
  | 'waiting'
  | 'question'
  | 'discussion'
  | 'voting'
  | 'game_over';

export type IDMessageType =
  // 클라 → 서버
  | 'id_join_game'
  | 'id_fill_bots'
  | 'id_start'
  | 'id_rejoin'
  | 'id_correct'
  | 'id_open_vote'
  | 'id_vote'
  | 'id_react'
  // 서버 → 클라
  | 'id_player_joined'
  | 'id_spectate_joined'
  | 'id_game_state'
  | 'id_event'
  | 'id_game_over'
  | 'id_player_disconnected'
  | 'id_player_reconnected'
  | 'id_session_expired'
  | 'id_error';

export interface IDMessage {
  type: IDMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 역할은 게임 종료(전원 공개) 또는 마스터(항상 공개)만 채워진다.
// votes 는 개표 후에만 실값, 그 외 0/생략.
export interface IDPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 이번 투표에서 제출을 마쳤는지 (비공개 투표 — 대상은 안 온다)
  voted: boolean;
  // '' = 미공개. 마스터는 시작부터, 나머지는 종료 시 공개.
  role?: IDRole;
  // 개표 후 득표 수
  votes?: number;
}

export type IDWinner = 'citizens' | 'insider' | 'none';

// 투표 개표·종료 결과 (phase voting 개표 후 ~ game_over)
export interface IDResult {
  insiderSeat: number;
  // 최다 득표 좌석 (동표면 마스터 지목이 결정)
  topSeat: number;
  winner: IDWinner;
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// word 는 마스터·인사이더에게만, yourRole 은 본인 것만 온다)
export interface IDGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: IDPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — question 5분 / discussion 2분 /
  // voting 45초 카운트다운 표시용
  endsAt: number;
  // 마스터 좌석 — 전원에게 공개
  masterSeat: number;
  yourRole: IDRole;
  // 제시어 — 마스터·인사이더에게만 온다 (그 외 부재)
  word?: string;
  // 예약 필드 — 정답 외친 사람은 앱이 모르므로 항상 -1 (사용 안 함)
  correctSeat?: number;
  players?: IDPlayerView[];
  result?: IDResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface IDEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// id_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over',
// 전원 역할·제시어 공개)으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface IDGameOverPayload {
  winner?: IDWinner;
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const ID_SESSION_KEY = 'id_session_id';

export const ID_MIN_PLAYERS = 4;
export const ID_MAX_PLAYERS = 8;
// id_fill_bots 는 5인까지 채우고 즉시 시작한다
export const ID_BOT_FILL_TARGET = 5;

// 역할 한글 라벨 (빈 역할은 미공개)
export const ID_ROLE_LABEL: Record<Exclude<IDRole, ''>, string> = {
  master: '마스터',
  insider: '인사이더',
  citizen: '일반인',
};

// 역할 아이콘 — 마스터 👁 / 인사이더 🕵 / 시민 🙋
export const ID_ROLE_ICON: Record<Exclude<IDRole, ''>, string> = {
  master: '👁',
  insider: '🕵',
  citizen: '🙋',
};
