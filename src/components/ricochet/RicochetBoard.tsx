import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type {
  RRCell,
  RRColor,
  RRDir,
  RREvent,
  RRGameState,
  RRMove,
} from '../../types/ricochet';
import {
  RR_BOARD_SIZE,
  RR_COLORS,
  RR_COLOR_GLYPH,
  RR_COLOR_LABEL,
  RR_COLOR_MARK,
  RR_DIRS,
  RR_DIR_ARROW,
  RR_DIR_LABEL,
  RR_MAX_BID,
  RR_MIN_BID,
  RR_WALL_BIT,
  rrApplyMoves,
  rrBids,
  rrCellKey,
  rrCellLabel,
  rrGoal,
  rrIsBlocked,
  rrPath,
  rrReached,
  rrRobots,
  rrSlide,
  rrWalls,
} from '../../types/ricochet';
import type { RRToast } from '../../hooks/useRicochetGameState';
import './RicochetBoard.css';

interface RicochetBoardProps {
  game: RRGameState;
  toasts: RRToast[];
  onBid: (moves: number) => void;
  onDemo: (moves: RRMove[]) => void;
  onPass: () => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: RREvent, game: RRGameState): string {
  if (event.message) return event.message;
  const name = (seat?: number) =>
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
    case 'goal_start':
      return `🎯 ${game.goalIndex + 1}번째 목표가 열렸습니다`;
    case 'bid':
      return `${name(event.seat)}님이 외쳤습니다`;
    case 'demo_start':
      return `${name(event.seat)}님이 증명을 시작합니다`;
    case 'pass':
      return `${name(event.seat)}님이 증명을 포기했습니다`;
    case 'timeout':
      return '⏳ 시간이 지나 다음 목표로 넘어갑니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// 칸의 벽 비트 → 굵은 선. 네 방향이 겹칠 수 있어 box-shadow 를 합쳐 쓴다.
const wallShadow = (bits: number, px: number): string => {
  const parts: string[] = [];
  if (bits & RR_WALL_BIT.up) parts.push(`inset 0 ${px}px 0 0 var(--rr-wall)`);
  if (bits & RR_WALL_BIT.right)
    parts.push(`inset -${px}px 0 0 0 var(--rr-wall)`);
  if (bits & RR_WALL_BIT.down)
    parts.push(`inset 0 -${px}px 0 0 var(--rr-wall)`);
  if (bits & RR_WALL_BIT.left) parts.push(`inset ${px}px 0 0 0 var(--rr-wall)`);
  return parts.join(', ');
};

interface RRGhost {
  dir: RRDir;
  // 못 가는 방향이면 null
  to: RRCell | null;
  path: RRCell[];
}

export function RicochetBoard({
  game,
  toasts,
  onBid,
  onDemo,
  onPass,
}: RicochetBoardProps) {
  const players = game.players ?? [];
  const bids = useMemo(() => rrBids(game), [game]);
  const walls = useMemo(() => rrWalls(game), [game]);
  const baseRobots = useMemo(() => rrRobots(game), [game]);
  const goal = useMemo(() => rrGoal(game), [game]);
  const isSpectator = game.yourSeat < 0;

  // 고른 로봇 — 고르면 네 방향 도착 지점을 고스트로 미리 보여준다
  const [selected, setSelected] = useState<RRColor | null>(null);
  // 로컬 이동 목록. 증명 중이면 그대로 제출할 수(手)고, 그 외 단계에서는
  // "몇 수에 되는지" 세어 보는 연습이다 (서버 판은 그대로다).
  const [moves, setMoves] = useState<RRMove[]>([]);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지
  const [submitted, setSubmitted] = useState(false);

  // 스냅샷 컨텍스트(목표·단계·증명자)가 바뀌면 로컬 선택을 통째로 리셋한다.
  // 남아 있던 이동이 다음 판에서 엉뚱하게 제출되지 않도록.
  useEffect(() => {
    setSelected(null);
    setMoves([]);
    setSubmitted(false);
  }, [game.goalIndex, game.phase, game.demoSeat]);

  // 서버 응답이 유실돼도 영원히 잠기지 않게 하는 안전장치
  useEffect(() => {
    if (!submitted) return;
    const timer = window.setTimeout(() => setSubmitted(false), 2500);
    return () => window.clearTimeout(timer);
  }, [submitted]);

  // 단계 마감 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (game.endsAt <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const sync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    sync();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, [game.endsAt]);
  const remaining = game.endsAt > 0 ? Math.max(0, game.endsAt - now) : 0;

  // 칸 크기 — 16×16 을 가로 스크롤 없이 한 화면에 넣으려면 칸이 얼마나
  // 작아져야 하는지 실제 폭을 재서 정한다 (글자·고스트 크기가 여기 붙는다).
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [cell, setCell] = useState(20);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () =>
      setCell(Math.max(8, Math.floor(el.clientWidth / RR_BOARD_SIZE)));
    update();
    window.addEventListener('resize', update);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(el);
    }
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, []);
  const wallPx = Math.max(2, Math.round(cell * 0.14));
  // 칸이 아주 작아지면(280px 화면) 한글 글자가 뭉개진다 — 그때는 색마다 다른
  // 무늬로 바꿔 단다. 어느 쪽이든 색만으로 구분되지는 않는다.
  const tinyCells = cell < 18;

  const isDemoPhase = game.phase === 'demo';
  const isMyDemo = isDemoPhase && !isSpectator && game.demoSeat === game.yourSeat;
  const canPractice =
    !isSpectator && (game.phase === 'thinking' || game.phase === 'bidding');
  // 로봇을 실제로 움직여 볼 수 있는가 (관전자는 보기만 한다)
  const canMove = isMyDemo ? !submitted : canPractice;

  // 로컬 이동을 적용한 현재 배치
  const robots = useMemo(
    () => rrApplyMoves(walls, baseRobots, moves),
    [walls, baseRobots, moves],
  );

  // 고른 로봇의 네 방향 도착 지점 — 이 게임을 이해시키는 핵심 장치
  const ghosts: RRGhost[] = useMemo(() => {
    if (!selected) return [];
    const from = robots[selected];
    if (!from) return [];
    return RR_DIRS.map((dir) => {
      const to = rrSlide(walls, robots, selected, dir);
      // 도착 지점이 지금 자리와 같으면 그 방향으로는 못 간다
      if (!to || (to.r === from.r && to.c === from.c)) {
        return { dir, to: null, path: [] };
      }
      return { dir, to, path: rrPath(from, to, dir) };
    });
  }, [selected, robots, walls]);

  // 칸 → 고스트/경로 조회표
  const ghostAt = useMemo(() => {
    const map = new Map<string, RRDir>();
    for (const g of ghosts) {
      if (g.to) map.set(rrCellKey(g.to.r, g.to.c), g.dir);
    }
    return map;
  }, [ghosts]);

  const pathAt = useMemo(() => {
    const set = new Set<string>();
    for (const g of ghosts) {
      for (const cellOnPath of g.path) {
        set.add(rrCellKey(cellOnPath.r, cellOnPath.c));
      }
    }
    return set;
  }, [ghosts]);

  const robotAt = useMemo(() => {
    const map = new Map<string, RRColor>();
    for (const color of RR_COLORS) {
      const at = robots[color];
      if (at) map.set(rrCellKey(at.r, at.c), color);
    }
    return map;
  }, [robots]);

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  const lowestBid = bids.length > 0 ? bids[0].moves : null;
  const myBid = bids.find((b) => b.seat === game.yourSeat) ?? null;
  const demoBid = bids.find((b) => b.seat === game.demoSeat) ?? null;
  const declared = demoBid?.moves ?? null;
  const reached = rrReached(robots, goal);

  // 외침 스테퍼 — 기존 최저 외침보다 낮아야 의미가 있다
  const maxBid = lowestBid !== null ? lowestBid - 1 : RR_MAX_BID;
  const canBidAtAll =
    !isSpectator &&
    (game.phase === 'thinking' || game.phase === 'bidding') &&
    maxBid >= RR_MIN_BID;
  const [bidValue, setBidValue] = useState(RR_MIN_BID + 1);

  // 목표가 바뀌거나 최저 외침이 내려가면 스테퍼 기본값을 다시 잡는다
  useEffect(() => {
    setBidValue((prev) => {
      const cap = lowestBid !== null ? lowestBid - 1 : RR_MAX_BID;
      if (cap < RR_MIN_BID) return RR_MIN_BID;
      return Math.min(Math.max(prev, RR_MIN_BID), cap);
    });
  }, [lowestBid, game.goalIndex]);

  const applyMove = (color: RRColor, dir: RRDir) => {
    if (!canMove) return;
    const to = rrSlide(walls, robots, color, dir);
    const from = robots[color];
    if (!to || !from) return;
    if (to.r === from.r && to.c === from.c) return;
    setMoves((prev) => [...prev, { robot: color, dir }]);
    setSelected(color);
  };

  const handleCellClick = (r: number, c: number) => {
    const key = rrCellKey(r, c);
    const robot = robotAt.get(key);
    if (robot) {
      setSelected((prev) => (prev === robot ? null : robot));
      return;
    }
    const dir = ghostAt.get(key);
    if (dir && selected && canMove) applyMove(selected, dir);
  };

  const handleUndo = () => {
    setMoves((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setMoves([]);
  };

  const handleSubmitDemo = () => {
    if (!isMyDemo || submitted || moves.length === 0) return;
    setSubmitted(true);
    onDemo(moves);
  };

  const headline = (() => {
    switch (game.phase) {
      case 'thinking':
        return '🎯 푸는 중 — 몇 수에 되는지 찾아 외치세요';
      case 'bidding':
        return `⏱ 외침 접수 중 — 최저 ${lowestBid ?? 0}수`;
      case 'demo':
        return isMyDemo
          ? `🤖 내 증명 — 외친 ${declared ?? 0}수 안에 목표까지`
          : `🤖 ${nameOf(game.demoSeat)}님이 증명 중입니다`;
      case 'goal_end':
        return '🎯 목표 정리 중 — 곧 다음 판이 열립니다';
      default:
        return '리코셰 로봇';
    }
  })();

  const subline = (() => {
    if (isSpectator) return '관전 중 — 판과 외침을 볼 수 있지만 참여할 수는 없습니다';
    switch (game.phase) {
      case 'thinking':
        return '로봇을 눌러 갈 수 있는 곳을 미리 보고, 수를 세어 외치세요';
      case 'bidding':
        return '카운트다운이 끝나면 가장 낮게 외친 사람이 증명합니다';
      case 'demo':
        return isMyDemo
          ? '되돌리기로 얼마든지 고쳐도 됩니다 — 제출할 때만 판정합니다'
          : '실패하면 그다음으로 낮게 외친 사람이 증명합니다';
      default:
        return '로봇은 벽이나 다른 로봇에 막힐 때까지 미끄러집니다';
    }
  })();

  const gridStyle = {
    '--rr-cell': `${cell}px`,
  } as CSSProperties;

  return (
    <div className="rr-scope rr-board">
      <div className="rr-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="rr-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 — 진행 / 단계 / 카운트다운 */}
      <div className={`rr-status-bar ${game.phase}`}>
        <div className="rr-status-row">
          <span className="rr-status-chip">
            목표 {Math.min(game.goalIndex + 1, game.goalTotal)}/{game.goalTotal}
          </span>
          {goal && (
            <span className={`rr-status-goal rr-c-${goal.color}`}>
              🎯 {RR_COLOR_LABEL[goal.color]} → {rrCellLabel(goal)}
            </span>
          )}
          {game.endsAt > 0 && (
            <span className={`rr-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="rr-status-title">{headline}</span>
        <span className="rr-status-sub">{subline}</span>
      </div>

      {/* 외침 현황 — 낮은 순. 전원 공개다. */}
      <div className="rr-bids">
        <span className="rr-bids-label">외침</span>
        {bids.length === 0 ? (
          <span className="rr-bids-empty">아직 아무도 외치지 않았습니다</span>
        ) : (
          <ul className="rr-bid-list">
            {bids.map((bid, i) => (
              <li
                key={bid.seat}
                className={`rr-bid ${i === 0 ? 'lowest' : ''} ${
                  bid.seat === game.demoSeat ? 'demoing' : ''
                } ${bid.seat === game.yourSeat ? 'mine' : ''}`}
              >
                <span className="rr-bid-name">
                  {i === 0 && '🥇 '}
                  {nameOf(bid.seat)}
                  {bid.seat === game.yourSeat && ' (나)'}
                </span>
                <strong className="rr-bid-moves">{bid.moves}수</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 직전 증명 결과 — 자리를 늘 비워 둬 아래가 밀리지 않는다 */}
      <div className="rr-last-slot">
        {game.lastResult ? (
          <div
            className={`rr-last ${game.lastResult.ok ? 'ok' : 'fail'}`}
            role="status"
          >
            <strong>{game.lastResult.name || nameOf(game.lastResult.seat)}</strong>
            <span>
              {game.lastResult.message ??
                `${game.lastResult.moves}수 증명 ${
                  game.lastResult.ok ? '성공 — 목표 획득' : '실패'
                }`}
            </span>
          </div>
        ) : (
          <div className="rr-last idle">
            로봇은 벽이나 다른 로봇에 막힐 때까지 미끄러집니다
          </div>
        )}
      </div>

      {/* 16×16 판 — 가로 스크롤 없이 한 화면에 정사각으로 */}
      <div className="rr-grid-frame" ref={frameRef} style={gridStyle}>
        <div
          className="rr-grid"
          role="group"
          aria-label={`${RR_BOARD_SIZE}×${RR_BOARD_SIZE} 판`}
        >
          {Array.from({ length: RR_BOARD_SIZE }, (_, r) =>
            Array.from({ length: RR_BOARD_SIZE }, (_, c) => {
              const key = rrCellKey(r, c);
              const robot = robotAt.get(key);
              const ghostDir = ghostAt.get(key);
              const onPath = pathAt.has(key);
              const blocked = rrIsBlocked(r, c);
              const isGoalCell = !!goal && goal.r === r && goal.c === c;
              const shadow = wallShadow(walls[r][c], wallPx);
              const clickable =
                !!robot || (!!ghostDir && !!selected && canMove);

              const inner = (
                <>
                  {isGoalCell && goal && (
                    <span
                      className={`rr-goal-ring rr-c-${goal.color}`}
                      aria-hidden="true"
                    >
                      {!robot && (
                        <span className="rr-goal-mark">
                          {RR_COLOR_MARK[goal.color]}
                        </span>
                      )}
                    </span>
                  )}
                  {robot && (
                    <span
                      className={`rr-robot rr-c-${robot} ${
                        selected === robot ? 'sel' : ''
                      }`}
                    >
                      {tinyCells
                        ? RR_COLOR_MARK[robot]
                        : RR_COLOR_GLYPH[robot]}
                    </span>
                  )}
                  {!robot && ghostDir && selected && (
                    <span
                      className={`rr-ghost rr-c-${selected}`}
                      aria-hidden="true"
                    >
                      {RR_DIR_ARROW[ghostDir]}
                    </span>
                  )}
                </>
              );

              const className = `rr-cell${blocked ? ' blocked' : ''}${
                onPath ? ' path' : ''
              }${isGoalCell ? ' goal' : ''}${ghostDir ? ' ghost-cell' : ''}`;

              const label = robot
                ? `${RR_COLOR_LABEL[robot]} 로봇 ${rrCellLabel({ r, c })}`
                : ghostDir && selected
                  ? `${RR_COLOR_LABEL[selected]} 로봇 ${RR_DIR_LABEL[ghostDir]}으로 ${rrCellLabel({ r, c })}까지`
                  : rrCellLabel({ r, c });

              return clickable ? (
                <button
                  type="button"
                  key={key}
                  className={className}
                  style={{ boxShadow: shadow || undefined }}
                  aria-label={label}
                  onClick={() => handleCellClick(r, c)}
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={key}
                  className={className}
                  style={{ boxShadow: shadow || undefined }}
                  title={label}
                >
                  {inner}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {/* 방향 조작 — 판의 칸이 작아지므로 큰 버튼을 따로 둔다 (44px 이상) */}
      <div className="rr-controls">
        <div className="rr-pick-row">
          {RR_COLORS.map((color) => {
            const at = robots[color];
            return (
              <button
                key={color}
                type="button"
                className={`rr-pick rr-c-${color} ${
                  selected === color ? 'sel' : ''
                }`}
                disabled={!at}
                aria-pressed={selected === color}
                onClick={() =>
                  setSelected((prev) => (prev === color ? null : color))
                }
              >
                <span className="rr-robot sm">{RR_COLOR_GLYPH[color]}</span>
                <span className="rr-pick-where">
                  {at ? rrCellLabel(at) : '—'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rr-dir-row">
          {RR_DIRS.map((dir) => {
            const ghost = ghosts.find((g) => g.dir === dir) ?? null;
            const blockedDir = !selected || !ghost || !ghost.to;
            return (
              <button
                key={dir}
                type="button"
                className="rr-dir"
                disabled={blockedDir || !canMove}
                aria-label={`${RR_DIR_LABEL[dir]}으로 이동`}
                onClick={() => selected && applyMove(selected, dir)}
              >
                <span className="rr-dir-arrow">{RR_DIR_ARROW[dir]}</span>
                <span className="rr-dir-label">
                  {ghost?.to ? rrCellLabel(ghost.to) : '못 감'}
                </span>
              </button>
            );
          })}
        </div>

        {!selected && (
          <p className="rr-hint">
            로봇을 누르면 네 방향으로 어디까지 미끄러지는지 고스트로 미리
            보여줍니다
          </p>
        )}

        {/* 이동 기록 + 실행 취소 */}
        {!isSpectator && (
          <div className="rr-move-bar">
            <span className="rr-move-count">
              {isMyDemo ? '증명' : '연습'} {moves.length}수
              {declared !== null && isMyDemo ? ` / 외침 ${declared}수` : ''}
              {reached && <span className="rr-reached"> · 목표 도달 ✓</span>}
            </span>
            <div className="rr-move-actions">
              <button
                type="button"
                className="rr-ghost-button"
                onClick={handleUndo}
                disabled={moves.length === 0}
              >
                ↶ 되돌리기
              </button>
              <button
                type="button"
                className="rr-ghost-button"
                onClick={handleClear}
                disabled={moves.length === 0}
              >
                처음으로
              </button>
            </div>
          </div>
        )}

        {!isSpectator && moves.length > 0 && !isMyDemo && (
          <p className="rr-hint">
            연습 이동입니다 — 실제 판은 그대로이고 아무에게도 보이지 않습니다
          </p>
        )}
      </div>

      {/* 하단 — 증명 제출 또는 외침 입력 (관전자에게는 아무것도 없다) */}
      {!isSpectator && isMyDemo && (
        <div className="rr-action-bar demo">
          <p className="rr-action-title">
            외친 {declared ?? 0}수 이하로 목표에 닿으면 성공입니다
          </p>
          {declared !== null && moves.length > declared && (
            <p className="rr-action-warn">
              외침보다 {moves.length - declared}수 많습니다 — 되돌리기로 줄이세요
            </p>
          )}
          <div className="rr-action-buttons">
            <button
              type="button"
              className="rr-primary-button"
              onClick={handleSubmitDemo}
              disabled={submitted || moves.length === 0}
            >
              {submitted ? '제출 중...' : `${moves.length}수 제출`}
            </button>
            <button
              type="button"
              className="rr-ghost-button"
              onClick={onPass}
              disabled={submitted}
            >
              포기
            </button>
          </div>
        </div>
      )}

      {!isSpectator && !isMyDemo && (game.phase === 'thinking' || game.phase === 'bidding') && (
        <div className="rr-action-bar bid">
          <p className="rr-action-title">
            {myBid
              ? `내 외침 ${myBid.moves}수 — 더 낮게 다시 외칠 수 있습니다`
              : '몇 수에 풀 수 있습니까?'}
          </p>
          {canBidAtAll ? (
            <>
              <div className="rr-stepper">
                <button
                  type="button"
                  className="rr-step"
                  aria-label="한 수 줄이기"
                  onClick={() =>
                    setBidValue((v) => Math.max(RR_MIN_BID, v - 1))
                  }
                  disabled={bidValue <= RR_MIN_BID}
                >
                  −
                </button>
                <span className="rr-step-value" aria-live="polite">
                  {bidValue}수
                </span>
                <button
                  type="button"
                  className="rr-step"
                  aria-label="한 수 늘리기"
                  onClick={() => setBidValue((v) => Math.min(maxBid, v + 1))}
                  disabled={bidValue >= maxBid}
                >
                  +
                </button>
              </div>
              <div className="rr-action-buttons">
                <button
                  type="button"
                  className="rr-primary-button"
                  onClick={() => onBid(bidValue)}
                >
                  {bidValue}수 외치기
                </button>
                {moves.length >= RR_MIN_BID && moves.length <= maxBid && (
                  <button
                    type="button"
                    className="rr-ghost-button"
                    onClick={() => onBid(moves.length)}
                  >
                    연습한 {moves.length}수로 외치기
                  </button>
                )}
              </div>
              {lowestBid !== null && (
                <p className="rr-action-note">
                  지금 최저는 {lowestBid}수 — {maxBid}수 이하로만 외칠 수 있습니다
                </p>
              )}
            </>
          ) : (
            <p className="rr-action-note">
              최저 외침이 {lowestBid}수라 더 낮게 외칠 수 없습니다
            </p>
          )}
        </div>
      )}

      {/* 점수 — 획득한 목표 카드 수 */}
      <div className="rr-scores">
        {players.map((p) => (
          <span
            key={p.seat}
            className={`rr-score ${p.seat === game.yourSeat ? 'mine' : ''} ${
              p.connected ? '' : 'off'
            }`}
          >
            {p.name}
            {p.bot && ' 🤖'}
            {p.seat === game.yourSeat && ' (나)'}
            <strong>{p.score}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
