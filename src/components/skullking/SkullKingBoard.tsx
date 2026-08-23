import { useEffect, useState } from 'react';
import type {
  KGCard,
  KGEvent,
  KGGameState,
  KGSuit,
} from '../../types/skullking';
import {
  KG_SPECIAL_ICON,
  KG_SPECIAL_LABEL,
  KG_SUIT_ICON,
  KG_SUIT_LABEL,
  kgBidHint,
  kgCardLabel,
  kgMaxRound,
  kgPlayableFlags,
} from '../../types/skullking';
import type { KGToast } from '../../hooks/useSkullKingGameState';
import './SkullKingBoard.css';

interface SkullKingBoardProps {
  game: KGGameState;
  toasts: KGToast[];
  // 비드 제출 — 0 ~ 이번 라운드 장수
  onBid: (bid: number) => void;
  // 카드 내기 — 내 손패 인덱스
  onPlay: (index: number) => void;
}

// 무늬 아이콘·이름 — 특수 카드('' 무늬)에도 안전하게 접근한다
const suitIcon = (suit: KGSuit): string =>
  suit ? KG_SUIT_ICON[suit] : '';
const suitLabel = (suit: KGSuit): string =>
  suit ? KG_SUIT_LABEL[suit] : '';

// 카드 한 장 — 숫자는 색+숫자, 특수는 이모지
function KGCardFace({
  card,
  size = 'md',
}: {
  card: KGCard;
  size?: 'sm' | 'md';
}) {
  const cls =
    card.kind === 'number' ? `suit-${card.suit}` : `kind-${card.kind}`;
  return (
    <span className={`kg-card ${size} ${cls}`}>
      {card.kind === 'number' ? (
        <>
          <span className="kg-card-suit">{suitIcon(card.suit)}</span>
          <span className="kg-card-rank">{card.rank}</span>
        </>
      ) : (
        <>
          <span className="kg-card-icon">{KG_SPECIAL_ICON[card.kind]}</span>
          <span className="kg-card-name">{KG_SPECIAL_LABEL[card.kind]}</span>
        </>
      )}
    </span>
  );
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: KGEvent, game: KGGameState): string {
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
      return `🃏 라운드 ${game.round} — 카드를 나눕니다`;
    case 'bid':
      return `${name(event.seat)}님이 비드를 제출했습니다`;
    case 'bids_revealed':
      return '📣 비드 공개!';
    case 'play':
      return `${name(event.seat)}님이 카드를 냈습니다`;
    case 'trick_won':
      return `${name(event.seat)}님이 트릭을 가져갑니다`;
    case 'round_end':
      return '🧾 라운드 정산';
    case 'auto_bid':
      return '⏳ 시간 초과 — 비드가 0으로 자동 제출되었습니다';
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

export function SkullKingBoard({
  game,
  toasts,
  onBid,
  onPlay,
}: SkullKingBoardProps) {
  // 손패 탭 → 확인 흐름의 로컬 선택 (손패 인덱스)
  const [selected, setSelected] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지 (비드·플레이 공용).
  // 서버가 거부(kg_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 진행 여부는 스냅샷(phase·currentSeat·trick)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const players = game.players ?? [];
  const trick = game.trick ?? [];
  const yourHand = game.yourHand ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)는 비드·플레이 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;
  const myBid = game.yourBid ?? -1;
  const maxRound = game.maxRound > 0 ? game.maxRound : kgMaxRound(players.length);

  // 스냅샷 컨텍스트(라운드·단계·차례·트릭 진행)가 바뀌면 로컬 선택과
  // 연타 잠금을 리셋한다 — 남아 있던 선택이 다음 상황에 잘못 확정되지 않게.
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [game.round, game.phase, game.currentSeat, trick.length]);

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

  const isBidding = game.phase === 'bidding';
  const isPlaying = game.phase === 'playing';
  const isRoundEnd = game.phase === 'round_end';
  const isMyTurn = isPlaying && !isSpectator && game.currentSeat === game.yourSeat;

  // 비드 — 제출하면 다음 라운드까지 잠긴다 (본인 스냅샷 yourBid 가 진실)
  const bidSubmitted = myBid >= 0 || (me?.bidSubmitted ?? false);
  const canBid = isBidding && !isSpectator && !bidSubmitted && !submitted;
  const bidCount = players.filter((p) => p.bidSubmitted).length;

  const handleBid = (bid: number) => {
    if (!canBid) return;
    lockSubmit();
    onBid(bid);
  };

  // 따라내기 의무 — 서버가 최종 판정하고 이건 보조 필터(흐림 + 이유 툴팁)다
  const playable = kgPlayableFlags(yourHand, game.leadSuit);
  const canPlay = isMyTurn && !submitted;

  const handleCardTap = (index: number) => {
    if (!canPlay || !playable[index]) return;
    setSelected((prev) => (prev === index ? null : index));
  };

  const handleConfirmPlay = () => {
    if (selected === null || !canPlay) return;
    lockSubmit();
    onPlay(selected);
    setSelected(null);
  };

  const lastTrick = game.lastTrick ?? null;
  // 스냅샷마다 key 를 갈아 끼워 승자 연출을 다시 돌린다
  const lastTrickKey = lastTrick
    ? `${game.round}-${lastTrick.winnerSeat}-${lastTrick.cards.length}-${trick.length}`
    : 'none';

  const roundResult = game.roundResult ?? null;

  const headline = (() => {
    if (isRoundEnd) return '🧾 라운드 정산';
    if (isBidding) {
      if (isSpectator) return '🤫 전원 비드 제출 중';
      return bidSubmitted ? '⏳ 다른 참가자를 기다리는 중' : '🎯 비드를 정하세요';
    }
    if (isMyTurn) return '🃏 내 차례 — 카드를 내세요';
    return `${nameOf(game.currentSeat)}님이 카드를 내는 중`;
  })();

  const subline = (() => {
    if (isRoundEnd) return '잠시 후 다음 라운드가 시작됩니다';
    if (isBidding) {
      if (isSpectator) return '관전 중 — 비드는 전원 제출 후 공개됩니다';
      return bidSubmitted
        ? `내 비드 ${myBid} — 전원이 내면 일괄 공개됩니다`
        : `이번 라운드에 몇 트릭을 먹을지 0~${game.round} 중에 고르세요`;
    }
    if (isSpectator) return '관전 중 — 손패는 보이지 않습니다';
    if (isMyTurn)
      return game.leadSuit
        ? `리드 무늬는 ${suitLabel(game.leadSuit)} — 같은 무늬 숫자 카드가 있으면 그 무늬나 특수 카드만 낼 수 있습니다`
        : '리드입니다 — 어떤 카드든 낼 수 있습니다';
    return '트릭 승자가 다음 리드를 잡습니다';
  })();

  return (
    <div className="kg-scope kg-board">
      <div className="kg-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="kg-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 라운드 / 단계 / 카운트다운 */}
      <div className={`kg-status-bar ${game.phase}`}>
        <div className="kg-status-row">
          <span className="kg-status-chip">
            라운드 {game.round}/{maxRound}
          </span>
          <span className="kg-status-chip">
            {isBidding
              ? '비드'
              : isRoundEnd
                ? '정산'
                : `트릭 ${trick.length}/${players.length}`}
          </span>
          {isPlaying && game.leadSuit && (
            <span className={`kg-status-chip lead suit-${game.leadSuit}`}>
              리드 {suitIcon(game.leadSuit)} {suitLabel(game.leadSuit)}
            </span>
          )}
          {game.endsAt > 0 && (
            <span className={`kg-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="kg-status-title">{headline}</span>
        <span className="kg-status-sub">{subline}</span>
      </div>

      {isSpectator && (
        <div className="kg-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {/* 비드 단계 — 0~r 숫자 버튼 (제출 후 잠금) */}
      {isBidding && (
        <div className="kg-bid-box">
          <div className="kg-section-head">
            <span className="kg-section-title">비드</span>
            <span className="kg-section-note">
              {bidCount}/{players.length}명 제출
            </span>
          </div>
          {!isSpectator ? (
            <>
              <div className="kg-bid-grid">
                {Array.from({ length: game.round + 1 }).map((_, n) => (
                  <button
                    key={n}
                    type="button"
                    className={`kg-bid-button ${myBid === n ? 'picked' : ''}`}
                    onClick={() => handleBid(n)}
                    disabled={!canBid}
                    aria-pressed={myBid === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="kg-bid-hint">
                {bidSubmitted
                  ? `제출 완료 — 비드 ${myBid} (${kgBidHint(myBid, game.round)})`
                  : '정확히 맞히면 크게 얻고, 어긋나면 잃습니다'}
              </p>
            </>
          ) : (
            <p className="kg-bid-hint">
              전원이 제출하면 비드가 일괄 공개됩니다
            </p>
          )}
        </div>
      )}

      {/* 플레이 단계 — 중앙 트릭 (좌석별 카드 부채) */}
      {isPlaying && (
        <div className="kg-trick-area">
          <div className="kg-section-head">
            <span className="kg-section-title">이번 트릭</span>
            <span className="kg-section-note">
              {trick.length === 0
                ? '아직 낸 카드가 없습니다'
                : `${trick.length}장`}
            </span>
          </div>
          <div className="kg-trick-fan">
            {trick.length === 0 && (
              <span className="kg-trick-empty">— 리드를 기다리는 중 —</span>
            )}
            {trick.map((t, i) => {
              const spread = (i - (trick.length - 1) / 2) * 5;
              return (
                <div
                  key={`${t.seat}-${i}`}
                  className={`kg-trick-slot ${t.seat === game.yourSeat ? 'mine' : ''}`}
                  style={{ transform: `rotate(${spread}deg)` }}
                >
                  <KGCardFace card={t.card} />
                  <span className="kg-trick-name">{nameOf(t.seat)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 직전 트릭 승자 연출 */}
      {(isPlaying || isRoundEnd) && lastTrick && (
        <div key={lastTrickKey} className="kg-last-trick">
          <span className="kg-last-trick-title">
            🏆 {nameOf(lastTrick.winnerSeat)}님이 트릭 획득
          </span>
          <div className="kg-last-trick-cards">
            {lastTrick.cards.map((t, i) => (
              <span
                key={`${t.seat}-${i}`}
                className={`kg-last-trick-card ${t.seat === lastTrick.winnerSeat ? 'won' : ''}`}
                title={`${nameOf(t.seat)} — ${kgCardLabel(t.card)}`}
              >
                <KGCardFace card={t.card} size="sm" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 라운드 정산 표 — 비드·획득·증감·누계 */}
      {isRoundEnd && roundResult && (
        <div className="kg-round-table">
          <div className="kg-section-head">
            <span className="kg-section-title">라운드 {game.round} 정산</span>
            <span className="kg-section-note">
              {roundResult.message ??
                (game.round < maxRound
                  ? `다음 라운드는 ${game.round + 1}장`
                  : '마지막 라운드였습니다')}
            </span>
          </div>
          <div className="kg-table">
            <div className="kg-table-row head">
              <span className="kg-col name">이름</span>
              <span className="kg-col num">비드</span>
              <span className="kg-col num">획득</span>
              <span className="kg-col num">증감</span>
              <span className="kg-col num">누계</span>
            </div>
            {(roundResult.rows ?? []).map((row) => (
              <div
                key={row.seat}
                className={`kg-table-row ${row.seat === game.yourSeat ? 'me' : ''}`}
              >
                <span className="kg-col name">{nameOf(row.seat)}</span>
                <span className="kg-col num">{row.bid}</span>
                <span
                  className={`kg-col num ${row.bid === row.tricks ? 'hit' : 'miss'}`}
                >
                  {row.tricks}
                </span>
                <span
                  className={`kg-col num ${row.delta >= 0 ? 'plus' : 'minus'}`}
                >
                  {row.delta > 0 ? `+${row.delta}` : row.delta}
                </span>
                <span className="kg-col num total">{row.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 좌석 스트립 — 비드/획득 · 총점 · 봇/끊김 */}
      <div className="kg-seats">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const offline = !p.connected && !p.bot;
          const bidText =
            p.bid >= 0
              ? `${p.tricks}/${p.bid}`
              : isBidding
                ? p.bidSubmitted
                  ? '제출 완료'
                  : '비드 중…'
                : `${p.tricks}/?`;
          return (
            <div
              key={p.seat}
              className={[
                'kg-seat',
                isMe ? 'me' : '',
                isPlaying && p.seat === game.currentSeat ? 'active' : '',
                lastTrick && lastTrick.winnerSeat === p.seat ? 'won' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="kg-seat-head">
                <span className="kg-seat-name">
                  {isPlaying && p.seat === game.currentSeat && '▶ '}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="kg-seat-badges">
                  {p.bot && <span className="kg-badge">🤖</span>}
                  {offline && <span className="kg-badge off">끊김</span>}
                </span>
              </div>
              <div className="kg-seat-stats">
                <span
                  className={`kg-stat ${p.bid >= 0 && p.tricks === p.bid ? 'hit' : ''}`}
                  title="획득 트릭 / 비드"
                >
                  {bidText}
                </span>
                <span className="kg-stat score" title="총점">
                  {p.score}점
                </span>
                <span className="kg-stat" title="남은 손패">
                  🂠 {p.handCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 내 손패 — 낼 수 없는 카드는 흐림 처리 + 이유 툴팁 */}
      {!isSpectator && (
        <div className="kg-my-hand">
          <div className="kg-section-head">
            <span className="kg-section-title">내 손패</span>
            <span className="kg-section-note">
              {yourHand.length > 0
                ? isMyTurn
                  ? '카드를 눌러 선택하세요'
                  : '나만 볼 수 있습니다'
                : '남은 카드가 없습니다'}
            </span>
          </div>
          <div className="kg-hand-row">
            {yourHand.map((card, i) => {
              const ok = playable[i];
              const blocked = isMyTurn && !ok;
              return (
                <button
                  key={`${card.kind}-${card.suit}-${card.rank}-${i}`}
                  type="button"
                  className={[
                    'kg-hand-card',
                    canPlay && ok ? 'selectable' : '',
                    selected === i ? 'selected' : '',
                    blocked ? 'blocked' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleCardTap(i)}
                  disabled={!canPlay || !ok}
                  title={
                    blocked
                      ? `${suitLabel(game.leadSuit)} 무늬를 가지고 있어 따라내야 합니다`
                      : kgCardLabel(card)
                  }
                  aria-label={kgCardLabel(card)}
                >
                  <KGCardFace card={card} />
                </button>
              );
            })}
            {yourHand.length === 0 && (
              <span className="kg-hand-empty">— 전부 냈습니다 —</span>
            )}
          </div>
        </div>
      )}

      {/* 하단 확정 바 — 카드 탭 후 내기 확정 */}
      {selected !== null && canPlay && yourHand[selected] && (
        <div className="kg-confirm-bar">
          <span className="kg-confirm-text">
            {kgCardLabel(yourHand[selected])} — 낼까요?
          </span>
          <div className="kg-confirm-actions">
            <button
              type="button"
              className="kg-confirm-button"
              onClick={handleConfirmPlay}
            >
              내기
            </button>
            <button
              type="button"
              className="kg-cancel-button"
              onClick={() => setSelected(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
