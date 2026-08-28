// 루미큐브 보드.
//
// 이 게임의 어려운 곳은 "차례 중 타일 배치 조작"이다.
// 확정(ru_commit)은 테이블 전체를 통째로 보내는 모델이라, 프론트는 차례 중
// 로컬에서 자유롭게 배치를 바꾸다가 한 번에 확정한다.
//
//   상태 모델 = [차례 시작 스냅샷] + [이동 목록] → 매번 처음부터 다시 계산
//
//   • 스냅샷 = 서버가 준 sets(테이블) + yourRack(받침대). 절대 손대지 않는다.
//   • 이동 = { 타일 → 어느 세트 } 또는 { 타일 → 받침대 } 의 목록.
//     세트는 인덱스가 아니라 "세트 키"로 가리킨다(s0,s1… 스냅샷 / n3,n7… 새 세트).
//     인덱스로 가리키면 빈 세트가 사라질 때 뒤 이동이 전부 어긋난다.
//   • 화면에 보이는 배치는 언제나 replay(스냅샷, 이동목록)의 결과다.
//     파생 상태를 따로 들고 있지 않으므로 어긋날 여지가 없다.
//   • 되돌리기 = 이동 목록 비우기. 한 수 취소 = 마지막 이동 pop.
//   • 서버가 확정을 거부하면(ru_error) errorSeq 가 오르고, 그때도 이동 목록을
//     비운다 — "통째로 되돌아간다"를 화면이 그대로 보여 준다.

import { useEffect, useMemo, useState } from 'react';
import type {
  RUEvent,
  RUGameState,
  RUTile,
  RUTileId,
} from '../../types/rummikub';
import {
  RU_COLORS,
  RU_MELD_MIN,
  RU_MIN_SET,
  ruBoardValid,
  ruCanonicalOrder,
  ruColorMark,
  ruIsJoker,
  ruRackSortKey,
  ruSetScore,
  ruTileKey,
  ruTileLabel,
  ruValidateSet,
} from '../../types/rummikub';
import type { RUToast } from '../../hooks/useRummikubGameState';
import './RummikubBoard.css';

interface RummikubBoardProps {
  game: RUGameState;
  toasts: RUToast[];
  // ru_error 누적 카운터 — 오를 때마다 로컬 배치를 차례 시작 상태로 되돌린다
  errorSeq: number;
  // 테이블 전체 배치를 통째로 보낸다
  onCommit: (sets: RUTileId[][]) => void;
  onDraw: () => void;
}

// ---------- 타일 표기 ----------
// 색만으로 구분되지 않게 기호(◆●■▲)를 병기하고, 숫자 글꼴 색을 타일 색으로.
// 검정·주황은 명도로도 갈린다(RummikubApp.css 참고).

// 색 슬롯 클래스 — 모르는 색이 와도 무채색으로 안전하게 떨어진다
function ruTileToneClass(tile: RUTile): string {
  if (ruIsJoker(tile)) return 'ru-c-joker';
  return (RU_COLORS as readonly string[]).includes(tile.color)
    ? `ru-c-${tile.color}`
    : 'ru-c-unknown';
}

interface RummikubTileProps {
  tile: RUTile;
  size?: 'sm' | 'md';
  selected?: boolean;
  // 이번 차례에 내가 받침대에서 새로 낸 타일
  fresh?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function RummikubTile({
  tile,
  size = 'md',
  selected = false,
  fresh = false,
  onClick,
  disabled = false,
}: RummikubTileProps) {
  const joker = ruIsJoker(tile);
  const className = [
    'ru-tile',
    `size-${size}`,
    ruTileToneClass(tile),
    selected ? 'selected' : '',
    fresh ? 'fresh' : '',
    onClick ? 'tappable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const face = (
    <>
      <span className="ru-tile-mark" aria-hidden="true">
        {joker ? '🃏' : ruColorMark(tile.color)}
      </span>
      <span className="ru-tile-num">
        {joker ? (tile.standsFor ?? 0) > 0 ? tile.standsFor : '조커' : tile.num}
      </span>
      {joker && (tile.standsFor ?? 0) > 0 && (
        <span className="ru-tile-sub">조커</span>
      )}
    </>
  );

  if (!onClick) {
    return (
      <span className={className} title={ruTileLabel(tile)}>
        {face}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${ruTileLabel(tile)}${selected ? ' — 선택됨' : ''}`}
      title={ruTileLabel(tile)}
    >
      {face}
    </button>
  );
}

// ---------- 로컬 배치 모델 ----------

type RULocation = 'rack' | string; // 'rack' 또는 세트 키

type RUMove =
  | { kind: 'place'; tileKey: string; setKey: string }
  | { kind: 'toRack'; tileKey: string };

interface RUSetView {
  key: string;
  // 스냅샷에 없던 세트(이번 차례에 새로 만든 것)
  isNew: boolean;
  // 스냅샷과 내용이 달라졌는지 (숫자조합으로 손댄 세트)
  changed: boolean;
  tiles: RUTile[];
}

interface RUArrangement {
  sets: RUSetView[];
  rack: RUTile[];
  // 타일 키 → 차례 시작 시점 위치
  origin: Map<string, RULocation>;
  // 타일 키 → 지금 위치
  location: Map<string, RULocation>;
}

// 스냅샷 + 이동 목록 → 지금 배치. 순수 함수(파생 상태 없음).
function replayArrangement(
  snapshotSets: RUTile[][],
  rackTiles: RUTile[],
  moves: RUMove[],
): RUArrangement {
  const tileByKey = new Map<string, RUTile>();
  const origin = new Map<string, RULocation>();
  const order: string[] = [];
  const contents = new Map<string, string[]>();
  const snapshotContents = new Map<string, string[]>();

  (snapshotSets ?? []).forEach((set, i) => {
    const key = `s${i}`;
    order.push(key);
    const keys = (set ?? []).map((tile) => {
      const k = ruTileKey(tile);
      tileByKey.set(k, tile);
      origin.set(k, key);
      return k;
    });
    contents.set(key, [...keys]);
    snapshotContents.set(key, [...keys]);
  });

  const rackOrder: string[] = [];
  (rackTiles ?? []).forEach((tile) => {
    const k = ruTileKey(tile);
    tileByKey.set(k, tile);
    origin.set(k, 'rack');
    rackOrder.push(k);
  });

  const location = new Map<string, RULocation>(origin);

  const detach = (k: string) => {
    const loc = location.get(k);
    if (loc === undefined || loc === 'rack') return;
    const arr = contents.get(loc);
    if (arr) contents.set(loc, arr.filter((x) => x !== k));
  };

  for (const move of moves) {
    // 스냅샷이 갈아 끼워진 뒤 남은 낡은 이동은 무시한다 (없는 타일)
    if (!tileByKey.has(move.tileKey)) continue;
    detach(move.tileKey);
    if (move.kind === 'toRack') {
      location.set(move.tileKey, 'rack');
      continue;
    }
    if (!contents.has(move.setKey)) {
      contents.set(move.setKey, []);
      order.push(move.setKey);
    }
    contents.get(move.setKey)?.push(move.tileKey);
    location.set(move.tileKey, move.setKey);
  }

  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length &&
    [...a].sort().join(',') === [...b].sort().join(',');

  const sets: RUSetView[] = order
    .map((key) => {
      const keys = contents.get(key) ?? [];
      const snap = snapshotContents.get(key);
      return {
        key,
        isNew: snap === undefined,
        changed: snap === undefined ? true : !sameSet(keys, snap),
        tiles: keys
          .map((k) => tileByKey.get(k))
          .filter((t): t is RUTile => t !== undefined),
      };
    })
    .filter((s) => s.tiles.length > 0);

  // 받침대는 원래 순서를 지킨다. (테이블 타일을 받침대로 내리는 조작은
  // UI 가 막지만, 혹시 들어와도 안전하게 뒤에 붙인다)
  const rackKeys = rackOrder.filter((k) => location.get(k) === 'rack');
  const extraKeys = [...location.entries()]
    .filter(([k, loc]) => loc === 'rack' && !rackOrder.includes(k))
    .map(([k]) => k);
  const rack = [...rackKeys, ...extraKeys]
    .map((k) => tileByKey.get(k))
    .filter((t): t is RUTile => t !== undefined);

  return { sets, rack, origin, location };
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: RUEvent, game: RUGameState): string {
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
    case 'commit':
    case 'play':
      return `${name(event.seat)}님이 타일을 내려놓았습니다`;
    case 'meld':
      return `${name(event.seat)}님이 등록했습니다`;
    case 'manipulate':
      return `${name(event.seat)}님이 숫자조합을 했습니다`;
    case 'draw':
      return `${name(event.seat)}님이 타일더미에서 1개 가져갔습니다`;
    case 'rejected':
      return '확정이 거부되어 차례 시작 상태로 되돌렸습니다';
    case 'pool_empty':
      return '🁢 타일더미가 떨어졌습니다';
    case 'auto_action':
      return '⏳ 시간 초과 — 자동으로 타일을 가져가고 차례를 넘겼습니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

export function RummikubBoard({
  game,
  toasts,
  errorSeq,
  onCommit,
  onDraw,
}: RummikubBoardProps) {
  const snapshotSets = useMemo(() => game.sets ?? [], [game.sets]);
  const snapshotRack = useMemo(() => game.yourRack ?? [], [game.yourRack]);
  const players = game.players ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  const isSpectator = game.yourSeat < 0 || !me;
  const melded = game.yourMelded === true;
  const poolLeft = game.poolLeft ?? 0;

  // 차례 시작 스냅샷의 지문 — 바뀌면 로컬 배치를 새 스냅샷 기준으로 리셋한다
  const signature = useMemo(
    () =>
      [
        game.currentSeat,
        game.phase,
        snapshotSets
          .map((s) => (s ?? []).map(ruTileKey).join(','))
          .join('|'),
        snapshotRack.map(ruTileKey).join(','),
      ].join('#'),
    [game.currentSeat, game.phase, snapshotSets, snapshotRack],
  );

  const [moves, setMoves] = useState<RUMove[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  // 받침대 정렬 — 로컬 표시용일 뿐 서버로 나가지 않는다
  const [rackSort, setRackSort] = useState<'none' | 'color' | 'num'>('none');

  const resetLocal = () => {
    setMoves([]);
    setSelected([]);
  };

  // 스냅샷이 바뀌면(차례 넘어감·확정 반영) 로컬 배치를 버린다
  useEffect(() => {
    setMoves([]);
    setSelected([]);
    setSubmitted(false);
  }, [signature]);

  // 서버가 거부하면 통째로 되돌린다 — 화면도 그렇게 보여야 한다
  useEffect(() => {
    setMoves([]);
    setSelected([]);
    setSubmitted(false);
  }, [errorSeq]);

  const arrangement = useMemo(
    () => replayArrangement(snapshotSets, snapshotRack, moves),
    [snapshotSets, snapshotRack, moves],
  );

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

  const isMyTurn = !isSpectator && game.currentSeat === game.yourSeat;
  const canAct = isMyTurn && !submitted && game.phase === 'turn';

  // ---------- 배치 판정 ----------

  // 내가 이번 차례에 새로 내놓은 타일 (받침대 → 테이블)
  const freshKeys = useMemo(() => {
    const keys = new Set<string>();
    arrangement.location.forEach((loc, key) => {
      if (arrangement.origin.get(key) === 'rack' && loc !== 'rack') {
        keys.add(key);
      }
    });
    return keys;
  }, [arrangement]);

  // 테이블 타일을 건드렸는지 = 숫자조합 (등록 차례에는 금지)
  const manipulated = useMemo(
    () => arrangement.sets.some((s) => !s.isNew && s.changed),
    [arrangement],
  );

  const invalidSets = arrangement.sets.filter(
    (s) => !ruValidateSet(s.tiles).ok,
  );
  const tableValid = ruBoardValid(arrangement.sets.map((s) => s.tiles));

  // 등록 점수 — 등록 전에는 "내 타일만으로 만든 새 세트"의 합만 인정된다
  const meldScore = useMemo(
    () =>
      arrangement.sets
        .filter((s) => s.isNew && ruValidateSet(s.tiles).ok)
        .reduce((sum, s) => sum + ruSetScore(s.tiles), 0),
    [arrangement],
  );

  const dirty = moves.length > 0;

  // 확정을 막는 이유들 — 사용자가 무엇이 모자란지 늘 알 수 있게 나열한다
  const blockers: string[] = [];
  if (freshKeys.size === 0) {
    blockers.push('내 타일이 최소 1개는 새로 나가야 합니다');
  }
  if (!tableValid) {
    blockers.push(
      `유효하지 않은 세트가 ${invalidSets.length}개 있습니다 (붉게 표시된 세트)`,
    );
  }
  if (!melded) {
    if (manipulated) {
      blockers.push(
        '등록하는 차례에는 숫자조합을 할 수 없습니다 — 테이블 위 타일은 그대로 두세요',
      );
    }
    if (meldScore < RU_MELD_MIN) {
      blockers.push(
        `등록에는 ${RU_MELD_MIN}점 이상이 필요합니다 (지금 ${meldScore}점)`,
      );
    }
  }
  const canCommit = canAct && blockers.length === 0;

  // ---------- 조작 ----------

  const toggleSelect = (key: string) => {
    if (!canAct) return;
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const placeSelected = (setKey: string) => {
    if (!canAct || selected.length === 0) return;
    setMoves((prev) => [
      ...prev,
      ...selected.map(
        (tileKey): RUMove => ({ kind: 'place', tileKey, setKey }),
      ),
    ]);
    setSelected([]);
  };

  const placeSelectedInNewSet = () => {
    if (!canAct || selected.length === 0) return;
    // 세트 키는 이동 목록 길이로 만든다 — 이동은 덧붙이기만 하므로 중복되지 않는다
    setMoves((prev) => {
      const setKey = `n${prev.length}`;
      return [
        ...prev,
        ...selected.map(
          (tileKey): RUMove => ({ kind: 'place', tileKey, setKey }),
        ),
      ];
    });
    setSelected([]);
  };

  // 받침대로 되돌리기는 "이번 차례에 내가 낸 타일"에만 허용한다.
  // 테이블에 원래 있던 타일은 받침대로 가져올 수 없다(조커 회수는 v1 미지원).
  const selectedTiles = selected;
  const returnable =
    selectedTiles.length > 0 &&
    selectedTiles.every(
      (k) =>
        arrangement.origin.get(k) === 'rack' &&
        arrangement.location.get(k) !== 'rack',
    );

  const returnSelectedToRack = () => {
    if (!canAct || !returnable) return;
    setMoves((prev) => [
      ...prev,
      ...selected.map((tileKey): RUMove => ({ kind: 'toRack', tileKey })),
    ]);
    setSelected([]);
  };

  const undoLast = () => {
    if (!canAct || moves.length === 0) return;
    setMoves((prev) => prev.slice(0, -1));
    setSelected([]);
  };

  const handleCommit = () => {
    if (!canCommit) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    // 정렬은 사람이 읽을 수 있는 순서로 맞춰 보낸다 (서버는 순서 무관 가정)
    onCommit(
      arrangement.sets.map((s) => ruCanonicalOrder(s.tiles).map((t) => t.id)),
    );
  };

  const handleDraw = () => {
    if (!canAct || dirty) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    onDraw();
  };

  // ---------- 표시 ----------

  const rack = useMemo(() => {
    const list = [...arrangement.rack];
    if (rackSort === 'color') {
      return list.sort((a, b) => ruRackSortKey(a) - ruRackSortKey(b));
    }
    if (rackSort === 'num') {
      return list.sort((a, b) => {
        const an = ruIsJoker(a) ? 99 : a.num;
        const bn = ruIsJoker(b) ? 99 : b.num;
        return an - bn || ruRackSortKey(a) - ruRackSortKey(b);
      });
    }
    return list;
  }, [arrangement.rack, rackSort]);

  const headline = (() => {
    if (game.phase === 'game_over') return '게임이 끝났습니다';
    if (isSpectator) return `${nameOf(game.currentSeat)}님의 차례`;
    if (isMyTurn) {
      return melded
        ? '🁢 내 차례 — 타일을 내려놓거나 숫자조합을 하세요'
        : `🁢 내 차례 — 등록(${RU_MELD_MIN}점 이상)을 노리세요`;
    }
    return `${nameOf(game.currentSeat)}님의 차례`;
  })();

  const subline = (() => {
    if (isSpectator) return '관전 중 — 행동할 수 없습니다';
    if (!isMyTurn) return '받침대를 정리하며 다음 수를 계산해 두세요';
    if (!melded) {
      return '등록은 내 타일만으로 — 테이블 위 타일과 섞을 수 없고, 등록한 차례에는 숫자조합을 할 수 없습니다';
    }
    return '테이블 위 타일도 옮길 수 있습니다 — 차례가 끝날 때 모든 세트가 유효하면 됩니다';
  })();

  const selectedCount = selected.length;

  return (
    <div className="ru-board">
      <div className="ru-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="ru-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 차례 · 타일더미 잔량 · ⏱ · 내 등록 여부 */}
      <div className={`ru-status-bar ${isMyTurn ? 'mine' : ''}`}>
        <div className="ru-status-row">
          <span className="ru-status-chip">🁢 타일더미 {poolLeft}개</span>
          {!isSpectator && (
            <span className={`ru-status-chip meld ${melded ? 'done' : 'todo'}`}>
              {melded
                ? '✔ 등록 완료'
                : `미등록 — ${RU_MELD_MIN}점 필요`}
            </span>
          )}
          {game.endsAt > 0 && (
            <span className={`ru-timer ${remaining <= 15_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="ru-status-title">{headline}</span>
        <span className="ru-status-sub">{subline}</span>
        {game.lastAction && (
          <span className="ru-last-action">
            직전 — {game.lastAction.name}: {game.lastAction.message}
          </span>
        )}
      </div>

      {isSpectator && (
        <div className="ru-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {/* 참가자 띠 — 남은 타일 수 · 등록 여부 · 점수 */}
      <div className="ru-score-strip">
        {players.map((p) => (
          <span
            key={p.seat}
            className={[
              'ru-score-pill',
              p.seat === game.currentSeat ? 'active' : '',
              p.seat === game.yourSeat ? 'me' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="ru-score-name">
              {p.seat === game.currentSeat && '▶ '}
              {p.name}
              {p.seat === game.yourSeat && ' (나)'}
              {p.bot && ' 🤖'}
              {!p.connected && !p.bot && ' ⚠'}
            </span>
            <span className="ru-score-meta">
              <span className="ru-score-count">🁢 {p.rackCount}</span>
              <span className={`ru-score-meld ${p.melded ? 'done' : ''}`}>
                {p.melded ? '등록✔' : '미등록'}
              </span>
              <span className="ru-score-value">{p.score}점</span>
            </span>
          </span>
        ))}
      </div>

      {/* ★ 테이블 — 세트 경계가 명확해야 한다 ★ */}
      <section className="ru-section">
        <div className="ru-section-head">
          <span className="ru-section-title">
            테이블 · 세트 {arrangement.sets.length}개
          </span>
          <span className="ru-section-note">
            그룹 = 색이 다른 같은 숫자 3~4개 · 연속 = 같은 색으로 이어지는{' '}
            {RU_MIN_SET}개 이상
          </span>
        </div>

        <div className="ru-table">
          {arrangement.sets.map((set) => {
            const check = ruValidateSet(set.tiles);
            return (
              <div
                key={set.key}
                className={[
                  'ru-set',
                  check.ok ? 'valid' : 'invalid',
                  set.isNew ? 'new' : '',
                  set.changed && !set.isNew ? 'changed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="ru-set-tiles">
                  {(check.ok ? ruCanonicalOrder(set.tiles) : set.tiles).map(
                    (tile) => {
                      const key = ruTileKey(tile);
                      return (
                        <RummikubTile
                          key={key}
                          tile={tile}
                          selected={selected.includes(key)}
                          fresh={freshKeys.has(key)}
                          onClick={canAct ? () => toggleSelect(key) : undefined}
                          disabled={!canAct}
                        />
                      );
                    },
                  )}
                </div>
                <div className="ru-set-foot">
                  <span className={`ru-set-state ${check.ok ? 'ok' : 'bad'}`}>
                    {check.ok
                      ? `✔ ${check.reason} · ${ruSetScore(set.tiles)}점`
                      : `✕ ${check.reason}`}
                  </span>
                  {canAct && selectedCount > 0 && (
                    <button
                      type="button"
                      className="ru-drop-button"
                      onClick={() => placeSelected(set.key)}
                    >
                      여기에 놓기 ({selectedCount})
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {arrangement.sets.length === 0 && (
            <span className="ru-row-empty">
              아직 테이블에 놓인 세트가 없습니다
            </span>
          )}

          {canAct && (
            <button
              type="button"
              className="ru-new-set-button"
              onClick={placeSelectedInNewSet}
              disabled={selectedCount === 0}
            >
              ➕ 선택한 타일로 새 세트 만들기
              {selectedCount > 0 ? ` (${selectedCount}개)` : ''}
            </button>
          )}
        </div>
      </section>

      {/* 내 받침대 — 나만 볼 수 있습니다 */}
      {!isSpectator && (
        <section className="ru-section ru-my-rack">
          <div className="ru-section-head">
            <span className="ru-section-title">
              내 받침대 {rack.length}개
            </span>
            <span className="ru-section-note">나만 볼 수 있습니다</span>
          </div>

          <div className="ru-rack-sort" role="group" aria-label="받침대 정렬">
            {(
              [
                ['none', '받은 순'],
                ['color', '색순'],
                ['num', '숫자순'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`ru-sort-option ${rackSort === mode ? 'active' : ''}`}
                aria-pressed={rackSort === mode}
                onClick={() => setRackSort(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ru-rack">
            {rack.map((tile) => {
              const key = ruTileKey(tile);
              return (
                <RummikubTile
                  key={key}
                  tile={tile}
                  selected={selected.includes(key)}
                  onClick={canAct ? () => toggleSelect(key) : undefined}
                  disabled={!canAct}
                />
              );
            })}
            {rack.length === 0 && (
              <span className="ru-row-empty">받침대가 비었습니다 🎉</span>
            )}
          </div>

          {canAct && (
            <p className="ru-rack-hint">
              타일을 탭해 고른 뒤 세트의 <b>여기에 놓기</b> 를 누르거나{' '}
              <b>새 세트 만들기</b> 를 누르세요. 테이블 위 타일도 골라서 옮길 수
              있습니다(숫자조합).
            </p>
          )}
        </section>
      )}

      {/* 선택 상태 띠 */}
      {canAct && selectedCount > 0 && (
        <div className="ru-select-bar">
          <span className="ru-select-text">
            🖐 {selectedCount}개 선택됨 — 놓을 곳을 고르세요
          </span>
          <div className="ru-select-buttons">
            <button
              type="button"
              className="ru-ghost-button"
              onClick={returnSelectedToRack}
              disabled={!returnable}
              title={
                returnable
                  ? '이번 차례에 내려놓은 내 타일을 받침대로 되돌립니다'
                  : '테이블에 원래 있던 타일은 받침대로 가져올 수 없습니다'
              }
            >
              받침대로
            </button>
            <button
              type="button"
              className="ru-ghost-button"
              onClick={() => setSelected([])}
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      {/* 하단 행동 바 — 확정 / 가져오기 / 되돌리기 */}
      {!isSpectator && isMyTurn && game.phase === 'turn' && (
        <div className="ru-action-bar">
          <span className="ru-action-text">
            {dirty
              ? `이번 차례에 내 타일 ${freshKeys.size}개를 냈습니다${
                  manipulated ? ' · 숫자조합 진행 중' : ''
                }`
              : '아직 아무것도 놓지 않았습니다'}
          </span>

          {blockers.length > 0 && dirty && (
            <ul className="ru-blockers">
              {blockers.map((reason) => (
                <li key={reason}>⚠ {reason}</li>
              ))}
            </ul>
          )}

          <span className="ru-action-warn">
            확정하면 테이블 전체가 서버로 갑니다 — 서버가 거부하면{' '}
            <b>차례 시작 상태로 통째로 되돌아갑니다</b>
          </span>

          <div className="ru-action-buttons">
            <button
              type="button"
              className="ru-primary-button"
              onClick={handleCommit}
              disabled={!canCommit}
            >
              확정하기
            </button>
            <button
              type="button"
              className="ru-ghost-button"
              onClick={handleDraw}
              disabled={!canAct || dirty}
              title={
                dirty
                  ? '되돌리기를 먼저 누르면 타일을 가져올 수 있습니다'
                  : '타일더미에서 1개 가져오고 차례를 끝냅니다'
              }
            >
              가져오기
            </button>
            <button
              type="button"
              className="ru-ghost-button"
              onClick={undoLast}
              disabled={!canAct || !dirty}
            >
              한 수 취소
            </button>
            <button
              type="button"
              className="ru-ghost-button danger"
              onClick={resetLocal}
              disabled={!canAct || !dirty}
            >
              되돌리기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
