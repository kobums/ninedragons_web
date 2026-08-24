import { useEffect, useState } from 'react';
import type { EKCard, EKEvent, EKGameState } from '../../types/kittens';
import {
  ekCardMeta,
  ekEffectAlive,
  ekIsCard,
  ekIsCat,
  ekNeedsTarget,
  ekPlaceLabel,
  ekSoloBlockReason,
} from '../../types/kittens';
import type { EKToast } from '../../hooks/useKittensGameState';
import './KittensBoard.css';

interface KittensBoardProps {
  game: EKGameState;
  toasts: EKToast[];
  // 나에게만 온 미래 예측 결과 (덱 맨 위부터 3장). 없으면 null.
  futureCards: EKCard[] | null;
  onPlay: (index: number, targetSeat?: number) => void;
  onPlayPair: (indexes: number[], targetSeat: number) => void;
  onDraw: () => void;
  onNope: () => void;
  onPass: () => void;
  onGive: (index: number) => void;
  onDefusePlace: (position: number) => void;
}

const PHASE_LABEL: Record<string, string> = {
  turn: '차례',
  nope_window: '아뇨 창',
  favor_wait: '호의 대기',
  defuse_place: '폭탄 되꽂기',
  game_over: '게임 종료',
};

// 이벤트 피드 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: EKEvent, game: EKGameState): string {
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
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'exploded':
      return `💥 ${name(event.seat)}님이 폭탄에 탈락했습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 카드 한 장 — 외부 에셋 없이 이모지 + 색 블록 + 한글 이름으로 그린다.
// 색만으로는 구분되지 않으므로 이름은 항상 함께 보인다.
function EKCardFace({
  kind,
  size = 'md',
  selected,
  dimmed,
  onClick,
  disabled,
  corner,
}: {
  kind: string;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  // 카드 좌상단 배지 (미래 예측 순번 등)
  corner?: string;
}) {
  const meta = ekCardMeta(kind);
  const classes = [
    'ek-card',
    `size-${size}`,
    `kind-${ekIsCard(kind) ? kind : 'unknown'}`,
    selected ? 'selected' : '',
    dimmed ? 'dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      {corner && <span className="ek-card-corner">{corner}</span>}
      <span className="ek-card-emoji" aria-hidden="true">
        {meta.emoji}
      </span>
      <span className="ek-card-name">{meta.short}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`${classes} tappable`}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`${meta.name} 카드`}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={classes} aria-label={`${meta.name} 카드`}>
      {body}
    </div>
  );
}

export function KittensBoard({
  game,
  toasts,
  futureCards,
  onPlay,
  onPlayPair,
  onDraw,
  onNope,
  onPass,
  onGive,
  onDefusePlace,
}: KittensBoardProps) {
  // 서버 회귀로 nil 슬라이스/필드가 와도 죽지 않게 방어한다
  const players = game.players ?? [];
  const hand = game.yourHand ?? [];
  const pending = game.pending ?? null;

  // 관전자(yourSeat -1)와 탈락자는 손패·행동 UI 없이 판만 본다
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const alive = me?.alive ?? false;
  const canAct = !isSpectator && alive;

  const isTurn = game.phase === 'turn';
  const isNopeWindow = game.phase === 'nope_window';
  const isFavorWait = game.phase === 'favor_wait';
  const isDefusePlace = game.phase === 'defuse_place';

  const myTurn = canAct && isTurn && game.currentSeat === game.yourSeat;

  // ----- 로컬 선택·연타 잠금 -----
  const [selected, setSelected] = useState<number[]>([]);
  const [targetMode, setTargetMode] = useState<'favor' | 'pair' | null>(null);
  const [giveIdx, setGiveIdx] = useState<number | null>(null);
  const [placePos, setPlacePos] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const lockSubmit = () => {
    setSubmitted(true);
    // 서버가 거부(ek_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
    // 진짜 상태는 다음 스냅샷이 결정한다
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 스냅샷 컨텍스트(단계·차례·펜딩)가 바뀌면 로컬 선택과 잠금을 리셋한다
  useEffect(() => {
    setSelected([]);
    setTargetMode(null);
    setGiveIdx(null);
    setPlacePos(0);
    setSubmitted(false);
  }, [
    game.phase,
    game.currentSeat,
    game.turnsLeft,
    pending?.kind,
    pending?.bySeat,
    pending?.nopeCount,
  ]);

  // ----- 단계 마감 카운트다운 (서버 endsAt 기준, 탭 복귀 시 재동기화) -----
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
  const remainSec = Math.ceil(remaining / 1000);
  const urgent = game.endsAt > 0 && remaining < 6000;

  const nameOf = (seat?: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  // ----- 아뇨 창 -----
  const pendingKind = pending?.kind ?? '';
  const pendingMeta = ekCardMeta(pendingKind);
  const nopeCount = pending?.nopeCount ?? 0;
  const effectAlive = ekEffectAlive(nopeCount);
  const hasNope = hand.some((c) => c.kind === 'nope');
  // 마지막으로 낸 사람은 자기 카드에 응답하지 않고 기다린다
  const isPendingOwner = pending !== null && game.yourSeat === pending.bySeat;
  const canRespond = isNopeWindow && canAct && !isPendingOwner;

  // ----- 호의 / 되꽂기 -----
  const iAmGiver =
    isFavorWait && canAct && pending !== null && pending.targetSeat === game.yourSeat;
  const iAmPlacer = isDefusePlace && canAct && game.currentSeat === game.yourSeat;

  // ----- 손패 선택 -----
  const kindAt = (i: number) => hand[i]?.kind ?? '';
  const toggleCard = (i: number) => {
    if (!myTurn || submitted) return;
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      const kind = kindAt(i);
      // 같은 종류 고양이 2장만 묶음 선택 (훔치기)
      if (prev.length === 1 && ekIsCat(kind) && kindAt(prev[0]) === kind) {
        return [prev[0], i].sort((a, b) => a - b);
      }
      return [i];
    });
  };

  const isPairSelection = selected.length === 2;
  const soloKind = selected.length === 1 ? kindAt(selected[0]) : '';
  const soloReason = soloKind ? ekSoloBlockReason(soloKind) : null;
  const playBlocked =
    selected.length === 0 || (!isPairSelection && soloReason !== null);

  const playLabel = (() => {
    if (selected.length === 0) return '낼 카드를 고르세요';
    if (isPairSelection) {
      const meta = ekCardMeta(kindAt(selected[0]));
      return `${meta.emoji} ${meta.short} 2장 — 카드 훔치기`;
    }
    const meta = ekCardMeta(soloKind);
    return `${meta.emoji} ${meta.short} 내기`;
  })();

  const handlePlayTap = () => {
    if (!myTurn || submitted || playBlocked) return;
    if (isPairSelection) {
      setTargetMode('pair');
      return;
    }
    if (ekNeedsTarget(soloKind)) {
      setTargetMode('favor');
      return;
    }
    lockSubmit();
    onPlay(selected[0]);
  };

  const handleTargetTap = (seat: number) => {
    if (submitted || !targetMode) return;
    lockSubmit();
    if (targetMode === 'pair') {
      onPlayPair([...selected].sort((a, b) => a - b), seat);
    } else {
      onPlay(selected[0], seat);
    }
    setTargetMode(null);
    setSelected([]);
  };

  const handleDraw = () => {
    if (!myTurn || submitted) return;
    lockSubmit();
    onDraw();
  };

  const respond = (send: () => void) => {
    if (submitted) return;
    lockSubmit();
    send();
  };

  // 대상 후보 — 훔치기는 손패가 있는 상대만 고를 수 있다
  const targetCandidates = players.filter(
    (p) =>
      p.alive &&
      p.seat !== game.yourSeat &&
      (targetMode === 'pair' ? p.handCount > 0 : true),
  );

  // ----- 상단 안내 문구 -----
  const pendingLine = pending
    ? `${nameOf(pending.bySeat)}님의 ${pendingMeta.name}` +
      (pending.targetSeat >= 0 ? ` → ${nameOf(pending.targetSeat)}님` : '')
    : '';

  const bannerSub = (() => {
    if (isTurn) {
      if (myTurn) return '카드를 내거나, 덱에서 1장 뽑아 차례를 끝내세요';
      return `${nameOf(game.currentSeat)}님의 차례입니다`;
    }
    if (isNopeWindow) return pendingLine || '아뇨 응답을 기다리는 중…';
    if (isFavorWait) {
      return iAmGiver
        ? '🙏 줄 카드 1장을 고르세요'
        : `${nameOf(pending?.targetSeat)}님이 줄 카드를 고르는 중…`;
    }
    if (isDefusePlace) {
      return iAmPlacer
        ? '🛡 폭탄을 덱 어디에 되꽂을지 고르세요'
        : `${nameOf(game.currentSeat)}님이 폭탄을 몰래 되꽂는 중…`;
    }
    return '';
  })();

  const showNopeBar = isNopeWindow;
  const maxPlace = Math.max(0, game.deckLeft);

  return (
    <div className={`ek-board ${showNopeBar ? 'with-bar' : ''}`}>
      {/* 이벤트 피드 (최근 3줄) */}
      <div className="ek-feed">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="ek-feed-line">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* ---------- 상단 배너 ---------- */}
      <div className="ek-phase-banner">
        <span className="ek-phase-title">
          💣 익스플로딩 키튼 · {PHASE_LABEL[game.phase] ?? game.phase}
          {game.endsAt > 0 && (
            <span className={`ek-deadline ${urgent ? 'urgent' : ''}`}>
              ⏱ {remainSec}초
            </span>
          )}
        </span>
        {bannerSub && <span className="ek-phase-sub">{bannerSub}</span>}
        {game.lastAction?.message && (
          <span className="ek-last-action">{game.lastAction.message}</span>
        )}
      </div>

      {/* ---------- 상태 칩: 차례 · 남은 차례 수 · 덱 잔량 ---------- */}
      <div className="ek-stat-row">
        <span className="ek-stat">
          <span className="ek-stat-key">차례</span>
          <span className="ek-stat-value">
            {game.currentSeat >= 0 ? nameOf(game.currentSeat) : '—'}
            {game.currentSeat === game.yourSeat && ' (나)'}
          </span>
        </span>
        <span className={`ek-stat ${game.turnsLeft > 1 ? 'hot' : ''}`}>
          <span className="ek-stat-key">남은 차례</span>
          <span className="ek-stat-value">
            {Math.max(0, game.turnsLeft)}회
            {game.turnsLeft > 1 && ' ⚔️'}
          </span>
        </span>
        <span className="ek-stat">
          <span className="ek-stat-key">덱</span>
          <span className="ek-stat-value">{Math.max(0, game.deckLeft)}장</span>
        </span>
      </div>

      {/* ---------- 좌석 스트립 ---------- */}
      <div className="ek-seat-strip">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isTurnSeat = p.seat === game.currentSeat && p.alive;
          const offline = !p.connected && !p.bot;
          const isActor = isNopeWindow && pending?.bySeat === p.seat;
          const isTarget =
            pending !== null &&
            pending.targetSeat >= 0 &&
            pending.targetSeat === p.seat;
          return (
            <div
              key={p.seat}
              className={[
                'ek-seat',
                isTurnSeat ? 'turn' : '',
                isMe ? 'me' : '',
                !p.alive ? 'dead' : '',
                isTarget ? 'target' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="ek-seat-name">
                {isTurnSeat && <span className="ek-turn-mark">▶</span>}
                {!p.alive && '💀 '}
                {p.name}
                {isMe && ' (나)'}
              </span>
              <span className="ek-seat-meta">
                <span className="ek-seat-hand" title="손패 수">
                  🃏 {p.handCount}
                </span>
                {p.bot && <span className="ek-seat-badge">🤖</span>}
                {offline && <span className="ek-seat-badge off">끊김</span>}
                {isActor && <span className="ek-seat-badge act">낸 사람</span>}
                {isTarget && <span className="ek-seat-badge tgt">🎯 대상</span>}
              </span>
              {!p.alive && <span className="ek-seat-out">탈락</span>}
            </div>
          );
        })}
      </div>

      {/* ---------- 중앙 더미: 덱 + 버린 더미 ---------- */}
      <div className="ek-piles">
        <div className="ek-pile">
          <span className="ek-pile-title">덱</span>
          <button
            type="button"
            className={`ek-deck ${myTurn ? 'live' : ''}`}
            onClick={handleDraw}
            disabled={!myTurn || submitted}
            aria-label="덱에서 카드 뽑기"
          >
            <span className="ek-deck-back" aria-hidden="true">
              🐱
            </span>
            <span className="ek-deck-count">{Math.max(0, game.deckLeft)}장</span>
          </button>
          <span className="ek-pile-note">
            {myTurn ? '탭하면 뽑기 (차례 종료)' : '남은 카드'}
          </span>
        </div>

        <div className="ek-pile">
          <span className="ek-pile-title">버린 더미</span>
          {game.discardTop ? (
            <EKCardFace kind={game.discardTop} size="md" />
          ) : (
            <div className="ek-discard-empty">비어 있음</div>
          )}
          <span className="ek-pile-note">맨 위 카드</span>
        </div>
      </div>

      {/* ---------- 미래 예측 결과 (나만 보임) ---------- */}
      {futureCards && futureCards.length > 0 && !isSpectator && (
        <div className="ek-future">
          <span className="ek-future-title">
            🔮 미래 예측 — 덱 맨 위 {futureCards.length}장 (나만 보입니다)
          </span>
          <div className="ek-future-row">
            {futureCards.map((card, i) => (
              <EKCardFace
                key={`${card}-${i}`}
                kind={card}
                size="sm"
                corner={i === 0 ? '맨 위' : `${i + 1}번째`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---------- 내 손패 ---------- */}
      {canAct ? (
        <div className="ek-hand">
          <span className="ek-hand-title">
            내 손패 {hand.length}장
            {myTurn && (
              <span className="ek-hand-hint">
                {' '}
                · 탭해서 선택 · 같은 고양이 2장은 묶어서 훔치기
              </span>
            )}
          </span>
          {hand.length > 0 ? (
            <div className="ek-hand-row">
              {hand.map((card, i) => (
                <EKCardFace
                  key={`${card.kind}-${i}`}
                  kind={card.kind}
                  selected={selected.includes(i)}
                  dimmed={!myTurn}
                  onClick={myTurn ? () => toggleCard(i) : undefined}
                  disabled={submitted}
                />
              ))}
            </div>
          ) : (
            <p className="ek-note">손패가 비었습니다</p>
          )}

          {myTurn && (
            <div className="ek-turn-actions">
              <button
                type="button"
                className="ek-play-button"
                onClick={handlePlayTap}
                disabled={submitted || playBlocked}
              >
                {playLabel}
              </button>
              <button
                type="button"
                className="ek-draw-button"
                onClick={handleDraw}
                disabled={submitted}
              >
                🎴 뽑고 차례 끝내기
              </button>
              {selected.length === 1 && soloReason && (
                <p className="ek-note warn">{soloReason}</p>
              )}
              {selected.length === 1 && !soloReason && (
                <p className="ek-note">{ekCardMeta(soloKind).effect}</p>
              )}
              {isPairSelection && (
                <p className="ek-note">
                  대상 손패에서 무작위 1장을 가져옵니다
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="ek-note big">
          {isSpectator
            ? '👁 관전 중 — 좌석이 없어 손패는 보이지 않습니다'
            : '💀 탈락했습니다 — 남은 대결을 지켜보세요'}
        </p>
      )}

      {/* ---------- 아뇨 창 (이 게임의 긴장) ---------- */}
      {showNopeBar && (
        <div className={`ek-nope-bar ${canRespond ? '' : 'passive'}`}>
          <div className="ek-nope-head">
            <EKCardFace kind={pendingKind} size="lg" />
            <div className="ek-nope-text">
              <span className="ek-nope-who">
                {pending ? `${nameOf(pending.bySeat)}님이 냈습니다` : '판정 대기'}
              </span>
              <span className="ek-nope-what">
                {pendingMeta.emoji} {pendingMeta.name}
                {pending && pending.targetSeat >= 0 && (
                  <span className="ek-nope-target">
                    {' '}
                    → {nameOf(pending.targetSeat)}님
                  </span>
                )}
              </span>
              <span className="ek-nope-stack">
                <span className="ek-nope-count">🚫 아뇨 {nopeCount}장 겹침</span>
                <span
                  className={`ek-nope-verdict ${effectAlive ? 'alive' : 'dead'}`}
                >
                  {effectAlive ? '지금은 효과 유효' : '지금은 효과 무효'}
                </span>
                {game.endsAt > 0 && (
                  <span className={`ek-nope-timer ${urgent ? 'urgent' : ''}`}>
                    ⏱ {remainSec}초
                  </span>
                )}
              </span>
            </div>
          </div>

          {canRespond ? (
            <div className="ek-nope-buttons">
              <button
                type="button"
                className="ek-nope-button"
                onClick={() => respond(onNope)}
                disabled={submitted || !hasNope}
              >
                🚫 아뇨
              </button>
              <button
                type="button"
                className="ek-pass-button"
                onClick={() => respond(onPass)}
                disabled={submitted}
              >
                통과
              </button>
            </div>
          ) : (
            <p className="ek-nope-wait">
              {isPendingOwner
                ? '내가 낸 카드입니다 — 다른 사람의 응답을 기다리는 중…'
                : '다른 플레이어의 응답을 기다리는 중…'}
            </p>
          )}
          {canRespond && !hasNope && (
            <p className="ek-nope-wait">
              손패에 🚫 아뇨 카드가 없습니다 — 통과만 할 수 있습니다
            </p>
          )}
        </div>
      )}

      {/* ---------- 대상 선택 오버레이 (호의 · 훔치기) ---------- */}
      {targetMode && (
        <div className="ek-overlay" onClick={() => setTargetMode(null)}>
          <div className="ek-overlay-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="ek-overlay-title">
              {targetMode === 'pair' ? '🐱 훔칠 상대 선택' : '🙏 호의할 상대 선택'}
            </h2>
            <p className="ek-overlay-sub">
              {targetMode === 'pair'
                ? '상대 손패에서 무작위 1장을 가져옵니다'
                : '상대가 직접 고른 카드 1장을 받습니다'}
            </p>
            <div className="ek-target-list">
              {targetCandidates.length > 0 ? (
                targetCandidates.map((p) => (
                  <button
                    key={p.seat}
                    type="button"
                    className="ek-target-button"
                    onClick={() => handleTargetTap(p.seat)}
                    disabled={submitted}
                  >
                    <span className="ek-target-name">
                      {p.name}
                      {p.bot && ' 🤖'}
                    </span>
                    <span className="ek-target-info">🃏 {p.handCount}장</span>
                  </button>
                ))
              ) : (
                <p className="ek-note">고를 수 있는 상대가 없습니다</p>
              )}
            </div>
            <button
              type="button"
              className="ek-ghost-button"
              onClick={() => setTargetMode(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ---------- 호의 — 줄 카드 선택 ---------- */}
      {iAmGiver && hand.length > 0 && (
        <div className="ek-overlay">
          <div className="ek-overlay-panel">
            <h2 className="ek-overlay-title">🙏 줄 카드 선택</h2>
            <p className="ek-overlay-sub">
              {nameOf(pending?.bySeat)}님에게 카드 1장을 줍니다
              {game.endsAt > 0 && ` · ⏱ ${remainSec}초 (미선택 시 무작위)`}
            </p>
            <div className="ek-overlay-cards">
              {hand.map((card, i) => (
                <EKCardFace
                  key={`give-${card.kind}-${i}`}
                  kind={card.kind}
                  size="sm"
                  selected={giveIdx === i}
                  onClick={() => setGiveIdx(i)}
                  disabled={submitted}
                />
              ))}
            </div>
            <button
              type="button"
              className="ek-primary-button"
              onClick={() => {
                if (submitted || giveIdx === null) return;
                lockSubmit();
                onGive(giveIdx);
              }}
              disabled={submitted || giveIdx === null}
            >
              {giveIdx === null
                ? '줄 카드를 고르세요'
                : `${ekCardMeta(kindAt(giveIdx)).short} 주기`}
            </button>
          </div>
        </div>
      )}

      {/* ---------- 해체 — 폭탄 되꽂기 위치 선택 ---------- */}
      {iAmPlacer && (
        <div className="ek-overlay">
          <div className="ek-overlay-panel">
            <h2 className="ek-overlay-title">🛡 폭탄 되꽂기</h2>
            <p className="ek-overlay-sub">
              해체로 폭탄을 막았습니다. 덱 어디에 몰래 되꽂을지 고르세요 —
              아무도 위치를 모릅니다
              {game.endsAt > 0 && ` · ⏱ ${remainSec}초 (미선택 시 무작위)`}
            </p>

            <div className="ek-place-readout">
              <span className="ek-place-emoji" aria-hidden="true">
                💣
              </span>
              <span className="ek-place-label">
                {ekPlaceLabel(placePos, maxPlace)}
              </span>
              <span className="ek-place-sub">
                덱 {maxPlace}장 중 {placePos}장 아래
              </span>
            </div>

            <input
              type="range"
              className="ek-place-slider"
              min={0}
              max={maxPlace}
              step={1}
              value={Math.min(placePos, maxPlace)}
              onChange={(e) => setPlacePos(Number(e.target.value))}
              aria-label="폭탄을 되꽂을 위치"
            />

            <div className="ek-place-quick">
              <button
                type="button"
                className="ek-quick-button"
                onClick={() => setPlacePos(0)}
              >
                맨 위
              </button>
              <button
                type="button"
                className="ek-quick-button"
                onClick={() => setPlacePos(Math.floor(maxPlace / 2))}
              >
                가운데
              </button>
              <button
                type="button"
                className="ek-quick-button"
                onClick={() => setPlacePos(maxPlace)}
              >
                맨 아래
              </button>
            </div>

            <button
              type="button"
              className="ek-primary-button"
              onClick={() => {
                if (submitted) return;
                lockSubmit();
                onDefusePlace(Math.min(placePos, maxPlace));
              }}
              disabled={submitted}
            >
              {ekPlaceLabel(placePos, maxPlace)}에 되꽂기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
