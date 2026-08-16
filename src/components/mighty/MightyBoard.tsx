import { useEffect, useState } from 'react';
import type {
  MTBidSuit,
  MTCard,
  MTEvent,
  MTFriendType,
  MTGameState,
  MTPlayerView,
  MTSuit,
} from '../../types/mighty';
import type { MTToast } from '../../hooks/useMightyGameState';
import { useFanHand } from '../../hooks/useFanHand';
import {
  BID_SUIT_LABEL,
  SUIT_SYMBOL,
  jokerCallCard,
  legalPlays,
  rankLabel,
  rankOf,
  suitOf,
} from './mightyRules';
import { MightyCard } from './MightyCard';
import {
  MightyBidPanel,
  MightyFriendPanel,
  MightyJokerCallConfirm,
  MightyJokerSuitPicker,
  MightyKittyPanel,
} from './MightyActionPanels';
import './MightyBoard.css';

export interface MightyPlayOptions {
  jokerCall?: boolean;
  jokerSuit?: MTSuit;
}

interface MightyBoardProps {
  game: MTGameState;
  toasts: MTToast[];
  onBid: (suit: MTBidSuit, count: number) => void;
  onPass: () => void;
  onKitty: (discard: MTCard[], suit: MTBidSuit) => void;
  onFriend: (type: MTFriendType, card?: MTCard) => void;
  onPlay: (card: MTCard, options?: MightyPlayOptions) => void;
}

// 이벤트 토스트 문구
function toastText(event: MTEvent, game: MTGameState): string {
  const name = (seat?: number) =>
    game.players.find((p) => p.seat === seat)?.name ?? event.name ?? '?';
  const suitLabel =
    event.suit && event.suit in BID_SUIT_LABEL
      ? BID_SUIT_LABEL[event.suit as MTBidSuit]
      : '';

  switch (event.kind) {
    case 'joined':
      return `${name(event.seat)}님이 입장했습니다`;
    case 'left':
      return `${name(event.seat)}님이 나갔습니다`;
    case 'bid':
      return `${name(event.seat)} — ${suitLabel} ${event.count ?? ''} 공약`;
    case 'pass':
      return `${name(event.seat)}님 패스`;
    case 'redeal':
      return '전원 패스 — 카드를 다시 돌립니다';
    case 'contract':
      return `공약 확정 — ${name(event.seat)} ${suitLabel}${event.count ?? ''}`;
    case 'kitty_done':
      return '주공이 키티를 정리했습니다';
    case 'friend_set':
      return '주공이 프렌드를 지정했습니다';
    case 'friend_revealed':
      return `🎉 프렌드 공개 — ${name(event.seat)}!`;
    case 'play':
      return `${name(event.seat)}님이 카드를 냈습니다`;
    case 'joker_call':
      return '조커콜! 조커 소지자는 조커를 내야 합니다';
    case 'trick_won':
      return `${name(event.seat ?? event.winner)}님이 트릭을 가져갑니다`;
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
  }
}

// 좌석 패널 하나 (상대 4명 공용)
function SeatPanel({
  player,
  game,
  position,
}: {
  player: MTPlayerView;
  game: MTGameState;
  position: number;
}) {
  const bidding = game.phase === 'bidding';
  const isTurn = bidding
    ? game.bidding.turn === player.seat
    : game.currentTurn === player.seat;
  const dim = !player.connected && !player.bot;

  return (
    <div
      className={`mt-seat mt-seat-pos-${position} ${isTurn ? 'turn' : ''} ${dim ? 'dim' : ''}`}
    >
      <div className="mt-seat-name">
        {player.isDeclarer && <span title="주공">👑</span>}
        <span className="mt-seat-name-text">{player.name}</span>
        {player.bot && <span title="봇">🤖</span>}
        {player.friendRevealed && <span className="mt-friend-badge">프렌드</span>}
        {bidding && player.passed && <span className="mt-pass-badge">패스</span>}
      </div>
      <div className="mt-seat-stats">
        <span title="손패">🂠 {player.handCount}</span>
        <span title="트릭">트릭 {player.tricksWon}</span>
        <span title="점수카드">점수 {player.capturedPoints}</span>
      </div>
      {dim && <div className="mt-seat-offline">연결 끊김</div>}
    </div>
  );
}

export function MightyBoard({
  game,
  toasts,
  onBid,
  onPass,
  onKitty,
  onFriend,
  onPlay,
}: MightyBoardProps) {
  // 키티 단계에서 버릴 카드 선택 (주공 전용)
  const [kittyDiscard, setKittyDiscard] = useState<MTCard[]>([]);
  const handRef = useFanHand(game.yourHand.length);
  // 조커 리드 → 문양 선택 대기 / 조커콜 카드 리드 → 선언 확인 대기
  const [pendingJoker, setPendingJoker] = useState(false);
  const [pendingJokerCall, setPendingJokerCall] = useState<MTCard | null>(null);

  // 서버 스냅샷이 단계·턴을 바꾸면 로컬 입력 상태를 리셋한다
  useEffect(() => {
    setKittyDiscard([]);
  }, [game.phase]);
  useEffect(() => {
    setPendingJoker(false);
    setPendingJokerCall(null);
  }, [game.phase, game.currentTurn, game.trickNo]);

  const me = game.players.find((p) => p.seat === game.yourSeat);
  // 내 좌석은 항상 아래, 나머지는 반원 배치: (seat - yourSeat + 5) % 5
  const others = game.players
    .filter((p) => p.seat !== game.yourSeat)
    .map((p) => ({
      player: p,
      position: (p.seat - game.yourSeat + 5) % 5,
    }));

  const nameOf = (seat: number) =>
    game.players.find((p) => p.seat === seat)?.name ?? '?';

  const trump = game.contract?.suit ?? null;
  const isDeclarer = me?.isDeclarer ?? false;
  const myBidTurn = game.phase === 'bidding' && game.bidding.turn === game.yourSeat;
  const myPlayTurn = game.phase === 'play' && game.currentTurn === game.yourSeat;
  const leading = myPlayTurn && game.ledSuit === '' && game.trick.length === 0;

  const legal = myPlayTurn
    ? legalPlays(game.yourHand, game.ledSuit, game.jokerCallActive, trump)
    : null;

  const toggleKittyDiscard = (card: MTCard) => {
    setKittyDiscard((prev) => {
      if (prev.includes(card)) return prev.filter((c) => c !== card);
      if (prev.length >= 3) return prev;
      return [...prev, card];
    });
  };

  const handlePlayCard = (card: MTCard) => {
    if (pendingJoker || pendingJokerCall) return;
    if (leading && card === 'JK') {
      setPendingJoker(true);
      return;
    }
    // 첫 트릭에는 조커콜 무효 — 확인 없이 그냥 낸다
    if (leading && game.trickNo > 1 && card === jokerCallCard(trump)) {
      setPendingJokerCall(card);
      return;
    }
    onPlay(card);
  };

  const handleHandClick = (card: MTCard) => {
    if (game.phase === 'kitty' && isDeclarer) {
      toggleKittyDiscard(card);
    } else if (myPlayTurn) {
      handlePlayCard(card);
    }
  };

  const handInteractive =
    (game.phase === 'kitty' && isDeclarer) || myPlayTurn;

  // 상태 칩 (공약·프렌드·트릭)
  const contractChip = game.contract
    ? `공약 ${nameOf(game.contract.declarer)} ${BID_SUIT_LABEL[game.contract.suit]}${game.contract.count}`
    : null;
  const friendChip = (() => {
    const f = game.friend;
    if (!f || !f.type) return null;
    if (f.revealed && f.seat >= 0) return `프렌드 ${nameOf(f.seat)}`;
    // 공개됐는데 좌석이 없으면 실질 노프렌드 (첫 트릭을 주공이 직접 이긴 경우 등)
    if (f.revealed && f.seat < 0) return '노프렌드';
    if (f.type === 'card' && f.card) {
      const s = suitOf(f.card);
      const label = s ? `${SUIT_SYMBOL[s]}${rankLabel(rankOf(f.card))}` : 'JK';
      return `프렌드 ${label}`;
    }
    if (f.type === 'first_trick') return '프렌드 첫 트릭 승자';
    if (f.type === 'none') return '노프렌드';
    return null;
  })();

  // 트릭 카드 5칸 (position 별)
  const trickAt = (position: number) =>
    game.trick.find(
      (t) => (t.seat - game.yourSeat + 5) % 5 === position,
    ) ?? null;

  return (
    <div className="mt-board">
      <div className="mt-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="mt-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 상태 바 */}
      <div className="mt-status-bar">
        {game.phase === 'bidding' && <span className="mt-chip">입찰</span>}
        {game.phase === 'kitty' && <span className="mt-chip">키티 정리</span>}
        {game.phase === 'friend' && <span className="mt-chip">프렌드 지정</span>}
        {game.phase === 'play' && (
          <span className="mt-chip">트릭 {game.trickNo}/10</span>
        )}
        {contractChip && <span className="mt-chip accent">{contractChip}</span>}
        {friendChip && <span className="mt-chip teal">{friendChip}</span>}
        {game.phase === 'play' && game.ledSuit !== '' && (
          <span className="mt-chip">리드 {BID_SUIT_LABEL[game.ledSuit]}</span>
        )}
        {game.jokerCallActive && <span className="mt-chip warn">조커콜!</span>}
      </div>

      {/* 좌석 반원 + 중앙 */}
      <div className="mt-table">
        {others.map(({ player, position }) => (
          <SeatPanel
            key={player.seat}
            player={player}
            game={game}
            position={position}
          />
        ))}

        <div className="mt-center">
          {game.phase === 'bidding' && (
            <div className="mt-center-info">
              <p className="mt-center-line">
                {game.bidding.best
                  ? `현재 최고 — ${nameOf(game.bidding.best.seat)} ${BID_SUIT_LABEL[game.bidding.best.suit]} ${game.bidding.best.count}`
                  : '아직 공약이 없습니다'}
              </p>
              <p className="mt-center-sub">
                {myBidTurn
                  ? '내 차례입니다'
                  : `${nameOf(game.bidding.turn)}님이 공약을 고민 중…`}
              </p>
            </div>
          )}

          {game.phase === 'kitty' && (
            <div className="mt-center-info">
              <p className="mt-center-line">
                {isDeclarer
                  ? '키티 3장을 받았습니다'
                  : '주공이 키티를 정리하는 중…'}
              </p>
            </div>
          )}

          {game.phase === 'friend' && (
            <div className="mt-center-info">
              <p className="mt-center-line">
                {isDeclarer ? '프렌드를 지정하세요' : '주공이 프렌드 지정 중…'}
              </p>
            </div>
          )}

          {game.phase === 'play' && (
            <>
              <div className="mt-trick">
                {[2, 3, 1, 4, 0].map((position) => {
                  const t = trickAt(position);
                  return (
                    <div key={position} className={`mt-trick-slot slot-${position}`}>
                      {t ? (
                        <>
                          <MightyCard card={t.card} size="sm" />
                          <span className="mt-trick-name">{nameOf(t.seat)}</span>
                        </>
                      ) : (
                        <span className="mt-trick-empty" />
                      )}
                    </div>
                  );
                })}
              </div>
              {myPlayTurn && !pendingJoker && !pendingJokerCall && (
                <p className="mt-center-sub">내 차례 — 카드를 선택하세요</p>
              )}
              {game.currentTurn >= 0 && game.currentTurn !== game.yourSeat && (
                <p className="mt-center-sub">{nameOf(game.currentTurn)}님 차례</p>
              )}
              {game.lastTrick && (
                <div className="mt-last-trick">
                  <span className="mt-last-trick-label">
                    지난 트릭 · {nameOf(game.lastTrick.winner)} 승
                  </span>
                  <span className="mt-last-trick-cards">
                    {game.lastTrick.cards.map((t) => (
                      <MightyCard key={`${t.seat}-${t.card}`} card={t.card} size="sm" />
                    ))}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 내 영역 */}
      <div className="mt-my-area">
        {me && (
          <div
            className={`mt-my-info ${myBidTurn || myPlayTurn ? 'turn' : ''}`}
          >
            <span className="mt-seat-name-text">
              {me.isDeclarer && '👑 '}
              {me.name} (나)
            </span>
            {me.friendRevealed && <span className="mt-friend-badge">프렌드</span>}
            {game.phase === 'bidding' && me.passed && (
              <span className="mt-pass-badge">패스</span>
            )}
            <span className="mt-seat-stats-inline">
              트릭 {me.tricksWon} · 점수 {me.capturedPoints}
            </span>
          </div>
        )}

        <div className="mt-hand" ref={handRef}>
          {game.yourHand.map((card, i) => {
            const prev = i > 0 ? game.yourHand[i - 1] : null;
            const suitBreak = prev !== null && suitOf(prev) !== suitOf(card);
            const inKitty = game.yourKitty?.includes(card) ?? false;
            const disabled =
              myPlayTurn && legal !== null ? !legal.has(card) : false;
            return (
              <div
                key={card}
                className={`mt-hand-slot ${suitBreak ? 'suit-break' : ''}`}
              >
                <MightyCard
                  card={card}
                  onClick={
                    handInteractive ? () => handleHandClick(card) : undefined
                  }
                  disabled={handInteractive ? disabled : undefined}
                  selected={kittyDiscard.includes(card)}
                  highlighted={game.phase === 'kitty' && inKitty}
                />
              </div>
            );
          })}
        </div>

        {/* 하단 액션 패널 */}
        {myBidTurn && (
          <MightyBidPanel best={game.bidding.best} onBid={onBid} onPass={onPass} />
        )}
        {game.phase === 'kitty' && isDeclarer && game.contract && (
          <MightyKittyPanel
            contract={game.contract}
            selectedCount={kittyDiscard.length}
            onSubmit={(suit) => onKitty(kittyDiscard, suit)}
          />
        )}
        {game.phase === 'friend' && isDeclarer && (
          <MightyFriendPanel onSubmit={onFriend} />
        )}
        {pendingJoker && (
          <MightyJokerSuitPicker
            onPick={(suit) => {
              setPendingJoker(false);
              onPlay('JK', { jokerSuit: suit });
            }}
            onCancel={() => setPendingJoker(false)}
          />
        )}
        {pendingJokerCall && (
          <MightyJokerCallConfirm
            card={pendingJokerCall}
            onPlay={(jokerCall) => {
              const card = pendingJokerCall;
              setPendingJokerCall(null);
              onPlay(card, jokerCall ? { jokerCall: true } : undefined);
            }}
            onCancel={() => setPendingJokerCall(null)}
          />
        )}
      </div>
    </div>
  );
}
