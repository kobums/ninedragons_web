import { useEffect, useState } from 'react';
import type { SKEvent, SKGameState, SKPlayerView } from '../../types/skull';
import { SK_CARD_ICON, SK_CARD_LABEL, SK_WIN_POINTS } from '../../types/skull';
import type { SKToast } from '../../hooks/useSkullGameState';
import './SkullBoard.css';

interface SkullBoardProps {
  game: SKGameState;
  toasts: SKToast[];
  onPlace: (index: number) => void;
  onBid: (count: number) => void;
  onPass: () => void;
  onFlip: (seat: number) => void;
}

const PHASE_LABEL: Record<string, string> = {
  placing: '배치',
  bidding: '베팅',
  flipping: '뒤집기',
  round_end: '라운드 결과',
  game_over: '게임 종료',
};

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: SKEvent, game: SKGameState): string {
  if (event.message) return event.message;
  const name = (seat?: number) =>
    // 퇴장 이벤트는 스냅샷에서 좌석이 이미 빠진 뒤라 이벤트의 name 이 우선
    game.players.find((p) => p.seat === seat)?.name ?? event.name ?? '?';

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

export function SkullBoard({
  game,
  toasts,
  onPlace,
  onBid,
  onPass,
  onFlip,
}: SkullBoardProps) {
  // 서버 회귀로 nil 슬라이스가 와도 죽지 않게 방어한다
  const hand = game.yourHand ?? [];
  const myStack = game.yourStack ?? [];
  const flipped = game.flipped ?? [];
  const players = game.players ?? [];

  // 관전자(yourSeat -1)는 행동 잠금 — 서버도 에러 처리하지만 UI 부터 막는다
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const myTurn =
    !isSpectator && game.currentSeat === game.yourSeat && (me?.alive ?? false);

  const isPlacing = game.phase === 'placing';
  const isBidding = game.phase === 'bidding';
  const isFlipping = game.phase === 'flipping';
  const isRoundEnd = game.phase === 'round_end';
  const amChallenger = !isSpectator && game.challengerSeat === game.yourSeat;

  const alivePlayers = players.filter((p) => p.alive);
  const placedTotal = players.reduce((sum, p) => sum + p.stackCount, 0);
  // 전원 첫 장 의무 배치가 끝났는지 — 동시 배치 구간 판별 휴리스틱
  // (탈락하지 않은 전원은 항상 카드 1장 이상을 들고 있다)
  const allPlacedFirst = alivePlayers.every((p) => p.stackCount > 0);

  // ----- 로컬 입력 상태 -----
  // 손패 원판 선택 (확정 전까지 서버에 안 나간다 — 배치는 되돌릴 수 없어서)
  const [handSelected, setHandSelected] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지. 서버가 거부(sk_error)해도
  // 잠깐 뒤 풀려 재시도할 수 있다 — 진짜 상태는 스냅샷이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = (ms = 2000) => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), ms);
  };

  // 베팅 스테퍼 — 배치 중 첫 선언은 1부터, 베팅 중 레이즈는 현재+1부터
  const minBid = isBidding ? game.highBid + 1 : 1;
  const maxBid = Math.max(minBid, placedTotal);
  const [bidCount, setBidCount] = useState(minBid);

  // 단계·차례·베팅이 바뀌면 로컬 입력을 리셋한다
  useEffect(() => {
    setHandSelected(null);
    setSubmitted(false);
  }, [game.phase, game.currentSeat, game.highBid]);

  // 스테퍼 값을 항상 유효 범위로 끌어온다
  useEffect(() => {
    setBidCount((prev) => Math.min(Math.max(prev, minBid), maxBid));
  }, [minBid, maxBid]);

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

  // ----- 행동 가능 판정 -----
  const amAlive = !isSpectator && (me?.alive ?? false);
  // 배치: 첫 장(내 더미 0장)은 전원 동시, 이후는 내 차례에만
  const canPlace =
    isPlacing &&
    amAlive &&
    hand.length > 0 &&
    !submitted &&
    ((me?.stackCount ?? 0) === 0 || myTurn);
  // 베팅 선언(배치 종료 트리거): 내 차례 + 전원 첫 장 이후 + 내 더미 1장 이상
  const canDeclare =
    isPlacing && myTurn && allPlacedFirst && (me?.stackCount ?? 0) > 0 && !submitted;
  // 베팅 단계의 레이즈/패스
  const canRaise =
    isBidding && myTurn && !(me?.passed ?? false) && placedTotal > game.highBid && !submitted;
  const canPassBid = isBidding && myTurn && !(me?.passed ?? false) && !submitted;
  const showBidPanel = canDeclare || canRaise || canPassBid;

  // 뒤집기: 도전자만, 자기 더미는 서버가 먼저 자동 소진 → 상대 더미만 탭
  const canFlipSeat = (p: SKPlayerView) =>
    isFlipping &&
    amChallenger &&
    !submitted &&
    p.seat !== game.yourSeat &&
    p.stackCount > 0;

  const handleConfirmPlace = () => {
    if (handSelected === null || !canPlace) return;
    lockSubmit();
    onPlace(handSelected);
    setHandSelected(null);
  };

  const handleDeclare = () => {
    if (!(canDeclare || canRaise)) return;
    lockSubmit();
    onBid(bidCount);
  };

  const handlePass = () => {
    if (!canPassBid) return;
    lockSubmit();
    onPass();
  };

  const handleFlip = (seat: number) => {
    // 뒤집기는 연속 탭이 정상 흐름이라 잠금을 짧게 가져간다
    lockSubmit(900);
    onFlip(seat);
  };

  // 뒤집기 진행 — flipTarget 은 "남은 장미 수"
  const flippedRoses = Math.max(0, game.highBid - Math.max(0, game.flipTarget));

  // 상단 배너 보조 문구
  const bannerSub = (() => {
    if (isPlacing) {
      if (!allPlacedFirst) {
        const placedCount = alivePlayers.filter((p) => p.stackCount > 0).length;
        if (canPlace && (me?.stackCount ?? 0) === 0)
          return '첫 카드 1장을 비공개로 내려놓으세요 (의무)';
        return `전원이 첫 카드를 내려놓는 중… (${placedCount}/${alivePlayers.length})`;
      }
      if (myTurn) return '카드를 더 내려놓거나, 베팅을 선언해 배치를 끝내세요';
      if (game.currentSeat >= 0)
        return `${nameOf(game.currentSeat)}님이 배치 또는 베팅을 고르는 중…`;
      return '배치가 진행 중입니다…';
    }
    if (isBidding) {
      if (canRaise || canPassBid)
        return `현재 베팅 ${game.highBid} — 더 크게 부르거나 패스하세요`;
      if (game.currentSeat >= 0)
        return `현재 베팅 ${game.highBid} · ${nameOf(game.currentSeat)}님의 차례…`;
      return `현재 베팅 ${game.highBid}`;
    }
    if (isFlipping) {
      if (amChallenger)
        return `상대 더미를 탭해 위에서부터 뒤집으세요 — 장미 ${Math.max(0, game.flipTarget)}장 남음`;
      if (game.challengerSeat >= 0)
        return `⚔️ ${nameOf(game.challengerSeat)}님이 장미 ${game.highBid}장에 도전 중… (남은 장미 ${Math.max(0, game.flipTarget)})`;
      return '뒤집기가 진행 중입니다…';
    }
    if (isRoundEnd) {
      return game.roundResult?.message ?? '라운드가 끝났습니다 — 곧 다음 라운드가 시작됩니다';
    }
    return '';
  })();

  return (
    <div className="sk-board">
      <div className="sk-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="sk-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="sk-phase-banner">
        <span className="sk-phase-title">
          💀 스컬 · {PHASE_LABEL[game.phase] ?? game.phase}
          {game.endsAt > 0 && (
            <span
              className={`sk-deadline ${remaining < 10_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="sk-phase-sub">{bannerSub}</span>}
      </div>

      {/* 좌석 타일 그리드 — 뒤집기 단계엔 도전자의 탭 대상 */}
      <div className="sk-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isTurnSeat =
            p.seat === game.currentSeat && (isPlacing || isBidding);
          const isChal = p.seat === game.challengerSeat;
          const offline = !p.connected && !p.bot;
          const tappable = canFlipSeat(p);
          return (
            <button
              key={p.seat}
              type="button"
              className={[
                'sk-tile',
                isTurnSeat ? 'turn' : '',
                isChal ? 'challenger' : '',
                isMe ? 'me' : '',
                !p.alive ? 'dead' : '',
                tappable ? 'tappable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => tappable && handleFlip(p.seat)}
              disabled={!tappable}
            >
              <span className="sk-tile-head">
                <span className="sk-tile-name">
                  {isTurnSeat && <span className="sk-turn-mark">▶</span>}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="sk-tile-points" title={`${p.points}점 / ${SK_WIN_POINTS}점 선취`}>
                  {Array.from({ length: SK_WIN_POINTS }).map((_, i) => (
                    <span
                      key={i}
                      className={`sk-point ${i < p.points ? 'won' : ''}`}
                    >
                      🌹
                    </span>
                  ))}
                </span>
              </span>

              {/* 더미 — 카드 뒷면 스택 (장수만 공개) */}
              <span className="sk-tile-stack" aria-label={`더미 ${p.stackCount}장`}>
                {p.stackCount > 0 ? (
                  <>
                    <span className="sk-stack-discs">
                      {Array.from({ length: Math.min(p.stackCount, 4) }).map(
                        (_, i) => (
                          <span
                            key={i}
                            className="sk-stack-disc"
                            style={{ '--i': i } as React.CSSProperties}
                          />
                        ),
                      )}
                    </span>
                    <span className="sk-stack-count">{p.stackCount}장</span>
                  </>
                ) : (
                  <span className="sk-stack-none">더미 없음</span>
                )}
                {tappable && <span className="sk-flip-hint">탭해서 뒤집기</span>}
              </span>

              <span className="sk-tile-badges">
                <span className="sk-hand-count">손 {p.handCount}장</span>
                {p.bot && <span className="sk-badge">🤖</span>}
                {isChal && <span className="sk-badge challenger">⚔️ 도전자</span>}
                {!isChal && p.bid > 0 && (
                  <span className="sk-badge bid">베팅 {p.bid}</span>
                )}
                {p.passed && (isBidding || isFlipping) && (
                  <span className="sk-badge passed">패스</span>
                )}
                {offline && <span className="sk-badge off">끊김</span>}
              </span>

              {!p.alive && <span className="sk-tile-out">💀 탈락</span>}
            </button>
          );
        })}
      </div>

      {/* 뒤집힌 카드 공개 스트립 — 마지막 장은 뒤집기 연출 */}
      {flipped.length > 0 && (isFlipping || isRoundEnd) && (
        <div className="sk-flip-strip">
          <span className="sk-flip-title">
            공개된 카드 — 🌹 {flippedRoses}/{game.highBid}
          </span>
          <div className="sk-flip-cards">
            {flipped.map((f, i) => (
              <div
                key={i}
                className={[
                  'sk-flip-card',
                  f.card,
                  i === flipped.length - 1 ? 'reveal' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="sk-flip-icon">{SK_CARD_ICON[f.card]}</span>
                <span className="sk-flip-owner">{nameOf(f.seat)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 라운드 결과 연출 — 새 결과마다 key 교체로 애니메이션 재생 */}
      {game.roundResult && (
        <div
          key={`rr-${game.roundResult.kind}-${game.roundResult.seat}`}
          className={`sk-round-result ${game.roundResult.kind}`}
        >
          <span className="sk-rr-icon">
            {game.roundResult.kind === 'success' ? '🌹' : '💀'}
          </span>
          <span className="sk-rr-body">
            <span className="sk-rr-title">
              {game.roundResult.kind === 'success'
                ? `${nameOf(game.roundResult.seat)}님 도전 성공! +1점`
                : `${nameOf(game.roundResult.seat)}님 도전 실패 — 카드 1장 제거`}
            </span>
            {game.roundResult.message && (
              <span className="sk-rr-sub">{game.roundResult.message}</span>
            )}
          </span>
        </div>
      )}

      {/* 내 영역 — 내 더미(나만 보임) + 손패 원판 카드 */}
      {amAlive && (
        <div className="sk-my-area">
          {myStack.length > 0 && (
            <div className="sk-my-stack">
              <span className="sk-my-label">
                내 더미 {myStack.length}장 (나만 보여요 · 왼쪽이 먼저 낸 카드)
              </span>
              <div className="sk-my-stack-cards">
                {myStack.map((c, i) => (
                  <span key={i} className={`sk-mini-disc ${c}`}>
                    {SK_CARD_ICON[c]}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="sk-my-hand">
            <span className="sk-my-label">
              내 손패 {hand.length}장
              {canPlace && ' — 내려놓을 카드를 탭하세요 (비공개)'}
            </span>
            {hand.length > 0 ? (
              <div className="sk-hand-cards">
                {hand.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className={[
                      'sk-disc',
                      c,
                      handSelected === i ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={!canPlace}
                    onClick={() =>
                      canPlace &&
                      setHandSelected((prev) => (prev === i ? null : i))
                    }
                  >
                    <span className="sk-disc-face">{SK_CARD_ICON[c]}</span>
                    <span className="sk-disc-label">{SK_CARD_LABEL[c]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="sk-my-empty">손패가 없습니다</p>
            )}
          </div>
        </div>
      )}

      {/* 베팅 컨트롤 — 숫자 스테퍼 + 선언/패스 */}
      {showBidPanel && (
        <div className="sk-bid-panel">
          <span className="sk-bid-title">
            {isBidding
              ? `현재 베팅 ${game.highBid} — 레이즈 또는 패스`
              : '베팅을 선언하면 배치가 끝나고 베팅 단계로 넘어갑니다'}
          </span>
          {(canDeclare || canRaise) && (
            <>
              <div className="sk-bid-stepper">
                <button
                  type="button"
                  className="sk-step-button"
                  aria-label="베팅 수 줄이기"
                  onClick={() => setBidCount((v) => Math.max(minBid, v - 1))}
                  disabled={bidCount <= minBid}
                >
                  −
                </button>
                <span className="sk-bid-count">{bidCount}</span>
                <button
                  type="button"
                  className="sk-step-button"
                  aria-label="베팅 수 늘리기"
                  onClick={() => setBidCount((v) => Math.min(maxBid, v + 1))}
                  disabled={bidCount >= maxBid}
                >
                  ＋
                </button>
              </div>
              <span className="sk-bid-hint">
                “장미 {bidCount}장을 뒤집겠다”
                {bidCount === placedTotal && ' — 전체 배치 수! 선언 즉시 도전자가 됩니다'}
              </span>
            </>
          )}
          <div className="sk-bid-actions">
            {(canDeclare || canRaise) && (
              <button
                type="button"
                className="sk-bid-declare"
                onClick={handleDeclare}
              >
                베팅 선언 · {bidCount}
              </button>
            )}
            {canPassBid && (
              <button type="button" className="sk-bid-pass" onClick={handlePass}>
                패스 (라운드에서 빠짐)
              </button>
            )}
          </div>
        </div>
      )}

      {/* 하단 확인 바 — 배치 확정 */}
      {canPlace && handSelected !== null && hand[handSelected] !== undefined && (
        <div className="sk-confirm-bar">
          <span className="sk-confirm-text">
            {SK_CARD_ICON[hand[handSelected]]} {SK_CARD_LABEL[hand[handSelected]]}{' '}
            카드를 비공개로 내려놓을까요?
          </span>
          <div className="sk-confirm-actions">
            <button
              type="button"
              className="sk-confirm-button"
              onClick={handleConfirmPlace}
            >
              내려놓기
            </button>
            <button
              type="button"
              className="sk-cancel-button"
              onClick={() => setHandSelected(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 탈락자·관전자 안내 */}
      {!isSpectator && me && !me.alive && (
        <p className="sk-observer-note">
          💀 탈락했습니다 — 남은 승부를 지켜보세요
        </p>
      )}
      {isSpectator && (
        <p className="sk-observer-note">👁 관전 중 — 손패는 보이지 않습니다</p>
      )}
    </div>
  );
}
