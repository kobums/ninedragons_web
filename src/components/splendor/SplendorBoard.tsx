import { useEffect, useState } from 'react';
import type {
  SLCard,
  SLEvent,
  SLGameState,
  SLGem,
  SLNoble,
  SLPayPlan,
  SLPlayerView,
  SLToken,
} from '../../types/splendor';
import {
  SL_DOUBLE_TAKE_MIN,
  SL_DISTINCT_TAKE,
  SL_GEMS,
  SL_MAX_RESERVED,
  SL_TARGET_POINTS,
  SL_TIERS,
  SL_TOKENS,
  SL_TOKEN_LABEL,
  SL_TOKEN_LIMIT,
  SL_TOKEN_SHAPE,
  slNobleProgress,
  slPlanPurchase,
  slShortageText,
  slTotalCards,
  slTotalTokens,
} from '../../types/splendor';
import type { SLToast } from '../../hooks/useSplendorGameState';
import './SplendorBoard.css';

interface SplendorBoardProps {
  game: SLGameState;
  toasts: SLToast[];
  // 서로 다른 색 3개 또는 같은 색 2개(['ruby','ruby'])
  onTake: (colors: SLGem[]) => void;
  // 공개 카드는 cardId, 덱 맨 위(비공개)는 tier
  onReserve: (cardId?: number, tier?: number) => void;
  onBuy: (cardId: number) => void;
  // 10개 초과분 버리기 (황금도 셈에 들어간다)
  onDiscard: (colors: SLToken[]) => void;
}

// ---------- 보석 아이콘 ----------
// 외부 에셋 없이 인라인 SVG 로 그린다. 색약·흑백 인쇄에서도 구분되도록
// 보석마다 모양이 다르고(마름모·원·팔각·육각·삼각·별) 화면에는 늘
// 한글 이름을 함께 적는다.
export function SplendorGemIcon({
  gem,
  size = 20,
}: {
  gem: SLToken;
  size?: number;
}) {
  const shape = () => {
    switch (gem) {
      // 다이아몬드 — 마름모
      case 'diamond':
        return <polygon points="12,1.5 21,12 12,22.5 3,12" />;
      // 사파이어 — 원
      case 'sapphire':
        return <circle cx="12" cy="12" r="9.6" />;
      // 에메랄드 — 모서리를 깎은 팔각 (에메랄드 컷)
      case 'emerald':
        return (
          <polygon points="7.2,2.4 16.8,2.4 21.6,7.2 21.6,16.8 16.8,21.6 7.2,21.6 2.4,16.8 2.4,7.2" />
        );
      // 루비 — 육각
      case 'ruby':
        return <polygon points="12,1.8 20.8,7 20.8,17 12,22.2 3.2,17 3.2,7" />;
      // 줄마노 — 삼각
      case 'onyx':
        return <polygon points="12,2.4 22,20.8 2,20.8" />;
      // 황금 — 별
      case 'gold':
        return (
          <polygon points="12,1.6 14.9,8.9 22.7,9.4 16.7,14.4 18.6,22 12,17.8 5.4,22 7.3,14.4 1.3,9.4 9.1,8.9" />
        );
    }
  };

  return (
    <svg
      className={`sl-gem-svg gem-${gem}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={`${SL_TOKEN_LABEL[gem]}(${SL_TOKEN_SHAPE[gem]})`}
      focusable="false"
    >
      {shape()}
    </svg>
  );
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: SLEvent, game: SLGameState): string {
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
    case 'take':
      return `${name(event.seat)}님이 토큰을 가져갔습니다`;
    case 'buy':
      return `${name(event.seat)}님이 개발 카드를 구매했습니다`;
    case 'reserve':
      return `${name(event.seat)}님이 개발 카드를 예약했습니다`;
    case 'discard':
      return `${name(event.seat)}님이 토큰을 버렸습니다`;
    case 'noble':
      return `👑 ${name(event.seat)}님이 귀족 타일을 맞이했습니다`;
    case 'last_round':
      return `🏁 ${SL_TARGET_POINTS}점 도달 — 마지막 라운드입니다`;
    case 'auto_action':
      return '⏳ 시간 초과 — 자동으로 행동했습니다';
    case 'auto_discard':
      return '⏳ 시간 초과 — 무작위로 토큰을 버렸습니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    // react 등 토스트로 쓰지 않는 이벤트 — 훅에서 걸러지지만 방어
    default:
      return '';
  }
}

// 왜 못 사는지를 한 줄로. 이 게임의 판단은 전부 비용 계산이라
// "살 수 있다/없다" 보다 "무엇이 몇 개 모자라나" 가 훨씬 중요하다.
function verdictText(plan: SLPayPlan, gold: number): string {
  if (plan.affordable) {
    return plan.goldNeeded > 0
      ? `구매 가능 · 황금 ${plan.goldNeeded}개 사용`
      : '구매 가능';
  }
  const short = slShortageText(plan.shortages);
  const goldUse = Math.min(gold, plan.goldNeeded);
  return goldUse > 0
    ? `${short} 부족 — 황금 ${goldUse}개를 써도 ${plan.stillShort}개 모자랍니다`
    : `${short} 부족 — 모두 ${plan.stillShort}개 모자랍니다`;
}

interface CardTileProps {
  card: SLCard;
  plan: SLPayPlan;
  gold: number;
  bonuses: Partial<Record<SLGem, number>>;
  selected: boolean;
  selectable: boolean;
  onTap: () => void;
  // 예약 카드 표시용 뱃지
  badge?: string;
}

// 개발 카드 1장 — 명성 점수 · 보너스 보석 · 비용(보너스 차감 후) · 판정
function SplendorCardTile({
  card,
  plan,
  gold,
  bonuses,
  selected,
  selectable,
  onTap,
  badge,
}: CardTileProps) {
  const costGems = SL_GEMS.filter((g) => (card.cost?.[g] ?? 0) > 0);
  const shortOf = (gem: SLGem) =>
    plan.shortages.find((s) => s.gem === gem)?.count ?? 0;

  return (
    <button
      type="button"
      className={[
        'sl-card',
        `tier-${card.tier}`,
        plan.affordable ? 'buyable' : 'unaffordable',
        selected ? 'selected' : '',
        selectable ? 'selectable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onTap}
      disabled={!selectable}
      aria-label={`${card.tier}단계 개발 카드 · 명성 점수 ${card.points} · 보너스 ${SL_TOKEN_LABEL[card.gem]} · ${verdictText(plan, gold)}`}
    >
      <span className="sl-card-top">
        <span className="sl-card-points">
          {card.points > 0 ? card.points : ''}
        </span>
        <span className="sl-card-bonus">
          <SplendorGemIcon gem={card.gem} size={22} />
          <span className="sl-card-bonus-name">{SL_TOKEN_LABEL[card.gem]}</span>
        </span>
      </span>

      <span className="sl-card-costs">
        {costGems.map((gem) => {
          const raw = card.cost?.[gem] ?? 0;
          const bonus = bonuses[gem] ?? 0;
          const need = plan.need[gem];
          const lack = shortOf(gem);
          return (
            <span
              key={gem}
              className={`sl-cost-chip ${lack > 0 ? 'lack' : 'ok'}`}
              title={`${SL_TOKEN_LABEL[gem]} ${raw}개 필요${
                bonus > 0 ? ` · 보너스 ${bonus} 차감` : ''
              }${lack > 0 ? ` · ${lack}개 부족` : ''}`}
            >
              <SplendorGemIcon gem={gem} size={14} />
              <span className="sl-cost-need">{need}</span>
              {bonus > 0 && <span className="sl-cost-raw">{raw}</span>}
              {lack > 0 && <span className="sl-cost-lack">−{lack}</span>}
            </span>
          );
        })}
        {costGems.length === 0 && <span className="sl-cost-free">무료</span>}
      </span>

      <span
        className={`sl-card-verdict ${plan.affordable ? 'ok' : 'lack'}`}
      >
        {verdictText(plan, gold)}
      </span>

      {badge && <span className="sl-card-badge">{badge}</span>}
    </button>
  );
}

export function SplendorBoard({
  game,
  toasts,
  onTake,
  onReserve,
  onBuy,
  onDiscard,
}: SplendorBoardProps) {
  // 토큰 가져오기 초안 — 서로 다른 색 3개 또는 같은 색 2개
  const [takeSel, setTakeSel] = useState<SLGem[]>([]);
  // 카드 선택 (진열대 / 내 예약) — 하단 행동 바에서 구매·예약을 확정한다
  const [pick, setPick] = useState<{
    card: SLCard;
    from: 'board' | 'reserved';
  } | null>(null);
  // 10개 초과 버리기 초안
  const [discardSel, setDiscardSel] = useState<SLToken[]>([]);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(sl_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 진행 여부는 스냅샷(currentSeat·phase)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const players = game.players ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)는 행동 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;

  const bank = game.bank ?? {};
  const board = game.board ?? {};
  const nobles = game.nobles ?? [];
  const reserved = game.yourReserved ?? [];
  const deckLeft = game.deckLeft ?? {};

  const myTokens = me?.tokens ?? {};
  const myBonuses = me?.cards ?? {};
  const myGold = myTokens.gold ?? 0;
  const myTokenTotal = slTotalTokens(myTokens);

  // 스냅샷 컨텍스트(차례·단계)가 바뀌면 로컬 선택과 연타 잠금을 리셋한다 —
  // 남아 있던 선택이 다음 상황에 잘못 확정되지 않게.
  useEffect(() => {
    setTakeSel([]);
    setPick(null);
    setDiscardSel([]);
    setSubmitted(false);
  }, [game.currentSeat, game.phase]);

  // 단계 마감 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화)
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

  const isTurnPhase = game.phase === 'turn';
  const isDiscardPhase = game.phase === 'discard';
  const isMySeatActive = !isSpectator && game.currentSeat === game.yourSeat;
  const isMyTurn = isTurnPhase && isMySeatActive;
  const canAct = isMyTurn && !submitted;

  // ---------- 토큰 가져오기 ----------
  const isDouble = takeSel.length === 2 && takeSel[0] === takeSel[1];
  const bankOf = (t: SLToken) => bank[t] ?? 0;

  const handleTokenTap = (gem: SLGem) => {
    if (!canAct || bankOf(gem) <= 0) return;
    setPick(null);
    setTakeSel((prev) => {
      const dbl = prev.length === 2 && prev[0] === prev[1];
      if (dbl) {
        // 같은 색 2개 상태 — 같은 칩을 누르면 해제, 다른 칩이면 그 색으로 갈아탐
        return prev[0] === gem ? [] : [gem];
      }
      if (prev.includes(gem)) {
        // 이미 고른 색을 한 번 더 → 공동 창고에 4개 이상이면 "같은 색 2개"
        if (prev.length === 1 && bankOf(gem) >= SL_DOUBLE_TAKE_MIN) {
          return [gem, gem];
        }
        return prev.filter((g) => g !== gem);
      }
      if (prev.length >= SL_DISTINCT_TAKE) return prev;
      return [...prev, gem];
    });
  };

  const takeValid =
    takeSel.length > 0 &&
    (isDouble
      ? bankOf(takeSel[0]) >= SL_DOUBLE_TAKE_MIN
      : takeSel.length <= SL_DISTINCT_TAKE);
  // 가져온 뒤 10개를 넘기면 차례 끝에 버려야 한다 — 미리 알려 준다
  const overflowAfterTake = Math.max(
    0,
    myTokenTotal + takeSel.length - SL_TOKEN_LIMIT,
  );

  const handleConfirmTake = () => {
    if (!canAct || !takeValid) return;
    lockSubmit();
    onTake(takeSel);
    setTakeSel([]);
  };

  // ---------- 카드 선택 ----------
  const planFor = (card: SLCard) =>
    slPlanPurchase(card.cost, myBonuses, myTokens);

  const reservedFull = (me?.reservedCount ?? 0) >= SL_MAX_RESERVED;

  const handleCardTap = (card: SLCard, from: 'board' | 'reserved') => {
    if (!canAct) return;
    setTakeSel([]);
    setPick((prev) =>
      prev && prev.card.id === card.id && prev.from === from
        ? null
        : { card, from },
    );
  };

  const pickPlan = pick ? planFor(pick.card) : null;
  const canBuyPick = Boolean(canAct && pickPlan?.affordable);
  const canReservePick = Boolean(
    canAct && pick && pick.from === 'board' && !reservedFull,
  );

  const handleBuy = () => {
    if (!pick || !canBuyPick) return;
    lockSubmit();
    onBuy(pick.card.id);
    setPick(null);
  };

  const handleReserve = () => {
    if (!pick || !canReservePick) return;
    lockSubmit();
    onReserve(pick.card.id, undefined);
    setPick(null);
  };

  const handleDeckReserve = (tier: number) => {
    if (!canAct || reservedFull) return;
    lockSubmit();
    onReserve(undefined, tier);
    setPick(null);
    setTakeSel([]);
  };

  // ---------- 10개 초과 버리기 ----------
  const needDiscard = Math.max(0, myTokenTotal - SL_TOKEN_LIMIT);
  const selectedOf = (t: SLToken) => discardSel.filter((x) => x === t).length;
  const bumpDiscard = (t: SLToken, delta: number) => {
    setDiscardSel((prev) => {
      const have = myTokens[t] ?? 0;
      const cur = prev.filter((x) => x === t).length;
      if (delta > 0) {
        if (cur >= have || prev.length >= needDiscard) return prev;
        return [...prev, t];
      }
      if (cur <= 0) return prev;
      const idx = prev.lastIndexOf(t);
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  };
  const handleDiscard = () => {
    if (discardSel.length !== needDiscard || needDiscard <= 0) return;
    lockSubmit();
    onDiscard(discardSel);
    setDiscardSel([]);
  };

  // ---------- 상단 안내 ----------
  const headline = (() => {
    if (isDiscardPhase) {
      return isMySeatActive
        ? `🎒 토큰 ${needDiscard}개를 버리세요`
        : `${nameOf(game.currentSeat)}님이 토큰을 버리는 중`;
    }
    if (isMyTurn) return '✨ 내 차례 — 행동 하나를 고르세요';
    return `${nameOf(game.currentSeat)}님의 차례`;
  })();

  const subline = (() => {
    if (isDiscardPhase) {
      return isMySeatActive
        ? `보유 토큰은 ${SL_TOKEN_LIMIT}개까지입니다`
        : '잠시만 기다려 주세요';
    }
    if (isSpectator) return '관전 중 — 행동할 수 없습니다';
    if (isMyTurn)
      return '토큰 가져오기 · 개발 카드 구매 · 개발 카드 예약 중 하나만 합니다';
    return '진열대를 미리 계산해 두면 차례가 빨라집니다';
  })();

  const leaderPoints = players.reduce((max, p) => Math.max(max, p.points), 0);

  const tierCards = (tier: number): SLCard[] => {
    if (tier === 1) return board.tier1 ?? [];
    if (tier === 2) return board.tier2 ?? [];
    return board.tier3 ?? [];
  };
  const tierDeck = (tier: number): number => {
    if (tier === 1) return deckLeft.tier1 ?? 0;
    if (tier === 2) return deckLeft.tier2 ?? 0;
    return deckLeft.tier3 ?? 0;
  };

  return (
    <div className="sl-board">
      <div className="sl-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="sl-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 명성 점수 · 차례 · ⏱ */}
      <div className={`sl-status-bar ${game.phase}`}>
        <div className="sl-status-row">
          <span className="sl-status-chip">
            🏆 명성 점수 {leaderPoints}/{SL_TARGET_POINTS}
          </span>
          {game.lastRound && (
            <span className="sl-status-chip last">🏁 마지막 라운드</span>
          )}
          {game.endsAt > 0 && (
            <span className={`sl-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="sl-status-title">{headline}</span>
        <span className="sl-status-sub">{subline}</span>
        {game.lastAction && (
          <span className="sl-last-action">
            직전 — {game.lastAction.name}: {game.lastAction.message}
          </span>
        )}
      </div>

      {isSpectator && (
        <div className="sl-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {/* 명성 점수 스코어보드 */}
      <div className="sl-score-strip">
        {players.map((p: SLPlayerView) => (
          <span
            key={p.seat}
            className={[
              'sl-score-pill',
              p.seat === game.currentSeat ? 'active' : '',
              p.seat === game.yourSeat ? 'me' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="sl-score-name">
              {p.seat === game.currentSeat && '▶ '}
              {p.name}
              {p.seat === game.yourSeat && ' (나)'}
              {p.bot && ' 🤖'}
              {!p.connected && !p.bot && ' ⚠'}
            </span>
            <span className="sl-score-value">{p.points}점</span>
          </span>
        ))}
      </div>

      {/* 공동 창고 — 색별 개수, 탭해서 선택 */}
      <section className="sl-section">
        <div className="sl-section-head">
          <span className="sl-section-title">공동 창고</span>
          <span className="sl-section-note">
            {isSpectator
              ? '남은 토큰'
              : `서로 다른 색 3개 · 같은 색은 ${SL_DOUBLE_TAKE_MIN}개 이상일 때만 2개`}
          </span>
        </div>
        <div className="sl-bank-row">
          {SL_TOKENS.map((t) => {
            const count = bankOf(t);
            const picked = takeSel.filter((g) => g === t).length;
            const isGold = t === 'gold';
            const tappable = !isSpectator && canAct && !isGold && count > 0;
            return (
              <button
                key={t}
                type="button"
                className={[
                  'sl-token-chip',
                  `tk-${t}`,
                  picked > 0 ? 'picked' : '',
                  tappable ? 'tappable' : '',
                  count <= 0 ? 'empty' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => !isGold && handleTokenTap(t as SLGem)}
                disabled={!tappable}
                aria-label={`${SL_TOKEN_LABEL[t]} ${count}개${
                  isGold ? ' — 예약할 때만 받습니다' : ''
                }`}
              >
                <SplendorGemIcon gem={t} size={26} />
                <span className="sl-token-name">{SL_TOKEN_LABEL[t]}</span>
                <span className="sl-token-count">{count}</span>
                {picked > 0 && <span className="sl-token-picked">+{picked}</span>}
              </button>
            );
          })}
        </div>
        {!isSpectator && takeSel.length > 0 && (
          <p className="sl-take-summary">
            선택 —{' '}
            {takeSel.map((g) => SL_TOKEN_LABEL[g]).join(' · ')}
            {isDouble && bankOf(takeSel[0]) < SL_DOUBLE_TAKE_MIN
              ? ` (공동 창고에 ${SL_DOUBLE_TAKE_MIN}개 이상 있어야 같은 색 2개를 가져옵니다)`
              : ''}
            {overflowAfterTake > 0
              ? ` · 가져오면 ${overflowAfterTake}개를 버려야 합니다`
              : ''}
          </p>
        )}
        {!isSpectator && (
          <p className="sl-bank-hint">
            황금은 직접 가져올 수 없습니다 — 개발 카드를 예약하면 1개 받습니다
          </p>
        )}
      </section>

      {/* 개발 카드 진열대 — 3단계 × 4장 + 각 단계 덱 */}
      <section className="sl-section">
        <div className="sl-section-head">
          <span className="sl-section-title">개발 카드</span>
          <span className="sl-section-note">
            테두리가 밝은 카드는 지금 살 수 있습니다
          </span>
        </div>
        {[...SL_TIERS].reverse().map((tier) => {
          const cards = tierCards(tier);
          const left = tierDeck(tier);
          return (
            <div key={tier} className={`sl-tier-row tier-${tier}`}>
              <div className="sl-tier-label">
                <span className="sl-tier-name">{tier}단계</span>
                <button
                  type="button"
                  className="sl-deck-pile"
                  onClick={() => handleDeckReserve(tier)}
                  disabled={!canAct || reservedFull || left <= 0}
                  aria-label={`${tier}단계 덱 맨 위 카드를 비공개로 예약 (남은 ${left}장)`}
                >
                  <span className="sl-deck-count">{left}장</span>
                  <span className="sl-deck-action">덱 예약</span>
                </button>
              </div>
              <div className="sl-card-row">
                {cards.map((card) => (
                  <SplendorCardTile
                    key={card.id}
                    card={card}
                    plan={planFor(card)}
                    gold={myGold}
                    bonuses={myBonuses}
                    selected={
                      pick?.from === 'board' && pick.card.id === card.id
                    }
                    selectable={canAct}
                    onTap={() => handleCardTap(card, 'board')}
                  />
                ))}
                {cards.length === 0 && (
                  <span className="sl-row-empty">
                    남은 {tier}단계 카드가 없습니다
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* 귀족 타일 — 요구 보너스를 모두 채우면 차례 끝에 자동으로 옵니다 */}
      <section className="sl-section">
        <div className="sl-section-head">
          <span className="sl-section-title">귀족 타일</span>
          <span className="sl-section-note">
            보너스 카드만 셉니다 (토큰은 세지 않습니다)
          </span>
        </div>
        <div className="sl-noble-row">
          {nobles.map((noble: SLNoble) => {
            const prog = slNobleProgress(noble, myBonuses);
            return (
              <div
                key={noble.id}
                className={`sl-noble ${prog.reached ? 'reached' : ''}`}
              >
                <span className="sl-noble-points">👑 {noble.points}</span>
                <span className="sl-noble-costs">
                  {SL_GEMS.filter((g) => (noble.cost?.[g] ?? 0) > 0).map(
                    (gem) => {
                      const req = noble.cost?.[gem] ?? 0;
                      const own = myBonuses[gem] ?? 0;
                      const ok = own >= req;
                      return (
                        <span
                          key={gem}
                          className={`sl-cost-chip ${ok ? 'ok' : 'lack'}`}
                          title={`${SL_TOKEN_LABEL[gem]} 보너스 ${req}장 필요 · 내 보유 ${own}장`}
                        >
                          <SplendorGemIcon gem={gem} size={14} />
                          <span className="sl-cost-need">
                            {isSpectator ? req : `${Math.min(own, req)}/${req}`}
                          </span>
                        </span>
                      );
                    },
                  )}
                </span>
                {!isSpectator && (
                  <span
                    className={`sl-noble-verdict ${prog.reached ? 'ok' : 'lack'}`}
                  >
                    {prog.reached
                      ? '조건 충족'
                      : `${slShortageText(prog.shortages)} 부족`}
                  </span>
                )}
              </div>
            );
          })}
          {nobles.length === 0 && (
            <span className="sl-row-empty">남은 귀족 타일이 없습니다</span>
          )}
        </div>
      </section>

      {/* 내 보드 — 보유 토큰 · 보너스 카드 수 · 예약 카드 */}
      {!isSpectator && me && (
        <section className="sl-section sl-my-board">
          <div className="sl-section-head">
            <span className="sl-section-title">내 보드</span>
            <span
              className={`sl-section-note ${
                myTokenTotal > SL_TOKEN_LIMIT ? 'warn' : ''
              }`}
            >
              명성 점수 {me.points} · 개발 카드 {slTotalCards(myBonuses)}장 ·
              토큰 {myTokenTotal}/{SL_TOKEN_LIMIT}
            </span>
          </div>

          <div className="sl-mine-row">
            {SL_TOKENS.map((t) => (
              <span key={t} className="sl-mine-chip" title={SL_TOKEN_LABEL[t]}>
                <SplendorGemIcon gem={t} size={18} />
                <span className="sl-mine-name">{SL_TOKEN_LABEL[t]}</span>
                <span className="sl-mine-nums">
                  <span className="sl-mine-token" title="보유 토큰">
                    토큰 {myTokens[t] ?? 0}
                  </span>
                  {t !== 'gold' && (
                    <span className="sl-mine-bonus" title="보너스 (개발 카드)">
                      보너스 {myBonuses[t as SLGem] ?? 0}
                    </span>
                  )}
                </span>
              </span>
            ))}
          </div>

          <div className="sl-section-head">
            <span className="sl-section-subtitle">
              예약 카드 {reserved.length}/{SL_MAX_RESERVED}
            </span>
            <span className="sl-section-note">나만 볼 수 있습니다</span>
          </div>
          <div className="sl-card-row">
            {reserved.map((card) => (
              <SplendorCardTile
                key={card.id}
                card={card}
                plan={planFor(card)}
                gold={myGold}
                bonuses={myBonuses}
                selected={
                  pick?.from === 'reserved' && pick.card.id === card.id
                }
                selectable={canAct}
                onTap={() => handleCardTap(card, 'reserved')}
                badge="예약"
              />
            ))}
            {reserved.length === 0 && (
              <span className="sl-row-empty">예약한 카드가 없습니다</span>
            )}
          </div>
        </section>
      )}

      {/* 다른 참가자 요약 */}
      <section className="sl-section">
        <div className="sl-section-head">
          <span className="sl-section-title">참가자</span>
        </div>
        <div className="sl-players">
          {players.map((p) => (
            <div
              key={p.seat}
              className={[
                'sl-player',
                p.seat === game.currentSeat ? 'active' : '',
                p.seat === game.yourSeat ? 'me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="sl-player-head">
                <span className="sl-player-name">
                  {p.seat === game.currentSeat && '▶ '}
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="sl-player-badges">
                  {!p.connected && !p.bot && (
                    <span className="sl-badge off">끊김</span>
                  )}
                  <span className="sl-badge points">{p.points}점</span>
                </span>
              </div>
              <div className="sl-player-gems">
                {SL_GEMS.map((gem) => (
                  <span
                    key={gem}
                    className="sl-player-gem"
                    title={`${SL_TOKEN_LABEL[gem]} — 보너스 ${
                      p.cards?.[gem] ?? 0
                    }장 · 토큰 ${p.tokens?.[gem] ?? 0}개`}
                  >
                    <SplendorGemIcon gem={gem} size={14} />
                    <span className="sl-player-gem-num">
                      {p.cards?.[gem] ?? 0}
                      <em>/{p.tokens?.[gem] ?? 0}</em>
                    </span>
                  </span>
                ))}
                <span className="sl-player-gem" title="황금 토큰">
                  <SplendorGemIcon gem="gold" size={14} />
                  <span className="sl-player-gem-num">
                    <em>/{p.tokens?.gold ?? 0}</em>
                  </span>
                </span>
              </div>
              <div className="sl-player-foot">
                <span>보너스 {slTotalCards(p.cards)}장</span>
                <span>토큰 {slTotalTokens(p.tokens)}개</span>
                <span>예약 {p.reservedCount}장</span>
                <span>귀족 {(p.nobles ?? []).length}장</span>
              </div>
            </div>
          ))}
        </div>
        <p className="sl-players-legend">
          숫자는 <b>보너스 카드 수 / 보유 토큰 수</b> 입니다
        </p>
      </section>

      {/* 10개 초과 버리기 패널 */}
      {isDiscardPhase && isMySeatActive && needDiscard > 0 && (
        <div className="sl-discard-panel">
          <div className="sl-section-head">
            <span className="sl-section-title">토큰 버리기</span>
            <span className="sl-section-note">
              {discardSel.length}/{needDiscard}개 선택
            </span>
          </div>
          <div className="sl-discard-row">
            {SL_TOKENS.filter((t) => (myTokens[t] ?? 0) > 0).map((t) => (
              <div key={t} className="sl-discard-chip">
                <SplendorGemIcon gem={t} size={20} />
                <span className="sl-discard-name">{SL_TOKEN_LABEL[t]}</span>
                <span className="sl-discard-have">
                  {(myTokens[t] ?? 0) - selectedOf(t)}개 남김
                </span>
                <div className="sl-stepper">
                  <button
                    type="button"
                    className="sl-step-button"
                    onClick={() => bumpDiscard(t, -1)}
                    disabled={selectedOf(t) <= 0}
                    aria-label={`${SL_TOKEN_LABEL[t]} 버리기 취소`}
                  >
                    −
                  </button>
                  <span className="sl-step-value">{selectedOf(t)}</span>
                  <button
                    type="button"
                    className="sl-step-button"
                    onClick={() => bumpDiscard(t, 1)}
                    disabled={
                      selectedOf(t) >= (myTokens[t] ?? 0) ||
                      discardSel.length >= needDiscard
                    }
                    aria-label={`${SL_TOKEN_LABEL[t]} 버리기`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="sl-primary-button"
            onClick={handleDiscard}
            disabled={discardSel.length !== needDiscard || submitted}
          >
            {discardSel.length === needDiscard
              ? `${needDiscard}개 버리기`
              : `${needDiscard - discardSel.length}개 더 골라 주세요`}
          </button>
        </div>
      )}

      {/* 하단 행동 바 — 토큰 확정 / 카드 구매·예약 */}
      {!isSpectator && canAct && takeSel.length > 0 && (
        <div className="sl-action-bar">
          <span className="sl-action-text">
            {isDouble
              ? `${SL_TOKEN_LABEL[takeSel[0]]} 2개를 가져올까요?`
              : `${takeSel.map((g) => SL_TOKEN_LABEL[g]).join(' · ')} ${takeSel.length}개를 가져올까요?`}
          </span>
          <div className="sl-action-buttons">
            <button
              type="button"
              className="sl-primary-button"
              onClick={handleConfirmTake}
              disabled={!takeValid}
            >
              가져오기
            </button>
            <button
              type="button"
              className="sl-ghost-button"
              onClick={() => setTakeSel([])}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {!isSpectator && canAct && pick && pickPlan && (
        <div className="sl-action-bar">
          <span className="sl-action-text">
            {pick.from === 'reserved' ? '예약 카드' : `${pick.card.tier}단계`} ·
            명성 점수 {pick.card.points} · 보너스{' '}
            {SL_TOKEN_LABEL[pick.card.gem]} — {verdictText(pickPlan, myGold)}
          </span>
          <div className="sl-action-buttons">
            <button
              type="button"
              className="sl-primary-button"
              onClick={handleBuy}
              disabled={!canBuyPick}
            >
              구매
            </button>
            {pick.from === 'board' && (
              <button
                type="button"
                className="sl-ghost-button"
                onClick={handleReserve}
                disabled={!canReservePick}
              >
                {reservedFull
                  ? `예약 가득 (${SL_MAX_RESERVED}장)`
                  : '예약 + 황금 1'}
              </button>
            )}
            <button
              type="button"
              className="sl-ghost-button"
              onClick={() => setPick(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
