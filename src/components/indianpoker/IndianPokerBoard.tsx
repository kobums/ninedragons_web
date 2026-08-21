import { useEffect, useState } from 'react';
import type { IPEvent, IPGameState } from '../../types/indianpoker';
import { IP_MAX_RAISE_AMOUNT, IP_ROUNDS } from '../../types/indianpoker';
import type { IPToast } from '../../hooks/useIndianPokerGameState';
import './IndianPokerBoard.css';

interface IndianPokerBoardProps {
  game: IPGameState;
  toasts: IPToast[];
  onCall: () => void;
  onRaise: (amount: number) => void;
  onFold: () => void;
}

const PHASE_LABEL: Record<string, string> = {
  betting: '베팅',
  showdown: '쇼다운',
  round_end: '라운드 결과',
  game_over: '게임 종료',
};

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: IPEvent, game: IPGameState): string {
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
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 실물 카드 한 장 — 이마에 붙인 컨셉.
// value 0 = 뒷면 (본인 은닉 or 폴드). mine 뒷면에는 물음표를 띄운다.
function IPCardView({
  value,
  mine,
  folded,
  reveal,
}: {
  value: number;
  mine: boolean;
  folded: boolean;
  reveal: boolean;
}) {
  const faceUp = value > 0;
  const classes = [
    'ip-card',
    faceUp ? 'face' : 'back',
    folded ? 'folded' : '',
    reveal ? 'reveal' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!faceUp) {
    return (
      <div
        className={classes}
        aria-label={folded ? '엎어진 카드' : mine ? '내 카드 (나만 몰라요)' : '뒷면 카드'}
      >
        {mine && !folded ? (
          <span className="ip-card-question">?</span>
        ) : (
          <span className="ip-card-back-pip">✦</span>
        )}
      </div>
    );
  }

  return (
    <div className={classes} aria-label={`카드 ${value}`}>
      <span className="ip-card-index tl">{value}</span>
      <span className="ip-card-rank">{value}</span>
      <span className="ip-card-pip">♦</span>
      <span className="ip-card-index br">{value}</span>
    </div>
  );
}

export function IndianPokerBoard({
  game,
  toasts,
  onCall,
  onRaise,
  onFold,
}: IndianPokerBoardProps) {
  // 서버 회귀로 nil 슬라이스가 와도 죽지 않게 방어한다
  const players = game.players ?? [];

  // 관전자(yourSeat -1)는 전원 카드가 보인다 — 컨트롤만 숨긴다
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);

  const isBetting = game.phase === 'betting';
  const isShowdown = game.phase === 'showdown';
  const isRoundEnd = game.phase === 'round_end';

  const myTurn =
    !isSpectator &&
    isBetting &&
    game.currentSeat === game.yourSeat &&
    (me?.alive ?? false) &&
    !(me?.folded ?? false);

  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지. 서버가 거부(ip_error)해도
  // 잠깐 뒤 풀려 재시도할 수 있다 — 진짜 상태는 스냅샷이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 차례·베팅·라운드가 바뀌면 잠금을 리셋한다
  useEffect(() => {
    setSubmitted(false);
  }, [game.phase, game.currentSeat, game.currentBet, game.round]);

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
  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  // ----- 베팅 컨트롤 판정 -----
  const myChips = me?.chips ?? 0;
  const myBet = me?.betThisRound ?? 0;
  // 콜에 필요한 칩 — 부족하면 올인 콜 (간이 룰: 있는 만큼으로 콜 인정)
  const toCall = Math.max(0, game.currentBet - myBet);
  const isAllInCall = toCall > 0 && myChips < toCall;
  const canAct = myTurn && !submitted;
  const raisesLeft = Math.max(0, game.raisesLeft);
  const canRaiseBy = (amount: number) =>
    canAct && raisesLeft > 0 && myChips >= toCall + amount;

  const handleCall = () => {
    if (!canAct) return;
    lockSubmit();
    onCall();
  };
  const handleRaise = (amount: number) => {
    if (!canRaiseBy(amount)) return;
    lockSubmit();
    onRaise(amount);
  };
  const handleFold = () => {
    if (!canAct) return;
    lockSubmit();
    onFold();
  };

  // 상단 배너 보조 문구
  const bannerSub = (() => {
    if (isBetting) {
      if (myTurn) {
        if (toCall <= 0) return '체크(콜 0칩)하거나 레이즈로 압박하세요';
        if (isAllInCall)
          return `콜에 ${toCall}칩이 필요하지만 ${myChips}칩뿐 — 올인 콜만 가능합니다`;
        return `콜 ${toCall}칩 · 레이즈 · 폴드 중 선택하세요`;
      }
      if (game.currentSeat >= 0)
        return `${nameOf(game.currentSeat)}님이 베팅을 고르는 중…`;
      return '베팅이 진행 중입니다…';
    }
    if (isShowdown) return '쇼다운! 이제 내 카드도 공개됩니다';
    if (isRoundEnd)
      return (
        game.roundResult?.message ??
        '라운드가 끝났습니다 — 곧 다음 라운드가 시작됩니다'
      );
    return '';
  })();

  // 라운드 결과 승자 문구
  const winnerSeats = game.roundResult?.winnerSeats ?? [];
  const winnerNames = winnerSeats.map(nameOf).join(', ');

  // 팟 칩 더미 — 팟 크기에 비례하되 8개 상한
  const potChips = Math.max(1, Math.min(8, game.pot));

  return (
    <div className="ip-board">
      <div className="ip-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="ip-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="ip-phase-banner">
        <span className="ip-phase-title">
          🃏 인디언 포커 · {game.round}/{IP_ROUNDS}R ·{' '}
          {PHASE_LABEL[game.phase] ?? game.phase}
          {game.endsAt > 0 && (
            <span
              className={`ip-deadline ${remaining < 10_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="ip-phase-sub">{bannerSub}</span>}
      </div>

      {/* 중앙 팟 — 칩 더미 + 숫자 */}
      <div className="ip-pot">
        <div className="ip-pot-chips" aria-hidden="true">
          {Array.from({ length: potChips }).map((_, i) => (
            <span
              key={i}
              className="ip-chip-disc"
              style={{ '--i': i } as React.CSSProperties}
            />
          ))}
        </div>
        <span className="ip-pot-amount">
          팟 <strong>{game.pot}</strong>
        </span>
        <span className="ip-pot-sub">
          현재 베팅 {game.currentBet} · 레이즈 {raisesLeft}회 남음
        </span>
      </div>

      {/* 좌석 타일 그리드 — 상대 카드는 큼직한 실물 카드, 내 자리는 뒷면+? */}
      <div className="ip-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isTurnSeat = p.seat === game.currentSeat && isBetting;
          const card = p.card ?? 0;
          const folded = p.folded ?? false;
          const offline = !p.connected && !p.bot;
          const allIn = p.alive && !folded && p.chips === 0;
          // 은닉됐던 내 카드가 쇼다운에 실값으로 오면 뒤집힘 연출
          const reveal = isMe && card > 0 && (isShowdown || isRoundEnd);
          const isWinner = isRoundEnd && winnerSeats.includes(p.seat);
          return (
            <div
              key={p.seat}
              className={[
                'ip-tile',
                isTurnSeat ? 'turn' : '',
                isMe ? 'me' : '',
                folded ? 'folded' : '',
                !p.alive ? 'dead' : '',
                isWinner ? 'winner' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="ip-tile-head">
                <span className="ip-tile-name">
                  {isTurnSeat && <span className="ip-turn-mark">▶</span>}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="ip-tile-chips" title="보유 칩">
                  🪙 {p.chips}
                </span>
              </span>

              <span className="ip-tile-card">
                {/* key 교체로 값이 나타나는 순간 flip 애니메이션 재생 */}
                <IPCardView
                  key={`${game.round}-${p.seat}-${card}`}
                  value={card}
                  mine={isMe}
                  folded={folded}
                  reveal={reveal}
                />
                {isMe && card === 0 && !folded && (
                  <span className="ip-tile-hint">이마에 붙인 내 카드</span>
                )}
              </span>

              <span className="ip-tile-badges">
                {p.betThisRound > 0 && (
                  <span className="ip-badge bet">베팅 {p.betThisRound}</span>
                )}
                {folded && <span className="ip-badge folded">폴드</span>}
                {allIn && <span className="ip-badge allin">올인</span>}
                {p.bot && <span className="ip-badge">🤖</span>}
                {offline && <span className="ip-badge off">끊김</span>}
                {isWinner && <span className="ip-badge win">🏆 승리</span>}
              </span>

              {!p.alive && <span className="ip-tile-out">💸 탈락</span>}
            </div>
          );
        })}
      </div>

      {/* 라운드 결과 — 승자·팟 획득. 새 결과마다 key 교체로 애니메이션 재생 */}
      {isRoundEnd && game.roundResult && (
        <div
          key={`rr-${game.round}-${winnerSeats.join('-')}`}
          className="ip-round-result"
        >
          <span className="ip-rr-icon">🏆</span>
          <span className="ip-rr-body">
            <span className="ip-rr-title">
              {winnerNames
                ? `${winnerNames}님이 팟 ${game.pot > 0 ? game.pot : ''}${game.pot > 0 ? '칩을' : '을'} 가져갑니다`
                : '라운드 종료'}
            </span>
            {game.roundResult.message && (
              <span className="ip-rr-sub">{game.roundResult.message}</span>
            )}
          </span>
        </div>
      )}

      {/* 베팅 컨트롤 — 콜(필요 칩) / 레이즈 +1~+3 / 폴드 */}
      {myTurn && (
        <div className="ip-controls">
          <span className="ip-controls-title">
            내 차례 — 내 칩 {myChips} · 이번 베팅 {myBet}
          </span>
          <div className="ip-controls-row">
            <button
              type="button"
              className="ip-call-button"
              onClick={handleCall}
              disabled={!canAct}
            >
              {toCall <= 0
                ? '체크'
                : isAllInCall
                  ? `올인 콜 · ${myChips}칩`
                  : `콜 · ${toCall}칩`}
            </button>
            <button
              type="button"
              className="ip-fold-button"
              onClick={handleFold}
              disabled={!canAct}
            >
              폴드
            </button>
          </div>
          <div className="ip-controls-row">
            {Array.from({ length: IP_MAX_RAISE_AMOUNT }).map((_, i) => {
              const amount = i + 1;
              return (
                <button
                  key={amount}
                  type="button"
                  className="ip-raise-button"
                  onClick={() => handleRaise(amount)}
                  disabled={!canRaiseBy(amount)}
                >
                  레이즈 +{amount}
                </button>
              );
            })}
          </div>
          <span className="ip-controls-hint">
            {raisesLeft > 0
              ? `레이즈 시 콜 비용(${toCall}칩)에 얹어 냅니다 · 남은 레이즈 ${raisesLeft}회`
              : '이번 라운드 레이즈 상한(3회)에 도달했습니다'}
          </span>
        </div>
      )}

      {/* 폴드·탈락·관전 안내 */}
      {!isSpectator && me && me.alive && me.folded && isBetting && (
        <p className="ip-observer-note">
          🙅 폴드했습니다 — 이번 라운드를 지켜보세요 (낸 칩은 팟에 남습니다)
        </p>
      )}
      {!isSpectator && me && !me.alive && (
        <p className="ip-observer-note">
          💸 칩이 떨어져 탈락했습니다 — 남은 승부를 지켜보세요
        </p>
      )}
      {isSpectator && (
        <p className="ip-observer-note">
          👁 관전 중 — 좌석이 없어 모든 카드가 보입니다
        </p>
      )}
    </div>
  );
}
