// 저스트 원 메시지·상태 타입 — 와이어 계약(spec-justone.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

// 단계 — 단서 60초 → 자동 소거 → 추리 60초 → 판정(인정 창 15초) → 라운드 종료
export type JOPhase =
  | 'waiting'
  | 'clue'
  | 'guess'
  | 'judging'
  | 'round_end'
  | 'game_over';

export type JOMessageType =
  // 클라 → 서버
  | 'jo_join_game'
  | 'jo_fill_bots'
  | 'jo_start'
  | 'jo_rejoin'
  | 'jo_clue'
  | 'jo_guess'
  | 'jo_pass'
  | 'jo_accept'
  | 'jo_react'
  // 서버 → 클라
  | 'jo_player_joined'
  | 'jo_spectate_joined'
  | 'jo_game_state'
  | 'jo_event'
  | 'jo_game_over'
  | 'jo_player_disconnected'
  | 'jo_player_reconnected'
  | 'jo_session_expired'
  | 'jo_error';

export interface JOMessage {
  type: JOMessageType;
  payload?: unknown;
}

// 공개된 단서 한 줄 — removed 면 자동 소거(겹침·제시어 포함·빈 단서)된 것.
// 단서 단계에는 서버가 항상 빈 배열을 보내므로 남의 단서가 새지 않는다.
export interface JOClue {
  seat: number;
  name: string;
  text: string;
  removed: boolean;
}

// 좌석 뷰 — submitted 는 "이번 라운드 단서를 냈는가", isGuesser 는 출제자 여부
export interface JOPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  submitted: boolean;
  isGuesser: boolean;
}

// 판정 결과 — accepted 는 인정 창에서 누군가 정답으로 인정해 준 경우
export interface JOJudged {
  correct: boolean;
  accepted: boolean;
  message?: string;
}

// 라운드별 기록 — 종료 화면 표에 그대로 쓴다
export interface JOHistoryEntry {
  round: number;
  word: string;
  guess: string;
  correct: boolean;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// word 는 단서 제공자에게만, yourClue 는 본인에게만 온다. 출제자·관전자의
// raw JSON 에는 word 키 자체가 없다)
export interface JOGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: JOPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — 단서·추리 60초 / 인정 창 15초
  endsAt: number;
  // 1부터. 총 라운드 수 = 인원 × 2
  round: number;
  totalRounds: number;
  // 이번 라운드 출제자 좌석
  guesserSeat: number;
  // 협력 점수 (정답 +1 / 오답 −1, 0 미만으로 내려가지 않음)
  score: number;
  // 제시어 — 단서 제공자만. 출제자·관전자는 키 부재.
  word?: string;
  // 본인이 낸 단서 (본인만, 미제출이면 '')
  yourClue?: string;
  // guess 단계부터 공개. 그 전에는 빈 배열.
  clues?: JOClue[];
  // 단서를 낸 인원 수 (단서 단계 진척 표시용)
  submittedCount: number;
  // 출제자가 제출한 답 (없으면 '')
  guess?: string;
  judged?: JOJudged | null;
  players?: JOPlayerView[];
  history?: JOHistoryEntry[];
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface JOEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// jo_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(총점·history)으로
// 그리고, 이 페이로드는 신호 + 총평 보조로만 쓴다.
export interface JOGameOverPayload {
  score?: number;
  totalRounds?: number;
  message?: string;
  history?: JOHistoryEntry[];
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const JO_SESSION_KEY = 'jo_session_id';

export const JO_MIN_PLAYERS = 3;
export const JO_MAX_PLAYERS = 7;
// jo_fill_bots 는 4인까지 채우고 즉시 시작한다
export const JO_BOT_FILL_TARGET = 4;

// 서버가 자르는 단서·답 길이 상한 — 입력창 maxLength 와 카운터에 함께 쓴다
export const JO_TEXT_MAX_LEN = 12;

// 총 라운드 수 = 인원 × 2 (서버 totalRounds 가 없을 때의 안내용 폴백)
export const joTotalRounds = (playerCount: number): number =>
  Math.max(0, playerCount) * 2;

// 서버와 같은 정규화 — 앞뒤 공백 제거 → 내부 공백 제거 → 소문자화.
// 클라에서는 "제시어와 같은 단어" 같은 사전 경고에만 쓰고, 판정은 서버가 한다.
export const joNormalize = (text: string): string =>
  text.trim().replace(/\s+/g, '').toLowerCase();

// 총점 등급 — 만점 / 우수 / 보통 / 재도전
export interface JOGrade {
  key: 'perfect' | 'great' | 'good' | 'retry';
  mark: string;
  label: string;
  message: string;
}

export const joGrade = (score: number, totalRounds: number): JOGrade => {
  const total = Math.max(1, totalRounds);
  const ratio = Math.max(0, score) / total;
  if (totalRounds > 0 && score >= totalRounds) {
    return {
      key: 'perfect',
      mark: '🏆',
      label: '만점',
      message: '한 라운드도 놓치지 않았습니다 — 완벽한 호흡이었어요',
    };
  }
  if (ratio >= 0.7) {
    return {
      key: 'great',
      mark: '✨',
      label: '우수',
      message: '겹치지 않으면서도 통하는 단서를 잘 골랐습니다',
    };
  }
  if (ratio >= 0.4) {
    return {
      key: 'good',
      mark: '🙂',
      label: '보통',
      message: '나쁘지 않아요 — 조금만 더 색다른 단어를 노려 보세요',
    };
  }
  return {
    key: 'retry',
    mark: '✏️',
    label: '재도전',
    message: '단서가 자꾸 겹쳤네요 — 다음 판에서 설욕해 보세요',
  };
};
