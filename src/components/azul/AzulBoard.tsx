import { useEffect, useMemo, useState } from 'react';
import type {
  AZColor,
  AZEvent,
  AZFloorTile,
  AZGameState,
  AZPlacement,
  AZPlayerView,
} from '../../types/azul';
import {
  AZ_CENTER_SOURCE,
  AZ_COLOR_GLYPH,
  AZ_COLOR_LABEL,
  AZ_FIRST_GLYPH,
  AZ_FIRST_LABEL,
  AZ_FLOOR_SLOTS,
  AZ_LINE_COUNT,
  AZ_LINE_FLOOR,
  AZ_LINE_SIZES,
  AZ_WALL_SIZE,
  azCountColor,
  azDistinctColors,
  azEvaluateAll,
  azFactorySource,
  azFloor,
  azFloorSlotPenalty,
  azLines,
  azTileLabel,
  azWall,
  azWallCol,
  azWallColor,
} from '../../types/azul';
import type { AZToast } from '../../hooks/useAzulGameState';
import './AzulBoard.css';

interface AzulBoardProps {
  game: AZGameState;
  toasts: AZToast[];
  // from 은 "factory:N" 또는 "center", line 은 패턴 라인 0~4 또는 -1(전부 바닥 라인)
  onTake: (from: string, color: AZColor, line: number) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: AZEvent, game: AZGameState): string {
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
    case 'round_start':
      return `🔷 ${game.round}라운드 — 진열대를 채웠습니다`;
    case 'tiling':
      return '🧱 벽 타일 붙이기 정산 중입니다';
    case 'refill':
      return '🔄 주머니가 비어 버린 타일을 섞습니다';
    case 'afk':
      return `⏳ ${name(event.seat)}님이 시간을 넘겨 자동으로 두었습니다`;
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// 타일 — CSS 도형(둥근 사각형) + 색. 색약 대비로 색마다 다른 무늬 기호를 겹친다.
//   파랑 ◆ · 노랑 ● · 빨강 ▲ · 검정 ■ · 하늘색 ✦ · 선 플레이어 마커 1
// ---------------------------------------------------------------------------

interface AzTileProps {
  tile: AZFloorTile;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  // 아직 놓이지 않은 미리보기 (반투명 + 점선)
  ghost?: boolean;
}

export function AzTile({ tile, size = 'md', ghost = false }: AzTileProps) {
  const glyph = tile === 'first' ? AZ_FIRST_GLYPH : AZ_COLOR_GLYPH[tile];
  return (
    <span
      className={`az-tile az-t-${tile} az-s-${size} ${ghost ? 'ghost' : ''}`}
      title={azTileLabel(tile)}
      aria-hidden="true"
    >
      <span className="az-glyph">{glyph}</span>
    </span>
  );
}

// 빈 칸
function AzSlot({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return <span className={`az-slot az-s-${size}`} aria-hidden="true" />;
}

// 벽 5×5 — 빈 칸에도 그 자리에 들어갈 색을 흐릿하게 새겨 둔다.
// "어디에 무슨 색이 들어가는지"가 아줄의 모든 판단의 전제라서다.
export function AzWallGrid({
  wall,
  size = 'md',
  // 이번 수로 채워질 자리 (미리보기 강조)
  target = null,
}: {
  wall: boolean[][];
  size?: 'xs' | 'sm' | 'md' | 'lg';
  target?: { row: number; col: number } | null;
}) {
  return (
    <div className={`az-wall az-w-${size}`}>
      {Array.from({ length: AZ_WALL_SIZE }, (_, r) => (
        <div className="az-wall-row" key={r}>
          {Array.from({ length: AZ_WALL_SIZE }, (_, c) => {
            const color = azWallColor(r, c);
            const filled = wall[r]?.[c] === true;
            const isTarget = target?.row === r && target?.col === c;
            return (
              <span
                key={c}
                className={`az-wall-cell ${filled ? 'filled' : 'open'} ${
                  isTarget ? 'target' : ''
                }`}
                title={`${AZ_COLOR_LABEL[color]}${filled ? ' (붙임)' : ''}`}
              >
                <AzTile tile={color} size={size} ghost={!filled} />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

// 같은 색 묶음 = 한 번의 수. 관전자에게는 버튼 대신 그림만 남긴다
// (관전은 보기 전용이라 조작 요소를 아예 만들지 않는다).
function AzTakeGroup({
  color,
  count,
  label,
  selected,
  disabled,
  spectator,
  onPick,
}: {
  color: AZColor;
  count: number;
  label: string;
  selected: boolean;
  disabled: boolean;
  spectator: boolean;
  onPick: () => void;
}) {
  const tiles = Array.from({ length: count }, (_, i) => (
    <AzTile key={i} tile={color} size="sm" />
  ));

  if (spectator) {
    return (
      <span className="az-take static" title={label}>
        {tiles}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`az-take ${selected ? 'selected' : ''}`}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      onClick={onPick}
    >
      {tiles}
    </button>
  );
}

interface AzPick {
  from: string;
  // 사람이 읽는 출처 이름 ("진열대 3" / "중앙")
  fromLabel: string;
  color: AZColor;
  count: number;
  takesFirst: boolean;
}

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// 넘침 배지 문구 — 이 게임의 핵심 판단을 한 덩어리로 보여준다
const overflowText = (p: AZPlacement): string =>
  p.overflow > 0 ? `바닥 ${p.overflow}장` : '바닥 0장';

export function AzulBoard({ game, toasts, onTake }: AzulBoardProps) {
  const players = game.players ?? [];
  const factories = game.factories ?? [];
  const center = game.center ?? [];
  const isSpectator = game.yourSeat < 0;

  // 고른 타일 (출처 + 색). 놓을 줄을 고르면 확정된다.
  const [pick, setPick] = useState<AzPick | null>(null);
  // 줄에 손을 올렸을 때 바닥 라인에 넘침을 미리 비춰 주기 위한 상태
  const [previewLine, setPreviewLine] = useState<number | null>(null);
  // 확정 직후 ~ 다음 스냅샷 사이의 연타 방지
  const [submitted, setSubmitted] = useState(false);

  // 스냅샷 컨텍스트(라운드·차례·단계)가 바뀌면 로컬 선택을 통째로 리셋한다.
  // 남아 있던 선택이 다음 상황에서 엉뚱하게 확정되지 않도록.
  useEffect(() => {
    setPick(null);
    setPreviewLine(null);
    setSubmitted(false);
  }, [game.round, game.currentSeat, game.phase]);

  // 서버 응답이 유실돼도 영원히 잠기지 않게 하는 안전장치
  useEffect(() => {
    if (!submitted) return;
    const timer = window.setTimeout(() => setSubmitted(false), 2500);
    return () => window.clearTimeout(timer);
  }, [submitted]);

  // 차례 마감 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화)
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

  const isDrafting = game.phase === 'drafting';
  const isTiling = game.phase === 'tiling';
  const isMyTurn =
    isDrafting && !isSpectator && game.currentSeat === game.yourSeat;
  const canAct = isMyTurn && !submitted;

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  const me = players.find((p) => p.seat === game.yourSeat) ?? null;
  // 관전자에게는 지금 차례인 사람의 보드를 크게 보여준다 (조작 UI는 없다)
  const focus =
    me ?? players.find((p) => p.seat === game.currentSeat) ?? players[0] ?? null;
  const others = players.filter((p) => p.seat !== focus?.seat);

  const focusLines = useMemo(() => azLines(focus), [focus]);
  const focusWall = useMemo(() => azWall(focus), [focus]);
  const focusFloor = useMemo(() => azFloor(focus), [focus]);

  // 배치 미리보기 — 패턴 라인 5줄 + 바닥(-1). 내 보드일 때만 의미가 있다.
  const placements: AZPlacement[] | null = useMemo(() => {
    if (!pick || !me || focus?.seat !== me.seat) return null;
    return azEvaluateAll({
      lines: focusLines,
      wall: focusWall,
      floor: focusFloor,
      color: pick.color,
      count: pick.count,
      takesFirst: pick.takesFirst,
    });
  }, [pick, me, focus, focusLines, focusWall, focusFloor]);

  const placementOf = (line: number): AZPlacement | null => {
    if (!placements) return null;
    return line === AZ_LINE_FLOOR
      ? (placements[AZ_LINE_COUNT] ?? null)
      : (placements[line] ?? null);
  };

  // 손해가 가장 적은 선택 — 넘침이 없는 줄을 우선, 같으면 큰 줄부터
  const bestLine = useMemo(() => {
    if (!placements) return null;
    let best: AZPlacement | null = null;
    for (let i = 0; i < AZ_LINE_COUNT; i += 1) {
      const p = placements[i];
      if (!p.allowed) continue;
      if (
        !best ||
        p.overflow < best.overflow ||
        (p.overflow === best.overflow && p.placed > best.placed)
      ) {
        best = p;
      }
    }
    return best;
  }, [placements]);

  // 바닥 라인 미리보기에 쓸 배치 (손을 올린 줄 → 없으면 미리보기 없음)
  const preview =
    previewLine === null ? null : (placementOf(previewLine) ?? null);
  const previewOk = preview?.allowed ? preview : null;

  const handlePickTile = (
    from: string,
    fromLabel: string,
    color: AZColor,
    count: number,
    takesFirst: boolean,
  ) => {
    if (!canAct) return;
    setPreviewLine(null);
    setPick((prev) =>
      prev && prev.from === from && prev.color === color
        ? null
        : { from, fromLabel, color, count, takesFirst },
    );
  };

  const handleCommit = (line: number) => {
    if (!canAct || !pick) return;
    const placement = placementOf(line);
    if (placement && !placement.allowed) return;
    setSubmitted(true);
    setPreviewLine(null);
    onTake(pick.from, pick.color, line);
    setPick(null);
  };

  const headline = (() => {
    if (isTiling) return '🧱 벽 타일 붙이기 — 정산 중';
    if (isSpectator) return `${nameOf(game.currentSeat)}님의 차례`;
    if (!isMyTurn) return `${nameOf(game.currentSeat)}님의 차례`;
    if (pick)
      return `🔷 ${pick.fromLabel}의 ${AZ_COLOR_LABEL[pick.color]} ${pick.count}장 — 놓을 줄을 고르세요`;
    return '🔷 내 차례 — 진열대나 중앙에서 같은 색을 전부 가져오세요';
  })();

  const subline = (() => {
    if (isTiling) return '꽉 찬 패턴 라인이 벽으로 올라가고 바닥 라인을 비웁니다';
    if (isSpectator) return '관전 중 — 모든 보드를 볼 수 있지만 둘 수는 없습니다';
    if (!isMyTurn) return '진열대와 중앙이 모두 비면 이 라운드의 수주가 끝납니다';
    if (pick)
      return pick.takesFirst
        ? '선 플레이어 마커도 함께 가져옵니다 — 바닥 라인에 1칸을 씁니다'
        : '넘치는 장수가 그대로 바닥 라인 감점입니다';
    return '진열대에서 가져가면 그 진열대의 나머지 타일은 중앙으로 밀려납니다';
  })();

  const roundResult = game.roundResult ?? null;
  const lastAction = game.lastAction ?? null;

  return (
    <div className="az-scope az-board">
      <div className="az-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="az-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 — 라운드 / 차례 / 카운트다운 / 재고 */}
      <div className={`az-status-bar ${game.phase}`}>
        <div className="az-status-row">
          <span className="az-status-chip">{game.round}라운드</span>
          <span className="az-status-chip">주머니 {game.bagLeft}</span>
          <span className="az-status-chip">버림 {game.discardLeft}</span>
          {game.endsAt > 0 && (
            <span className={`az-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="az-status-title">{headline}</span>
        <span className="az-status-sub">{subline}</span>
        {game.firstNextSeat >= 0 && (
          <span className="az-status-first">
            🚩 다음 라운드 선: {nameOf(game.firstNextSeat)}님
          </span>
        )}
      </div>

      {/* 직전 수 — 자리를 늘 비워 둬 아래가 밀리지 않는다 */}
      <div className="az-last-slot">
        {lastAction ? (
          <div className="az-last" role="status">
            <strong>{lastAction.name || nameOf(lastAction.seat)}</strong>
            <span>{lastAction.message}</span>
          </div>
        ) : (
          <div className="az-last idle">아직 아무도 타일을 가져가지 않았습니다</div>
        )}
      </div>

      {/* 라운드 정산 — 획득·감점을 한 표로 */}
      {roundResult && (roundResult.rows ?? []).length > 0 && (
        <div className="az-round-result">
          <span className="az-round-result-title">
            🧱 {game.round}라운드 정산
            {roundResult.message ? ` — ${roundResult.message}` : ''}
          </span>
          <table className="az-round-table">
            <thead>
              <tr>
                <th className="left">플레이어</th>
                <th>획득</th>
                <th>감점</th>
                <th>총점</th>
              </tr>
            </thead>
            <tbody>
              {(roundResult.rows ?? []).map((row) => (
                <tr
                  key={row.seat}
                  className={row.seat === game.yourSeat ? 'me' : undefined}
                >
                  <td className="left">
                    {nameOf(row.seat)}
                    {row.seat === game.yourSeat && ' (나)'}
                  </td>
                  <td className="gain">+{row.gained}</td>
                  <td className="loss">
                    {row.penalty === 0 ? '0' : `−${Math.abs(row.penalty)}`}
                  </td>
                  <td className="total">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- 진열대 + 중앙 ---------- */}
      <section className="az-supply">
        <h2 className="az-section-title">진열대</h2>
        <div className="az-factories">
          {factories.map((tiles, index) => {
            const from = azFactorySource(index);
            const colors = azDistinctColors(tiles);
            const empty = tiles.length === 0;
            return (
              <div
                key={index}
                className={`az-factory ${empty ? 'empty' : ''}`}
                aria-label={`진열대 ${index + 1}`}
              >
                <span className="az-factory-no">{index + 1}</span>
                <div className="az-factory-tiles">
                  {empty ? (
                    <span className="az-factory-empty">비었음</span>
                  ) : (
                    colors.map((color) => {
                      const count = azCountColor(tiles, color);
                      return (
                        <AzTakeGroup
                          key={color}
                          color={color}
                          count={count}
                          label={`진열대 ${index + 1}의 ${AZ_COLOR_LABEL[color]} ${count}장 가져오기`}
                          selected={pick?.from === from && pick.color === color}
                          disabled={!canAct}
                          spectator={isSpectator}
                          onPick={() =>
                            handlePickTile(
                              from,
                              `진열대 ${index + 1}`,
                              color,
                              count,
                              false,
                            )
                          }
                        />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
          {factories.length === 0 && (
            <p className="az-empty-note">진열대를 채우는 중…</p>
          )}
        </div>

        <h2 className="az-section-title">
          중앙
          {game.centerHasFirst && (
            <span className="az-first-note">
              🚩 선 플레이어 마커가 남아 있습니다 (가져가면 바닥 라인 −1)
            </span>
          )}
        </h2>
        <div className="az-center">
          {game.centerHasFirst && (
            <span className="az-center-first">
              <AzTile tile="first" size="sm" />
              <span className="az-center-first-label">{AZ_FIRST_LABEL}</span>
            </span>
          )}
          {azDistinctColors(center).map((color) => {
            const count = azCountColor(center, color);
            return (
              <AzTakeGroup
                key={color}
                color={color}
                count={count}
                label={`중앙의 ${AZ_COLOR_LABEL[color]} ${count}장 가져오기`}
                selected={
                  pick?.from === AZ_CENTER_SOURCE && pick.color === color
                }
                disabled={!canAct}
                spectator={isSpectator}
                onPick={() =>
                  handlePickTile(
                    AZ_CENTER_SOURCE,
                    '중앙',
                    color,
                    count,
                    game.centerHasFirst === true,
                  )
                }
              />
            );
          })}
          {center.length === 0 && !game.centerHasFirst && (
            <span className="az-empty-note">중앙이 비었습니다</span>
          )}
        </div>
      </section>

      {/* ---------- 내 개인 보드 (관전자는 차례인 사람의 보드) ---------- */}
      {focus && (
        <section className="az-self">
          <div className="az-self-head">
            <span className="az-self-name">
              {me && focus.seat === me.seat ? '내 보드' : `${focus.name}님의 보드`}
              {focus.bot && ' 🤖'}
            </span>
            <span className="az-self-score">{focus.score}점</span>
          </div>

          {pick && (
            <div className="az-pick-bar">
              <span className="az-pick-what">
                <AzTile tile={pick.color} size="sm" />
                {pick.fromLabel}의 {AZ_COLOR_LABEL[pick.color]} {pick.count}장
              </span>
              {bestLine && (
                <span className="az-pick-best">
                  손해가 가장 적은 곳: {bestLine.line + 1}번 줄 ·{' '}
                  {overflowText(bestLine)}
                </span>
              )}
              <button
                type="button"
                className="az-cancel"
                onClick={() => {
                  setPick(null);
                  setPreviewLine(null);
                }}
              >
                선택 취소
              </button>
            </div>
          )}

          <div className="az-panel">
            {/* 패턴 라인 5줄 (왼쪽) + 벽 5×5 (오른쪽) */}
            <div className="az-rows">
              <div className="az-rows-head">
                <span>패턴 라인</span>
                <span>벽</span>
              </div>
              {Array.from({ length: AZ_LINE_COUNT }, (_, row) => {
                const capacity = AZ_LINE_SIZES[row];
                const line = focusLines[row];
                const held = Math.min(line.count, capacity);
                const placement = placementOf(row);
                const interactive = canAct && pick !== null && placement !== null;
                const allowed = placement?.allowed === true;
                const isPreview = previewLine === row;

                // 채워질 자리: 오른쪽부터 기존 타일, 그 왼쪽으로 미리보기 타일
                const slots = Array.from({ length: capacity }, (_, i) => {
                  const fromRight = capacity - i;
                  if (fromRight <= held) return 'held' as const;
                  if (
                    allowed &&
                    placement &&
                    fromRight <= held + placement.placed
                  )
                    return 'preview' as const;
                  return 'empty' as const;
                });

                const lineColor: AZColor | null =
                  line.color !== '' ? line.color : null;
                const previewColor = pick?.color ?? null;

                // 이 수로 줄이 꽉 차면 이번 라운드에 벽의 어느 칸이 채워지는지
                const wallTarget =
                  isPreview && allowed && placement?.completes && pick
                    ? { row, col: azWallCol(row, pick.color) }
                    : null;

                const body = (
                  <>
                    <span className="az-line-no">{row + 1}</span>
                    <span className="az-line-slots">
                      {slots.map((slot, i) =>
                        slot === 'held' && lineColor ? (
                          <AzTile key={i} tile={lineColor} size="md" />
                        ) : slot === 'preview' && previewColor ? (
                          <AzTile key={i} tile={previewColor} size="md" ghost />
                        ) : (
                          <AzSlot key={i} size="md" />
                        ),
                      )}
                    </span>
                    {interactive && placement && (
                      <span
                        className={`az-line-badge ${allowed ? 'ok' : 'blocked'}`}
                      >
                        {allowed ? (
                          <>
                            <strong>{placement.placed}장 놓기</strong>
                            <small
                              className={placement.overflow > 0 ? 'warn' : ''}
                            >
                              {overflowText(placement)}
                              {placement.penaltyDelta < 0 &&
                                ` (${placement.penaltyDelta}점)`}
                            </small>
                            {placement.completes && (
                              <small className="done">이번 라운드 완성</small>
                            )}
                          </>
                        ) : (
                          <small className="warn">{placement.reason}</small>
                        )}
                      </span>
                    )}
                  </>
                );

                return (
                  <div className="az-row" key={row}>
                    {interactive ? (
                      <button
                        type="button"
                        className={`az-line ${allowed ? 'ok' : 'blocked'} ${
                          isPreview ? 'preview' : ''
                        }`}
                        disabled={!allowed}
                        onClick={() => handleCommit(row)}
                        onPointerEnter={() => setPreviewLine(row)}
                        onPointerLeave={() =>
                          setPreviewLine((p) => (p === row ? null : p))
                        }
                        onFocus={() => setPreviewLine(row)}
                        onBlur={() =>
                          setPreviewLine((p) => (p === row ? null : p))
                        }
                        aria-label={
                          allowed && placement
                            ? `${row + 1}번 줄에 ${placement.placed}장 놓기, ${overflowText(placement)}`
                            : `${row + 1}번 줄 — ${placement?.reason ?? '놓을 수 없습니다'}`
                        }
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="az-line static">{body}</div>
                    )}
                    <div className="az-row-wall">
                      {Array.from({ length: AZ_WALL_SIZE }, (_, col) => {
                        const color = azWallColor(row, col);
                        const filled = focusWall[row]?.[col] === true;
                        const isTarget =
                          wallTarget?.row === row && wallTarget?.col === col;
                        return (
                          <span
                            key={col}
                            className={`az-wall-cell ${
                              filled ? 'filled' : 'open'
                            } ${isTarget ? 'target' : ''}`}
                            title={`${AZ_COLOR_LABEL[color]}${filled ? ' (붙임)' : ''}`}
                          >
                            <AzTile tile={color} size="md" ghost={!filled} />
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 바닥 라인 — 칸마다 감점값을 새겨 둔다 */}
            <div className="az-floor-block">
              <div className="az-floor-head">
                <span>바닥 라인</span>
                <span className="az-floor-now">
                  {focusFloor.length}장
                  {previewOk && previewOk.floorAfter !== focusFloor.length && (
                    <em className="warn"> → {previewOk.floorAfter}장</em>
                  )}
                </span>
              </div>
              <div className="az-floor">
                {Array.from({ length: AZ_FLOOR_SLOTS }, (_, i) => {
                  const tile = focusFloor[i];
                  // 미리보기: 선 플레이어 마커 → 넘친 타일 순으로 채워진다
                  let ghostTile: AZFloorTile | null = null;
                  if (!tile && previewOk && pick) {
                    const offset = i - focusFloor.length;
                    if (offset >= 0) {
                      const firstSlots = pick.takesFirst ? 1 : 0;
                      if (offset < firstSlots) ghostTile = 'first';
                      else if (offset < firstSlots + previewOk.overflow)
                        ghostTile = pick.color;
                    }
                  }
                  return (
                    <span className="az-floor-cell" key={i}>
                      <span className="az-floor-penalty">
                        {azFloorSlotPenalty(i)}
                      </span>
                      {tile ? (
                        <AzTile tile={tile} size="md" />
                      ) : ghostTile ? (
                        <AzTile tile={ghostTile} size="md" ghost />
                      ) : (
                        <AzSlot size="md" />
                      )}
                    </span>
                  );
                })}
              </div>
              {focusFloor.length > AZ_FLOOR_SLOTS && (
                <p className="az-floor-over">
                  칸을 넘은 {focusFloor.length - AZ_FLOOR_SLOTS}장도 각 −3점입니다
                </p>
              )}
            </div>

            {/* 전부 바닥 라인에 버리는 선택 (line -1) — 늘 명시적으로 제공한다 */}
            {canAct && pick && placementOf(AZ_LINE_FLOOR) && (
              <button
                type="button"
                className="az-dump"
                onClick={() => handleCommit(AZ_LINE_FLOOR)}
                onPointerEnter={() => setPreviewLine(AZ_LINE_FLOOR)}
                onPointerLeave={() =>
                  setPreviewLine((p) => (p === AZ_LINE_FLOOR ? null : p))
                }
                onFocus={() => setPreviewLine(AZ_LINE_FLOOR)}
                onBlur={() =>
                  setPreviewLine((p) => (p === AZ_LINE_FLOOR ? null : p))
                }
              >
                🗑 전부 바닥 라인에 버리기 · {pick.count}장 (
                {placementOf(AZ_LINE_FLOOR)?.penaltyDelta ?? 0}점)
              </button>
            )}
          </div>

          {isSpectator && (
            <p className="az-hint spectator">
              👀 관전 중 — 지금 차례인 분의 보드를 크게 보고 있습니다
            </p>
          )}
          {!isSpectator && !isMyTurn && !isTiling && (
            <p className="az-hint">
              {nameOf(game.currentSeat)}님이 타일을 고르는 중입니다
            </p>
          )}
        </section>
      )}

      {/* ---------- 남의 보드 (축소) ---------- */}
      {others.length > 0 && (
        <section className="az-others">
          <h2 className="az-section-title">다른 참가자</h2>
          <div className="az-others-grid">
            {others.map((p) => (
              <AzMiniBoard
                key={p.seat}
                player={p}
                isCurrent={p.seat === game.currentSeat}
                isFirstNext={p.seat === game.firstNextSeat}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// 남의 보드 — 패턴 라인·벽·바닥 라인을 그대로 줄여 놓은 축소판
function AzMiniBoard({
  player,
  isCurrent,
  isFirstNext,
}: {
  player: AZPlayerView;
  isCurrent: boolean;
  isFirstNext: boolean;
}) {
  const lines = azLines(player);
  const wall = azWall(player);
  const floor = azFloor(player);
  const offline = !player.connected && !player.bot;

  return (
    <div className={`az-mini ${isCurrent ? 'current' : ''}`}>
      <div className="az-mini-head">
        <span className="az-mini-name">
          {player.name}
          {player.bot && ' 🤖'}
          {isFirstNext && ' 🚩'}
          {offline && <span className="az-mini-off">끊김</span>}
        </span>
        <span className="az-mini-score">{player.score}</span>
      </div>
      <div className="az-mini-body">
        <div className="az-mini-lines">
          {lines.map((line, row) => {
            const capacity = AZ_LINE_SIZES[row];
            const held = Math.min(line.count, capacity);
            return (
              <div className="az-mini-line" key={row}>
                {Array.from({ length: capacity }, (_, i) =>
                  capacity - i <= held && line.color !== '' ? (
                    <AzTile key={i} tile={line.color} size="xs" />
                  ) : (
                    <AzSlot key={i} size="xs" />
                  ),
                )}
              </div>
            );
          })}
        </div>
        <AzWallGrid wall={wall} size="xs" />
      </div>
      <div className="az-mini-floor">
        <span className="az-mini-floor-label">바닥</span>
        {floor.length === 0 ? (
          <span className="az-mini-floor-none">없음</span>
        ) : (
          floor
            .slice(0, AZ_FLOOR_SLOTS)
            .map((tile, i) => <AzTile key={i} tile={tile} size="xs" />)
        )}
      </div>
    </div>
  );
}
