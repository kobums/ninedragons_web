// 보난자 보드.
//
// 이 게임의 전부는 "손패 순서를 절대 못 바꾼다"는 것이다.
//
//   덱 ─── 뽑기(3장) ──▶ [손패 뒤]  …  [손패 앞] ──▶ 반드시 심는다
//                          ▲                              │
//                          └── 맨 뒤로만 붙는다             ▼
//                                                    ┌──────────┐
//   덱 ─── 2장 뒤집기 ──▶ 공개 카드 ──거래/기부──▶ 받은 콩 │  내 콩밭  │
//                                    (손에 못 든다)  └──────────┘
//                                    즉시 전부 심는다      │ 수확
//                                                         ▼
//                                                    콩미터 → 금화
//
// 그래서 이 화면에는 손패를 정렬하거나 드래그로 옮기는 UI 가 없다.
// 손패는 서버가 준 순서 그대로 그리고, 맨 앞 카드를 크게 강조한다 —
// 다음 차례에 반드시 심어야 하는 카드이기 때문이다.
//
// 판단의 근거는 콩미터다. 어떤 콩이든 탭하면 그 콩의 콩미터가 뜨고,
// 내 밭마다 "지금 수확하면 금화 몇 개"가 늘 적혀 있다.

import { useEffect, useState } from 'react';
import type {
  BZBean,
  BZBeanMeta,
  BZEvent,
  BZField,
  BZGameState,
  BZOffer,
  BZPlayerView,
} from '../../types/bohnanza';
import {
  BZ_DRAW_COUNT,
  BZ_FLIP_COUNT,
  BZ_MAX_FIELDS,
  BZ_PHASE_STEPS,
  BZ_THIRD_FIELD_COST,
  bzBean,
  bzCanHarvest,
  bzCoins,
  bzCycleText,
  bzFieldCoins,
  bzFieldEmpty,
  bzFieldSlots,
  bzHarvestBlockReason,
  bzIsFinalCycle,
  bzMeterCells,
  bzNextStep,
  bzPlantableFields,
  bzStepOf,
  bzTotalFieldCoins,
} from '../../types/bohnanza';
import type { BZToast } from '../../hooks/useBohnanzaGameState';
import './BohnanzaBoard.css';

// bz_offer payload — giveHand·giveFlipped 는 내 손패·공개 카드의 인덱스,
// wantHand 는 상대 손패의 인덱스(위치)다. 상대 손패는 비공개라 위치로 고른다.
export interface BZOfferDraft {
  toSeat: number;
  giveHand: number[];
  giveFlipped: number[];
  wantHand: number[];
}

interface BohnanzaBoardProps {
  game: BZGameState;
  toasts: BZToast[];
  onPlant: (second: boolean) => void;
  onHarvest: (field: number) => void;
  onBuyField: () => void;
  onOffer: (offer: BZOfferDraft) => void;
  onRespond: (offerId: string, accept: boolean) => void;
  onPlantReceived: (cardIndex: number, field: number) => void;
  onEndPhase: () => void;
}

// ---------- 콩 표기 ----------
// 색만으로 구분되지 않게 이모지 + 한글 이름을 늘 병기한다.
// 탭하면 그 콩의 콩미터가 뜬다 (onPick).
export function BohnanzaBeanChip({
  bean,
  size = 'md',
  count,
  onPick,
}: {
  bean: BZBean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  // 곁들일 장수 (밭·묶음 표시용)
  count?: number;
  onPick?: (bean: BZBean) => void;
}) {
  const meta = bzBean(bean);
  const body = (
    <>
      <span className="bz-bean-emoji" aria-hidden="true">
        {meta.emoji}
      </span>
      <span className="bz-bean-name">{meta.name}</span>
      {count !== undefined && <span className="bz-bean-count">×{count}</span>}
    </>
  );
  const cls = `bz-bean-chip size-${size} bz-tone-${meta.tone}`;
  const label = `${meta.name}${count !== undefined ? ` ${count}장` : ''} — 콩미터 보기`;

  if (!onPick) {
    return (
      <span className={cls} title={meta.name}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${cls} pickable`}
      onClick={() => onPick(bean)}
      aria-label={label}
      title={label}
    >
      {body}
    </button>
  );
}

// ---------- 콩미터 ----------
// "몇 장을 수확하면 금화 몇 개"의 문턱표. 지금 장수가 어느 칸에 있는지 표시한다.
export function BohnanzaBeanometer({
  bean,
  count = 0,
  compact = false,
}: {
  bean: BZBean;
  // 지금 내 밭에 쌓인 장수 (강조용)
  count?: number;
  compact?: boolean;
}) {
  const meta: BZBeanMeta = bzBean(bean);
  const cells = bzMeterCells(bean);
  const now = bzCoins(bean, count);

  if (cells.length === 0) {
    return (
      <span className="bz-meter-unknown">콩미터를 알 수 없는 콩입니다</span>
    );
  }

  return (
    <div className={`bz-meter bz-tone-${meta.tone} ${compact ? 'compact' : ''}`}>
      {cells.map((cell) => {
        const reached = count >= cell.need;
        const current = now === cell.coins && reached;
        return (
          <span
            key={cell.coins}
            className={[
              'bz-meter-cell',
              reached ? 'reached' : '',
              current ? 'current' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={`${cell.need}장을 수확하면 금화 ${cell.coins}개`}
          >
            <span className="bz-meter-cell-need">{cell.need}장</span>
            <span className="bz-meter-cell-coin">🪙{cell.coins}</span>
          </span>
        );
      })}
    </div>
  );
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: BZEvent, game: BZGameState): string {
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
    case 'plant':
      return `${name(event.seat)}님이 콩을 심었습니다`;
    case 'harvest':
      return `${name(event.seat)}님이 밭을 수확했습니다`;
    case 'buy_field':
      return `🌾 ${name(event.seat)}님이 세 번째 콩밭을 샀습니다`;
    case 'flip':
      return `덱에서 ${BZ_FLIP_COUNT}장을 공개했습니다`;
    case 'offer':
      return `${name(event.seat)}님이 거래를 제안했습니다`;
    case 'trade':
      return `🤝 ${name(event.seat)}님과 거래가 성사되었습니다`;
    case 'donate':
      return `🎁 ${name(event.seat)}님이 콩을 그냥 주었습니다`;
    case 'reject':
      return `${name(event.seat)}님이 제안을 거절했습니다`;
    case 'draw':
      return `${name(event.seat)}님이 ${BZ_DRAW_COUNT}장을 뽑았습니다`;
    case 'deck_empty':
      return '📇 덱이 소진되었습니다 — 섞어서 다시 씁니다';
    case 'auto_action':
      return '⏳ 시간 초과 — 자동으로 진행했습니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    // react 등 토스트로 쓰지 않는 이벤트 — 훅에서 걸러지지만 방어
    default:
      return '';
  }
}

export function BohnanzaBoard({
  game,
  toasts,
  onPlant,
  onHarvest,
  onBuyField,
  onOffer,
  onRespond,
  onPlantReceived,
  onEndPhase,
}: BohnanzaBoardProps) {
  // 콩미터 팝업 — 어떤 콩이든 탭하면 여기에 담긴다
  const [meterBean, setMeterBean] = useState<BZBean | null>(null);
  // 3단계 — 심을 받은 카드 인덱스
  const [pendingSel, setPendingSel] = useState<number | null>(null);
  // 거래 초안
  const [tradeOpen, setTradeOpen] = useState(false);
  const [toSeat, setToSeat] = useState<number | null>(null);
  const [giveHand, setGiveHand] = useState<number[]>([]);
  const [giveFlipped, setGiveFlipped] = useState<number[]>([]);
  const [wantHand, setWantHand] = useState<number[]>([]);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(bz_error)해도 잠깐 뒤 풀려 재시도할 수 있다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 1500);
  };

  const players = game.players ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)는 행동 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;

  const hand = game.yourHand ?? [];
  const pending = game.yourPending ?? [];
  const flipped = game.flipped ?? [];
  const offers = game.offers ?? [];
  const deckLeft = game.deckLeft ?? 0;
  const deckCycle = game.deckCycle ?? 0;

  const myFields = bzFieldSlots(me);
  const myCoins = me?.coins ?? 0;

  // 스냅샷 컨텍스트(차례·단계)가 바뀌면 로컬 초안을 리셋한다 —
  // 남아 있던 선택이 다음 상황에 잘못 확정되지 않게.
  useEffect(() => {
    setPendingSel(null);
    setGiveHand([]);
    setGiveFlipped([]);
    setWantHand([]);
    setTradeOpen(false);
    setToSeat(null);
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

  const isMyTurn = !isSpectator && game.currentSeat === game.yourSeat;
  const step = bzStepOf(game.phase);

  // ---------- 1단계 · 심기 ----------
  const frontBean = hand[0];
  const secondBean = hand[1];
  const canPlantPhase = game.phase === 'plant' && isMyTurn && !submitted;
  // 맨 앞 카드를 심을 자리가 있는가 (없으면 밭을 먼저 수확해야 한다)
  const frontSpots = frontBean ? bzPlantableFields(myFields, frontBean) : [];
  const frontBlocked = Boolean(frontBean) && frontSpots.length === 0;

  const handlePlant = (second: boolean) => {
    if (!canPlantPhase || frontBlocked) return;
    lockSubmit();
    onPlant(second);
  };

  // ---------- 수확 · 밭 구매 (언제든 가능) ----------
  const handleHarvest = (index: number) => {
    if (isSpectator || submitted) return;
    if (!bzCanHarvest(myFields, index)) return;
    lockSubmit();
    onHarvest(index);
  };

  const ownedFields = myFields.length;
  const canBuyField =
    !isSpectator &&
    !submitted &&
    ownedFields < BZ_MAX_FIELDS &&
    myCoins >= BZ_THIRD_FIELD_COST;

  const handleBuyField = () => {
    if (!canBuyField) return;
    lockSubmit();
    onBuyField();
  };

  // ---------- 2단계 · 거래 ----------
  const isTradePhase = game.phase === 'trade';
  // 모든 거래에는 차례인 사람이 반드시 낀다 —
  // 내가 차례면 아무에게나, 아니면 차례인 사람에게만 제안할 수 있다.
  const tradeTargets = isSpectator
    ? []
    : isMyTurn
      ? players.filter((p) => p.seat !== game.yourSeat)
      : players.filter((p) => p.seat === game.currentSeat);
  const canTrade = isTradePhase && !isSpectator && tradeTargets.length > 0;
  // 공개 카드는 차례인 사람의 것이라 그 사람만 거래에 내놓을 수 있다
  const canGiveFlipped = isMyTurn && flipped.length > 0;

  const target = players.find((p) => p.seat === toSeat) ?? tradeTargets[0];
  const targetSeat = target?.seat ?? -1;
  const targetHandCount = target?.handCount ?? 0;

  const toggle = (list: number[], value: number) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const offerEmpty =
    giveHand.length === 0 && giveFlipped.length === 0 && wantHand.length === 0;
  // want 를 비우면 기부다
  const isDonation = wantHand.length === 0 && !offerEmpty;

  const handleSendOffer = () => {
    if (!canTrade || targetSeat < 0 || offerEmpty || submitted) return;
    lockSubmit();
    onOffer({ toSeat: targetSeat, giveHand, giveFlipped, wantHand });
    setGiveHand([]);
    setGiveFlipped([]);
    setWantHand([]);
    setTradeOpen(false);
  };

  const myIncomingOffers = offers.filter((o) => o.toSeat === game.yourSeat);
  const myOutgoingOffers = offers.filter((o) => o.fromSeat === game.yourSeat);
  const otherOffers = offers.filter(
    (o) => o.toSeat !== game.yourSeat && o.fromSeat !== game.yourSeat,
  );

  const handleRespond = (offerId: string, accept: boolean) => {
    if (isSpectator || submitted) return;
    lockSubmit();
    onRespond(offerId, accept);
  };

  // ---------- 3단계 · 받은 콩 심기 ----------
  const mustPlantReceived = pending.length > 0;
  const pendingBean = pendingSel !== null ? pending[pendingSel] : undefined;
  const pendingSpots = pendingBean
    ? bzPlantableFields(myFields, pendingBean)
    : [];

  const handlePlantReceived = (field: number) => {
    if (isSpectator || pendingSel === null || submitted) return;
    lockSubmit();
    onPlantReceived(pendingSel, field);
    setPendingSel(null);
  };

  // ---------- 상단 안내 ----------
  const headline = (() => {
    if (mustPlantReceived) {
      return '🌱 받은 콩을 전부 심어야 합니다';
    }
    switch (game.phase) {
      case 'plant':
        return isMyTurn
          ? '① 손패 맨 앞 카드를 심으세요'
          : `${nameOf(game.currentSeat)}님이 콩을 심는 중`;
      case 'trade':
        return isMyTurn
          ? '② 공개 카드 2장을 거래·기부하세요'
          : `② ${nameOf(game.currentSeat)}님과 거래할 수 있습니다`;
      case 'plant_received':
        return isMyTurn
          ? '③ 받은 콩을 심는 중'
          : `③ ${nameOf(game.currentSeat)}님이 받은 콩을 심는 중`;
      case 'draw':
        return isMyTurn
          ? `④ 카드 ${BZ_DRAW_COUNT}장을 뽑습니다`
          : `④ ${nameOf(game.currentSeat)}님이 카드를 뽑는 중`;
      default:
        return `${nameOf(game.currentSeat)}님의 차례`;
    }
  })();

  const subline = (() => {
    if (isSpectator) return '관전 중 — 행동할 수 없습니다';
    if (mustPlantReceived) {
      return '받은 카드는 손에 들 수 없습니다 — 남김없이 밭에 심으세요';
    }
    switch (game.phase) {
      case 'plant':
        return isMyTurn
          ? frontBlocked
            ? '맨 앞 카드를 심을 자리가 없습니다 — 밭 하나를 먼저 수확하세요'
            : '맨 앞은 필수, 두 번째는 선택입니다 (세 번째부터는 못 심습니다)'
          : '수확과 세 번째 콩밭 구매는 내 차례가 아니어도 할 수 있습니다';
      case 'trade':
        return isMyTurn
          ? '아무도 안 가져간 공개 카드는 내가 심게 됩니다'
          : '모든 거래에는 차례인 사람이 반드시 낍니다 — 남들끼리는 못 합니다';
      default:
        return '수확과 세 번째 콩밭 구매는 언제든 할 수 있습니다';
    }
  })();

  const richest = players.reduce((max, p) => Math.max(max, p.coins), 0);
  const finalCycle = bzIsFinalCycle(deckCycle, players.length);

  return (
    <div className="bz-board">
      <div className="bz-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="bz-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 덱 잔량 · 소진 횟수 · ⏱ · 차례 · 단계 */}
      <div className={`bz-status-bar ${game.phase}`}>
        <div className="bz-status-row">
          <span className="bz-status-chip">📇 덱 {deckLeft}장</span>
          <span className={`bz-status-chip cycle ${finalCycle ? 'final' : ''}`}>
            🔁 {bzCycleText(deckCycle, players.length)}
          </span>
          {game.endsAt > 0 && (
            <span className={`bz-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>

        {/* 차례 4단계 — 지금 어디인지 늘 보인다 */}
        <ol className="bz-steps" aria-label="차례 4단계">
          {BZ_PHASE_STEPS.map((s) => (
            <li
              key={s.phase}
              className={[
                'bz-step',
                s.step === step ? 'now' : '',
                s.step < step ? 'done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={s.hint}
            >
              <span className="bz-step-index">{s.step}</span>
              <span className="bz-step-name">{s.name}</span>
            </li>
          ))}
        </ol>

        <span className="bz-status-title">{headline}</span>
        <span className="bz-status-sub">{subline}</span>
        {game.lastAction && (
          <span className="bz-last-action">
            직전 — {game.lastAction.name}: {game.lastAction.message}
          </span>
        )}
      </div>

      {isSpectator && (
        <div className="bz-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {/* 금화 순위 띠 */}
      <div className="bz-score-strip">
        {players.map((p: BZPlayerView) => (
          <span
            key={p.seat}
            className={[
              'bz-score-pill',
              p.seat === game.currentSeat ? 'active' : '',
              p.seat === game.yourSeat ? 'me' : '',
              p.coins === richest && richest > 0 ? 'top' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="bz-score-name">
              {p.seat === game.currentSeat && '▶ '}
              {p.name}
              {p.seat === game.yourSeat && ' (나)'}
              {p.bot && ' 🤖'}
              {!p.connected && !p.bot && ' ⚠'}
            </span>
            <span className="bz-score-value">🪙 {p.coins}</span>
          </span>
        ))}
      </div>

      {/* ★ 3단계 · 받은 콩 심기 — 남아 있으면 무엇보다 먼저 처리한다 ★ */}
      {!isSpectator && mustPlantReceived && (
        <section className="bz-section bz-pending">
          <div className="bz-section-head">
            <span className="bz-section-title">
              ③ 받은 콩 {pending.length}장 — 즉시 심어야 합니다
            </span>
            <span className="bz-section-note">
              손에 들 수 없습니다 · 카드를 고른 뒤 심을 밭을 누르세요
            </span>
          </div>
          <div className="bz-pending-row">
            {pending.map((bean, index) => (
              <button
                key={`${bean}-${index}`}
                type="button"
                className={[
                  'bz-pending-card',
                  `bz-tone-${bzBean(bean).tone}`,
                  pendingSel === index ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  setPendingSel((prev) => (prev === index ? null : index))
                }
                aria-label={`${bzBean(bean).name} — 심을 카드로 고르기`}
              >
                <span className="bz-pending-emoji" aria-hidden="true">
                  {bzBean(bean).emoji}
                </span>
                <span className="bz-pending-name">{bzBean(bean).name}</span>
              </button>
            ))}
          </div>
          {pendingSel !== null && pendingBean && (
            <div className="bz-pending-guide">
              <span className="bz-pending-guide-text">
                {bzBean(pendingBean).name}을(를) 심을 밭을 아래 <b>내 콩밭</b>{' '}
                에서 고르세요
                {pendingSpots.length === 0 &&
                  ' — 맞는 밭도 빈 밭도 없습니다. 먼저 밭 하나를 수확하세요'}
              </span>
              <div className="bz-pending-fields">
                {myFields.map((f, i) => {
                  const ok = pendingSpots.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`bz-pending-field ${ok ? 'ok' : 'no'}`}
                      onClick={() => handlePlantReceived(i)}
                      disabled={!ok || submitted}
                    >
                      {i + 1}번 밭
                      <span className="bz-pending-field-sub">
                        {bzFieldEmpty(f)
                          ? '빈 밭'
                          : `${bzBean(f.bean ?? '').name} ${f.count}장`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ★ 내 콩밭 — 밭마다 "지금 수확하면 금화 몇 개" ★ */}
      {!isSpectator && (
        <section className="bz-section bz-my-fields">
          <div className="bz-section-head">
            <span className="bz-section-title">
              내 콩밭 {ownedFields}개 · 🪙 {myCoins}
            </span>
            <span className="bz-section-note">
              수확은 내 차례가 아니어도 언제든 할 수 있습니다
            </span>
          </div>

          <div className="bz-fields-row">
            {myFields.map((field, index) => (
              <BohnanzaFieldCard
                key={index}
                field={field}
                index={index}
                fields={myFields}
                onHarvest={() => handleHarvest(index)}
                onPickBean={setMeterBean}
                disabled={submitted}
              />
            ))}
          </div>

          <div className="bz-field-foot">
            <span className="bz-field-total">
              전부 수확하면 🪙 {bzTotalFieldCoins(myFields)}
            </span>
            {ownedFields < BZ_MAX_FIELDS && (
              <button
                type="button"
                className="bz-ghost-button bz-buy-field"
                onClick={handleBuyField}
                disabled={!canBuyField}
              >
                🌾 세 번째 콩밭 사기 (🪙 {BZ_THIRD_FIELD_COST})
                {myCoins < BZ_THIRD_FIELD_COST && ' — 금화 부족'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ★ 내 손패 — 순서가 곧 진실. 맨 앞 카드를 크게 강조한다 ★ */}
      {!isSpectator && (
        <section className="bz-section bz-my-hand">
          <div className="bz-section-head">
            <span className="bz-section-title">내 손패 {hand.length}장</span>
            <span className="bz-section-note">
              순서는 절대 바뀌지 않습니다 — 맨 앞에서만 빠지고 맨 뒤로만 붙습니다
            </span>
          </div>

          {hand.length === 0 ? (
            <span className="bz-row-empty">손패가 없습니다</span>
          ) : (
            <div className="bz-hand-strip">
              {/* 맨 앞 — 반드시 심어야 하는 카드 */}
              <div className="bz-front-wrap">
                <span className="bz-front-flag">맨 앞 · 반드시 심습니다</span>
                <button
                  type="button"
                  className={`bz-front-card bz-tone-${bzBean(hand[0]).tone} ${
                    frontBlocked ? 'blocked' : ''
                  }`}
                  onClick={() => setMeterBean(hand[0])}
                  aria-label={`${bzBean(hand[0]).name} — 맨 앞 카드, 콩미터 보기`}
                >
                  <span className="bz-front-emoji" aria-hidden="true">
                    {bzBean(hand[0]).emoji}
                  </span>
                  <span className="bz-front-name">{bzBean(hand[0]).name}</span>
                  <BohnanzaBeanometer
                    bean={hand[0]}
                    count={
                      myFields.find((f) => f.bean === hand[0])?.count ?? 0
                    }
                    compact
                  />
                  <span className="bz-front-where">
                    {frontBlocked
                      ? '⚠ 심을 자리 없음 — 밭을 먼저 수확하세요'
                      : `→ ${frontSpots[0] + 1}번 밭에 들어갑니다`}
                  </span>
                </button>
              </div>

              {/* 나머지 — 서버가 준 순서 그대로. 정렬·이동 UI 는 없다. */}
              <div className="bz-hand-rest" aria-label="손패 나머지 (순서 고정)">
                {hand.slice(1).map((bean, i) => {
                  const index = i + 1;
                  const meta = bzBean(bean);
                  return (
                    <button
                      key={`${bean}-${index}`}
                      type="button"
                      className={[
                        'bz-hand-card',
                        `bz-tone-${meta.tone}`,
                        index === 1 ? 'second' : '',
                        giveHand.includes(index) ? 'giving' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setMeterBean(bean)}
                      aria-label={`손패 ${index + 1}번째 ${meta.name} — 콩미터 보기`}
                    >
                      <span className="bz-hand-pos">{index + 1}</span>
                      <span className="bz-hand-emoji" aria-hidden="true">
                        {meta.emoji}
                      </span>
                      <span className="bz-hand-name">{meta.name}</span>
                      {index === 1 && (
                        <span className="bz-hand-tag">두 번째 · 선택</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="bz-hand-legend">
            손패는 <b>정렬할 수 없습니다</b>. 뽑은 카드는 맨 뒤에 붙고, 심을
            때는 맨 앞부터 나갑니다.
          </p>
        </section>
      )}

      {/* 1단계 행동 — 심기 */}
      {canPlantPhase && frontBean && (
        <div className="bz-action-bar">
          <span className="bz-action-text">
            {frontBlocked
              ? `${bzBean(frontBean).name}을(를) 심을 자리가 없습니다 — 위에서 밭 하나를 수확한 뒤 다시 심으세요`
              : secondBean
                ? `맨 앞 ${bzBean(frontBean).name}은 필수입니다. 두 번째 ${bzBean(secondBean).name}까지 심을 수 있습니다`
                : `맨 앞 ${bzBean(frontBean).name}을(를) 심습니다`}
          </span>
          <div className="bz-action-buttons">
            <button
              type="button"
              className="bz-primary-button"
              onClick={() => handlePlant(false)}
              disabled={frontBlocked}
            >
              맨 앞 1장 심기
            </button>
            {secondBean && (
              <button
                type="button"
                className="bz-ghost-button"
                onClick={() => handlePlant(true)}
                disabled={frontBlocked}
              >
                앞 2장 심기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2단계 — 공개 카드 */}
      {isTradePhase && (
        <section className="bz-section bz-flipped">
          <div className="bz-section-head">
            <span className="bz-section-title">
              ② 공개 카드 {flipped.length}장
            </span>
            <span className="bz-section-note">
              전원 공개 · 아무도 안 가져가면 {nameOf(game.currentSeat)}님이
              심습니다
            </span>
          </div>
          <div className="bz-flipped-row">
            {flipped.map((bean, index) => {
              const meta = bzBean(bean);
              return (
                <button
                  key={`${bean}-${index}`}
                  type="button"
                  className={[
                    'bz-flipped-card',
                    `bz-tone-${meta.tone}`,
                    giveFlipped.includes(index) ? 'giving' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setMeterBean(bean)}
                  aria-label={`공개 카드 ${meta.name} — 콩미터 보기`}
                >
                  <span className="bz-flipped-emoji" aria-hidden="true">
                    {meta.emoji}
                  </span>
                  <span className="bz-flipped-name">{meta.name}</span>
                  <BohnanzaBeanometer
                    bean={bean}
                    count={myFields.find((f) => f.bean === bean)?.count ?? 0}
                    compact
                  />
                </button>
              );
            })}
            {flipped.length === 0 && (
              <span className="bz-row-empty">공개 카드가 없습니다</span>
            )}
          </div>
        </section>
      )}

      {/* 거래 제안 패널 */}
      {!isSpectator && isTradePhase && (
        <section className="bz-section bz-trade">
          <div className="bz-section-head">
            <span className="bz-section-title">거래 · 기부</span>
            <span className="bz-section-note">
              모든 거래에는 차례인 {nameOf(game.currentSeat)}님이 반드시 낍니다
            </span>
          </div>

          {/* 받은 제안 — 수락/거절 */}
          {myIncomingOffers.length > 0 && (
            <div className="bz-offer-group incoming">
              <span className="bz-offer-group-title">
                📥 받은 제안 {myIncomingOffers.length}건
              </span>
              {myIncomingOffers.map((offer) => (
                <BohnanzaOfferCard
                  key={offer.id}
                  offer={offer}
                  nameOf={nameOf}
                  onPickBean={setMeterBean}
                  actions={
                    <>
                      <button
                        type="button"
                        className="bz-primary-button bz-offer-btn"
                        onClick={() => handleRespond(offer.id, true)}
                        disabled={submitted}
                      >
                        수락
                      </button>
                      <button
                        type="button"
                        className="bz-ghost-button bz-offer-btn"
                        onClick={() => handleRespond(offer.id, false)}
                        disabled={submitted}
                      >
                        거절
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          )}

          {/* 내가 보낸 제안 */}
          {myOutgoingOffers.length > 0 && (
            <div className="bz-offer-group outgoing">
              <span className="bz-offer-group-title">
                📤 보낸 제안 {myOutgoingOffers.length}건 — 답을 기다리는 중
              </span>
              {myOutgoingOffers.map((offer) => (
                <BohnanzaOfferCard
                  key={offer.id}
                  offer={offer}
                  nameOf={nameOf}
                  onPickBean={setMeterBean}
                />
              ))}
            </div>
          )}

          {/* 남들의 제안 — 상세는 당사자만 본다 */}
          {otherOffers.length > 0 && (
            <div className="bz-offer-group others">
              <span className="bz-offer-group-title">
                진행 중인 다른 제안 {otherOffers.length}건
              </span>
              {otherOffers.map((offer) => (
                <div key={offer.id} className="bz-offer-brief">
                  {nameOf(offer.fromSeat)} → {nameOf(offer.toSeat)} · 상세는
                  당사자만 볼 수 있습니다
                </div>
              ))}
            </div>
          )}

          {/* 제안 만들기 */}
          {canTrade &&
            (tradeOpen ? (
              <div className="bz-offer-form">
                <span className="bz-offer-form-title">누구에게</span>
                <div className="bz-target-row">
                  {tradeTargets.map((p) => (
                    <button
                      key={p.seat}
                      type="button"
                      className={`bz-target ${targetSeat === p.seat ? 'on' : ''}`}
                      onClick={() => setToSeat(p.seat)}
                    >
                      {p.seat === game.currentSeat && '▶ '}
                      {p.name}
                      {p.bot && ' 🤖'}
                      <span className="bz-target-sub">
                        손패 {p.handCount}장 · 🪙 {p.coins}
                      </span>
                    </button>
                  ))}
                </div>

                <span className="bz-offer-form-title">
                  내가 주는 손패 카드 {giveHand.length > 0 && `${giveHand.length}장`}
                </span>
                <div className="bz-pick-row">
                  {hand.map((bean, index) => {
                    const meta = bzBean(bean);
                    return (
                      <button
                        key={`give-${bean}-${index}`}
                        type="button"
                        className={[
                          'bz-pick',
                          `bz-tone-${meta.tone}`,
                          giveHand.includes(index) ? 'on' : '',
                          index === 0 ? 'front' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() =>
                          setGiveHand((prev) => toggle(prev, index))
                        }
                      >
                        <span className="bz-pick-pos">{index + 1}</span>
                        <span aria-hidden="true">{meta.emoji}</span>
                        <span className="bz-pick-name">{meta.name}</span>
                      </button>
                    );
                  })}
                  {hand.length === 0 && (
                    <span className="bz-row-empty">손패가 없습니다</span>
                  )}
                </div>

                {canGiveFlipped && (
                  <>
                    <span className="bz-offer-form-title">
                      내가 주는 공개 카드
                    </span>
                    <div className="bz-pick-row">
                      {flipped.map((bean, index) => {
                        const meta = bzBean(bean);
                        return (
                          <button
                            key={`giveflip-${bean}-${index}`}
                            type="button"
                            className={[
                              'bz-pick',
                              `bz-tone-${meta.tone}`,
                              giveFlipped.includes(index) ? 'on' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() =>
                              setGiveFlipped((prev) => toggle(prev, index))
                            }
                          >
                            <span aria-hidden="true">{meta.emoji}</span>
                            <span className="bz-pick-name">{meta.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <span className="bz-offer-form-title">
                  받고 싶은 상대 손패 위치
                </span>
                <p className="bz-offer-form-note">
                  상대 손패는 비공개입니다 — <b>위치</b>로 고릅니다. 순서가 절대
                  바뀌지 않으므로 <b>1번째는 상대가 다음 차례에 반드시 심어야
                  하는 카드</b>입니다. 비워 두면 <b>기부</b>가 됩니다.
                </p>
                <div className="bz-pick-row">
                  {Array.from({ length: targetHandCount }).map((_, index) => (
                    <button
                      key={`want-${index}`}
                      type="button"
                      className={[
                        'bz-pick want',
                        wantHand.includes(index) ? 'on' : '',
                        index === 0 ? 'front' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setWantHand((prev) => toggle(prev, index))}
                    >
                      <span className="bz-pick-pos">{index + 1}</span>
                      <span className="bz-pick-name">
                        {index === 0 ? '맨 앞' : `${index + 1}번째`}
                      </span>
                    </button>
                  ))}
                  {targetHandCount === 0 && (
                    <span className="bz-row-empty">
                      상대 손패가 비어 있습니다
                    </span>
                  )}
                </div>

                <div className="bz-action-buttons">
                  <button
                    type="button"
                    className="bz-primary-button"
                    onClick={handleSendOffer}
                    disabled={offerEmpty || targetSeat < 0 || submitted}
                  >
                    {isDonation ? '🎁 그냥 주기 (기부)' : '🤝 제안 보내기'}
                  </button>
                  <button
                    type="button"
                    className="bz-ghost-button"
                    onClick={() => {
                      setTradeOpen(false);
                      setGiveHand([]);
                      setGiveFlipped([]);
                      setWantHand([]);
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="bz-ghost-button bz-open-trade"
                onClick={() => {
                  setTradeOpen(true);
                  setToSeat(tradeTargets[0]?.seat ?? null);
                }}
              >
                🤝 거래 제안하기 · 기부하기
              </button>
            ))}

          {/* 차례인 사람만 거래를 마감할 수 있다 */}
          {isMyTurn && (
            <button
              type="button"
              className="bz-primary-button bz-end-phase"
              onClick={() => {
                lockSubmit();
                onEndPhase();
              }}
              disabled={submitted}
            >
              거래 마감 — 남은 공개 카드는 내가 심습니다
            </button>
          )}
        </section>
      )}

      {/* 4단계 — 뽑기 (서버가 자동 진행하면 이 화면은 스쳐 지나간다) */}
      {isMyTurn && game.phase === 'draw' && (
        <div className="bz-action-bar">
          <span className="bz-action-text">
            카드 {BZ_DRAW_COUNT}장을 뽑아 손패 맨 뒤에 붙입니다
          </span>
          <div className="bz-action-buttons">
            <button
              type="button"
              className="bz-primary-button"
              onClick={() => {
                lockSubmit();
                onEndPhase();
              }}
              disabled={submitted}
            >
              뽑고 차례 넘기기
            </button>
          </div>
        </div>
      )}

      {/* 남의 밭 — 축소 나열 (전원 공개) */}
      <section className="bz-section bz-others">
        <div className="bz-section-head">
          <span className="bz-section-title">다른 참가자의 콩밭</span>
          <span className="bz-section-note">
            밭과 금화는 전원 공개 · 손패는 장수만 보입니다
          </span>
        </div>
        <div className="bz-others-list">
          {players
            .filter((p) => p.seat !== game.yourSeat)
            .map((p) => {
              const fields = bzFieldSlots(p);
              return (
                <div
                  key={p.seat}
                  className={`bz-other ${p.seat === game.currentSeat ? 'active' : ''}`}
                >
                  <div className="bz-other-head">
                    <span className="bz-other-name">
                      {p.seat === game.currentSeat && '▶ '}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {!p.connected && !p.bot && (
                        <span className="bz-badge off">끊김</span>
                      )}
                    </span>
                    <span className="bz-other-meta">
                      🪙 {p.coins} · 손패 {p.handCount}장
                    </span>
                  </div>
                  <div className="bz-other-fields">
                    {fields.map((f, i) => (
                      <span
                        key={i}
                        className={[
                          'bz-other-field',
                          bzFieldEmpty(f)
                            ? 'empty'
                            : `bz-tone-${bzBean(f.bean ?? '').tone}`,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        title={
                          bzFieldEmpty(f)
                            ? `${i + 1}번 밭 — 비어 있음`
                            : `${bzBean(f.bean ?? '').name} ${f.count}장 — 지금 수확하면 금화 ${bzFieldCoins(f)}개`
                        }
                      >
                        {bzFieldEmpty(f) ? (
                          <span className="bz-other-empty-text">빈 밭</span>
                        ) : (
                          <>
                            <span aria-hidden="true">
                              {bzBean(f.bean ?? '').emoji}
                            </span>
                            <span className="bz-other-field-name">
                              {bzBean(f.bean ?? '').name}
                            </span>
                            <span className="bz-other-field-count">
                              {f.count}장
                            </span>
                            <span className="bz-other-field-coin">
                              🪙{bzFieldCoins(f)}
                            </span>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* 콩미터 팝업 — 어떤 콩을 탭해도 여기로 온다 */}
      {meterBean !== null && (
        <BohnanzaMeterSheet
          bean={meterBean}
          myFields={myFields}
          onClose={() => setMeterBean(null)}
        />
      )}
    </div>
  );
}

// ---------- 내 밭 한 칸 ----------
// "지금 수확하면 금화 몇 개"를 늘 적고, 다음 문턱까지 몇 장 남았는지도 적는다.
function BohnanzaFieldCard({
  field,
  index,
  fields,
  onHarvest,
  onPickBean,
  disabled,
}: {
  field: BZField;
  index: number;
  fields: BZField[];
  onHarvest: () => void;
  onPickBean: (bean: BZBean) => void;
  disabled: boolean;
}) {
  const empty = bzFieldEmpty(field);
  const bean = field.bean ?? '';
  const meta = bzBean(bean);
  const coins = bzFieldCoins(field);
  const next = empty ? null : bzNextStep(bean, field.count);
  const blockReason = bzHarvestBlockReason(fields, index);
  const canHarvest = !empty && blockReason === null;

  return (
    <div
      className={[
        'bz-field',
        empty ? 'empty' : `bz-tone-${meta.tone}`,
        !empty && coins > 0 ? 'ripe' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="bz-field-no">{index + 1}번 밭</span>

      {empty ? (
        <span className="bz-field-empty-text">비어 있음</span>
      ) : (
        <>
          <button
            type="button"
            className="bz-field-bean"
            onClick={() => onPickBean(bean)}
            aria-label={`${meta.name} ${field.count}장 — 콩미터 보기`}
          >
            <span className="bz-field-emoji" aria-hidden="true">
              {meta.emoji}
            </span>
            <span className="bz-field-name">{meta.name}</span>
            <span className="bz-field-count">{field.count}장</span>
          </button>

          {/* 이 밭의 값어치 — 판단의 핵심이라 가장 크게 */}
          <span className={`bz-field-coins ${coins > 0 ? 'has' : 'none'}`}>
            지금 수확하면 <b>🪙 {coins}</b>
          </span>

          <BohnanzaBeanometer bean={bean} count={field.count} compact />

          <span className="bz-field-next">
            {next
              ? `${next.more}장 더 모으면 🪙 ${next.coins}`
              : '더 오를 칸이 없습니다'}
          </span>

          <button
            type="button"
            className="bz-ghost-button bz-harvest-btn"
            onClick={onHarvest}
            disabled={!canHarvest || disabled}
          >
            수확하기
          </button>
          {blockReason && (
            <span className="bz-field-block">⚠ {blockReason}</span>
          )}
        </>
      )}
    </div>
  );
}

// ---------- 거래 제안 카드 ----------
function BohnanzaOfferCard({
  offer,
  nameOf,
  onPickBean,
  actions,
}: {
  offer: BZOffer;
  nameOf: (seat: number) => string;
  onPickBean: (bean: BZBean) => void;
  actions?: React.ReactNode;
}) {
  const give = [...(offer.giveHand ?? []), ...(offer.giveFlipped ?? [])];
  const want = offer.wantHand ?? [];
  const donation = want.length === 0;

  return (
    <div className="bz-offer">
      <div className="bz-offer-head">
        <span className="bz-offer-who">
          {nameOf(offer.fromSeat)} → {nameOf(offer.toSeat)}
        </span>
        <span className={`bz-offer-kind ${donation ? 'donate' : 'trade'}`}>
          {donation ? '🎁 기부' : '🤝 거래'}
        </span>
      </div>

      <div className="bz-offer-side give">
        <span className="bz-offer-label">줍니다</span>
        <span className="bz-offer-beans">
          {give.map((bean, i) => (
            <BohnanzaBeanChip
              key={`g-${bean}-${i}`}
              bean={bean}
              size="sm"
              onPick={onPickBean}
            />
          ))}
          {give.length === 0 && (
            <span className="bz-offer-none">주는 카드 없음</span>
          )}
        </span>
      </div>

      <div className="bz-offer-side want">
        <span className="bz-offer-label">받습니다</span>
        <span className="bz-offer-beans">
          {want.map((bean, i) => (
            <BohnanzaBeanChip
              key={`w-${bean}-${i}`}
              bean={bean}
              size="sm"
              onPick={onPickBean}
            />
          ))}
          {donation && (
            <span className="bz-offer-none">
              받는 것 없음 — 그냥 주는 기부입니다
            </span>
          )}
        </span>
      </div>

      {actions && <div className="bz-offer-actions">{actions}</div>}
    </div>
  );
}

// ---------- 콩미터 팝업 ----------
function BohnanzaMeterSheet({
  bean,
  myFields,
  onClose,
}: {
  bean: BZBean;
  myFields: BZField[];
  onClose: () => void;
}) {
  const meta = bzBean(bean);
  const mine = myFields.find((f) => f.bean === bean);
  const count = mine?.count ?? 0;
  const coins = bzCoins(bean, count);
  const next = bzNextStep(bean, count);
  const cells = bzMeterCells(bean);

  return (
    <div
      className="bz-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`bz-sheet bz-tone-${meta.tone}`}
        role="dialog"
        aria-label={`${meta.name} 콩미터`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bz-sheet-head">
          <span className="bz-sheet-emoji" aria-hidden="true">
            {meta.emoji}
          </span>
          <span className="bz-sheet-name">{meta.name}</span>
          {meta.total > 0 && (
            <span className="bz-sheet-total">덱에 총 {meta.total}장</span>
          )}
        </div>

        <div className="bz-sheet-now">
          <span>
            내 밭에 <b>{count}장</b>
          </span>
          <span>
            지금 수확하면 <b>🪙 {coins}</b>
          </span>
        </div>

        <table className="bz-sheet-table">
          <thead>
            <tr>
              <th>금화</th>
              <th>필요한 장수</th>
              <th>지금</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((cell) => {
              const reached = count >= cell.need;
              return (
                <tr key={cell.coins} className={reached ? 'reached' : ''}>
                  <td>🪙 {cell.coins}</td>
                  <td>{cell.need}장</td>
                  <td>
                    {reached ? '✔ 달성' : `${cell.need - count}장 더`}
                  </td>
                </tr>
              );
            })}
            {cells.length === 0 && (
              <tr>
                <td colSpan={3}>콩미터를 알 수 없는 콩입니다</td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="bz-sheet-note">
          {meta.bean === 'garden'
            ? '강낭콩만 예외입니다 — 금화 1개·4개 칸이 없습니다'
            : next
              ? `${next.more}장 더 모으면 금화 ${next.coins}개가 됩니다`
              : '더 오를 칸이 없습니다 — 수확하기 좋습니다'}
        </p>

        <button type="button" className="bz-primary-button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
