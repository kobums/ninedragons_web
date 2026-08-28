import { useEffect, useState } from 'react';
import type {
  BGCard,
  BGCardInfo,
  BGEvent,
  BGGameState,
  BGPlayContext,
  BGPlayPayload,
  BGPlayerView,
  BGShootContext,
  BGTargetCheck,
} from '../../types/bang';
import {
  BG_COLOR_LABEL,
  BG_DISCARD_SECONDS,
  BG_PANIC_RANGE,
  BG_RESPOND_SECONDS,
  BG_STORE_SECONDS,
  bgBangCheck,
  bgCardFace,
  bgCardInfo,
  bgCardLabel,
  bgCardName,
  bgDiscardNeed,
  bgDistanceLabel,
  bgMustRespond,
  bgPendingDemand,
  bgPendingTitle,
  bgPlayCheck,
  bgRankLabel,
  bgRoleIcon,
  bgRoleName,
  bgSuitIsRed,
  bgSuitSymbol,
  bgTargetCheck,
  bgUnlimitedBang,
  bgWeaponName,
  bgWeaponRange,
} from '../../types/bang';
import type { BGToast } from '../../hooks/useBangGameState';
import './BangBoard.css';

interface BangBoardProps {
  game: BGGameState;
  toasts: BGToast[];
  onPlay: (payload: BGPlayPayload) => void;
  // index 생략 = 포기
  onRespond: (index?: number) => void;
  onPick: (index: number) => void;
  onDiscard: (indexes: number[]) => void;
  onEndTurn: () => void;
}

// ---------- 카드 한 장 ----------
// 외부 에셋 없이 이모지 + 색 + 한글 이름으로 그린다. 무늬(♠♥♦♣)와 숫자는
// 술통·감옥·다이너마이트의 "뒤집기" 판정에 쓰이므로 어느 화면에서도 지우지
// 않는다 (안 보이면 게임이 안 된다).
function BangCardTile({
  card,
  reason,
  ok,
  selected = false,
  actionable = false,
  compact = false,
  badge,
  onTap,
}: {
  card: BGCard;
  reason?: string;
  ok?: boolean;
  selected?: boolean;
  actionable?: boolean;
  compact?: boolean;
  badge?: string;
  onTap?: () => void;
}) {
  const info = bgCardInfo(card.kind);
  const suit = bgSuitSymbol(card.suit);
  const rank = bgRankLabel(card.rank);
  const red = bgSuitIsRed(card.suit);

  const className = [
    'bg-card',
    `c-${info.color}`,
    compact ? 'compact' : '',
    ok === undefined ? '' : ok ? 'ok' : 'blocked',
    selected ? 'selected' : '',
    actionable ? 'actionable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      {/* 무늬 + 숫자 — 뒤집기 판정의 근거라 가장 먼저 읽히게 둔다 */}
      <span className={`bg-card-face ${red ? 'red' : 'black'}`}>
        <span className="bg-card-suit">{suit}</span>
        <span className="bg-card-rank">{rank}</span>
      </span>
      <span className="bg-card-icon" aria-hidden="true">
        {info.icon}
      </span>
      <span className="bg-card-name">{info.name}</span>
      {!compact && (
        <span className="bg-card-tag">
          {BG_COLOR_LABEL[info.color]}
          {info.range !== undefined ? ` · 사거리 ${info.range}` : ''}
        </span>
      )}
      {!compact && reason && (
        <span className={`bg-card-reason ${ok === false ? 'lack' : 'ok'}`}>
          {reason}
        </span>
      )}
      {badge && <span className="bg-card-badge">{badge}</span>}
    </>
  );

  const label = `${bgCardLabel(card)}${reason ? ` · ${reason}` : ''}`;

  if (!actionable || !onTap) {
    return (
      <div className={className} title={label}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onTap}
      disabled={ok === false}
      aria-label={label}
      title={label}
    >
      {body}
    </button>
  );
}

// 남의 손패 — 뒷면. 캣 벌로우·강탈!은 보이지 않는 카드를 지목한다.
function BangCardBack({
  index,
  selected,
  onTap,
}: {
  index: number;
  selected: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      className={`bg-card back ${selected ? 'selected' : ''}`}
      onClick={onTap}
      aria-label={`손패 ${index + 1}번째 카드 (뒷면)`}
    >
      <span className="bg-card-back-mark" aria-hidden="true">
        🂠
      </span>
      <span className="bg-card-name">손패 {index + 1}</span>
      <span className="bg-card-tag">뒷면 — 무엇인지 모릅니다</span>
    </button>
  );
}

// 체력 하트 — 남은 만큼 붉게, 잃은 만큼 흐리게
function BangHearts({ hp, maxHp }: { hp: number; maxHp: number }) {
  const total = Math.max(0, Math.min(maxHp, 8));
  return (
    <span
      className="bg-hearts"
      role="img"
      aria-label={`체력 ${hp} / ${maxHp}`}
      title={`체력 ${hp} / ${maxHp}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`bg-heart ${i < hp ? 'on' : 'off'}`}>
          {i < hp ? '❤' : '🖤'}
        </span>
      ))}
      <span className="bg-hearts-num">
        {hp}/{maxHp}
      </span>
    </span>
  );
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: BGEvent, game: BGGameState): string {
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
    case 'turn':
      return `🤠 ${name(event.seat)}님의 차례`;
    case 'draw':
      return `🃏 ${name(event.seat)}님이 카드를 뽑았습니다`;
    case 'flip':
      return '🎴 덱을 뒤집었습니다';
    case 'dynamite':
      return '🧨 다이너마이트가 터졌습니다';
    case 'jail':
      return '⛓️ 감옥 판정';
    case 'bang':
      return `💥 ${name(event.seat)}님이 뱅!을 쐈습니다`;
    case 'miss':
      return '💨 빗나감!으로 막았습니다';
    case 'barrel':
      return '🛢️ 술통으로 피했습니다';
    case 'hit':
      return `💔 ${name(event.seat)}님이 체력을 잃었습니다`;
    case 'heal':
      return `🍺 ${name(event.seat)}님이 체력을 회복했습니다`;
    case 'duel':
      return '⚔️ 결투가 벌어졌습니다';
    case 'gatling':
      return '🔥 기관총 — 전원 대응';
    case 'indians':
      return '🏹 인디언! — 전원 대응';
    case 'store':
      return '🏪 잡화점이 열렸습니다';
    case 'eliminated':
      return `💀 ${name(event.seat)}님이 탈락했습니다`;
    case 'reward':
      return '🎁 무법자를 잡아 카드 3장을 뽑습니다';
    case 'penalty':
      return '⭐ 보안관이 부관을 쏴 손패·장비를 전부 버립니다';
    case 'discard':
      return `🗑️ ${name(event.seat)}님이 손패를 줄였습니다`;
    case 'auto_action':
      return '⏳ 시간 초과 — 자동으로 행동했습니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    // react 등 토스트로 쓰지 않는 이벤트 — 훅에서 걸러지지만 방어
    default:
      return '';
  }
}

export function BangBoard({
  game,
  toasts,
  onPlay,
  onRespond,
  onPick,
  onDiscard,
  onEndTurn,
}: BangBoardProps) {
  // ---------- 로컬 선택 ----------
  const [selectedHand, setSelectedHand] = useState<number | null>(null);
  const [targetSeat, setTargetSeat] = useState<number | null>(null);
  const [targetCardIndex, setTargetCardIndex] = useState<number | null>(null);
  const [discardSel, setDiscardSel] = useState<number[]>([]);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(bg_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 진행 여부는 스냅샷(phase·currentSeat·pending)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  // 이번 차례에 뱅!을 썼는지. 서버가 yourBangUsed 를 주면 그 값을 쓰고,
  // 없으면 여기서 추적한다 (한 차례 1장 제한 안내용).
  const [localBangUsed, setLocalBangUsed] = useState(false);

  const players = game.players ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)·탈락자는 행동 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;
  const iAmAlive = !isSpectator && !!me?.alive;
  const isDead = !isSpectator && !me?.alive;

  const myHand = game.yourHand ?? [];
  const myEquip = me?.equipment ?? [];
  const storeCards = game.storeCards ?? [];
  const pending = game.pending ?? null;
  const myHp = me?.hp ?? 0;
  const myMaxHp = me?.maxHp ?? 0;
  const myRange = bgWeaponRange(myEquip);
  const unlimited = bgUnlimitedBang(myEquip);
  const bangUsed = game.yourBangUsed ?? localBangUsed;
  const aliveCount = players.filter((p) => p.alive).length;

  const isMyTurn = iAmAlive && game.currentSeat === game.yourSeat;
  const mustRespond = bgMustRespond(
    pending,
    game.phase,
    game.yourSeat,
    iAmAlive,
  );

  // 스냅샷 컨텍스트(phase/currentSeat/pending)가 바뀌면 로컬 선택과 연타
  // 잠금을 리셋한다 — 남아 있던 선택이 다음 상황에 잘못 확정되지 않게.
  const ctxKey = [
    game.phase,
    game.currentSeat,
    pending?.kind ?? '',
    pending?.bySeat ?? -1,
    pending?.targetSeat ?? -1,
    (pending?.passed ?? []).length,
  ].join('|');
  useEffect(() => {
    setSelectedHand(null);
    setTargetSeat(null);
    setTargetCardIndex(null);
    setDiscardSel([]);
    setSubmitted(false);
  }, [ctxKey]);

  // 뱅! 사용 여부는 차례가 끝나면 풀린다 (phase 왕복으로는 리셋하지 않는다)
  useEffect(() => {
    if (!isMyTurn) setLocalBangUsed(false);
  }, [isMyTurn]);

  // 내 손패·체력이 실제로 바뀌면(=서버가 내 행동을 처리했으면) 즉시 잠금 해제.
  // 한 차례에 카드를 여러 장 내는 게임이라 2초씩 묶이면 답답하다.
  const mySig = `${myHand.length}|${myHp}|${myEquip.length}|${game.deckLeft}`;
  useEffect(() => {
    setSubmitted(false);
  }, [mySig]);

  const lockSubmit = () => {
    setSubmitted(true);
    // 스냅샷이 오지 않아도 2초 뒤에는 풀어 재시도할 수 있게 한다
    setTimeout(() => setSubmitted(false), 2000);
  };

  // ---------- 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화) ----------
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
  const seconds = Math.ceil(remaining / 1000);
  const clock = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}초`;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  // ---------- 판정 컨텍스트 ----------
  const shootCtx: BGShootContext = {
    mySeat: game.yourSeat,
    range: myRange,
    bangUsed,
    unlimited,
    isMyTurn,
  };
  // "사거리 안에 상대가 있는가" 는 뱅! 사용 여부와 무관하게 센다
  const rangeCtx: BGShootContext = { ...shootCtx, bangUsed: false };

  const hasBangTarget = players.some((p) => bgBangCheck(p, rangeCtx).ok);
  const hasNearTarget = players.some(
    (p) =>
      p.seat !== game.yourSeat &&
      p.alive &&
      (p.distanceFromYou ?? -1) >= 0 &&
      (p.distanceFromYou ?? 99) <= BG_PANIC_RANGE,
  );
  const hasOtherTarget = players.some(
    (p) => p.seat !== game.yourSeat && p.alive,
  );

  const playCtx: BGPlayContext = {
    ...shootCtx,
    hp: myHp,
    maxHp: myMaxHp,
    alivePlayers: aliveCount,
    equipment: myEquip,
    hasBangTarget,
    hasNearTarget,
    hasOtherTarget,
  };

  const canAct = !isSpectator && iAmAlive && !submitted;

  // ---------- 선택된 카드 ----------
  const selectedCard: BGCard | null =
    selectedHand !== null && selectedHand < myHand.length
      ? myHand[selectedHand]
      : null;
  const selectedInfo: BGCardInfo | null = selectedCard
    ? bgCardInfo(selectedCard.kind)
    : null;
  const selectedCheck: BGTargetCheck | null = selectedCard
    ? bgPlayCheck(selectedCard, playCtx)
    : null;
  const needsTarget = selectedInfo !== null && selectedInfo.rule !== 'none';
  const targetPlayer =
    targetSeat === null
      ? null
      : (players.find((p) => p.seat === targetSeat) ?? null);

  // 대상 좌석 판정 — 뱅!은 사거리, 나머지는 카드별 규칙
  const seatCheckFor = (card: BGCard, p: BGPlayerView): BGTargetCheck =>
    card.kind === 'bang'
      ? bgBangCheck(p, shootCtx)
      : bgTargetCheck(card.kind, p, game.yourSeat);

  // ---------- 행동 ----------
  const handlePlay = () => {
    if (!canAct || !selectedCard || selectedHand === null) return;
    if (!selectedCheck?.ok) return;
    if (needsTarget && targetSeat === null) return;
    if (selectedInfo?.needsCard && targetCardIndex === null) return;
    lockSubmit();
    if (selectedCard.kind === 'bang') setLocalBangUsed(true);
    const payload: BGPlayPayload = { index: selectedHand };
    if (needsTarget && targetSeat !== null) payload.targetSeat = targetSeat;
    if (selectedInfo?.needsCard && targetCardIndex !== null) {
      payload.targetCardIndex = targetCardIndex;
    }
    onPlay(payload);
    setSelectedHand(null);
    setTargetSeat(null);
    setTargetCardIndex(null);
  };

  const handleRespond = (index?: number) => {
    if (!canAct || !mustRespond) return;
    lockSubmit();
    onRespond(index);
  };

  const handlePick = (index: number) => {
    if (!canAct || game.phase !== 'store_pick') return;
    if (game.currentSeat !== game.yourSeat) return;
    lockSubmit();
    onPick(index);
  };

  const handleDiscard = () => {
    if (!canAct || game.phase !== 'discard') return;
    lockSubmit();
    onDiscard(discardSel);
  };

  const handleEndTurn = () => {
    if (!canAct || !isMyTurn) return;
    lockSubmit();
    onEndTurn();
  };

  const toggleDiscard = (index: number) => {
    setDiscardSel((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index],
    );
  };

  // ---------- 지금 할 일 ----------
  const discardNeed = bgDiscardNeed(myHand.length, myHp);
  const myPick = game.phase === 'store_pick' && game.currentSeat === game.yourSeat;
  const myDiscard = game.phase === 'discard' && isMyTurn;

  const headline = (() => {
    if (isSpectator) return '👀 관전 중입니다';
    if (isDead) return '💀 탈락했습니다 — 관전만 할 수 있습니다';
    if (mustRespond && pending) {
      return `🛡️ ${bgCardName(pending.need)}(으)로 대응하세요`;
    }
    if (myPick) return '🏪 잡화점 — 가져갈 카드를 고르세요';
    if (myDiscard) {
      return discardNeed > 0
        ? `🗑️ 손패를 ${myHp}장까지 줄이세요 (${discardNeed}장 버립니다)`
        : '🗑️ 버릴 카드가 없습니다 — 그대로 넘어갑니다';
    }
    if (isMyTurn && game.phase === 'draw') return '🃏 카드를 뽑는 중입니다';
    if (isMyTurn) return '🤠 카드를 쓰거나 차례를 끝내세요';
    if (game.phase === 'respond' && pending) {
      return `⏳ ${nameOf(pending.bySeat)}님의 ${bgCardName(pending.kind)} — 대응을 기다리는 중`;
    }
    return `${nameOf(game.currentSeat)}님의 차례입니다`;
  })();

  const subline = (() => {
    if (isSpectator) return '관전 중 — 행동할 수 없습니다';
    if (isDead) return '탈락자는 카드를 낼 수 없습니다';
    if (mustRespond && pending) return bgPendingDemand(pending);
    if (myPick) return '공개된 카드 중 1장을 가져갑니다';
    if (myDiscard) {
      return `손패 ${myHand.length}장 · 체력 ${myHp} — 체력 수를 넘는 만큼 버립니다`;
    }
    return `내 무기 ${bgWeaponName(myEquip)} · 사거리 ${myRange} · 이번 차례 뱅! ${
      unlimited ? '무제한(볼캐닉)' : bangUsed ? '사용함' : '가능'
    }`;
  })();

  // ---------- 원탁 배치 ----------
  // 내 좌석을 아래쪽(6시)에 두고 좌석 순서대로 시계방향으로 앉힌다.
  const ordered = (() => {
    const sorted = [...players].sort((a, b) => a.seat - b.seat);
    if (sorted.length === 0) return sorted;
    const start = Math.max(
      0,
      sorted.findIndex((p) => p.seat === game.yourSeat),
    );
    return [...sorted.slice(start), ...sorted.slice(0, start)];
  })();

  const seatStyle = (index: number, total: number) => {
    // 화면 좌표는 아래쪽이 +y 라 90°가 6시 방향 = 내 자리
    const angle = Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, total);
    const x = 50 + 37 * Math.cos(angle);
    const y = 50 + 37 * Math.sin(angle);
    return { '--x': `${x}%`, '--y': `${y}%` } as React.CSSProperties;
  };

  // 아직 대응하지 않은 좌석 (대기 안내용)
  const waitingSeats = pending
    ? players
        .filter((p) => {
          if (!p.alive) return false;
          if ((pending.passed ?? []).includes(p.seat)) return false;
          if (pending.targetSeat >= 0) return p.seat === pending.targetSeat;
          return p.seat !== pending.bySeat;
        })
        .map((p) => p.name)
    : [];

  const discardTop = game.discardTop ?? null;

  return (
    <div className="bg-board">
      <div className="bg-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="bg-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 덱 · 버린 카드 · 생존자 · ⏱ */}
      <div className={`bg-status-bar ${game.phase}`}>
        <div className="bg-status-row">
          <span className="bg-status-chip">🂠 남은 카드 {game.deckLeft}</span>
          <span className="bg-status-chip">🤠 생존 {aliveCount}명</span>
          {discardTop && (
            <span className="bg-status-chip discard">
              🗑️ 버린 카드 {bgCardName(discardTop.kind)}
              <span
                className={`bg-inline-face ${
                  bgSuitIsRed(discardTop.suit) ? 'red' : 'black'
                }`}
              >
                {bgCardFace(discardTop)}
              </span>
            </span>
          )}
          {game.endsAt > 0 && (
            <span className={`bg-timer ${seconds <= 10 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
      </div>

      {/* 지금 할 일 — 이 게임에서 가장 중요한 한 문장 */}
      <div
        className={`bg-headline ${mustRespond ? 'respond' : isMyTurn ? 'mine' : 'idle'}`}
      >
        <span className="bg-headline-title">{headline}</span>
        <span className="bg-headline-sub">{subline}</span>
      </div>

      {isSpectator && (
        <div className="bg-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}
      {isDead && (
        <div className="bg-note danger">
          💀 탈락했습니다 — 남은 판을 지켜볼 수 있습니다
        </div>
      )}

      {game.lastAction && (
        <div className="bg-last-action">
          직전 — {game.lastAction.name}: {game.lastAction.message}
        </div>
      )}

      {/* ---------- 대응 창 ---------- */}
      {pending && game.phase === 'respond' && (
        <section
          className={`bg-section ${mustRespond ? 'bg-focus bg-respond' : ''}`}
        >
          <div className="bg-section-head">
            <span className="bg-section-title">대응</span>
            <span className="bg-section-note">
              {mustRespond
                ? `제한 ${BG_RESPOND_SECONDS}초`
                : waitingSeats.length > 0
                  ? `${waitingSeats.join(' · ')} 대응 중`
                  : '처리 중'}
            </span>
          </div>

          <p className="bg-respond-title">
            {bgPendingTitle(
              pending,
              nameOf(pending.bySeat),
              pending.targetSeat >= 0 ? nameOf(pending.targetSeat) : '전원',
            )}
          </p>
          <p className="bg-respond-demand">{bgPendingDemand(pending)}</p>

          {mustRespond && game.endsAt > 0 && (
            <div className={`bg-big-timer ${seconds <= 5 ? 'urgent' : ''}`}>
              {seconds}
              <span className="bg-big-timer-unit">초 남음</span>
            </div>
          )}

          {mustRespond ? (
            <>
              <div className="bg-card-grid">
                {myHand.map((card, index) =>
                  card.kind === pending.need ? (
                    <BangCardTile
                      key={card.id}
                      card={card}
                      ok={canAct}
                      actionable
                      reason={`${bgCardName(card.kind)}(으)로 막습니다`}
                      onTap={() => handleRespond(index)}
                    />
                  ) : null,
                )}
              </div>
              {myHand.every((c) => c.kind !== pending.need) && (
                <p className="bg-section-foot lack">
                  낼 수 있는 {bgCardName(pending.need)}이(가) 손에 없습니다 —
                  포기하면 체력 −1
                </p>
              )}
              <button
                type="button"
                className="bg-ghost-button"
                onClick={() => handleRespond(undefined)}
                disabled={!canAct}
              >
                포기 (체력 −1)
              </button>
            </>
          ) : (
            <p className="bg-section-foot">
              {waitingSeats.length > 0
                ? `${waitingSeats.join(' · ')}님의 대응을 기다리는 중입니다`
                : '처리 중입니다...'}
            </p>
          )}
        </section>
      )}

      {/* ---------- 잡화점 ---------- */}
      {game.phase === 'store_pick' && (
        <section className={`bg-section ${myPick ? 'bg-focus' : ''}`}>
          <div className="bg-section-head">
            <span className="bg-section-title">🏪 잡화점</span>
            <span className="bg-section-note">
              {myPick
                ? `내 차례 — 1장 고르기 (제한 ${BG_STORE_SECONDS}초)`
                : `${nameOf(game.currentSeat)}님이 고르는 중`}
            </span>
          </div>
          <div className="bg-card-grid">
            {storeCards.map((card, index) => (
              <BangCardTile
                key={`${card.id}-${index}`}
                card={card}
                ok={myPick && canAct}
                actionable={myPick}
                reason={myPick ? '이 카드를 가져갑니다' : '공개된 카드'}
                onTap={() => handlePick(index)}
              />
            ))}
            {storeCards.length === 0 && (
              <span className="bg-row-empty">남은 카드가 없습니다</span>
            )}
          </div>
        </section>
      )}

      {/* ---------- 손패 줄이기 ---------- */}
      {myDiscard && (
        <section className="bg-section bg-focus">
          <div className="bg-section-head">
            <span className="bg-section-title">🗑️ 손패 줄이기</span>
            <span className="bg-section-note">
              체력 {myHp}장까지 · 제한 {BG_DISCARD_SECONDS}초
            </span>
          </div>
          <p className="bg-section-foot">
            {discardNeed > 0
              ? `${discardNeed}장을 버려야 합니다 — ${discardSel.length}/${discardNeed}장 골랐습니다`
              : '버릴 카드가 없습니다'}
          </p>
          <div className="bg-card-grid">
            {myHand.map((card, index) => (
              <BangCardTile
                key={card.id}
                card={card}
                ok
                actionable
                selected={discardSel.includes(index)}
                reason={
                  discardSel.includes(index)
                    ? '버릴 카드로 골랐습니다'
                    : '누르면 버릴 카드로 고릅니다'
                }
                onTap={() => toggleDiscard(index)}
              />
            ))}
          </div>
          <button
            type="button"
            className="bg-primary-button"
            onClick={handleDiscard}
            disabled={!canAct || discardSel.length !== discardNeed}
          >
            {discardSel.length === discardNeed
              ? `${discardSel.length}장 버리고 차례 끝내기`
              : `${Math.max(0, discardNeed - discardSel.length)}장 더 골라야 합니다`}
          </button>
        </section>
      )}

      {/* ---------- 내 정체 ---------- */}
      {!isSpectator && me && (
        <section className="bg-section">
          <div className="bg-section-head">
            <span className="bg-section-title">내 정체</span>
            <span className="bg-section-note">나만 볼 수 있습니다</span>
          </div>
          <div className="bg-me-row">
            <span className={`bg-role-chip r-${game.yourRole ?? ''}`}>
              {bgRoleIcon(game.yourRole)} {bgRoleName(game.yourRole)}
            </span>
            <BangHearts hp={myHp} maxHp={myMaxHp} />
            <span className="bg-me-stat">
              🔫 {bgWeaponName(myEquip)} · 사거리 {myRange}
            </span>
          </div>
          {myEquip.length > 0 && (
            <div className="bg-card-grid compact">
              {myEquip.map((card) => (
                <BangCardTile key={card.id} card={card} compact />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------- 원탁 ---------- */}
      <section className="bg-section">
        <div className="bg-section-head">
          <span className="bg-section-title">원탁</span>
          <span className="bg-section-note">
            내 기준 거리 · 탈락자는 거리 계산에서 빠집니다
          </span>
        </div>
        <div className="bg-table">
          <div className="bg-table-center">
            <span className="bg-table-center-line">🂠 {game.deckLeft}장</span>
            <span className="bg-table-center-line">
              사거리 {myRange}
            </span>
          </div>
          {ordered.map((p, index) => {
            const shoot = bgBangCheck(p, shootCtx);
            const dist = bgDistanceLabel(p, game.yourSeat);
            const inRange =
              p.seat !== game.yourSeat &&
              p.alive &&
              (p.distanceFromYou ?? 99) <= myRange;
            return (
              <div
                key={p.seat}
                className={[
                  'bg-seat',
                  p.seat === game.currentSeat ? 'active' : '',
                  p.seat === game.yourSeat ? 'me' : '',
                  !p.alive ? 'dead' : '',
                  inRange ? 'in-range' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={seatStyle(index, ordered.length)}
                title={`${p.name} · ${dist}${
                  p.seat === game.yourSeat ? '' : ` · ${shoot.reason}`
                }`}
              >
                <span className="bg-seat-name">
                  {p.seat === game.currentSeat && '▶ '}
                  {p.name}
                  {p.bot && ' 🤖'}
                  {p.seat === game.yourSeat && ' (나)'}
                </span>
                {/* 거리는 이 게임의 핵심이라 좌석에서 가장 크게 읽힌다 */}
                <span
                  className={`bg-seat-dist ${
                    p.seat === game.yourSeat
                      ? 'self'
                      : !p.alive
                        ? 'dead'
                        : inRange
                          ? 'in'
                          : 'out'
                  }`}
                >
                  {p.seat === game.yourSeat || !p.alive
                    ? dist
                    : (p.distanceFromYou ?? -1) >= 0
                      ? p.distanceFromYou
                      : '—'}
                </span>
                {p.seat !== game.yourSeat && p.alive && (
                  <span className="bg-seat-dist-label">
                    {(p.distanceFromYou ?? -1) >= 0 ? '거리' : ''}
                  </span>
                )}
                <BangHearts hp={p.hp} maxHp={p.maxHp} />
                <span className="bg-seat-equip">
                  {(p.equipment ?? []).map((c) => (
                    <span
                      key={c.id}
                      className="bg-seat-equip-icon"
                      title={bgCardLabel(c)}
                    >
                      {bgCardInfo(c.kind).icon}
                    </span>
                  ))}
                  <span className="bg-seat-hand">🃏 {p.handCount}</span>
                </span>
                {p.role && (
                  <span className={`bg-seat-role r-${p.role}`}>
                    {bgRoleIcon(p.role)} {bgRoleName(p.role)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- 좌석 상세 ---------- */}
      <section className="bg-section">
        <div className="bg-section-head">
          <span className="bg-section-title">참가자</span>
          <span className="bg-section-note">
            역할은 보안관만 공개 · 나머지는 탈락 시 공개
          </span>
        </div>
        <div className="bg-players">
          {ordered.map((p) => {
            const shoot = bgBangCheck(p, shootCtx);
            const isMeRow = p.seat === game.yourSeat;
            return (
              <div
                key={p.seat}
                className={[
                  'bg-player',
                  p.seat === game.currentSeat ? 'active' : '',
                  isMeRow ? 'me' : '',
                  !p.alive ? 'dead' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="bg-player-head">
                  <span className="bg-player-name">
                    {p.seat === game.currentSeat && '▶ '}
                    {p.name}
                    {isMeRow && ' (나)'}
                    {p.bot && ' 🤖'}
                  </span>
                  <span className="bg-player-badges">
                    {!p.connected && !p.bot && p.alive && (
                      <span className="bg-badge off">끊김</span>
                    )}
                    {!p.alive && <span className="bg-badge dead">탈락</span>}
                    {p.role && (
                      <span className={`bg-badge role r-${p.role}`}>
                        {bgRoleIcon(p.role)} {bgRoleName(p.role)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="bg-player-stats">
                  <BangHearts hp={p.hp} maxHp={p.maxHp} />
                  <span>🃏 손패 {p.handCount}장</span>
                  <span className="bg-player-dist">
                    📏 {bgDistanceLabel(p, game.yourSeat)}
                  </span>
                </div>
                {/* 쏠 수 없는 대상은 사유를 그대로 보여준다 */}
                {!isMeRow && !isSpectator && iAmAlive && (
                  <p
                    className={`bg-player-reason ${shoot.ok ? 'ok' : 'lack'}`}
                  >
                    {shoot.ok ? '💥 ' : '🚫 '}
                    {shoot.reason}
                  </p>
                )}
                <div className="bg-player-equip">
                  {(p.equipment ?? []).map((card) => (
                    <span
                      key={card.id}
                      className={`bg-mini-card c-${bgCardInfo(card.kind).color}`}
                      title={bgCardLabel(card)}
                    >
                      <span
                        className={`bg-inline-face ${
                          bgSuitIsRed(card.suit) ? 'red' : 'black'
                        }`}
                      >
                        {bgCardFace(card)}
                      </span>
                      <span className="bg-mini-name">
                        {bgCardInfo(card.kind).icon}{' '}
                        {bgCardName(card.kind)}
                      </span>
                    </span>
                  ))}
                  {(p.equipment ?? []).length === 0 && (
                    <span className="bg-mini-empty">앞에 깔린 카드 없음</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- 내 손패 ---------- */}
      {!isSpectator && !isDead && !myDiscard && (
        <section
          className={`bg-section ${isMyTurn && game.phase === 'turn' ? 'bg-focus' : ''}`}
        >
          <div className="bg-section-head">
            <span className="bg-section-title">내 손패 {myHand.length}장</span>
            <span className="bg-section-note">
              {isMyTurn && game.phase === 'turn'
                ? '누르면 아래에서 대상을 고릅니다'
                : '나만 볼 수 있습니다'}
            </span>
          </div>
          <div className="bg-card-grid">
            {myHand.map((card, index) => {
              const check = bgPlayCheck(card, playCtx);
              return (
                <BangCardTile
                  key={card.id}
                  card={card}
                  ok={check.ok && canAct}
                  actionable={isMyTurn && game.phase === 'turn'}
                  selected={selectedHand === index}
                  reason={check.reason}
                  onTap={() => {
                    setSelectedHand(index);
                    setTargetSeat(null);
                    setTargetCardIndex(null);
                  }}
                />
              );
            })}
            {myHand.length === 0 && (
              <span className="bg-row-empty">손패가 없습니다</span>
            )}
          </div>
        </section>
      )}

      {/* ---------- 카드 사용 · 대상 고르기 ---------- */}
      {!isSpectator &&
        !isDead &&
        isMyTurn &&
        game.phase === 'turn' &&
        selectedCard &&
        selectedInfo &&
        selectedCheck && (
          <section className="bg-section bg-focus">
            <div className="bg-section-head">
              <span className="bg-section-title">
                {selectedInfo.icon} {selectedInfo.name} 사용
              </span>
              <span className="bg-section-note">
                {bgCardFace(selectedCard)} · {BG_COLOR_LABEL[selectedInfo.color]}
              </span>
            </div>
            <p className="bg-effect-desc">{selectedInfo.desc}</p>
            <p
              className={`bg-section-foot ${selectedCheck.ok ? 'ok' : 'lack'}`}
            >
              {selectedCheck.ok ? '✅ ' : '🚫 '}
              {selectedCheck.reason}
            </p>

            {needsTarget && (
              <>
                <p className="bg-step">1) 대상을 고르세요</p>
                <div className="bg-target-grid">
                  {players.map((p) => {
                    const check = seatCheckFor(selectedCard, p);
                    const selected = targetSeat === p.seat;
                    return (
                      <button
                        key={p.seat}
                        type="button"
                        className={`bg-target ${check.ok ? 'ok' : 'blocked'} ${
                          selected ? 'selected' : ''
                        }`}
                        onClick={() => {
                          if (!check.ok) return;
                          setTargetSeat(p.seat);
                          setTargetCardIndex(null);
                        }}
                        disabled={!check.ok || !canAct}
                        aria-label={`${p.name} — ${check.reason}`}
                      >
                        <span className="bg-target-title">
                          {p.name}
                          {p.bot && ' 🤖'} ·{' '}
                          {bgDistanceLabel(p, game.yourSeat)}
                        </span>
                        <span
                          className={`bg-target-reason ${check.ok ? 'ok' : 'lack'}`}
                        >
                          {check.reason}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* 캣 벌로우·강탈! — 대상의 카드 1장까지 고른다 */}
            {selectedInfo.needsCard && targetPlayer && (
              <>
                <p className="bg-step">
                  2) {targetPlayer.name}님의 어떤 카드를 노릴까요? (손패는
                  뒷면이라 무엇인지 모릅니다)
                </p>
                <div className="bg-card-grid">
                  {Array.from({ length: targetPlayer.handCount }).map(
                    (_, i) => (
                      <BangCardBack
                        key={`hand-${i}`}
                        index={i}
                        selected={targetCardIndex === i}
                        onTap={() => setTargetCardIndex(i)}
                      />
                    ),
                  )}
                  {(targetPlayer.equipment ?? []).map((card, i) => (
                    <BangCardTile
                      key={card.id}
                      card={card}
                      ok
                      actionable
                      badge="장비"
                      selected={
                        targetCardIndex === targetPlayer.handCount + i
                      }
                      reason="앞에 깔린 카드입니다"
                      onTap={() =>
                        setTargetCardIndex(targetPlayer.handCount + i)
                      }
                    />
                  ))}
                  {targetPlayer.handCount === 0 &&
                    (targetPlayer.equipment ?? []).length === 0 && (
                      <span className="bg-row-empty">가진 카드가 없습니다</span>
                    )}
                </div>
              </>
            )}

            <div className="bg-confirm-row">
              <button
                type="button"
                className="bg-primary-button"
                onClick={handlePlay}
                disabled={
                  !canAct ||
                  !selectedCheck.ok ||
                  (needsTarget && targetSeat === null) ||
                  (selectedInfo.needsCard && targetCardIndex === null)
                }
              >
                {!selectedCheck.ok
                  ? '지금은 낼 수 없습니다'
                  : needsTarget && targetSeat === null
                    ? '대상을 고르세요'
                    : selectedInfo.needsCard && targetCardIndex === null
                      ? '노릴 카드를 고르세요'
                      : `${selectedInfo.icon} ${selectedInfo.name} 사용하기`}
              </button>
              <button
                type="button"
                className="bg-ghost-button"
                onClick={() => {
                  setSelectedHand(null);
                  setTargetSeat(null);
                  setTargetCardIndex(null);
                }}
              >
                선택 취소
              </button>
            </div>
          </section>
        )}

      {/* ---------- 하단 행동 바 ---------- */}
      {!isSpectator && !isDead && isMyTurn && game.phase === 'turn' && (
        <div className="bg-action-bar">
          <span className="bg-action-text">
            {selectedCard
              ? `${bgCardName(selectedCard.kind)} 선택 중`
              : `손패 ${myHand.length}장 · 사거리 ${myRange} · 뱅! ${
                  unlimited ? '무제한' : bangUsed ? '사용함' : '가능'
                }`}
          </span>
          <div className="bg-action-buttons">
            <button
              type="button"
              className="bg-primary-button"
              onClick={handleEndTurn}
              disabled={!canAct}
            >
              차례 끝내기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
