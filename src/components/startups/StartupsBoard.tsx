// 스타트업스 보드.
//
// 카드가 어디로 흐르는가 (앞면/뒷면을 헷갈리면 이 게임은 안 보인다)
//
//        ┌──────────────┐  ① 뽑기(내가 대주주인 회사면 못 가져옴
//        │  덱 + 안티💰  │      → 돈 1원을 안티로 얹고 다시 뽑는다)
//        └──────────────┘ ─────────────────────────────┐
//                                                      ▼
//        ┌──────────────────────────┐          ┌─────────────────┐
//        │  시장 [카드+안티][카드+안티] │          │  내 손패 (비공개) │
//        └──────────────────────────┘          └─────────────────┘
//              │  ① 시장에서 가져오기                    │
//              │    (그 위의 안티를 전부 받는다)           │ ② 1장 내려놓기
//              ▼                                       ▼
//     ┌────────────────────────┐            (시장에 앞면으로 놓인다.
//     │ 내 앞면 보유 (전원 공개)  │             내 앞에 쌓이는 게 아니다!)
//     │  = 대주주 판정의 근거     │
//     └────────────────────────┘
//
// 화면의 얼굴은 "회사 현황판"이다 — 회사 6종마다 가치(총 장수)·각자 앞면
// 보유 수·대주주를 한 판에 모아 둔다. 이 판이 곧 판단의 전부다.

import { useEffect, useState } from 'react';
import type {
  SUCompanyDisplay,
  SUEvent,
  SUGameState,
  SUPlayerView,
} from '../../types/startups';
import {
  SU_ANTE_PER_SKIP,
  suAnteLevel,
  suCompanyDisplay,
  suCompanyList,
  suFaceUp,
  suMarketCount,
  suMarketFrom,
  suMoney,
  suMyMajorities,
  suRevealedCount,
  suTotalAnte,
} from '../../types/startups';
import type { SUToast } from '../../hooks/useStartupsGameState';
import './StartupsBoard.css';

interface StartupsBoardProps {
  game: SUGameState;
  toasts: SUToast[];
  // 'deck' 또는 'market:N'
  onTake: (from: string) => void;
  // 손패 인덱스
  onPlay: (index: number) => void;
}

// ---------- 회사 표기 ----------
// 색만으로 구분되지 않게 이모지 + 한글 이름을 늘 병기하고,
// 가치(=총 장수)를 함께 적는다. 종료 화면도 이 컴포넌트를 쓴다.
export function StartupsCompanyBadge({
  company,
  size = 'md',
  showValue = true,
}: {
  company: SUCompanyDisplay;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}) {
  return (
    <span
      className={`su-co-badge size-${size} su-tone-${company.tone}`}
      title={`${company.name} — 총 ${company.size}장 · 가치 ${company.size}원`}
    >
      <span className="su-co-emoji" aria-hidden="true">
        {company.emoji}
      </span>
      <span className="su-co-name">{company.name}</span>
      {showValue && <span className="su-co-value">{company.size}원</span>}
    </span>
  );
}

// ---------- 안티 배지 ----------
// 이 게임의 판돈. 쌓일수록 강조가 세진다 (없음 → 1~2 → 3~4 → 5 이상).
function StartupsAnteBadge({
  ante,
  label = '안티',
}: {
  ante: number;
  label?: string;
}) {
  const level = suAnteLevel(ante);
  return (
    <span
      className={`su-ante ante-lv-${level}`}
      title={
        ante > 0
          ? `${label} ${ante}원 — 이 카드를 가져오면 전부 받습니다`
          : `쌓인 ${label}가 없습니다`
      }
    >
      <span className="su-ante-icon" aria-hidden="true">
        {ante > 0 ? '💰' : '○'}
      </span>
      <span className="su-ante-text">
        {ante > 0 ? `${label} ${ante}원` : `${label} 없음`}
      </span>
    </span>
  );
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: SUEvent, game: SUGameState): string {
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
    case 'take_deck':
      return `${name(event.seat)}님이 덱에서 뽑았습니다`;
    case 'take_market':
      return `${name(event.seat)}님이 시장 카드를 가져갔습니다`;
    case 'take':
      return `${name(event.seat)}님이 카드를 가져갔습니다`;
    case 'play':
      return `${name(event.seat)}님이 시장에 카드를 내려놓았습니다`;
    case 'ante':
      return `💰 ${name(event.seat)}님이 덱 위에 안티 ${SU_ANTE_PER_SKIP}원을 얹었습니다`;
    case 'majority':
      return `👑 ${name(event.seat)}님이 대주주가 되었습니다`;
    case 'deck_empty':
      return '📇 덱이 떨어졌습니다 — 이번 라운드를 마치고 정산합니다';
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

export function StartupsBoard({
  game,
  toasts,
  onTake,
  onPlay,
}: StartupsBoardProps) {
  // 가져오기 초안 — 'deck' 또는 'market:N'
  const [takeSel, setTakeSel] = useState<string | null>(null);
  // 내려놓기 초안 — 손패 인덱스
  const [playSel, setPlaySel] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(su_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
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

  const market = game.market ?? [];
  const companies = game.companies ?? [];
  const hand = game.yourHand ?? [];
  const deckLeft = game.deckLeft ?? 0;
  const deckAnte = game.deckAnte ?? 0;

  const companyList = suCompanyList(companies);
  const myMoney = me?.money ?? 0;
  const myMajorities = suMyMajorities(companies, game.yourSeat);
  const totalAnte = suTotalAnte(deckAnte, market);

  // 스냅샷 컨텍스트(차례·단계)가 바뀌면 로컬 선택과 연타 잠금을 리셋한다 —
  // 남아 있던 선택이 다음 상황에 잘못 확정되지 않게.
  useEffect(() => {
    setTakeSel(null);
    setPlaySel(null);
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

  const isTakePhase = game.phase === 'take';
  const isPlayPhase = game.phase === 'play';
  const isMySeatActive = !isSpectator && game.currentSeat === game.yourSeat;
  const canTake = isTakePhase && isMySeatActive && !submitted;
  const canPlay = isPlayPhase && isMySeatActive && !submitted;

  // ---------- 덱 뽑기 제약 ----------
  // 내가 대주주인 회사는 덱에서 뽑아도 가져올 수 없다. 뽑기 전에 알려 준다.
  const majorityNames = myMajorities
    .map((c) => {
      const d = suCompanyDisplay(c.id, companies);
      return `${d.emoji} ${d.name}`;
    })
    .join(' · ');
  const deckReason = (() => {
    if (deckLeft <= 0) return '덱이 비었습니다 — 시장에서 가져오세요';
    if (myMajorities.length === 0) {
      return '지금은 어떤 회사가 나와도 가져올 수 있습니다';
    }
    if (myMoney < SU_ANTE_PER_SKIP) {
      return `${majorityNames}의 대주주라 그 카드는 못 가져옵니다 · 돈이 ${suMoney(myMoney)}이라 안티를 얹을 수 없어 시장에서 가져와야 합니다`;
    }
    return `${majorityNames}의 대주주라 그 카드는 못 가져옵니다 — 돈 ${SU_ANTE_PER_SKIP}원을 안티로 얹고 다시 뽑습니다`;
  })();
  const deckReasonLevel =
    myMajorities.length === 0 ? 'ok' : myMoney < SU_ANTE_PER_SKIP ? 'block' : 'warn';

  // ---------- 가져오기 ----------
  const handleTakeTap = (from: string) => {
    if (!canTake) return;
    setTakeSel((prev) => (prev === from ? null : from));
  };

  const handleConfirmTake = () => {
    if (!canTake || !takeSel) return;
    lockSubmit();
    onTake(takeSel);
    setTakeSel(null);
  };

  const selMarketIndex =
    takeSel && takeSel.startsWith('market:')
      ? Number(takeSel.slice('market:'.length))
      : -1;
  const selMarketCard = selMarketIndex >= 0 ? market[selMarketIndex] : undefined;

  // ---------- 내려놓기 ----------
  const handlePlayTap = (index: number) => {
    if (!canPlay) return;
    setPlaySel((prev) => (prev === index ? null : index));
  };

  const handleConfirmPlay = () => {
    if (!canPlay || playSel === null) return;
    lockSubmit();
    onPlay(playSel);
    setPlaySel(null);
  };

  // ---------- 상단 안내 ----------
  const headline = (() => {
    if (isPlayPhase) {
      return isMySeatActive
        ? '📤 손패에서 1장을 시장에 내려놓으세요'
        : `${nameOf(game.currentSeat)}님이 카드를 내려놓는 중`;
    }
    if (isMySeatActive) return '📥 내 차례 — 카드를 가져오세요';
    return `${nameOf(game.currentSeat)}님의 차례`;
  })();

  const subline = (() => {
    if (isSpectator) return '관전 중 — 행동할 수 없습니다';
    if (isPlayPhase) {
      return isMySeatActive
        ? '내려놓은 카드는 시장에 앞면으로 놓입니다 — 남이 가져갈 수 있습니다'
        : '잠시만 기다려 주세요';
    }
    if (isMySeatActive) {
      return '덱에서 뽑으면 손패(비공개), 시장에서 가져오면 내 앞면 보유 + 안티';
    }
    return '회사 현황판을 보며 다음 수를 계산해 두세요';
  })();

  const richest = players.reduce((max, p) => Math.max(max, p.money), 0);

  return (
    <div className="su-board">
      <div className="su-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="su-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 덱 잔량 · 판돈 · 차례 · ⏱ */}
      <div className={`su-status-bar ${game.phase}`}>
        <div className="su-status-row">
          <span className="su-status-chip">📇 덱 {deckLeft}장</span>
          <span
            className={`su-status-chip ante ante-lv-${suAnteLevel(totalAnte)}`}
          >
            💰 판돈 {totalAnte}원
          </span>
          {game.endsAt > 0 && (
            <span className={`su-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="su-status-title">{headline}</span>
        <span className="su-status-sub">{subline}</span>
        {game.lastAction && (
          <span className="su-last-action">
            직전 — {game.lastAction.name}: {game.lastAction.message}
          </span>
        )}
      </div>

      {isSpectator && (
        <div className="su-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {/* 돈 순위 띠 */}
      <div className="su-score-strip">
        {players.map((p: SUPlayerView) => (
          <span
            key={p.seat}
            className={[
              'su-score-pill',
              p.seat === game.currentSeat ? 'active' : '',
              p.seat === game.yourSeat ? 'me' : '',
              p.money === richest && richest > 0 ? 'top' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="su-score-name">
              {p.seat === game.currentSeat && '▶ '}
              {p.name}
              {p.seat === game.yourSeat && ' (나)'}
              {p.bot && ' 🤖'}
              {!p.connected && !p.bot && ' ⚠'}
            </span>
            <span className="su-score-value">💰 {suMoney(p.money)}</span>
          </span>
        ))}
      </div>

      {/* 덱 + 시장 — 안티가 어디에 얼마나 쌓였는지 */}
      <section className="su-section">
        <div className="su-section-head">
          <span className="su-section-title">덱과 시장</span>
          <span className="su-section-note">
            시장 카드를 가져오면 그 위에 쌓인 안티를 전부 받습니다
          </span>
        </div>

        <div className="su-take-area">
          {/* 덱 — 뒷면 더미 + 그 위에 쌓인 안티 */}
          <button
            type="button"
            className={[
              'su-deck',
              `ante-lv-${suAnteLevel(deckAnte)}`,
              takeSel === 'deck' ? 'selected' : '',
              canTake && deckLeft > 0 ? 'selectable' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleTakeTap('deck')}
            disabled={!canTake || deckLeft <= 0}
            aria-label={`덱에서 뽑기 — 남은 ${deckLeft}장, 덱 위 안티 ${deckAnte}원. ${deckReason}`}
          >
            <span className="su-deck-top">
              <span className="su-deck-face" aria-hidden="true">
                🂠
              </span>
              <span className="su-deck-count">{deckLeft}장</span>
            </span>
            <StartupsAnteBadge ante={deckAnte} label="덱 안티" />
            <span className="su-deck-action">
              {isSpectator
                ? '덱 (비공개)'
                : canTake
                  ? '덱에서 뽑기 → 손패(비공개)'
                  : '덱에서 뽑기'}
            </span>
            {!isSpectator && (
              <span className={`su-deck-reason ${deckReasonLevel}`}>
                {deckReasonLevel === 'ok' ? '✔ ' : '⚠ '}
                {deckReason}
              </span>
            )}
          </button>

          {/* 시장 — 앞면 카드마다 자기 안티를 이고 있다 */}
          <div className="su-market">
            {market.map((card, index) => {
              const co = suCompanyDisplay(card.company, companies);
              const ante = card.ante ?? 0;
              const from = suMarketFrom(index);
              const mine = suFaceUp(me, card.company);
              const majoritySeat =
                companies.find((c) => c.id === card.company)?.majoritySeat ?? -1;
              return (
                <button
                  key={`${card.company}-${index}`}
                  type="button"
                  className={[
                    'su-market-card',
                    `su-tone-${co.tone}`,
                    `ante-lv-${suAnteLevel(ante)}`,
                    takeSel === from ? 'selected' : '',
                    canTake ? 'selectable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleTakeTap(from)}
                  disabled={!canTake}
                  aria-label={`${co.name} 주식 카드 · 가치 ${co.size}원 · 안티 ${ante}원 · 가져오면 안티를 전부 받습니다`}
                >
                  <StartupsCompanyBadge company={co} size="md" />
                  <StartupsAnteBadge ante={ante} />
                  {!isSpectator && (
                    <span className="su-market-hint">
                      {majoritySeat === game.yourSeat
                        ? `👑 내가 대주주 · 내 앞면 ${mine}장`
                        : majoritySeat >= 0
                          ? `👑 ${nameOf(majoritySeat)} · 내 앞면 ${mine}장`
                          : `대주주 없음 · 내 앞면 ${mine}장`}
                    </span>
                  )}
                </button>
              );
            })}
            {market.length === 0 && (
              <span className="su-row-empty">시장에 놓인 카드가 없습니다</span>
            )}
          </div>
        </div>
      </section>

      {/* ★ 회사 현황판 — 이 게임 판단의 전부 ★ */}
      <section className="su-section su-standings">
        <div className="su-section-head">
          <span className="su-section-title">회사 현황판</span>
          <span className="su-section-note">
            앞면 카드를 가장 많이 가진 사람이 대주주 · 동수면 대주주 없음
          </span>
        </div>

        <div className="su-standings-list">
          {companyList.map((co) => {
            const server = companies.find((c) => c.id === co.id);
            const majoritySeat = server?.majoritySeat ?? -1;
            const iAmMajority =
              majoritySeat >= 0 && majoritySeat === game.yourSeat;
            const revealed = suRevealedCount(players, market, co.id);
            const inMarket = suMarketCount(market, co.id);
            const inMyHand = hand.filter((h) => h === co.id).length;
            const top = players.reduce(
              (max, p) => Math.max(max, suFaceUp(p, co.id)),
              0,
            );
            return (
              <div
                key={co.id}
                className={[
                  'su-standing',
                  `su-tone-${co.tone}`,
                  iAmMajority ? 'mine' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="su-standing-head">
                  <StartupsCompanyBadge
                    company={co}
                    size="lg"
                    showValue={false}
                  />
                  <span className="su-standing-value" title="정산 때 카드 1장당 받는 돈">
                    가치 {co.size}원
                  </span>
                </div>

                <div className="su-standing-meta">
                  <span>총 {co.size}장</span>
                  <span>공개 {revealed}장</span>
                  <span>시장 {inMarket}장</span>
                  {!isSpectator && inMyHand > 0 && (
                    <span className="su-standing-hand">
                      🤫 내 손패 {inMyHand}장
                    </span>
                  )}
                </div>

                <div
                  className={`su-standing-major ${
                    majoritySeat < 0 ? 'none' : iAmMajority ? 'me' : 'other'
                  }`}
                >
                  {majoritySeat < 0
                    ? '👑 대주주 없음 (동수)'
                    : iAmMajority
                      ? '👑 대주주 — 나'
                      : `👑 대주주 — ${nameOf(majoritySeat)}`}
                </div>

                <div className="su-holders">
                  {players.map((p) => {
                    const count = suFaceUp(p, co.id);
                    const isMajor = majoritySeat === p.seat;
                    return (
                      <span
                        key={p.seat}
                        className={[
                          'su-holder',
                          count === 0 ? 'zero' : '',
                          isMajor ? 'major' : '',
                          p.seat === game.yourSeat ? 'me' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        title={`${p.name} — ${co.name} 앞면 ${count}장`}
                      >
                        <span className="su-holder-name">
                          {isMajor && '👑 '}
                          {p.name}
                          {p.seat === game.yourSeat && ' (나)'}
                        </span>
                        <span className="su-holder-count">{count}</span>
                        <span
                          className="su-holder-bar"
                          style={{
                            width: `${top > 0 ? (count / top) * 100 : 0}%`,
                          }}
                        />
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="su-standings-legend">
          숫자는 <b>각자 앞면으로 가진 장수</b>입니다 — 손패(비공개)와 시장
          카드는 세지 않습니다
        </p>
      </section>

      {/* 내 손패 — 나만 볼 수 있습니다 */}
      {!isSpectator && (
        <section className="su-section su-my-hand">
          <div className="su-section-head">
            <span className="su-section-title">내 손패 {hand.length}장</span>
            <span className="su-section-note">
              나만 볼 수 있습니다 · 내 돈 💰 {suMoney(myMoney)}
            </span>
          </div>
          <div className="su-hand-row">
            {hand.map((id, index) => {
              const co = suCompanyDisplay(id, companies);
              const majoritySeat =
                companies.find((c) => c.id === id)?.majoritySeat ?? -1;
              return (
                <button
                  key={`${id}-${index}`}
                  type="button"
                  className={[
                    'su-hand-card',
                    `su-tone-${co.tone}`,
                    playSel === index ? 'selected' : '',
                    canPlay ? 'selectable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handlePlayTap(index)}
                  disabled={!canPlay}
                  aria-label={`${co.name} 주식 카드 · 가치 ${co.size}원 · 시장에 내려놓기`}
                >
                  <StartupsCompanyBadge company={co} size="md" />
                  <span className="su-hand-note">
                    {majoritySeat === game.yourSeat
                      ? '👑 내가 대주주 — 쥐고 있으면 유리합니다'
                      : majoritySeat >= 0
                        ? `👑 ${nameOf(majoritySeat)}가 대주주`
                        : '대주주 없음'}
                  </span>
                </button>
              );
            })}
            {hand.length === 0 && (
              <span className="su-row-empty">손패가 없습니다</span>
            )}
          </div>
        </section>
      )}

      {/* 참가자 요약 — 돈 · 손패 장수 · 앞면 보유 */}
      <section className="su-section">
        <div className="su-section-head">
          <span className="su-section-title">참가자</span>
        </div>
        <div className="su-players">
          {players.map((p) => {
            const owned = companyList.filter((co) => suFaceUp(p, co.id) > 0);
            return (
              <div
                key={p.seat}
                className={[
                  'su-player',
                  p.seat === game.currentSeat ? 'active' : '',
                  p.seat === game.yourSeat ? 'me' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="su-player-head">
                  <span className="su-player-name">
                    {p.seat === game.currentSeat && '▶ '}
                    {p.name}
                    {p.seat === game.yourSeat && ' (나)'}
                    {p.bot && ' 🤖'}
                  </span>
                  <span className="su-player-badges">
                    {!p.connected && !p.bot && (
                      <span className="su-badge off">끊김</span>
                    )}
                    <span className="su-badge money">💰 {suMoney(p.money)}</span>
                  </span>
                </div>
                <div className="su-player-faceup">
                  {owned.map((co) => (
                    <span
                      key={co.id}
                      className={`su-face-chip su-tone-${co.tone}`}
                      title={`${co.name} 앞면 ${suFaceUp(p, co.id)}장`}
                    >
                      <span aria-hidden="true">{co.emoji}</span>
                      <span className="su-face-name">{co.name}</span>
                      <span className="su-face-count">
                        {suFaceUp(p, co.id)}
                      </span>
                    </span>
                  ))}
                  {owned.length === 0 && (
                    <span className="su-face-empty">앞면 보유 없음</span>
                  )}
                </div>
                <div className="su-player-foot">
                  <span>손패 {p.handCount}장 (비공개)</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 하단 행동 바 — 가져오기 확정 */}
      {!isSpectator && canTake && takeSel && (
        <div className="su-action-bar">
          <span className="su-action-text">
            {takeSel === 'deck'
              ? `덱에서 뽑아 손패에 넣습니다${
                  deckAnte > 0
                    ? ` (덱 위 안티 ${deckAnte}원은 그대로 남습니다)`
                    : ''
                }`
              : selMarketCard
                ? `${suCompanyDisplay(selMarketCard.company, companies).name} 카드를 가져옵니다 — 내 앞에 앞면으로 놓이고 안티 ${
                    selMarketCard.ante ?? 0
                  }원을 함께 받습니다`
                : '카드를 가져옵니다'}
          </span>
          <div className="su-action-buttons">
            <button
              type="button"
              className="su-primary-button"
              onClick={handleConfirmTake}
            >
              가져오기
            </button>
            <button
              type="button"
              className="su-ghost-button"
              onClick={() => setTakeSel(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 하단 행동 바 — 내려놓기 확정 */}
      {!isSpectator && canPlay && playSel !== null && hand[playSel] && (
        <div className="su-action-bar">
          <span className="su-action-text">
            {suCompanyDisplay(hand[playSel], companies).name} 카드를 시장에
            앞면으로 내려놓습니다 — 남이 가져갈 수 있습니다
          </span>
          <div className="su-action-buttons">
            <button
              type="button"
              className="su-primary-button"
              onClick={handleConfirmPlay}
            >
              내려놓기
            </button>
            <button
              type="button"
              className="su-ghost-button"
              onClick={() => setPlaySel(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
