import { useEffect, useState } from 'react';
import type {
  RFActionKind,
  RFBlockRole,
  RFEvent,
  RFFaction,
  RFGameState,
  RFMenuKind,
  RFPlayerView,
  RFRole,
} from '../../types/reformation';
import {
  RF_ACTIONS,
  RF_ACTION_ORDER,
  RF_FACTIONS,
  RF_FORCED_COUP_COINS,
  RF_ROLES,
  RF_SAME_FACTION_REASON,
  rfBlockRolesFor,
  rfFactionMeta,
  rfIsAttack,
  rfRoleName,
  rfTreasuryLevel,
} from '../../types/reformation';
import type { RFToast } from '../../hooks/useReformationGameState';
import './ReformationBoard.css';

interface ReformationBoardProps {
  game: RFGameState;
  toasts: RFToast[];
  // 기본 쿠 액션 7종 (rf_action)
  onAction: (kind: RFActionKind, targetSeat?: number) => void;
  // 확장 액션 — 전용 메시지
  onConvert: () => void;
  onConvertOther: (targetSeat: number) => void;
  onEmbezzle: () => void;
  // 응답 창
  onPass: () => void;
  onChallenge: () => void;
  onBlock: (role: RFBlockRole) => void;
  onLoseCard: (index: number) => void;
  onExchange: (keep: number[]) => void;
}

const PHASE_LABEL: Record<string, string> = {
  action: '액션',
  challenge_window: '도전 창',
  block_window: '저지 창',
  lose_card: '카드 제거',
  exchange: '캐릭터 교환',
  game_over: '게임 종료',
};

// 이벤트 피드 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: RFEvent, game: RFGameState): string {
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
      return '게임이 시작되었습니다 — 진영이 배정됐습니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 진영 배지 — 색 + 아이콘 + 이름 3중 표기 (색만으로 구분되지 않게)
function RFFactionBadge({
  faction,
  compact,
}: {
  faction?: string;
  compact?: boolean;
}) {
  const meta = rfFactionMeta(faction);
  if (!meta) {
    return <span className="rf-faction unknown">· 진영 미정</span>;
  }
  return (
    <span
      className={`rf-faction ${faction}`}
      title={`${meta.name} 진영`}
      aria-label={`${meta.name} 진영`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {compact ? meta.short : meta.name}
    </span>
  );
}

// 내 비공개 카드 — 실물 결: 세리프 역할명 + 한 줄 능력 + 역할 색 리본
function RFHandCard({
  role,
  selectable,
  selected,
  dimmed,
  onClick,
}: {
  role: RFRole;
  selectable?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const meta = RF_ROLES[role];
  const body = (
    <>
      <span className="rf-hand-ribbon" />
      <span className="rf-hand-en">{meta.en}</span>
      <span className="rf-hand-name">{meta.name}</span>
      <span className="rf-hand-ability">{meta.ability}</span>
    </>
  );
  const classes = [
    'rf-hand-card',
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
function RFMiniCard({ role }: { role: RFRole }) {
  const meta = RF_ROLES[role];
  return (
    <span className={`rf-mini-card face role-${role}`} title={meta.name}>
      {meta.name}
    </span>
  );
}

export function ReformationBoard({
  game,
  toasts,
  onAction,
  onConvert,
  onConvertOther,
  onEmbezzle,
  onPass,
  onChallenge,
  onBlock,
  onLoseCard,
  onExchange,
}: ReformationBoardProps) {
  // 서버 회귀로 nil 슬라이스/필드가 와도 죽지 않게 방어한다
  const players = game.players ?? [];
  const pending = game.pending ?? null;
  const yourRoles = game.yourRoles ?? [];
  const yourExchange = game.yourExchange ?? [];
  const treasury = game.treasury ?? 0;
  const treasuryLevel = rfTreasuryLevel(treasury);

  // 관전자(yourSeat -1)는 좌석·컨트롤 없이 판만 본다
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const alive = me?.alive ?? false;
  const myFaction: RFFaction | undefined = me?.faction;

  const isAction = game.phase === 'action';
  const isChallengeWin = game.phase === 'challenge_window';
  const isBlockWin = game.phase === 'block_window';
  const isWindow = isChallengeWin || isBlockWin;
  const isLose = game.phase === 'lose_card';
  const isExchange = game.phase === 'exchange';

  const myTurn =
    !isSpectator && isAction && game.currentSeat === game.yourSeat && alive;
  const myCoins = me?.coins ?? 0;
  const mustCoup = myCoins >= RF_FORCED_COUP_COINS;

  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지. 서버가 거부(rf_error)해도
  // 잠깐 뒤 풀려 재시도할 수 있다 — 진짜 상태는 스냅샷이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 대상 선택 오버레이 — 대상 필요 액션을 누르면 열린다
  const [targetKind, setTargetKind] = useState<RFMenuKind | null>(null);
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
    pending?.bySeat,
    pending?.targetSeat,
    pending?.blockRole,
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
  const actorSeat = pending?.bySeat ?? -1;
  const targetSeat = pending?.targetSeat ?? -1;
  // 계약상 blockerSeat 는 없을 수 있다 — 차단이 걸린 창에서는 bySeat 로 유도
  const blockerSeat =
    pending?.blockerSeat ?? (pending?.blockRole ? actorSeat : -1);
  const passed = pending?.passed ?? [];
  const pendingKind =
    pending?.kind && pending.kind in RF_ACTIONS
      ? (pending.kind as RFMenuKind)
      : null;
  const pendingMeta = pendingKind ? RF_ACTIONS[pendingKind] : null;
  // 차단 역할이 붙은 도전 창 = "차단에 대한 도전"
  const isBlockClaim = isChallengeWin && !!pending?.blockRole;

  // 도전 창의 주장자 — 이 좌석은 응답하지 않고 기다린다
  const claimSeat = isBlockClaim ? blockerSeat : actorSeat;
  const canChallenge =
    isChallengeWin && !isSpectator && alive && game.yourSeat !== claimSeat;
  // 차단 창: 액터를 제외한 생존자 전원이 허용으로 응답한다
  const inBlockWindowAsResponder =
    isBlockWin && !isSpectator && alive && game.yourSeat !== actorSeat;
  const myBlockRoles: RFBlockRole[] = inBlockWindowAsResponder
    ? rfBlockRolesFor(pending?.kind, game.yourSeat === targetSeat)
    : [];
  const canRespond = canChallenge || inBlockWindowAsResponder;

  const respond = (send: () => void) => {
    if (submitted) return;
    lockSubmit();
    send();
  };

  // ----- 진영 판정 -----
  const aliveOpponents = players.filter(
    (p) => p.alive && p.seat !== game.yourSeat,
  );
  // 같은 진영은 강탈·암살·쿠 대상이 될 수 없다 (리포메이션 핵심 제약)
  const isAlly = (p: RFPlayerView) =>
    myFaction !== undefined && p.faction === myFaction;
  const attackTargets = aliveOpponents.filter((p) => !isAlly(p));
  const allyNames = aliveOpponents.filter(isAlly).map((p) => p.name);
  const factionCount = (faction: RFFaction) =>
    players.filter((p) => p.alive && p.faction === faction).length;

  // ----- 액션 버튼 판정 -----
  const actionDisabledReason = (kind: RFMenuKind): string | null => {
    const meta = RF_ACTIONS[kind];
    if (mustCoup && kind !== 'coup') return '쿠데타 강제';
    if (meta.cost > myCoins) return `은화 ${meta.cost}개 필요`;
    if (meta.needsTarget && aliveOpponents.length === 0) return '대상 없음';
    if (meta.attack && attackTargets.length === 0) {
      return RF_SAME_FACTION_REASON;
    }
    return null;
  };

  const handleActionTap = (kind: RFMenuKind) => {
    if (!myTurn || submitted || actionDisabledReason(kind)) return;
    if (RF_ACTIONS[kind].needsTarget) {
      setTargetKind(kind);
      return;
    }
    lockSubmit();
    if (kind === 'convert') {
      onConvert();
      return;
    }
    if (kind === 'embezzle') {
      onEmbezzle();
      return;
    }
    onAction(kind as RFActionKind);
  };

  const handleTargetTap = (seat: number) => {
    if (!targetKind || submitted) return;
    lockSubmit();
    if (targetKind === 'convert_other') {
      onConvertOther(seat);
    } else {
      onAction(targetKind as RFActionKind, seat);
    }
    setTargetKind(null);
  };

  // ----- 카드 제거 / 교환 선택 -----
  // 계약에 loseSeat 가 없으면 pending.targetSeat 가 잃을 좌석이다
  const loseSeat = game.loseSeat ?? targetSeat;
  const mustLose =
    isLose && !isSpectator && loseSeat === game.yourSeat && yourRoles.length > 0;

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
          ? `은화 ${RF_FORCED_COUP_COINS}개 이상 — 이번 차례는 쿠데타만 가능합니다`
          : '액션을 선택하세요';
      if (game.currentSeat >= 0)
        return `${nameOf(game.currentSeat)}님이 액션을 고르는 중…`;
      return '진행 중…';
    }
    if (isChallengeWin)
      return isBlockClaim
        ? `${nameOf(blockerSeat)}의 저지(${rfRoleName(pending?.blockRole)}) — 도전하거나 허용하세요`
        : pendingLine
          ? `${pendingLine} — 도전하거나 허용하세요`
          : '역할 주장에 도전할 수 있습니다';
    if (isBlockWin)
      return pendingLine
        ? `${pendingLine} — 저지하거나 허용하세요`
        : '저지를 선언할 수 있습니다';
    if (isLose)
      return loseSeat === game.yourSeat
        ? '잃을 카드를 선택하세요'
        : `${nameOf(loseSeat)}님이 잃을 카드를 고르는 중…`;
    if (isExchange)
      return inExchangePick
        ? `유지할 카드 ${keepCount}장을 선택하세요`
        : `${nameOf(actorSeat)}님이 캐릭터 교환 중…`;
    return '';
  })();

  const showBar = isWindow && !isSpectator && canRespond;
  const showPassiveBar = isWindow && !showBar;
  // 공격 대상 선택 중이면 같은 진영 좌석에 잠금 표시를 켠다
  const attackArmed = targetKind !== null && rfIsAttack(targetKind);

  return (
    <div className={`rf-board ${showBar || showPassiveBar ? 'with-bar' : ''}`}>
      {/* 이벤트 피드 (최근 3줄) */}
      <div className="rf-feed">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="rf-feed-line">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* ----- 상단 국고 + 진영 세력 ----- */}
      <div className={`rf-treasury lv-${treasuryLevel}`}>
        <span className="rf-treasury-main">
          <span className="rf-treasury-label">🏦 피난처</span>
          <span className="rf-treasury-amount">🪙 {treasury}</span>
        </span>
        <span className="rf-treasury-hint">
          {treasury > 0
            ? `횡령하면 은화 ${treasury}개를 통째로 가져갑니다`
            : '아직 비어 있습니다 — 진영을 바꿀 때마다 쌓입니다'}
        </span>
        <span className="rf-tally">
          <span className="rf-faction loyalist">
            <span aria-hidden="true">{RF_FACTIONS.loyalist.icon}</span>
            {RF_FACTIONS.loyalist.name} {factionCount('loyalist')}
          </span>
          <span className="rf-faction reformist">
            <span aria-hidden="true">{RF_FACTIONS.reformist.icon}</span>
            {RF_FACTIONS.reformist.name} {factionCount('reformist')}
          </span>
        </span>
      </div>

      {/* 상단 단계 배너 */}
      <div className="rf-phase-banner">
        <span className="rf-phase-title">
          ⚖️ 리포메이션 · {PHASE_LABEL[game.phase] ?? game.phase}
          {game.endsAt > 0 && (
            <span
              className={`rf-deadline ${remaining < 6_000 ? 'urgent' : ''}`}
            >
              ⏱ {remainSec}초
            </span>
          )}
        </span>
        {bannerSub && <span className="rf-phase-sub">{bannerSub}</span>}
        {game.lastAction?.message && (
          <span className="rf-last-action">🕘 {game.lastAction.message}</span>
        )}
      </div>

      {/* 좌석 타일 그리드 — 진영 배지·공개 카드·카드 수·칩 */}
      <div className="rf-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isTurnSeat = p.seat === game.currentSeat && isAction;
          const lostRoles = p.lostRoles ?? [];
          const offline = !p.connected && !p.bot;
          const isActor = isWindow && p.seat === actorSeat;
          const isTarget =
            (isWindow || isLose) && targetSeat >= 0 && p.seat === targetSeat;
          const isBlocker =
            isBlockClaim && blockerSeat >= 0 && p.seat === blockerSeat;
          const isChoosing = isLose && p.seat === loseSeat;
          const ally = !isMe && p.alive && isAlly(p);
          // 같은 진영은 공격 대상이 될 수 없다 — 대상 고르는 중엔 못 박아 보여준다
          const locked = attackArmed && ally;
          return (
            <div
              key={p.seat}
              className={[
                'rf-tile',
                `f-${p.faction}`,
                isTurnSeat ? 'turn' : '',
                isMe ? 'me' : '',
                !p.alive ? 'dead' : '',
                isTarget ? 'target' : '',
                locked ? 'locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="rf-tile-head">
                <span className="rf-tile-name">
                  {isTurnSeat && <span className="rf-turn-mark">▶</span>}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="rf-tile-coins" title="보유 은화">
                  🪙 {p.coins}
                </span>
              </span>

              {/* 진영 배지 — 아이콘 + 이름 (색만으로 구분되지 않게) */}
              <span className="rf-tile-faction">
                <RFFactionBadge faction={p.faction} />
                {ally && (
                  <span className="rf-badge ally" title={RF_SAME_FACTION_REASON}>
                    🤝 동맹
                  </span>
                )}
              </span>

              {/* 카드 줄 — 비공개는 뒷면 수, 잃은 카드는 공개로 */}
              <span className="rf-tile-cards">
                {Array.from({ length: Math.max(0, p.cardCount) }).map(
                  (_, i) => (
                    <span
                      key={`b${i}`}
                      className="rf-mini-card back"
                      title="비공개 카드"
                    >
                      ✦
                    </span>
                  ),
                )}
                {lostRoles.map((role, i) => (
                  <RFMiniCard key={`r${i}`} role={role} />
                ))}
              </span>

              <span className="rf-tile-badges">
                {isActor && <span className="rf-badge act">⚡ 액션</span>}
                {isTarget && <span className="rf-badge tgt">🎯 대상</span>}
                {isBlocker && <span className="rf-badge blk">🛡 저지</span>}
                {isChoosing && (
                  <span className="rf-badge lose">카드 선택 중…</span>
                )}
                {p.bot && <span className="rf-badge">🤖</span>}
                {offline && <span className="rf-badge off">끊김</span>}
              </span>

              {locked && (
                <span className="rf-tile-locked">🚫 {RF_SAME_FACTION_REASON}</span>
              )}
              {!p.alive && <span className="rf-tile-out">☠️ 탈락</span>}
            </div>
          );
        })}
      </div>

      {/* 내 비공개 카드 + 내 진영 */}
      {!isSpectator && (
        <div className="rf-hand">
          <span className="rf-hand-title">
            내 카드 · 🪙 {myCoins}
            <span className="rf-hand-faction">
              <RFFactionBadge faction={myFaction} />
            </span>
          </span>
          {yourRoles.length > 0 ? (
            <div className="rf-hand-row">
              {yourRoles.map((role, i) => (
                <RFHandCard key={`${role}-${i}`} role={role} />
              ))}
            </div>
          ) : (
            <p className="rf-observer-note">
              {alive
                ? '카드 정보를 기다리는 중…'
                : '☠️ 카드를 모두 잃어 탈락했습니다 — 남은 개혁의 향방을 지켜보세요'}
            </p>
          )}
        </div>
      )}

      {/* 액션 그리드 (기본 7종 + 확장 3종) — 내 차례에만 */}
      {myTurn && (
        <div className="rf-actions">
          <span className="rf-actions-title">
            {mustCoup
              ? `💥 은화 ${RF_FORCED_COUP_COINS}개 이상 — 쿠데타 강제`
              : '내 차례 — 액션 선택'}
          </span>
          {allyNames.length > 0 && (
            <span className="rf-actions-warn">
              🚫 {RF_SAME_FACTION_REASON} — 같은 진영:{' '}
              {allyNames.join(', ')}
            </span>
          )}
          <div className="rf-actions-grid">
            {RF_ACTION_ORDER.map((kind) => {
              const meta = RF_ACTIONS[kind];
              const reason = actionDisabledReason(kind);
              const claim = meta.claim ? RF_ROLES[meta.claim] : null;
              return (
                <button
                  key={kind}
                  type="button"
                  className={[
                    'rf-action-button',
                    claim || meta.claimText ? 'claim' : '',
                    meta.extra ? 'extra' : '',
                    reason === RF_SAME_FACTION_REASON ? 'ally-locked' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleActionTap(kind)}
                  disabled={submitted || reason !== null}
                  title={reason ?? meta.effect}
                >
                  <span className="rf-action-label">
                    {meta.icon} {meta.label}
                    {meta.cost > 0 && (
                      <span className="rf-action-cost"> −은화 {meta.cost}</span>
                    )}
                  </span>
                  <span className="rf-action-sub">
                    {kind === 'embezzle'
                      ? `피난처 은화 ${treasury}개 획득`
                      : meta.effect}
                    {claim ? ` · ${claim.name} 주장` : ''}
                    {meta.claimText ? ` · "${meta.claimText}"` : ''}
                  </span>
                  <span
                    className={`rf-action-note ${reason ? 'reason' : ''}`}
                  >
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
        <p className="rf-observer-note">
          👁 관전 중 — 좌석이 없어 비공개 카드는 보이지 않습니다 (진영은 전원
          공개)
        </p>
      )}

      {/* ----- 하단 고정 응답 바 (도전/차단/허용 + 카운트다운) ----- */}
      {showBar && (
        <div className="rf-response-bar">
          <span className="rf-bar-prompt">
            {isBlockClaim
              ? `🛡 ${nameOf(blockerSeat)}의 저지(${rfRoleName(pending?.blockRole)})`
              : pendingLine || '응답을 선택하세요'}
            {passed.length > 0 && (
              <span className="rf-bar-passed"> · {passed.length}명 허용</span>
            )}
            {game.endsAt > 0 && (
              <span
                className={`rf-bar-timer ${remaining < 6_000 ? 'urgent' : ''}`}
              >
                ⏱ {remainSec}초
              </span>
            )}
          </span>
          <div className="rf-bar-buttons">
            {canChallenge && (
              <button
                type="button"
                className="rf-challenge-button"
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
                className="rf-block-button"
                onClick={() => respond(() => onBlock(role))}
                disabled={submitted}
              >
                🛡 저지: {RF_ROLES[role].name}
              </button>
            ))}
            <button
              type="button"
              className="rf-allow-button"
              onClick={() => respond(onPass)}
              disabled={submitted}
            >
              ✓ 허용
            </button>
          </div>
        </div>
      )}

      {/* 응답 자격이 없는 쪽(주장자·탈락자·관전자)의 대기 바 */}
      {showPassiveBar && (
        <div className="rf-response-bar passive">
          <span className="rf-bar-prompt">
            {pendingLine || '응답 대기 중'} — 다른 플레이어의 응답을 기다리는
            중…
            {passed.length > 0 && (
              <span className="rf-bar-passed"> · {passed.length}명 허용</span>
            )}
            {game.endsAt > 0 && (
              <span
                className={`rf-bar-timer ${remaining < 6_000 ? 'urgent' : ''}`}
              >
                ⏱ {remainSec}초
              </span>
            )}
          </span>
        </div>
      )}

      {/* ----- 대상 선택 오버레이 ----- */}
      {targetKind && (
        <div className="rf-overlay" onClick={() => setTargetKind(null)}>
          <div className="rf-overlay-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="rf-overlay-title">
              {RF_ACTIONS[targetKind].icon} {RF_ACTIONS[targetKind].label} — 대상
              선택
            </h2>
            <p className="rf-overlay-sub">{RF_ACTIONS[targetKind].effect}</p>
            {attackArmed && allyNames.length > 0 && (
              <p className="rf-overlay-warn">🚫 {RF_SAME_FACTION_REASON}</p>
            )}
            <div className="rf-target-list">
              {aliveOpponents.map((p) => {
                // 공격 액션에서 같은 진영은 비활성 + 사유를 그 자리에 적는다
                const blocked = rfIsAttack(targetKind) && isAlly(p);
                const flipTo =
                  p.faction === 'loyalist' ? 'reformist' : 'loyalist';
                return (
                  <button
                    key={p.seat}
                    type="button"
                    className={`rf-target-button ${blocked ? 'blocked' : ''}`}
                    onClick={() => handleTargetTap(p.seat)}
                    disabled={submitted || blocked}
                    title={blocked ? RF_SAME_FACTION_REASON : undefined}
                  >
                    <span className="rf-target-name">
                      {p.name}
                      <RFFactionBadge faction={p.faction} compact />
                    </span>
                    <span className="rf-target-info">
                      {blocked ? (
                        <span className="rf-target-blocked">
                          🚫 {RF_SAME_FACTION_REASON}
                        </span>
                      ) : targetKind === 'convert_other' ? (
                        <span className="rf-target-flip">
                          → {RF_FACTIONS[flipTo].icon}{' '}
                          {RF_FACTIONS[flipTo].name}
                        </span>
                      ) : (
                        `🂠 ${p.cardCount}장 · 🪙 ${p.coins}`
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="rf-overlay-cancel"
              onClick={() => setTargetKind(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ----- 카드 제거 선택 오버레이 (내 카드 중 탭) ----- */}
      {mustLose && (
        <div className="rf-overlay">
          <div className="rf-overlay-panel">
            <h2 className="rf-overlay-title">💔 잃을 카드 선택</h2>
            <p className="rf-overlay-sub">
              선택한 카드는 공개로 뒤집힙니다
              {game.endsAt > 0 && ` · ⏱ ${remainSec}초 (미선택 시 무작위)`}
            </p>
            <div className="rf-overlay-cards">
              {yourRoles.map((role, i) => (
                <RFHandCard
                  key={`${role}-${i}`}
                  role={role}
                  selectable
                  onClick={() => {
                    if (submitted) return;
                    lockSubmit();
                    onLoseCard(i);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----- 교환 선택 오버레이 (유지할 카드 선택) ----- */}
      {inExchangePick && (
        <div className="rf-overlay">
          <div className="rf-overlay-panel">
            <h2 className="rf-overlay-title">🔄 캐릭터 교환 — 유지할 카드 선택</h2>
            <p className="rf-overlay-sub">
              {yourExchange.length}장 중 {keepCount}장을 남기고 나머지는 덱으로
              반납합니다
              {game.endsAt > 0 && ` · ⏱ ${remainSec}초`}
            </p>
            <div className="rf-overlay-cards wrap">
              {yourExchange.map((role, i) => (
                <RFHandCard
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
              className="rf-overlay-confirm"
              onClick={() => {
                if (submitted || keepIdx.length !== keepCount) return;
                lockSubmit();
                onExchange([...keepIdx].sort((a, b) => a - b));
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
