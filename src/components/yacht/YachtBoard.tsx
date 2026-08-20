import { useEffect, useState } from 'react';
import type {
  YTCategory,
  YTCategoryMeta,
  YTEvent,
  YTGameState,
  YTPlayerView,
} from '../../types/yacht';
import {
  YT_CATEGORIES,
  YT_MAX_ROLLS,
  YT_UPPER_BONUS,
  YT_UPPER_BONUS_THRESHOLD,
  computeYachtScore,
  ytCategoryLabel,
} from '../../types/yacht';
import type { YTToast } from '../../hooks/useYachtGameState';
import './YachtBoard.css';

interface YachtBoardProps {
  game: YTGameState;
  toasts: YTToast[];
  onRoll: (hold: boolean[]) => void;
  onScore: (category: YTCategory) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: YTEvent, game: YTGameState): string {
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
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 주사위 눈 → 3×3 그리드에서 도트가 켜지는 칸 인덱스 (0~8)
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// 주사위 한 개 — 눈금 도트 CSS 렌더 + 홀드 토글(선택 테두리)
function YTDie({
  value,
  held,
  shaking,
  onToggle,
}: {
  value: number;
  held: boolean;
  shaking: boolean;
  onToggle?: () => void;
}) {
  const pips = PIP_LAYOUT[value] ?? [];
  const face = (
    <span className="yt-die-face" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={`yt-pip-cell${pips.includes(i) ? ' on' : ''}`}
        />
      ))}
    </span>
  );
  const classes = [
    'yt-die',
    held ? 'held' : '',
    shaking && !held ? 'rolling' : '',
    onToggle ? 'clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!onToggle) {
    return (
      <div className={classes} aria-label={`주사위 ${value || '?'}`}>
        {face}
        {held && <span className="yt-die-hold-tag">홀드</span>}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      aria-pressed={held}
      aria-label={`주사위 ${value || '?'}${held ? ' — 홀드됨' : ''}`}
      onClick={onToggle}
    >
      {face}
      {held && <span className="yt-die-hold-tag">홀드</span>}
    </button>
  );
}

// 계약상 dice/held 는 항상 5개지만, 어긋난 스냅샷도 화면이 깨지지 않게 패딩
function padDice(dice?: number[]): number[] {
  const out = (dice ?? []).slice(0, 5);
  while (out.length < 5) out.push(0);
  return out;
}

function padHeld(held?: boolean[]): boolean[] {
  const out = (held ?? []).slice(0, 5).map(Boolean);
  while (out.length < 5) out.push(false);
  return out;
}

export function YachtBoard({ game, toasts, onRoll, onScore }: YachtBoardProps) {
  const players = game.players ?? [];
  const dice = padDice(game.dice);
  const serverHeld = padHeld(game.held);
  const isSpectator = game.yourSeat < 0;
  const isPlaying = game.phase === 'playing';
  const me = players.find((p) => p.seat === game.yourSeat);
  const myTurn = isPlaying && !isSpectator && game.currentSeat === game.yourSeat;
  // 이번 턴에 최소 한 번 굴렸는지 — 기록(미리보기)은 첫 굴림 뒤부터
  const hasRolled = game.rollsLeft < YT_MAX_ROLLS;

  // 홀드 로컬 선택 — 굴리기 전에 토글해 두었다가 yt_roll 에 실어 보낸다.
  // 턴/굴림이 넘어가면 서버 상태로 재동기화 (서버 held = 마지막 굴림의 홀드)
  const [held, setHeld] = useState<boolean[]>(serverHeld);
  useEffect(() => {
    setHeld(padHeld(game.held));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentSeat, game.round, game.rollsLeft]);

  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(yt_error)해도 스냅샷/턴 갱신으로 다시 풀린다.
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    setSubmitted(false);
  }, [game.currentSeat, game.round, game.rollsLeft]);

  // 굴림 애니메이션 — 굴림이 반영된 스냅샷(rollsLeft 감소)마다 CSS 셰이크
  const [shaking, setShaking] = useState(false);
  const rollSignature = `${game.round}-${game.currentSeat}-${game.rollsLeft}`;
  useEffect(() => {
    // 턴 시작 스냅샷(rollsLeft 3)은 셰이크 없음
    if (game.rollsLeft >= YT_MAX_ROLLS) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollSignature]);

  // 턴 마감 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (game.endsAt <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const sync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [game.endsAt]);
  const remaining = game.endsAt > 0 ? Math.max(0, game.endsAt - now) : 0;
  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  // 홀드 토글 — 내 턴 + 최소 1회 굴린 뒤 + 남은 굴림이 있을 때만 의미가 있다
  const canToggleHold = myTurn && hasRolled && game.rollsLeft > 0 && !submitted;
  const toggleHold = (index: number) => {
    if (!canToggleHold) return;
    setHeld((prev) => prev.map((h, i) => (i === index ? !h : h)));
  };

  const canRoll = myTurn && game.rollsLeft > 0 && !submitted;
  const handleRoll = () => {
    if (!canRoll) return;
    setSubmitted(true);
    // 첫 굴림은 홀드 없이 전부 굴린다
    onRoll(hasRolled ? held : [false, false, false, false, false]);
  };

  // 점수 기록 — 내 턴 + 최소 1회 굴린 뒤, 빈 칸만
  const canScore = myTurn && hasRolled && !submitted;
  const scoreOf = (p: YTPlayerView, category: YTCategory): number => {
    const v = p.scores?.[category];
    return typeof v === 'number' ? v : -1;
  };
  const handleScore = (category: YTCategory) => {
    if (!canScore) return;
    if (me && scoreOf(me, category) >= 0) return;
    setSubmitted(true);
    onScore(category);
  };

  // 표시용 홀드 — 내 턴엔 로컬 선택, 그 외엔 서버 상태
  const shownHeld = myTurn ? held : serverHeld;

  const lastAction = game.lastAction ?? null;

  // 상단 배너 보조 문구
  const bannerSub = myTurn
    ? !hasRolled
      ? '주사위를 굴려 턴을 시작하세요'
      : game.rollsLeft > 0
        ? '홀드할 주사위를 고르고 다시 굴리거나, 점수표의 칸을 탭해 기록하세요'
        : '점수표에서 기록할 칸을 탭하세요'
    : isPlaying
      ? `🎲 ${nameOf(game.currentSeat)}님의 차례…`
      : '';

  // 점수표 셀 하나 (플레이어 × 카테고리)
  const renderScoreCell = (p: YTPlayerView, meta: YTCategoryMeta) => {
    const isMe = p.seat === game.yourSeat;
    const isCurrent = isPlaying && p.seat === game.currentSeat;
    const value = scoreOf(p, meta.id);
    const cellClass = [
      'yt-cell',
      isCurrent ? 'current' : '',
      isMe ? 'me' : '',
    ]
      .filter(Boolean)
      .join(' ');

    // 내 차례 + 빈 칸 → 예상 점수 미리보기, 탭으로 기록
    if (isMe && value < 0 && canScore) {
      const preview = computeYachtScore(meta.id, dice);
      return (
        <td key={p.seat} className={`${cellClass} scorable`}>
          <button
            type="button"
            className="yt-score-button"
            onClick={() => handleScore(meta.id)}
            aria-label={`${meta.label}에 ${preview}점 기록`}
          >
            {preview}
          </button>
        </td>
      );
    }

    return (
      <td key={p.seat} className={cellClass}>
        {value < 0 ? (
          <span className="yt-cell-empty">—</span>
        ) : (
          <span className={`yt-cell-score${value === 0 ? ' zero' : ''}`}>
            {value}
          </span>
        )}
      </td>
    );
  };

  const upper = YT_CATEGORIES.filter((c) => c.section === 'upper');
  const lower = YT_CATEGORIES.filter((c) => c.section === 'lower');

  const categoryRow = (meta: YTCategoryMeta) => (
    <tr key={meta.id}>
      <th scope="row" className="yt-col-cat">
        <span className="yt-cat-label">{meta.label}</span>
        <span className="yt-cat-hint">{meta.hint}</span>
      </th>
      {players.map((p) => renderScoreCell(p, meta))}
    </tr>
  );

  const headCellClass = (p: YTPlayerView) =>
    [
      'yt-col-player',
      isPlaying && p.seat === game.currentSeat ? 'current' : '',
      p.seat === game.yourSeat ? 'me' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div className="yt-board">
      <div className="yt-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="yt-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="yt-phase-banner">
        <span className="yt-phase-title">
          🎲 요트 다이스 · 라운드 {game.round}
          {isPlaying && game.endsAt > 0 && (
            <span
              className={`yt-deadline ${remaining < 15_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="yt-phase-sub">{bannerSub}</span>}
        {lastAction && (
          <span className="yt-last-action">
            직전 기록: {nameOf(lastAction.seat)} —{' '}
            {ytCategoryLabel(lastAction.category) || lastAction.category}{' '}
            {lastAction.points}점
          </span>
        )}
      </div>

      {/* 주사위 5개 — 전원 공개 (관전 자유) */}
      <div className="yt-dice-panel">
        <div className="yt-dice-row">
          {dice.map((v, i) => (
            <YTDie
              key={i}
              value={v}
              held={shownHeld[i]}
              shaking={shaking}
              onToggle={canToggleHold ? () => toggleHold(i) : undefined}
            />
          ))}
        </div>

        {myTurn ? (
          <div className="yt-roll-area">
            {canToggleHold && (
              <p className="yt-roll-hint">주사위를 탭하면 홀드/해제됩니다</p>
            )}
            <button
              type="button"
              className="yt-roll-button"
              onClick={handleRoll}
              disabled={!canRoll}
            >
              {game.rollsLeft > 0
                ? `🎲 굴리기 (남은 ${game.rollsLeft}회)`
                : '굴림 소진 — 점수를 기록하세요'}
            </button>
          </div>
        ) : (
          isPlaying && (
            <p className="yt-roll-hint">
              {nameOf(game.currentSeat)}님이 굴리는 중 · 남은 굴림{' '}
              {game.rollsLeft}회
            </p>
          )
        )}
        {isSpectator && (
          <p className="yt-spectator-note">
            👀 관전 중 — 주사위와 점수표는 전원 공개입니다
          </p>
        )}
      </div>

      {/* 점수표 — 행 12칸+보너스+합계, 열 플레이어 (280px 자체 가로 스크롤) */}
      <div className="yt-table-wrap">
        <table className="yt-table">
          <thead>
            <tr>
              <th className="yt-col-cat yt-col-head">족보</th>
              {players.map((p) => (
                <th key={p.seat} className={headCellClass(p)}>
                  <span className="yt-player-name">
                    {isPlaying && p.seat === game.currentSeat && (
                      <span className="yt-turn-mark">▶</span>
                    )}
                    {p.name}
                  </span>
                  <span className="yt-player-tags">
                    {p.bot && '🤖'}
                    {p.seat === game.yourSeat && ' (나)'}
                    {!p.connected && !p.bot && ' ⚠️'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upper.map(categoryRow)}

            {/* 상단 보너스 — 63+ 이면 +35 */}
            <tr className="yt-bonus-row">
              <th scope="row" className="yt-col-cat">
                <span className="yt-cat-label">보너스</span>
                <span className="yt-cat-hint">
                  상단 {YT_UPPER_BONUS_THRESHOLD}+ → +{YT_UPPER_BONUS}
                </span>
              </th>
              {players.map((p) => (
                <td
                  key={p.seat}
                  className={[
                    'yt-cell',
                    isPlaying && p.seat === game.currentSeat ? 'current' : '',
                    p.seat === game.yourSeat ? 'me' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {p.bonus > 0 ? (
                    <span className="yt-cell-score bonus">
                      +{YT_UPPER_BONUS}
                    </span>
                  ) : (
                    <span className="yt-bonus-progress">
                      {p.upperSum}/{YT_UPPER_BONUS_THRESHOLD}
                    </span>
                  )}
                </td>
              ))}
            </tr>

            {lower.map(categoryRow)}

            {/* 합계 */}
            <tr className="yt-total-row">
              <th scope="row" className="yt-col-cat">
                <span className="yt-cat-label">합계</span>
              </th>
              {players.map((p) => (
                <td
                  key={p.seat}
                  className={[
                    'yt-cell',
                    isPlaying && p.seat === game.currentSeat ? 'current' : '',
                    p.seat === game.yourSeat ? 'me' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="yt-cell-total">{p.total}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
