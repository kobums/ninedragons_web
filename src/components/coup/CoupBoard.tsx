import { useEffect, useState } from 'react';
import type {
  CPActionKind,
  CPBlockRole,
  CPEvent,
  CPGameState,
  CPRole,
} from '../../types/coup';
import {
  CP_ACTIONS,
  CP_ACTION_ORDER,
  CP_FORCED_COUP_CHIPS,
  CP_ROLES,
  cpBlockRolesFor,
} from '../../types/coup';
import type { CPToast } from '../../hooks/useCoupGameState';
import './CoupBoard.css';

interface CoupBoardProps {
  game: CPGameState;
  toasts: CPToast[];
  onAction: (kind: CPActionKind, targetSeat?: number) => void;
  onAllow: () => void;
  onChallenge: () => void;
  onBlock: (role: CPBlockRole) => void;
  onLose: (index: number) => void;
  onExchangeKeep: (indices: number[]) => void;
}

const PHASE_LABEL: Record<string, string> = {
  action: '액션',
  challenge_window: '도전 창',
  block_window: '저지 창',
  block_challenge_window: '저지 도전 창',
  lose_card: '카드 제거',
  exchange_pick: '캐릭터 교환',
  game_over: '게임 종료',
};

// 이벤트 피드 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: CPEvent, game: CPGameState): string {
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

// 내 비공개 카드 — 실물 결: 세리프 역할명 + 한 줄 능력 + 역할 색 리본
function CPHandCard({
  role,
  selectable,
  selected,
  dimmed,
  onClick,
}: {
  role: CPRole;
  selectable?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const meta = CP_ROLES[role];
  const body = (
    <>
      <span className="cp-hand-ribbon" />
      <span className="cp-hand-en">{meta.en}</span>
      <span className="cp-hand-name">{meta.name}</span>
      <span className="cp-hand-ability">{meta.ability}</span>
    </>
  );
  const classes = [
    'cp-hand-card',
    `role-${role}`,
    selected ? 'selected' : '',
    dimmed ? 'dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (selectable) {
    return (
      <button
        type="button"
        className={`${classes} tappable`}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${meta.name} 카드`}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={classes} aria-label={`${meta.name} 카드 (비공개)`}>
      {body}
    </div>
  );
}

// 좌석 타일의 공개 카드 (잃어서 뒤집힌 카드)
function CPMiniCard({ role }: { role: CPRole }) {
  const meta = CP_ROLES[role];
  return (
    <span className={`cp-mini-card face role-${role}`} title={meta.name}>
      {meta.name}
    </span>
  );
}

export function CoupBoard({
  game,
  toasts,
  onAction,
  onAllow,
  onChallenge,
  onBlock,
  onLose,
  onExchangeKeep,
}: CoupBoardProps) {
  // 서버 회귀로 nil 슬라이스/필드가 와도 죽지 않게 방어한다
  const players = game.players ?? [];
  const pending = game.pending ?? null;
  const yourCards = game.yourCards ?? [];
  const yourExchange = game.yourExchange ?? [];

  // 관전자(yourSeat -1)는 좌석·컨트롤 없이 판만 본다
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const alive = me?.alive ?? false;

  const isAction = game.phase === 'action';
  const isChallengeWin = game.phase === 'challenge_window';
  const isBlockWin = game.phase === 'block_window';
  const isBlockChallengeWin = game.phase === 'block_challenge_window';
  const isWindow = isChallengeWin || isBlockWin || isBlockChallengeWin;
  const isLose = game.phase === 'lose_card';
  const isExchange = game.phase === 'exchange_pick';

  const myTurn =
    !isSpectator && isAction && game.currentSeat === game.yourSeat && alive;
  const myChips = me?.chips ?? 0;
  const mustCoup = mustCoupWith(myChips);

  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지. 서버가 거부(cp_error)해도
  // 잠깐 뒤 풀려 재시도할 수 있다 — 진짜 상태는 스냅샷이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 대상 선택 오버레이 — 대상 필요 액션을 누르면 열린다
  const [targetKind, setTargetKind] = useState<CPActionKind | null>(null);
  // 교환 유지 선택
  const [keepIdx, setKeepIdx] = useState<number[]>([]);

  // 단계·차례·펜딩이 바뀌면 로컬 선택 상태를 리셋한다
  useEffect(() => {
    setSubmitted(false);
    setTargetKind(null);
    setKeepIdx([]);
  }, [
    game.phase,
    game.currentSeat,
    game.loseSeat,
    pending?.kind,
    pending?.blockerSeat,
  ]);

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
  const remainSec = Math.ceil(remaining / 1000);

  const nameOf = (seat?: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  // ----- 창(도전/차단) 응답 자격 -----
  const actorSeat = pending?.actorSeat ?? -1;
  const targetSeat = pending?.targetSeat ?? -1;
  const blockerSeat = pending?.blockerSeat ?? -1;
  const pendingKind =
    pending?.kind && pending.kind in CP_ACTIONS
      ? (pending.kind as CPActionKind)
      : null;
  const pendingMeta = pendingKind ? CP_ACTIONS[pendingKind] : null;
  const blockRoleMeta =
    pending?.blockRole && pending.blockRole in CP_ROLES
      ? CP_ROLES[pending.blockRole as CPRole]
      : null;

  // 도전 창의 주장자 — 이 좌석은 응답하지 않고 기다린다
  const claimSeat = isChallengeWin
    ? actorSeat
    : isBlockChallengeWin
      ? blockerSeat
      : -1;
  const canChallenge =
    (isChallengeWin || isBlockChallengeWin) &&
    !isSpectator &&
    alive &&
    game.yourSeat !== claimSeat;
  // 차단 창: 액터를 제외한 생존자 전원이 허용으로 응답한다
  const inBlockWindowAsResponder =
    isBlockWin && !isSpectator && alive && game.yourSeat !== actorSeat;
  const myBlockRoles: CPBlockRole[] = inBlockWindowAsResponder
    ? cpBlockRolesFor(pending?.kind, game.yourSeat === targetSeat)
    : [];
  const canRespond = canChallenge || inBlockWindowAsResponder;

  const respond = (send: () => void) => {
    if (submitted) return;
    lockSubmit();
    send();
  };

  // ----- 액션 버튼 판정 -----
  const aliveOpponents = players.filter(
    (p) => p.alive && p.seat !== game.yourSeat,
  );
  const actionDisabledReason = (kind: CPActionKind): string | null => {
    const meta = CP_ACTIONS[kind];
    if (mustCoup && kind !== 'coup') return '쿠데타 강제';
    if (meta.cost > myChips) return `은화 ${meta.cost}개 필요`;
    if (meta.needsTarget && aliveOpponents.length === 0) return '대상 없음';
    return null;
  };

  const handleActionTap = (kind: CPActionKind) => {
    if (!myTurn || submitted || actionDisabledReason(kind)) return;
    if (CP_ACTIONS[kind].needsTarget) {
      setTargetKind(kind);
      return;
    }
    lockSubmit();
    onAction(kind);
  };

  const handleTargetTap = (seat: number) => {
    if (!targetKind || submitted) return;
    lockSubmit();
    onAction(targetKind, seat);
    setTargetKind(null);
  };

  // ----- 카드 제거 / 교환 선택 -----
  const mustLose =
    isLose && !isSpectator && game.loseSeat === game.yourSeat &&
    yourCards.length > 0;

  const inExchangePick = isExchange && !isSpectator && yourExchange.length > 0;
  // 유지할 장수 = 선택지 - 반납 2장 (손패 1장 상태의 교환도 안전하게)
  const keepCount = Math.max(1, yourExchange.length - 2);
  const toggleKeep = (idx: number) => {
    setKeepIdx((prev) =>
      prev.includes(idx)
        ? prev.filter((i) => i !== idx)
        : prev.length >= keepCount
          ? prev
          : [...prev, idx],
    );
  };

  // ----- 배너 보조 문구 -----
  const pendingLine = (() => {
    if (!pendingMeta) return '';
    const target = targetSeat >= 0 ? ` → ${nameOf(targetSeat)}` : '';
    return `${nameOf(actorSeat)}의 ${pendingMeta.label}${target}`;
  })();

  const bannerSub = (() => {
    if (pending?.message) return pending.message;
    if (isAction) {
      if (myTurn)
        return mustCoup
          ? `은화 ${CP_FORCED_COUP_CHIPS}개 이상 — 이번 차례는 쿠데타만 가능합니다`
          : '액션을 선택하세요';
      if (game.currentSeat >= 0)
        return `${nameOf(game.currentSeat)}님이 액션을 고르는 중…`;
      return '진행 중…';
    }
    if (isChallengeWin)
      return pendingLine
        ? `${pendingLine} — 도전하거나 허용하세요`
        : '역할 주장에 도전할 수 있습니다';
    if (isBlockWin)
      return pendingLine
        ? `${pendingLine} — 저지하거나 허용하세요`
        : '저지를 선언할 수 있습니다';
    if (isBlockChallengeWin)
      return `${nameOf(blockerSeat)}의 저지(${blockRoleMeta?.name ?? '?'}) — 도전하거나 허용하세요`;
    if (isLose)
      return game.loseSeat === game.yourSeat
        ? '잃을 카드를 선택하세요'
        : `${nameOf(game.loseSeat)}님이 잃을 카드를 고르는 중…`;
    if (isExchange)
      return inExchangePick
        ? `유지할 카드 ${keepCount}장을 선택하세요`
        : `${nameOf(actorSeat)}님이 캐릭터 교환 중…`;
    return '';
  })();

  const showBar = isWindow && !isSpectator && canRespond;
  const showPassiveBar = isWindow && !showBar;

  return (
    <div className={`cp-board ${showBar || showPassiveBar ? 'with-bar' : ''}`}>
      {/* 이벤트 피드 (최근 3줄) */}
      <div className="cp-feed">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="cp-feed-line">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="cp-phase-banner">
        <span className="cp-phase-title">
          🗡️ 쿠 · {PHASE_LABEL[game.phase] ?? game.phase}
          {game.endsAt > 0 && (
            <span
              className={`cp-deadline ${remaining < 6_000 ? 'urgent' : ''}`}
            >
              ⏱ {remainSec}초
            </span>
          )}
        </span>
        {bannerSub && <span className="cp-phase-sub">{bannerSub}</span>}
      </div>

      {/* 좌석 타일 그리드 — 공개 카드·카드 수·칩 */}
      <div className="cp-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isTurnSeat = p.seat === game.currentSeat && isAction;
          const revealed = p.revealed ?? [];
          const offline = !p.connected && !p.bot;
          const isActor = isWindow && p.seat === actorSeat;
          const isTarget =
            (isWindow || isLose) && targetSeat >= 0 && p.seat === targetSeat;
          const isBlocker =
            (isBlockWin || isBlockChallengeWin) &&
            blockerSeat >= 0 &&
            p.seat === blockerSeat;
          const isChoosing = isLose && p.seat === game.loseSeat;
          return (
            <div
              key={p.seat}
              className={[
                'cp-tile',
                isTurnSeat ? 'turn' : '',
                isMe ? 'me' : '',
                !p.alive ? 'dead' : '',
                isTarget ? 'target' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="cp-tile-head">
                <span className="cp-tile-name">
                  {isTurnSeat && <span className="cp-turn-mark">▶</span>}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="cp-tile-chips" title="보유 은화">
                  🪙 {p.chips}
                </span>
              </span>

              {/* 카드 줄 — 비공개는 뒷면 수, 잃은 카드는 공개로 */}
              <span className="cp-tile-cards">
                {Array.from({ length: Math.max(0, p.cardCount) }).map(
                  (_, i) => (
                    <span
                      key={`b${i}`}
                      className="cp-mini-card back"
                      title="비공개 카드"
                    >
                      ✦
                    </span>
                  ),
                )}
                {revealed.map((role, i) => (
                  <CPMiniCard key={`r${i}`} role={role} />
                ))}
              </span>

              <span className="cp-tile-badges">
                {isActor && <span className="cp-badge act">⚡ 액션</span>}
                {isTarget && <span className="cp-badge tgt">🎯 대상</span>}
                {isBlocker && <span className="cp-badge blk">🛡 저지</span>}
                {isChoosing && (
                  <span className="cp-badge lose">카드 선택 중…</span>
                )}
                {p.bot && <span className="cp-badge">🤖</span>}
                {offline && <span className="cp-badge off">끊김</span>}
              </span>

              {!p.alive && <span className="cp-tile-out">☠️ 탈락</span>}
            </div>
          );
        })}
      </div>

      {/* 내 비공개 카드 2장 */}
      {!isSpectator && (
        <div className="cp-hand">
          <span className="cp-hand-title">
            내 카드 · 🪙 {myChips} · 덱 {game.deckCount}장
          </span>
          {yourCards.length > 0 ? (
            <div className="cp-hand-row">
              {yourCards.map((role, i) => (
                <CPHandCard key={`${role}-${i}`} role={role} />
              ))}
            </div>
          ) : (
            <p className="cp-observer-note">
              {alive
                ? '카드 정보를 기다리는 중…'
                : '☠️ 카드를 모두 잃어 탈락했습니다 — 남은 음모를 지켜보세요'}
            </p>
          )}
        </div>
      )}

      {/* 액션 그리드 (7종) — 내 차례에만 */}
      {myTurn && (
        <div className="cp-actions">
          <span className="cp-actions-title">
            {mustCoup
              ? `💥 은화 ${CP_FORCED_COUP_CHIPS}개 이상 — 쿠데타 강제`
              : '내 차례 — 액션 선택'}
          </span>
          <div className="cp-actions-grid">
            {CP_ACTION_ORDER.map((kind) => {
              const meta = CP_ACTIONS[kind];
              const reason = actionDisabledReason(kind);
              const claim = meta.claim ? CP_ROLES[meta.claim] : null;
              return (
                <button
                  key={kind}
                  type="button"
                  className={`cp-action-button ${claim ? 'claim' : ''}`}
                  onClick={() => handleActionTap(kind)}
                  disabled={submitted || reason !== null}
                >
                  <span className="cp-action-label">
                    {meta.icon} {meta.label}
                    {meta.cost > 0 && (
                      <span className="cp-action-cost"> −은화 {meta.cost}</span>
                    )}
                  </span>
                  <span className="cp-action-sub">
                    {meta.effect}
                    {claim ? ` · ${claim.name} 주장` : ''}
                  </span>
                  <span className="cp-action-note">
                    {reason ?? meta.counter}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 관전·대기 안내 */}
      {isSpectator && (
        <p className="cp-observer-note">
          👁 관전 중 — 좌석이 없어 비공개 카드는 보이지 않습니다
        </p>
      )}

      {/* ----- 하단 고정 응답 바 (도전/차단/허용 + 카운트다운) ----- */}
      {showBar && (
        <div className="cp-response-bar">
          <span className="cp-bar-prompt">
            {isBlockChallengeWin
              ? `🛡 ${nameOf(blockerSeat)}의 저지(${blockRoleMeta?.name ?? '?'})`
              : pendingLine || '응답을 선택하세요'}
            {game.endsAt > 0 && (
              <span
                className={`cp-bar-timer ${remaining < 6_000 ? 'urgent' : ''}`}
              >
                ⏱ {remainSec}초
              </span>
            )}
          </span>
          <div className="cp-bar-buttons">
            {canChallenge && (
              <button
                type="button"
                className="cp-challenge-button"
                onClick={() => respond(onChallenge)}
                disabled={submitted}
              >
                ⚔ 도전
              </button>
            )}
            {myBlockRoles.map((role) => (
              <button
                key={role}
                type="button"
                className="cp-block-button"
                onClick={() => respond(() => onBlock(role))}
                disabled={submitted}
              >
                🛡 저지: {CP_ROLES[role].name}
              </button>
            ))}
            <button
              type="button"
              className="cp-allow-button"
              onClick={() => respond(onAllow)}
              disabled={submitted}
            >
              ✓ 허용
            </button>
          </div>
        </div>
      )}

      {/* 응답 자격이 없는 쪽(주장자·탈락자·관전자)의 대기 바 */}
      {showPassiveBar && (
        <div className="cp-response-bar passive">
          <span className="cp-bar-prompt">
            {pendingLine || '응답 대기 중'} — 다른 플레이어의 응답을 기다리는
            중…
            {game.endsAt > 0 && (
              <span
                className={`cp-bar-timer ${remaining < 6_000 ? 'urgent' : ''}`}
              >
                ⏱ {remainSec}초
              </span>
            )}
          </span>
        </div>
      )}

      {/* ----- 대상 선택 오버레이 ----- */}
      {targetKind && (
        <div className="cp-overlay" onClick={() => setTargetKind(null)}>
          <div className="cp-overlay-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="cp-overlay-title">
              {CP_ACTIONS[targetKind].icon} {CP_ACTIONS[targetKind].label} —
              대상 선택
            </h2>
            <p className="cp-overlay-sub">{CP_ACTIONS[targetKind].effect}</p>
            <div className="cp-target-list">
              {aliveOpponents.map((p) => (
                <button
                  key={p.seat}
                  type="button"
                  className="cp-target-button"
                  onClick={() => handleTargetTap(p.seat)}
                  disabled={submitted}
                >
                  <span className="cp-target-name">{p.name}</span>
                  <span className="cp-target-info">
                    🂠 {p.cardCount}장 · 🪙 {p.chips}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="cp-overlay-cancel"
              onClick={() => setTargetKind(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ----- 카드 제거 선택 오버레이 (내 2장 중 탭) ----- */}
      {mustLose && (
        <div className="cp-overlay">
          <div className="cp-overlay-panel">
            <h2 className="cp-overlay-title">💔 잃을 카드 선택</h2>
            <p className="cp-overlay-sub">
              선택한 카드는 공개로 뒤집힙니다
              {game.endsAt > 0 && ` · ⏱ ${remainSec}초 (미선택 시 무작위)`}
            </p>
            <div className="cp-overlay-cards">
              {yourCards.map((role, i) => (
                <CPHandCard
                  key={`${role}-${i}`}
                  role={role}
                  selectable
                  onClick={() => {
                    if (submitted) return;
                    lockSubmit();
                    onLose(i);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----- 교환 선택 오버레이 (유지할 카드 선택) ----- */}
      {inExchangePick && (
        <div className="cp-overlay">
          <div className="cp-overlay-panel">
            <h2 className="cp-overlay-title">🔄 캐릭터 교환 — 유지할 카드 선택</h2>
            <p className="cp-overlay-sub">
              {yourExchange.length}장 중 {keepCount}장을 남기고 나머지는 덱으로
              반납합니다
              {game.endsAt > 0 && ` · ⏱ ${remainSec}초`}
            </p>
            <div className="cp-overlay-cards wrap">
              {yourExchange.map((role, i) => (
                <CPHandCard
                  key={`${role}-${i}`}
                  role={role}
                  selectable
                  selected={keepIdx.includes(i)}
                  dimmed={!keepIdx.includes(i) && keepIdx.length >= keepCount}
                  onClick={() => toggleKeep(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="cp-overlay-confirm"
              onClick={() => {
                if (submitted || keepIdx.length !== keepCount) return;
                lockSubmit();
                onExchangeKeep([...keepIdx].sort((a, b) => a - b));
              }}
              disabled={submitted || keepIdx.length !== keepCount}
            >
              {keepIdx.length}/{keepCount}장 선택 — 확정
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 원작 강제 룰: 칩 10개 이상이면 차례에 쿠만 가능
function mustCoupWith(chips: number): boolean {
  return chips >= CP_FORCED_COUP_CHIPS;
}
