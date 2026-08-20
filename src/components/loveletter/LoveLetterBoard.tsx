import { useEffect, useState } from 'react';
import type {
  LVEvent,
  LVGameState,
  LVPrivateInfo,
} from '../../types/loveletter';
import {
  LV_CARDS,
  LV_GUARD_GUESSES,
  lvCanTargetSelf,
  lvCardName,
  lvCountessForced,
  lvNeedsTarget,
  lvReasonLabel,
} from '../../types/loveletter';
import type { LVToast } from '../../hooks/useLoveLetterGameState';
import './LoveLetterBoard.css';

interface LoveLetterBoardProps {
  game: LVGameState;
  toasts: LVToast[];
  // 사제 열람·남작 비교 결과 (lv_private) — 당사자에게만 온다
  privateInfo: LVPrivateInfo | null;
  onClearPrivate: () => void;
  onPlay: (card: number, targetSeat?: number, guess?: number) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: LVEvent, game: LVGameState): string {
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

// 캐릭터 카드 한 장 — 실물 카드 결 (모서리 인덱스 + 세리프 인물 이름 + 한 줄 효과)
function LVCard({
  value,
  selected = false,
  disabled = false,
  onClick,
}: {
  value: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const meta = LV_CARDS[value];
  const body = (
    <>
      <span className="lv-card-index tl">{value}</span>
      <span className="lv-card-face">
        <span className="lv-card-name">{meta?.name ?? '?'}</span>
        <span className="lv-card-effect">{meta?.effect ?? ''}</span>
      </span>
      <span className="lv-card-index br">{value}</span>
    </>
  );
  const classes = [
    'lv-card',
    `lv-card-v${value}`,
    selected ? 'selected' : '',
    onClick ? 'clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!onClick) return <div className={classes}>{body}</div>;
  return (
    <button
      type="button"
      className={classes}
      disabled={disabled}
      onClick={onClick}
    >
      {body}
    </button>
  );
}

// 버린 카드·공개 제거용 미니 카드 — 값 + 이름
function LVMiniCard({ value }: { value: number }) {
  return (
    <span className={`lv-mini-card lv-card-v${value}`} title={lvCardName(value)}>
      <span className="lv-mini-value">{value}</span>
      <span className="lv-mini-name">{lvCardName(value)}</span>
    </span>
  );
}

export function LoveLetterBoard({
  game,
  toasts,
  privateInfo,
  onClearPrivate,
  onPlay,
}: LoveLetterBoardProps) {
  // 선택한 손패 인덱스 (같은 값 2장을 구분하기 위해 값이 아닌 인덱스)
  const [selected, setSelected] = useState<number | null>(null);
  // 대상 선택 오버레이의 로컬 선택
  const [targetSeat, setTargetSeat] = useState<number | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(lv_error)해도 잠깐 뒤 풀려 재시도할 수 있다.
  const [submitted, setSubmitted] = useState(false);

  // 관전(yourSeat -1)·타인 스냅샷에는 yourHand 가 없다 — 반드시 방어
  const hand = game.yourHand ?? [];
  const players = game.players ?? [];
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const isPlaying = game.phase === 'playing';
  const isRoundEnd = game.phase === 'round_end';
  const myTurn =
    isPlaying &&
    !isSpectator &&
    game.currentSeat === game.yourSeat &&
    (me?.alive ?? false);

  // 턴·단계가 넘어가면 로컬 선택을 리셋한다
  useEffect(() => {
    setSelected(null);
    setTargetSeat(null);
    setGuess(null);
    setSubmitted(false);
  }, [game.currentSeat, game.phase, game.deckCount]);

  // 턴 마감 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화)
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

  // 백작부인 강제 — 손에 7과 5/6이 함께 있으면 7만 낼 수 있다
  const countessForced = lvCountessForced(hand);
  const canPlayValue = (value: number) =>
    myTurn && !submitted && (!countessForced || value === 7);

  // 카드별 지목 가능 대상 — 생존 + 비보호, 왕자만 자신 포함
  const targetsFor = (value: number) => {
    const others = players.filter(
      (p) => p.alive && !p.protected && p.seat !== game.yourSeat,
    );
    if (lvCanTargetSelf(value)) {
      const self = players.filter((p) => p.seat === game.yourSeat && p.alive);
      return [...others, ...self];
    }
    return others;
  };

  const selectedValue = selected !== null ? hand[selected] : null;
  const selectedTargets =
    selectedValue !== null && lvNeedsTarget(selectedValue)
      ? targetsFor(selectedValue)
      : [];
  // 대상 카드인데 지목할 사람이 전원 보호·탈락이면 효과 없이 낼 수 있다
  const noTargetPlay =
    selectedValue !== null &&
    lvNeedsTarget(selectedValue) &&
    selectedTargets.length === 0;
  const showTargetOverlay =
    selectedValue !== null &&
    lvNeedsTarget(selectedValue) &&
    selectedTargets.length > 0;
  const isGuard = selectedValue === 1;

  const handlePickCard = (index: number) => {
    if (!canPlayValue(hand[index])) return;
    setTargetSeat(null);
    setGuess(null);
    setSelected((prev) => (prev === index ? null : index));
  };

  const cancelSelection = () => {
    setSelected(null);
    setTargetSeat(null);
    setGuess(null);
  };

  const confirmPlay = () => {
    if (selectedValue === null || submitted) return;
    if (showTargetOverlay) {
      if (targetSeat === null) return;
      if (isGuard && guess === null) return;
      setSubmitted(true);
      onPlay(
        selectedValue,
        targetSeat,
        isGuard && guess !== null ? guess : undefined,
      );
    } else {
      // 대상 없는 카드(4·7·8) 또는 전원 보호로 효과 없이 내기
      setSubmitted(true);
      onPlay(selectedValue);
    }
    setSelected(null);
    setTargetSeat(null);
    setGuess(null);
  };

  const removedFaceUp = game.removedFaceUp ?? [];
  const roundResult = game.roundResult ?? null;
  const reasonText = roundResult ? lvReasonLabel(roundResult.reason) : '';

  // 상단 배너 보조 문구
  const bannerSub = isRoundEnd
    ? '잠시 후 다음 라운드가 시작됩니다…'
    : myTurn
      ? countessForced
        ? '손에 왕/왕자가 함께 있어 백작부인을 내야 합니다'
        : '카드 한 장을 골라 내세요 — 시간 초과 시 자동으로 냅니다'
      : isPlaying
        ? `💌 ${nameOf(game.currentSeat)}님이 고민하는 중…`
        : '';

  return (
    <div className="lv-board">
      <div className="lv-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="lv-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="lv-phase-banner">
        <span className="lv-phase-title">
          💌 러브레터 · 목표 ❤️ {game.targetTokens}
          {isPlaying && game.endsAt > 0 && (
            <span
              className={`lv-deadline ${remaining < 15_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="lv-phase-sub">{bannerSub}</span>}
      </div>

      {/* 테이블 중앙 — 덱 + 공개 제거 카드 */}
      <div className="lv-table">
        <div className="lv-deck">
          <div className="lv-deck-back">{game.deckCount}</div>
          <span className="lv-deck-label">남은 카드</span>
        </div>
        {removedFaceUp.length > 0 && (
          <div className="lv-removed">
            <span className="lv-removed-label">공개 제거</span>
            <div className="lv-removed-cards">
              {removedFaceUp.map((v, i) => (
                <LVMiniCard key={`${v}-${i}`} value={v} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 라운드 결과 — round_end 동안 잠시 표시 */}
      {isRoundEnd && roundResult && (
        <div className="lv-round-result">
          {roundResult.winnerSeat >= 0 ? (
            <>
              🏆 <strong>{nameOf(roundResult.winnerSeat)}</strong>님이 라운드
              승리{reasonText && ` — ${reasonText}`} · ❤️ 토큰 획득!
            </>
          ) : (
            <>라운드 무승부{reasonText && ` — ${reasonText}`}</>
          )}
        </div>
      )}

      {/* 플레이어 타일 — 토큰·보호·탈락·버린 카드 열 (전원 공개) */}
      <div className="lv-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isCurrent = isPlaying && p.seat === game.currentSeat;
          const offline = !p.connected && !p.bot;
          const discards = p.discards ?? [];
          return (
            <div
              key={p.seat}
              className={[
                'lv-tile',
                isCurrent ? 'current' : '',
                !p.alive ? 'out' : '',
                isMe ? 'me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="lv-tile-head">
                <span className="lv-tile-name">
                  {isCurrent && <span className="lv-tile-turn">▶</span>}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="lv-tile-tokens" title="애정 토큰">
                  ❤️ {p.tokens}
                </span>
              </div>
              <div className="lv-tile-badges">
                {p.bot && <span className="lv-badge">🤖 봇</span>}
                {p.protected && p.alive && (
                  <span className="lv-badge shield">🛡 보호</span>
                )}
                {!p.alive && <span className="lv-badge out">💔 탈락</span>}
                {offline && <span className="lv-badge off">끊김</span>}
              </div>
              {discards.length > 0 && (
                <div className="lv-tile-discards">
                  {discards.map((v, i) => (
                    <LVMiniCard key={`${v}-${i}`} value={v} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 사제 열람·남작 비교 개인 결과 — 나에게만 보인다 */}
      {privateInfo && (
        <div className="lv-private-panel">
          <span className="lv-private-icon">
            {privateInfo.kind === 'priest' ? '👁' : '⚖️'}
          </span>
          <span className="lv-private-text">{privateInfo.message}</span>
          <button
            type="button"
            className="lv-private-close"
            aria-label="닫기"
            onClick={onClearPrivate}
          >
            ×
          </button>
        </div>
      )}

      {/* 내 손패 — 실물 캐릭터 카드 (관전자는 손패 없음) */}
      {!isSpectator && (me?.alive ?? false) && hand.length > 0 ? (
        <div className="lv-hand-wrap">
          <p className="lv-hand-hint">
            {myTurn
              ? '내 차례 — 낼 카드를 선택하세요'
              : '내 손패 (내 차례에 한 장을 냅니다)'}
          </p>
          <div className="lv-hand">
            {hand.map((v, i) => (
              <LVCard
                key={`${v}-${i}`}
                value={v}
                selected={selected === i}
                disabled={myTurn && !canPlayValue(v)}
                onClick={myTurn ? () => handlePickCard(i) : undefined}
              />
            ))}
          </div>
        </div>
      ) : isSpectator ? (
        <p className="lv-spectator-note">👀 관전 중 — 공개 정보만 표시됩니다</p>
      ) : me && !me.alive ? (
        <p className="lv-spectator-note">
          💔 이번 라운드에서 탈락했습니다 — 다음 라운드를 기다리세요
        </p>
      ) : null}

      {/* 대상 없는 카드(4·7·8)·효과 없는 플레이 확인 바 */}
      {selectedValue !== null && !showTargetOverlay && (
        <div className="lv-confirm-bar">
          <span className="lv-confirm-text">
            {lvCardName(selectedValue)}
            {selectedValue === 8 && ' — ⚠️ 공주를 버리면 즉시 탈락합니다!'}
            {noTargetPlay && ' — 지목할 대상이 없어 효과 없이 냅니다'}
            {selectedValue === 4 && ' — 다음 내 턴까지 보호받습니다'}
            {selectedValue === 7 && ' — 카드를 내려놓습니다'}
          </span>
          <div className="lv-confirm-actions">
            <button
              type="button"
              className="lv-confirm-button"
              onClick={confirmPlay}
              disabled={submitted}
            >
              내기
            </button>
            <button
              type="button"
              className="lv-cancel-button"
              onClick={cancelSelection}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 대상 선택 오버레이 (경비병은 값 추측 포함) */}
      {showTargetOverlay && selectedValue !== null && (
        <div className="lv-overlay" onClick={cancelSelection}>
          <div className="lv-overlay-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="lv-overlay-title">
              {lvCardName(selectedValue)} — 대상 선택
            </h2>
            <p className="lv-overlay-sub">{LV_CARDS[selectedValue]?.effect}</p>
            <div className="lv-target-grid">
              {selectedTargets.map((p) => (
                <button
                  key={p.seat}
                  type="button"
                  className={`lv-target-tile ${targetSeat === p.seat ? 'selected' : ''}`}
                  onClick={() =>
                    setTargetSeat((prev) => (prev === p.seat ? null : p.seat))
                  }
                >
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                </button>
              ))}
            </div>

            {isGuard && (
              <>
                <p className="lv-overlay-sub">
                  손패 값을 추측하세요 (경비병 1은 제외)
                </p>
                <div className="lv-guess-grid">
                  {LV_GUARD_GUESSES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`lv-guess-tile ${guess === v ? 'selected' : ''}`}
                      onClick={() =>
                        setGuess((prev) => (prev === v ? null : v))
                      }
                    >
                      <span className="lv-guess-value">{v}</span>
                      <span className="lv-guess-name">{lvCardName(v)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="lv-overlay-actions">
              <button
                type="button"
                className="lv-confirm-button wide"
                onClick={confirmPlay}
                disabled={
                  submitted || targetSeat === null || (isGuard && guess === null)
                }
              >
                {targetSeat !== null
                  ? isGuard
                    ? guess !== null
                      ? `${nameOf(targetSeat)}님을 ${lvCardName(guess)}(${guess})로 추측`
                      : '추측할 값을 고르세요'
                    : `${nameOf(targetSeat)}님에게 사용`
                  : '대상을 고르세요'}
              </button>
              <button
                type="button"
                className="lv-cancel-button wide"
                onClick={cancelSelection}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
