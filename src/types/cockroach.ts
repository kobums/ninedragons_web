// 바퀴벌레 포커 메시지·상태 타입 — 와이어 계약(spec-cockroach.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type CRPhase = 'waiting' | 'passing' | 'deciding' | 'game_over';

export type CRMessageType =
  // 클라 → 서버
  | 'cr_join_game'
  | 'cr_fill_bots'
  | 'cr_start'
  | 'cr_rejoin'
  | 'cr_pass_card'
  | 'cr_relay'
  | 'cr_judge'
  | 'cr_react'
  // 서버 → 클라
  | 'cr_player_joined'
  | 'cr_spectate_joined'
  | 'cr_game_state'
  | 'cr_peek'
  | 'cr_event'
  | 'cr_game_over'
  | 'cr_player_disconnected'
  | 'cr_player_reconnected'
  | 'cr_session_expired'
  | 'cr_error';

export interface CRMessage {
  type: CRMessageType;
  payload?: unknown;
}

// 동물 와이어 식별자 — 서버 enum 과 공유 (coup 의 role 처럼 소문자 영문)
export type CRAnimal =
  | 'cockroach'
  | 'rat'
  | 'bat'
  | 'fly'
  | 'scorpion'
  | 'spider'
  | 'toad'
  | 'stinkbug';

export const CR_ANIMALS: readonly CRAnimal[] = [
  'cockroach',
  'rat',
  'bat',
  'fly',
  'scorpion',
  'spider',
  'toad',
  'stinkbug',
];

export interface CRAnimalMeta {
  emoji: string;
  label: string;
}

export const CR_ANIMAL_META: Record<CRAnimal, CRAnimalMeta> = {
  cockroach: { emoji: '🪳', label: '바퀴벌레' },
  rat: { emoji: '🐀', label: '쥐' },
  bat: { emoji: '🦇', label: '박쥐' },
  fly: { emoji: '🪰', label: '파리' },
  scorpion: { emoji: '🦂', label: '전갈' },
  spider: { emoji: '🕷️', label: '거미' },
  toad: { emoji: '🐸', label: '두꺼비' },
  stinkbug: { emoji: '🐞', label: '노린재' },
};

// 서버가 낯선 동물명을 보내도 화면이 깨지지 않게 하는 안전 조회
export function crAnimalMeta(animal: string | null | undefined): CRAnimalMeta {
  if (!animal) return { emoji: '❓', label: '?' };
  return CR_ANIMAL_META[animal as CRAnimal] ?? { emoji: '❓', label: animal };
}

// 받침 유무에 따른 인용 조사 — "쥐라고 합니다" / "전갈이라고 합니다"
export function crClaimText(animal: string | null | undefined): string {
  const { label } = crAnimalMeta(animal);
  const last = label.charCodeAt(label.length - 1);
  const hasJong =
    last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 > 0;
  return `${label}${hasJong ? '이' : ''}라고 합니다`;
}

// 좌석 뷰 — 손패 실물은 본인만(yourHand), 타인은 장수(handCount)만 공개.
// 진열(display)은 전원 공개: 동물명 → 개수.
export interface CRPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  handCount: number;
  // 공개 진열 — 서버 회귀 대비 ?? {} 방어 필수
  display?: Record<string, number>;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷
export interface CRGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: CRPhase;
  hostSeat: number;
  yourSeat: number;
  spectators?: number;
  // 턴 마감 시각 (unixMillis, 없으면 0) — AFK 카운트다운 표시용
  endsAt: number;
  // 원 전달자 (이번 릴레이를 시작한 사람)
  passerSeat: number;
  // 현재 결정권자 (카드를 받아 판정/넘기기를 고르는 사람)
  holderSeat: number;
  // 현재 선언된 동물 (deciding 에만 의미)
  claim?: string;
  // 경유 좌석들 — 서버 회귀 대비 ?? [] 방어 필수
  chain?: number[];
  // 내 손패 실물 (본인만, 관전자·타인은 생략) — ?? [] 방어 필수
  yourHand?: string[];
  players?: CRPlayerView[];
  // 패자 좌석 (-1 = 아직 없음)
  loserSeat: number;
  loseReason?: string;
}

// cr_peek payload — 넘기기 선택자에게만 릴레이 카드 실물 공개
export interface CRPeekPayload {
  animal?: string;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface CREvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// cr_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')
// 으로 그리고, 이 페이로드는 신호+패자 보조로만 쓴다. 전부 방어적 옵셔널.
export interface CRGameOverPayload {
  loserSeat?: number;
  loserName?: string;
  loseReason?: string;
  winnerSeats?: number[];
  winners?: string[];
  message?: string;
}

// 패배 사유 와이어 값 → 짧은 한글 라벨. 알 수 없는 값은 그대로 노출한다.
export function crLoseReasonText(reason: string | null | undefined): string {
  switch (reason) {
    case 'four_same':
    case 'four_of_a_kind':
    case 'four':
    case 'display_four':
      return '같은 동물 4장';
    case 'empty_hand':
    case 'hand_empty':
    case 'no_cards':
    case 'out_of_cards':
      return '손패 소진';
    default:
      return reason ?? '';
  }
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const CR_SESSION_KEY = 'cr_session_id';

export const CR_MIN_PLAYERS = 3;
export const CR_MAX_PLAYERS = 6;
// cr_fill_bots 는 4인까지 채우고 즉시 시작한다
export const CR_BOT_FILL_TARGET = 4;

// 진열 경고 기준 — 3장이면 경고색, 4장이면 즉시 패배
export const CR_WARN_COUNT = 3;
export const CR_LOSE_COUNT = 4;
