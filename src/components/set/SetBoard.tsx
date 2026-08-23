import { useEffect, useState } from 'react';
import type {
  SECard,
  SEColor,
  SEEvent,
  SEFill,
  SEGameState,
  SEShape,
} from '../../types/set';
import {
  SE_BOARD_BASE,
  SE_CLAIM_SIZE,
  seCardLabel,
  seLockSeconds,
} from '../../types/set';
import type { SEToast } from '../../hooks/useSetGameState';
import './SetBoard.css';

interface SetBoardProps {
  game: SEGameState;
  toasts: SEToast[];
  // 카드 3장을 고르는 즉시 호출된다 (확인 버튼 없음 — 선착순 게임이라 반응성이 전부)
  onClaim: (ids: number[]) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글).
// claim 판정은 토스트가 아니라 스냅샷 lastClaim 배너가 그린다.
function toastText(event: SEEvent, game: SEGameState): string {
  if (event.message) return event.message;
  const name = (seat?: number) =>
    // 퇴장 이벤트는 스냅샷에서 좌석이 이미 빠진 뒤라 이벤트의 name 이 우선
    (game.players ?? []).find((p) => p.seat === seat)?.name ??
    event.name ??
    '?';

  switch (event.kind) {
    case 'joined':
      return `${name(event.seat)}님이 입장했습니다`;
    case 'left':
      return `${name(event.seat)}님이 나갔습니다`;
    case 'started':
      return '게임이 시작되었습니다';
    case 'deal':
      return '🃏 세트가 없어 3장을 더 폅니다';
    case 'reshuffle':
      return '🔄 바닥을 물리고 다시 폅니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'timeout':
      return '⏳ 제한 시간이 끝났습니다';
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// 카드 그림 — 전부 인라인 SVG. 외부 에셋·이미지·폰트 글리프를 쓰지 않는다.
//
// 색약 대비: 색은 세 번째 단서일 뿐이고, 모양(뾰족한 다이아 / S자 물결 /
// 매끈한 타원)과 채움(꽉 참 / 45° 빗금 / 외곽선만)이 흑백으로도 구분된다.
// ---------------------------------------------------------------------------

const SE_COLORS: readonly SEColor[] = ['red', 'green', 'purple'] as const;

// 심볼 하나의 좌표계 — 가로로 누운 44 × 22 상자
const SYMBOL_VIEWBOX = '0 0 44 22';

// 물결(스퀴글) — 중심 (22,11) 기준 점대칭인 S자 띠.
// 위쪽 곡선을 그린 뒤 그것을 180° 돌린 곡선으로 닫는다.
const WAVE_PATH =
  'M3.3,14.3 C3.3,3.3 14.3,1.1 23.1,5.5 C29.7,8.8 35.2,9.9 40.7,7.7 ' +
  'C40.7,18.7 29.7,20.9 20.9,16.5 C14.3,13.2 8.8,12.1 3.3,14.3 Z';

// 빗금 패턴 정의 — 문서 전체에서 색당 하나씩만 두고 카드들이 공유한다.
// (카드마다 defs 를 복제하면 같은 id 가 여러 개 생겨 어느 것이 쓰일지
//  브라우저 문서 순서에 좌우된다. 보드 최상단에서 한 번만 렌더한다.)
export function SetStripeDefs() {
  return (
    <svg className="se-defs" aria-hidden="true" focusable="false">
      <defs>
        {SE_COLORS.map((color) => (
          <pattern
            key={color}
            id={`se-stripe-${color}`}
            width="4.5"
            height="4.5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            {/* 선 자신에게 색 클래스를 걸어 둔다 — 어느 svg 안에서 참조되든
                currentColor 가 늘 같은 색으로 풀린다 */}
            <line
              className={`se-stripe-line se-c-${color}`}
              x1="2.25"
              y1="0"
              x2="2.25"
              y2="4.5"
            />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

// 심볼 한 개 — 채움 3종을 fill 속성으로 갈아 끼운다
function SetSymbol({
  shape,
  fill,
  color,
}: {
  shape: SEShape;
  fill: SEFill;
  color: SEColor;
}) {
  const paint =
    fill === 'solid'
      ? 'currentColor'
      : fill === 'stripe'
        ? `url(#se-stripe-${color})`
        : 'none';

  return (
    <svg
      className="se-symbol"
      viewBox={SYMBOL_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {shape === 'diamond' && (
        <polygon
          className="se-symbol-shape"
          points="22,1.6 42.4,11 22,20.4 1.6,11"
          fill={paint}
        />
      )}
      {shape === 'oval' && (
        <ellipse
          className="se-symbol-shape"
          cx="22"
          cy="11"
          rx="20.4"
          ry="9.4"
          fill={paint}
        />
      )}
      {shape === 'wave' && (
        <path className="se-symbol-shape" d={WAVE_PATH} fill={paint} />
      )}
    </svg>
  );
}

// 카드 한 장의 그림 — 개수(1~3)만큼 같은 심볼을 세로로 쌓는다
export function SetCardFace({ card }: { card: SECard }) {
  // 서버가 범위를 벗어난 값을 보내도 레이아웃이 깨지지 않게 접는다
  const count = Math.min(3, Math.max(1, card.count));
  return (
    <span className={`se-card-face se-c-${card.color}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SetSymbol
          key={i}
          shape={card.shape}
          fill={card.fill}
          color={card.color}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------

export function SetBoard({ game, toasts, onClaim }: SetBoardProps) {
  // 로컬 선택 — 카드 id 배열. 3장이 차는 순간 자동 제출된다.
  const [selected, setSelected] = useState<number[]>([]);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지
  const [submitting, setSubmitting] = useState(false);

  const board = game.board ?? [];
  const players = game.players ?? [];
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const isPlaying = game.phase === 'playing';

  // 바닥 구성 — 카드가 한 장이라도 바뀌면 로컬 선택을 통째로 리셋한다.
  // 실시간 게임이라 내가 고르던 카드를 남이 먼저 가져갔을 수 있고,
  // 그 상태로 남은 선택을 유지하면 엉뚱한 3장이 자동 제출된다.
  const boardKey = board.map((c) => c.id).join(',');
  useEffect(() => {
    setSelected([]);
    setSubmitting(false);
  }, [boardKey]);

  // 서버 타임스탬프 기준 시계. 잠금 중에는 남은 초가 또렷하게 줄도록 빠르게 돈다.
  const [now, setNow] = useState(() => Date.now());
  const myLockedUntil = me?.lockedUntil ?? 0;
  const myLockSec = seLockSeconds(myLockedUntil, now);
  const isLocked = myLockSec > 0;
  const tickMs = isLocked ? 100 : 1000;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    // 백그라운드에선 타이머가 멈추므로 복귀 순간 서버 시각 기준으로 재동기화한다
    const sync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    sync();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, [tickMs]);

  // 내 잠금이 새로 걸리면 즉시 시계를 맞추고(오버레이가 바로 뜨도록) 선택을 비운다
  useEffect(() => {
    setNow(Date.now());
    if (myLockedUntil > Date.now()) {
      setSelected([]);
      setSubmitting(false);
    }
  }, [myLockedUntil]);

  // 내 claim 이 판정되면(성공이든 실패든) 잠금을 푼다.
  // 성공은 바닥이 바뀌어 위 효과가 처리하고, 실패는 바닥이 그대로라 여기서 처리한다.
  const claim = game.lastClaim ?? null;
  const myClaimKey =
    claim && claim.seat === game.yourSeat
      ? `${claim.ok ? 'ok' : 'no'}:${(claim.ids ?? []).join(',')}`
      : '';
  useEffect(() => {
    if (!myClaimKey) return;
    setSelected([]);
    setSubmitting(false);
  }, [myClaimKey]);

  // 서버 응답이 유실돼도 영원히 잠기지 않게 하는 안전장치
  useEffect(() => {
    if (!submitting) return;
    const timer = window.setTimeout(() => {
      setSubmitting(false);
      setSelected([]);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [submitting]);

  const canSelect = isPlaying && !isSpectator && !isLocked && !submitting;

  const handleTap = (id: number) => {
    if (!canSelect) return;
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    if (next.length > SE_CLAIM_SIZE) return;
    setSelected(next);
    // 3장을 채우는 순간 확인 없이 바로 제출한다 — 선착순이라 한 탭이라도 아깝다
    if (next.length === SE_CLAIM_SIZE) {
      setSubmitting(true);
      onClaim(next);
    }
  };

  // 강제 종료(10분 캡)까지 남은 시간
  const remaining = game.endsAt > 0 ? Math.max(0, game.endsAt - now) : 0;
  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // 좌석 스트립 — 점수 높은 순, 같으면 좌석 순
  const ranked = [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);

  // 직전 판정 배너 — 스냅샷이 바뀔 때마다 key 를 갈아 끼워 연출을 다시 돌린다
  const claimKey = claim
    ? `${claim.seat}:${claim.ok ? 'ok' : 'no'}:${(claim.ids ?? []).join(',')}:${game.setsFound}`
    : 'none';
  const claimWho = claim
    ? claim.seat === game.yourSeat
      ? '내가'
      : `${claim.name || '?'}님이`
    : '';
  const claimHeadline = claim
    ? claim.ok
      ? `✅ ${claimWho} 세트를 가져갔습니다 +1점`
      : `❌ ${claimWho} 헛짚었습니다 −1점 · 5초 잠금`
    : '';

  return (
    <div className="se-scope se-board">
      <SetStripeDefs />

      <div className="se-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="se-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 HUD — 차례가 없으므로 "누구 차례" 대신 점수·재고·시계만 둔다 */}
      <div className="se-hud">
        <span className="se-hud-title">🔺 세트 · 먼저 찾는 사람이 임자</span>
        <div className="se-hud-stats">
          <span className="se-stat">
            <span className="se-stat-label">내 점수</span>
            <strong className="se-stat-value">
              {isSpectator ? '관전' : (me?.score ?? 0)}
            </strong>
          </span>
          <span className="se-stat">
            <span className="se-stat-label">남은 카드</span>
            <strong className="se-stat-value">{game.deckLeft}</strong>
          </span>
          <span className="se-stat">
            <span className="se-stat-label">찾은 세트</span>
            <strong className="se-stat-value">{game.setsFound}</strong>
          </span>
          {game.endsAt > 0 && (
            <span className="se-stat">
              <span className="se-stat-label">⏱ 남은 시간</span>
              <strong
                className={`se-stat-value ${remaining < 60_000 ? 'urgent' : ''}`}
              >
                {mmss(remaining)}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* 직전 판정 배너 — 자리를 늘 비워 둬 결과가 떠도 그리드가 밀리지 않는다 */}
      <div className="se-claim-slot">
        {claim ? (
          <div
            key={claimKey}
            className={`se-claim-banner ${claim.ok ? 'ok' : 'fail'}`}
            role="status"
          >
            <span className="se-claim-headline">{claimHeadline}</span>
            {claim.message && (
              <span className="se-claim-sub">{claim.message}</span>
            )}
          </div>
        ) : (
          <div className="se-claim-banner idle">
            아직 아무도 세트를 찾지 못했습니다
          </div>
        )}
      </div>

      {/* 바닥 카드 그리드 — 탭하면 선택, 3장이면 자동 제출 */}
      <div className="se-grid-wrap">
        <div
          className={`se-grid ${submitting ? 'submitting' : ''} ${
            isLocked ? 'locked' : ''
          }`}
        >
          {board.map((card) => {
            const pick = selected.indexOf(card.id);
            return (
              <button
                key={card.id}
                type="button"
                className={`se-card ${pick >= 0 ? 'selected' : ''}`}
                onClick={() => handleTap(card.id)}
                disabled={!canSelect}
                aria-pressed={pick >= 0}
                aria-label={seCardLabel(card)}
                title={seCardLabel(card)}
              >
                <SetCardFace card={card} />
                {pick >= 0 && <span className="se-pick">{pick + 1}</span>}
              </button>
            );
          })}
          {board.length === 0 && (
            <p className="se-grid-empty">바닥을 펴는 중…</p>
          )}
        </div>

        {/* 잠금 오버레이 — 그리드를 덮고 남은 초를 센다 */}
        {isLocked && (
          <div className="se-lock-overlay" role="status" aria-live="polite">
            <span className="se-lock-icon" aria-hidden="true">
              🔒
            </span>
            <span className="se-lock-count">{myLockSec}</span>
            <span className="se-lock-text">초 뒤 다시 시도할 수 있습니다</span>
          </div>
        )}
      </div>

      {/* 선택 진행 안내 — 탭할 때마다 즉시 반응한다 */}
      {isSpectator ? (
        <p className="se-hint spectator">
          👀 관전 중 — 카드는 볼 수 있지만 고를 수는 없습니다
        </p>
      ) : (
        <p className={`se-hint ${submitting ? 'busy' : ''}`}>
          {submitting
            ? '판정 중…'
            : isLocked
              ? `잠금 중 — ${myLockSec}초 남았습니다`
              : `카드 3장을 고르면 자동으로 제출됩니다 · ${selected.length}/${SE_CLAIM_SIZE}`}
        </p>
      )}
      {board.length > SE_BOARD_BASE && (
        <p className="se-hint muted">
          세트가 없어 {board.length}장까지 펼쳐졌습니다
        </p>
      )}

      {/* 좌석 스트립 — 점수 순. 차례가 없으니 순위와 잠금만 보여준다 */}
      <div className="se-seats">
        {ranked.map((p) => {
          const lockSec = seLockSeconds(p.lockedUntil, now);
          const offline = !p.connected && !p.bot;
          return (
            <div
              key={p.seat}
              className={[
                'se-seat',
                p.seat === game.yourSeat ? 'me' : '',
                lockSec > 0 ? 'locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="se-seat-name">
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="se-seat-meta">
                <strong className="se-seat-score">{p.score}</strong>
                {lockSec > 0 && (
                  <span className="se-seat-lock">🔒 {lockSec}</span>
                )}
                {offline && <span className="se-seat-off">끊김</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
