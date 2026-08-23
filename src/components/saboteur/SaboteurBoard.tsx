import { useEffect, useMemo, useState } from 'react';
import type {
  SBBoardTile,
  SBEdges,
  SBEvent,
  SBGameState,
  SBHandCard,
  SBMapReveal,
  SBTool,
} from '../../types/saboteur';
import {
  SB_CARD_DESC,
  SB_CARD_ICON,
  SB_CARD_LABEL,
  SB_COLS,
  SB_DIRS,
  SB_GOALS,
  SB_GOAL_LABEL,
  SB_ROLE_ICON,
  SB_ROLE_LABEL,
  SB_ROWS,
  SB_SABOTEUR_COUNT,
  SB_TOOLS,
  SB_TOOL_ICON,
  SB_TOOL_LABEL,
  sbBoardMap,
  sbBrokenTools,
  sbCardEdges,
  sbIsPathCard,
  sbKey,
  sbPlaceableCells,
  sbToolsOk,
} from '../../types/saboteur';
import type { SBToast } from '../../hooks/useSaboteurGameState';
import './SaboteurBoard.css';

// sb_action 의 대상 — 좌석+장비(break/repair) 또는 좌표(rockfall/map)
type SBActionTarget = {
  targetSeat?: number;
  tool?: SBTool;
  col?: number;
  row?: number;
};

interface SaboteurBoardProps {
  game: SBGameState;
  // 지도 카드로 나만 확인한 목표 타일들
  maps: SBMapReveal[];
  toasts: SBToast[];
  onPlace: (index: number, col: number, row: number, flip: boolean) => void;
  onAction: (index: number, target: SBActionTarget) => void;
  onDiscard: (index: number) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: SBEvent, game: SBGameState): string {
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
      return '게임이 시작되었습니다 — 갱도를 파 내려갑니다';
    case 'place':
      return `${name(event.seat)}님이 길 타일을 놓았습니다`;
    case 'rockfall':
      return `🪨 ${name(event.seat)}님이 낙석으로 타일을 걷어냈습니다`;
    case 'break':
      return `🔨 ${name(event.seat)}님이 장비를 망가뜨렸습니다`;
    case 'repair':
      return `🔧 ${name(event.seat)}님이 장비를 고쳤습니다`;
    case 'map':
      return `🗺 ${name(event.seat)}님이 목표를 몰래 확인했습니다`;
    case 'discard':
      return `${name(event.seat)}님이 카드를 버렸습니다`;
    case 'auto_discard':
      return '⏳ 시간 초과 — 카드가 자동으로 버려졌습니다';
    case 'reveal':
      return '🔎 목표 타일이 공개되었습니다';
    case 'timeout':
      return '⏳ 시간이 초과되었습니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    // react 등 토스트로 쓰지 않는 이벤트 — 훅에서 걸러지지만 방어
    default:
      return '';
  }
}

// ==================== 타일 그림 (인라인 SVG — 외부 에셋 없음) ====================
// 100×100 좌표계. 통로가 있는 방향으로 칸 중앙에서 굵은 선을 뻗고,
// 막다른 타일은 중앙에 닿기 전에 선을 끊고 중앙에 막힘 표시를 그린다.

const EDGE_POINT: Record<string, [number, number]> = {
  up: [50, 0],
  right: [100, 50],
  down: [50, 100],
  left: [0, 50],
};
// 막다른 타일에서 선이 멈추는 지점 (중앙에서 32 떨어진 곳)
const STOP_POINT: Record<string, [number, number]> = {
  up: [50, 18],
  right: [82, 50],
  down: [50, 82],
  left: [18, 50],
};

interface TileArtProps {
  edges: SBEdges;
  dead?: boolean;
  className?: string;
}

function TileArt({ edges, dead = false, className }: TileArtProps) {
  const open = SB_DIRS.filter((d) => edges[d]);
  return (
    <svg
      className={`sb-tile-art${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="sb-tile-rock" x="0" y="0" width="100" height="100" />
      {open.map((d) => {
        const [x1, y1] = EDGE_POINT[d];
        const [x2, y2] = dead ? STOP_POINT[d] : [50, 50];
        return (
          <line
            key={d}
            className="sb-tile-path"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
          />
        );
      })}
      {!dead && open.length > 0 && (
        <circle className="sb-tile-hub" cx="50" cy="50" r="12" />
      )}
      {dead && (
        <g className="sb-tile-block">
          <circle cx="50" cy="50" r="15" />
          <line x1="41" y1="41" x2="59" y2="59" />
          <line x1="59" y1="41" x2="41" y2="59" />
        </g>
      )}
    </svg>
  );
}

export function SaboteurBoard({
  game,
  maps,
  toasts,
  onPlace,
  onAction,
  onDiscard,
}: SaboteurBoardProps) {
  // 손패에서 고른 카드 (인덱스) + 길 카드의 180° 회전 여부
  const [selected, setSelected] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  // 확정 대기 중인 대상 (칸 또는 좌석+장비)
  const [target, setTarget] = useState<SBActionTarget | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(sb_error)해도 잠깐 뒤 풀려 재시도할 수 있다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const players = game.players ?? [];
  // ?? [] 를 그대로 쓰면 매 렌더 새 배열이라 아래 useMemo 들이 무의미해진다
  const board = useMemo(() => game.board ?? [], [game.board]);
  const yourHand = game.yourHand ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)는 손패·행동 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;
  const role = game.yourRole ?? '';
  const myTools = me?.tools;
  const broken = sbBrokenTools(myTools);
  const toolsOk = sbToolsOk(myTools);

  // 스냅샷 컨텍스트(차례·단계·판 크기)가 바뀌면 로컬 선택과 연타 잠금을 리셋한다
  useEffect(() => {
    setSelected(null);
    setTarget(null);
    setFlip(false);
    setSubmitted(false);
  }, [game.currentSeat, game.phase, board.length]);

  // 다른 카드를 고르면 회전·대상 초안은 버린다
  useEffect(() => {
    setTarget(null);
    setFlip(false);
  }, [selected]);

  // 차례 마감 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화)
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
  const clock = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}초`;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  const isMyTurn =
    game.phase === 'playing' && !isSpectator && game.currentSeat === game.yourSeat;
  const canAct = isMyTurn && !submitted;

  const tiles = useMemo(() => sbBoardMap(board), [board]);
  const card: SBHandCard | null =
    selected !== null ? (yourHand[selected] ?? null) : null;
  const cardEdges = card && sbIsPathCard(card) ? sbCardEdges(card, flip) : null;

  // 내 차례에 이 모양으로 놓을 수 있는 칸들 (서버가 최종 판정 — 후보 좁히기용)
  const placeable = useMemo(() => {
    if (!canAct || !cardEdges || !toolsOk) return new Set<string>();
    return sbPlaceableCells(board, cardEdges);
  }, [canAct, cardEdges, toolsOk, board]);

  // 낙석 대상 — 이미 놓인 길 타일만 (시작·목표 불가)
  const rockTargets = useMemo(() => {
    if (!canAct || card?.kind !== 'rockfall') return new Set<string>();
    const keys = new Set<string>();
    for (const t of board) {
      if (t.kind === 'path') keys.add(sbKey(t.col, t.row));
    }
    return keys;
  }, [canAct, card, board]);

  // 지도 대상 — 아직 뒷면인 목표 타일
  const mapTargets = useMemo(() => {
    if (!canAct || card?.kind !== 'map') return new Set<string>();
    const keys = new Set<string>();
    for (const t of board) {
      if (t.kind === 'goal' && t.revealed !== true) keys.add(sbKey(t.col, t.row));
    }
    return keys;
  }, [canAct, card, board]);

  const mapByIndex = new Map(maps.map((m) => [m.index, m]));
  // 좌표 → 목표 인덱스 (지도 결과 배지를 판 위에 얹으려고)
  const goalIndexOf = (col: number, row: number) =>
    SB_GOALS.findIndex((g) => g.col === col && g.row === row);

  const handleCellTap = (col: number, row: number) => {
    const key = sbKey(col, row);
    if (placeable.has(key) || rockTargets.has(key) || mapTargets.has(key)) {
      setTarget((prev) =>
        prev && prev.col === col && prev.row === row ? null : { col, row },
      );
    }
  };

  const handleToolTap = (seat: number, tool: SBTool) => {
    setTarget((prev) =>
      prev && prev.targetSeat === seat && prev.tool === tool
        ? null
        : { targetSeat: seat, tool },
    );
  };

  const handleConfirm = () => {
    if (selected === null || !card || !target || !canAct) return;
    lockSubmit();
    if (sbIsPathCard(card)) {
      onPlace(selected, target.col ?? 0, target.row ?? 0, flip);
    } else {
      onAction(selected, target);
    }
    setSelected(null);
    setTarget(null);
  };

  const handleDiscard = () => {
    if (selected === null || !canAct) return;
    lockSubmit();
    onDiscard(selected);
    setSelected(null);
    setTarget(null);
  };

  // 장비 대상 고르기 패널 (break: 멀쩡한 장비 / repair: 망가진 장비)
  const showToolPicker =
    canAct && (card?.kind === 'break' || card?.kind === 'repair');
  const toolPickable = (seat: number, tool: SBTool) => {
    const p = players.find((x) => x.seat === seat);
    const ok = p?.tools ? p.tools[tool] : true;
    if (card?.kind === 'break') return ok && seat !== game.yourSeat;
    if (card?.kind === 'repair') return !ok;
    return false;
  };

  const headline = (() => {
    if (isSpectator) return `${nameOf(game.currentSeat)}님의 차례`;
    if (isMyTurn) return '⛏ 내 차례 — 카드 1장을 쓰세요';
    return `${nameOf(game.currentSeat)}님의 차례`;
  })();

  const subline = (() => {
    if (isSpectator) return '관전 중 — 손패는 보이지 않습니다';
    if (!isMyTurn) return '갱도가 어느 쪽으로 뻗는지 지켜보세요';
    if (!toolsOk)
      return `${broken
        .map((t) => SB_TOOL_LABEL[t])
        .join('·')}이(가) 망가져 길 타일을 놓을 수 없습니다`;
    if (!card) return '손패에서 카드를 고르세요';
    if (sbIsPathCard(card))
      return placeable.size > 0
        ? '초록으로 표시된 칸에 놓을 수 있습니다'
        : '이 모양으로 놓을 칸이 없습니다 — 회전하거나 버리세요';
    if (card.kind === 'rockfall') return '걷어낼 길 타일을 고르세요';
    if (card.kind === 'map') return '몰래 확인할 목표 타일을 고르세요';
    if (card.kind === 'break') return '망가뜨릴 상대의 장비를 고르세요';
    if (card.kind === 'repair') return '고칠 장비를 고르세요';
    return '';
  })();

  const confirmText = (() => {
    if (!card || !target) return '';
    if (target.targetSeat !== undefined && target.tool) {
      return `${nameOf(target.targetSeat)}님의 ${
        SB_TOOL_LABEL[target.tool]
      }을(를) ${card.kind === 'break' ? '망가뜨릴' : '고칠'}까요?`;
    }
    const col = (target.col ?? 0) + 1;
    const row = (target.row ?? 0) + 1;
    if (card.kind === 'rockfall') return `${col}열 ${row}행 타일을 걷어낼까요?`;
    if (card.kind === 'map') return `${col}열 ${row}행 목표를 확인할까요?`;
    return `${col}열 ${row}행에 ${SB_CARD_LABEL[card.kind]}을(를) 놓을까요?`;
  })();

  const saboteurCount = SB_SABOTEUR_COUNT[players.length] ?? 0;

  // 판 위의 한 칸 렌더
  const renderCell = (col: number, row: number) => {
    const key = sbKey(col, row);
    const tile: SBBoardTile | undefined = tiles.get(key);
    const isPlaceable = placeable.has(key);
    const isRockTarget = rockTargets.has(key);
    const isMapTarget = mapTargets.has(key);
    const isTargeted = target?.col === col && target?.row === row;
    const interactive = isPlaceable || isRockTarget || isMapTarget;

    const goalIdx = tile?.kind === 'goal' ? goalIndexOf(col, row) : -1;
    const known = goalIdx >= 0 ? (mapByIndex.get(goalIdx) ?? null) : null;

    let inner: React.ReactNode = null;
    let label = `${col + 1}열 ${row + 1}행 빈 칸`;

    if (tile?.kind === 'goal') {
      const revealed = tile.revealed === true;
      inner = revealed ? (
        <>
          <TileArt edges={tile} dead={tile.dead} className="goal" />
          <span className="sb-cell-emoji">{tile.gold ? '💰' : '🪨'}</span>
        </>
      ) : (
        <>
          <span className="sb-goal-back">❓</span>
          {known && (
            <span
              className="sb-known-badge"
              title={`지도로 확인함 — ${known.gold ? '금덩이' : '돌'}`}
            >
              👁{known.gold ? '💰' : '🪨'}
            </span>
          )}
        </>
      );
      label = `${SB_GOAL_LABEL[goalIdx] ?? '목표'} ${
        revealed ? (tile.gold ? '금덩이' : '돌') : '뒷면'
      }`;
    } else if (tile) {
      inner = (
        <>
          <TileArt edges={tile} dead={tile.dead} />
          {tile.kind === 'start' && <span className="sb-cell-emoji">🪜</span>}
        </>
      );
      label = `${col + 1}열 ${row + 1}행 ${
        tile.kind === 'start' ? '시작 타일' : '길 타일'
      }`;
    } else if (isPlaceable && cardEdges) {
      // 놓을 수 있는 빈 칸 — 지금 고른 모양을 미리 얹어 보여준다
      inner = (
        <TileArt
          edges={cardEdges}
          dead={card?.kind === 'deadend'}
          className="ghost"
        />
      );
      label = `${col + 1}열 ${row + 1}행에 놓기`;
    }

    return (
      <button
        key={key}
        type="button"
        className={[
          'sb-cell',
          tile ? `filled kind-${tile.kind}` : 'empty',
          tile?.dead ? 'dead' : '',
          isPlaceable ? 'placeable' : '',
          isRockTarget ? 'rock-target' : '',
          isMapTarget ? 'map-target' : '',
          isTargeted ? 'targeted' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => handleCellTap(col, row)}
        disabled={!interactive}
        aria-label={label}
      >
        {inner}
      </button>
    );
  };

  return (
    <div className="sb-scope sb-board">
      <div className="sb-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="sb-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 차례 / 덱 잔량 / 카운트다운 */}
      <div className={`sb-status-bar ${isMyTurn ? 'mine' : ''}`}>
        <div className="sb-status-row">
          <span className="sb-status-chip">덱 {game.deckLeft}장</span>
          <span className="sb-status-chip">
            놓인 타일 {board.filter((t) => t.kind === 'path').length}장
          </span>
          {game.endsAt > 0 && (
            <span className={`sb-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="sb-status-title">{headline}</span>
        <span className="sb-status-sub">{subline}</span>
        {game.lastAction && (
          <span className="sb-last-action">
            {game.lastAction.message ||
              `${game.lastAction.name}님이 행동했습니다`}
          </span>
        )}
      </div>

      {/* 내 역할 카드 — 본인만 (은닉 스냅샷: 관전자는 yourRole 부재) */}
      {!isSpectator && role !== '' && (
        <div key={`role-${role}`} className={`sb-role-card role-${role}`}>
          <div className="sb-role-head">
            <span className="sb-role-icon">{SB_ROLE_ICON[role]}</span>
            <span className="sb-role-name">{SB_ROLE_LABEL[role]}</span>
          </div>
          <p className="sb-role-desc">
            {role === 'miner'
              ? '금덩이까지 길을 이으면 이깁니다 — 파괴꾼을 찾아내세요'
              : '길이 금에 닿지 못하게 막으세요 — 들키지 않는 게 관건입니다'}
          </p>
          {saboteurCount > 0 && (
            <p className="sb-role-pool">
              {players.length}인 구성 — 💣 파괴꾼 {saboteurCount}명 (역할 풀에서
              인원수만큼만 뽑아 실제 구성은 아무도 모릅니다)
            </p>
          )}
        </div>
      )}
      {isSpectator && (
        <div className="sb-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {/* 지도 결과 — 나만 보이는 패널 */}
      {!isSpectator && maps.length > 0 && (
        <div className="sb-map-panel">
          <div className="sb-section-head">
            <span className="sb-section-title">🗺 내가 확인한 목표</span>
            <span className="sb-section-note">나만 볼 수 있습니다</span>
          </div>
          <div className="sb-map-rows">
            {maps.map((m) => (
              <span
                key={m.index}
                className={`sb-map-row ${m.gold ? 'gold' : 'rock'}`}
              >
                {SB_GOAL_LABEL[m.index] ?? `목표 ${m.index + 1}`} —{' '}
                {m.gold ? '💰 금덩이' : '🪨 돌'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 9×5 갱도 판 — 좁은 화면에서는 가로 스크롤 */}
      <div className="sb-grid-wrap">
        <div className="sb-grid">
          {Array.from({ length: SB_ROWS }).map((_, row) =>
            Array.from({ length: SB_COLS }).map((_, col) =>
              renderCell(col, row),
            ),
          )}
        </div>
      </div>

      {/* 내 장비 — 하나라도 망가지면 길 타일을 못 놓는다 */}
      {!isSpectator && (
        <div className={`sb-tools-bar ${toolsOk ? '' : 'broken'}`}>
          <span className="sb-tools-label">내 장비</span>
          <div className="sb-tools-row">
            {SB_TOOLS.map((tool) => {
              const ok = myTools ? myTools[tool] : true;
              return (
                <span
                  key={tool}
                  className={`sb-tool ${ok ? 'ok' : 'broken'}`}
                  title={`${SB_TOOL_LABEL[tool]} ${ok ? '정상' : '망가짐'}`}
                >
                  <span className="sb-tool-icon">{SB_TOOL_ICON[tool]}</span>
                  <span className="sb-tool-name">{SB_TOOL_LABEL[tool]}</span>
                  {!ok && <span className="sb-tool-x">✕</span>}
                </span>
              );
            })}
          </div>
          <span className="sb-tools-note">
            {toolsOk
              ? '장비 정상 — 길 타일을 놓을 수 있습니다'
              : '장비가 망가져 길 타일을 놓을 수 없습니다 (행동 카드는 가능)'}
          </span>
        </div>
      )}

      {/* 내 손패 — 길 타일은 SVG 미리보기 + 회전, 행동 카드는 이모지+한글 */}
      {!isSpectator && (
        <div className="sb-hand">
          <div className="sb-section-head">
            <span className="sb-section-title">내 손패 {yourHand.length}장</span>
            <span className="sb-section-note">
              {isMyTurn ? '1장을 쓰고 1장을 뽑습니다' : '나만 볼 수 있습니다'}
            </span>
          </div>
          <div className="sb-hand-row">
            {yourHand.map((c, i) => {
              const isPath = sbIsPathCard(c);
              const active = selected === i;
              const edges = isPath ? sbCardEdges(c, active && flip) : null;
              const blockedByTools = isPath && !toolsOk;
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    'sb-hand-card',
                    `kind-${c.kind}`,
                    active ? 'active' : '',
                    blockedByTools ? 'blocked' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelected((prev) => (prev === i ? null : i))}
                  disabled={!canAct}
                  aria-pressed={active}
                  aria-label={`${SB_CARD_LABEL[c.kind]} 카드`}
                >
                  {edges ? (
                    <TileArt edges={edges} dead={c.kind === 'deadend'} />
                  ) : (
                    <span className="sb-hand-emoji">{SB_CARD_ICON[c.kind]}</span>
                  )}
                  <span className="sb-hand-label">
                    {c.kind === 'break' || c.kind === 'repair'
                      ? `${SB_CARD_LABEL[c.kind]}${
                          c.tool ? ` ${SB_TOOL_ICON[c.tool]}` : ''
                        }`
                      : SB_CARD_LABEL[c.kind]}
                  </span>
                  {blockedByTools && <span className="sb-hand-lock">🔒</span>}
                </button>
              );
            })}
            {yourHand.length === 0 && (
              <span className="sb-hand-empty">— 손패가 비었습니다 —</span>
            )}
          </div>

          {card && (
            <div className="sb-card-detail">
              <span className="sb-card-desc">{SB_CARD_DESC[card.kind]}</span>
              <div className="sb-card-actions">
                {sbIsPathCard(card) && card.flipable !== false && (
                  <button
                    type="button"
                    className={`sb-flip-button ${flip ? 'on' : ''}`}
                    onClick={() => setFlip((v) => !v)}
                    disabled={!canAct}
                  >
                    ↻ 180° 회전 {flip ? '(회전됨)' : ''}
                  </button>
                )}
                <button
                  type="button"
                  className="sb-discard-button"
                  onClick={handleDiscard}
                  disabled={!canAct}
                >
                  🗑 이 카드 버리기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 장비 대상 고르기 — break/repair */}
      {showToolPicker && (
        <div className="sb-target-panel">
          <div className="sb-section-head">
            <span className="sb-section-title">
              {card?.kind === 'break' ? '🔨 망가뜨릴 장비' : '🔧 고칠 장비'}
            </span>
          </div>
          <div className="sb-target-list">
            {players.map((p) => (
              <div key={p.seat} className="sb-target-row">
                <span className="sb-target-name">
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                </span>
                <span className="sb-target-tools">
                  {SB_TOOLS.map((tool) => {
                    const pickable = toolPickable(p.seat, tool);
                    const chosen =
                      target?.targetSeat === p.seat && target?.tool === tool;
                    return (
                      <button
                        key={tool}
                        type="button"
                        className={`sb-target-tool ${chosen ? 'chosen' : ''}`}
                        onClick={() => handleToolTap(p.seat, tool)}
                        disabled={!pickable}
                        aria-label={`${p.name}님의 ${SB_TOOL_LABEL[tool]}`}
                      >
                        {SB_TOOL_ICON[tool]}
                      </button>
                    );
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 좌석 스트립 — 손패 수·장비·봇/끊김 */}
      <div className="sb-seats">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const offline = !p.connected && !p.bot;
          return (
            <div
              key={p.seat}
              className={[
                'sb-seat',
                isMe ? 'me' : '',
                p.seat === game.currentSeat ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="sb-seat-name">
                {p.seat === game.currentSeat && '⛏ '}
                {p.name}
                {isMe && ' (나)'}
              </span>
              <span className="sb-seat-tools">
                {SB_TOOLS.map((tool) => {
                  const ok = p.tools ? p.tools[tool] : true;
                  return (
                    <span
                      key={tool}
                      className={`sb-seat-tool ${ok ? 'ok' : 'broken'}`}
                      title={`${SB_TOOL_LABEL[tool]} ${ok ? '정상' : '망가짐'}`}
                    >
                      {SB_TOOL_ICON[tool]}
                    </span>
                  );
                })}
              </span>
              <span className="sb-seat-badges">
                {p.bot && <span className="sb-badge">🤖</span>}
                {offline && <span className="sb-badge off">끊김</span>}
                <span className="sb-badge count">{p.handCount}장</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* 하단 확정 바 */}
      {target && card && canAct && (
        <div className="sb-confirm-bar">
          <span className="sb-confirm-text">{confirmText}</span>
          <div className="sb-confirm-actions">
            <button
              type="button"
              className="sb-confirm-button"
              onClick={handleConfirm}
            >
              확정
            </button>
            <button
              type="button"
              className="sb-cancel-button"
              onClick={() => setTarget(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
