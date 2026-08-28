import { useEffect, useRef, useState } from 'react';
import type {
  CTAbilityPayload,
  CTCard,
  CTColor,
  CTEvent,
  CTGameState,
  CTGatherKind,
  CTPlayerView,
} from '../../types/citadels';
import {
  CT_ARCHITECT_DRAW,
  CT_CITY_GOAL,
  CT_COLORS,
  CT_DRAW_COUNT,
  CT_GATHER_GOLD,
  CT_ROLES,
  CT_ROLE_ABILITY,
  CT_ROLE_ARCHITECT,
  CT_ROLE_ASSASSIN,
  CT_ROLE_MAGICIAN,
  CT_ROLE_NEEDS_TARGET,
  CT_ROLE_THIEF,
  CT_ROLE_WARLORD,
  ctAssassinTargetCheck,
  ctBuildCheck,
  ctBuildLimit,
  ctBuiltValue,
  ctColorIcon,
  ctColorLabel,
  ctColorTone,
  ctDestroyCardCheck,
  ctDestroyCost,
  ctDestroySeatCheck,
  ctMagicianTargetCheck,
  ctMissingColors,
  ctRoleIcon,
  ctRoleName,
  ctRoleTitle,
  ctThiefTargetCheck,
} from '../../types/citadels';
import type { CTToast } from '../../hooks/useCitadelsGameState';
import './CitadelsBoard.css';

interface CitadelsBoardProps {
  game: CTGameState;
  toasts: CTToast[];
  onPickRole: (role: number) => void;
  onGather: (kind: CTGatherKind) => void;
  onKeep: (index: number) => void;
  onBuild: (cardId: number) => void;
  onAbility: (payload: CTAbilityPayload) => void;
  onEndTurn: () => void;
}

// 지금 화면이 요구하는 행동 — 단계가 많은 게임이라 이 한 값이 화면 전체의
// 안내 문구·활성 패널·버튼 노출을 모두 결정한다.
type CTStep = 'pick' | 'keep' | 'gather' | 'build' | 'ability' | 'wait';

// ---------- 건물 색 블록 ----------
// 외부 에셋 없이 색 블록 + 아이콘으로 그린다. 색약·흑백에서도 구분되도록
// 색마다 아이콘이 다르고(귀족 👑 · 종교 ⛪ · 상업 💰 · 군사 ⚔️ · 특수 ✨)
// 화면에는 늘 한글 이름을 함께 적는다.
export function CitadelsSwatch({
  color,
  size = 24,
}: {
  color: CTColor | string;
  size?: number;
}) {
  return (
    <span
      className={`ct-swatch c-${color}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
      }}
      role="img"
      aria-label={`${ctColorTone(color)}(${ctColorLabel(color)}) 건물`}
    >
      {ctColorIcon(color)}
    </span>
  );
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: CTEvent, game: CTGameState): string {
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
    case 'round':
      return `🏰 ${game.round}라운드 — 직업을 고릅니다`;
    case 'call':
      return `📯 ${ctRoleTitle(game.callingRole)} 호출`;
    case 'skip':
      return `🗡️ ${ctRoleName(game.callingRole)}은(는) 암살당해 차례를 건너뜁니다`;
    case 'gather':
      return `${name(event.seat)}님이 자원을 받았습니다`;
    case 'build':
      return `🏗️ ${name(event.seat)}님이 건물을 지었습니다`;
    case 'kill':
      return '🗡️ 암살자가 직업 하나를 지목했습니다';
    case 'rob':
      return '🎭 도둑이 직업 하나를 노립니다';
    case 'swap':
      return '🎩 마술사가 손패를 바꿨습니다';
    case 'destroy':
      return `⚔️ ${name(event.seat)}님의 건물이 파괴되었습니다`;
    case 'crown':
      return `👑 ${name(event.seat)}님이 왕관을 가져갑니다`;
    case 'last_round':
      return `🏁 ${CT_CITY_GOAL}채 완성 — 마지막 라운드입니다`;
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

interface BuildingTileProps {
  card: CTCard;
  // 못 고르는 이유 (또는 고를 수 있을 때의 확인 문구)
  reason: string;
  ok: boolean;
  selected?: boolean;
  actionable?: boolean;
  onTap?: () => void;
  badge?: string;
}

// 건물 카드 1장 — 색 블록 + 값 + 이름 + 판정 한 줄
function CitadelsBuildingTile({
  card,
  reason,
  ok,
  selected = false,
  actionable = false,
  onTap,
  badge,
}: BuildingTileProps) {
  const className = [
    'ct-building',
    `c-${card.color}`,
    ok ? 'ok' : 'blocked',
    selected ? 'selected' : '',
    actionable ? 'actionable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <span className="ct-building-head">
        <CitadelsSwatch color={card.color} size={26} />
        <span className="ct-building-name">{card.name}</span>
        <span className="ct-building-cost" title="건설 비용 = 승점">
          {card.cost}
        </span>
      </span>
      <span className="ct-building-color">
        {ctColorTone(card.color)}({ctColorLabel(card.color)}) · 값 {card.cost}
      </span>
      <span className={`ct-building-reason ${ok ? 'ok' : 'lack'}`}>
        {reason}
      </span>
      {badge && <span className="ct-building-badge">{badge}</span>}
    </>
  );

  if (!actionable || !onTap) {
    return <div className={className}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onTap}
      disabled={!ok}
      aria-label={`${card.name} · ${ctColorLabel(card.color)} · 값 ${card.cost} · ${reason}`}
    >
      {body}
    </button>
  );
}

export function CitadelsBoard({
  game,
  toasts,
  onPickRole,
  onGather,
  onKeep,
  onBuild,
  onAbility,
  onEndTurn,
}: CitadelsBoardProps) {
  // ---------- 로컬 선택 ----------
  // 능력 대상 선택 (암살자·도둑 = 직업, 마술사·장군 = 좌석, 장군 = 건물)
  const [targetRole, setTargetRole] = useState<number | null>(null);
  const [targetSeat, setTargetSeat] = useState<number | null>(null);
  const [targetCard, setTargetCard] = useState<number | null>(null);
  // 마술사 — 'swap'(손패 통째 교환) / 'discard'(버리고 새로 뽑기)
  const [magicMode, setMagicMode] = useState<'swap' | 'discard'>('swap');
  const [discardSel, setDiscardSel] = useState<number[]>([]);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(ct_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 진행 여부는 스냅샷(phase·currentSeat)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  // ① 자원을 이미 받았는지 (스냅샷에 별도 플래그가 없어 로컬로 추적한다)
  const [gathered, setGathered] = useState(false);

  const players = game.players ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)는 행동 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;

  const myHand = game.yourHand ?? [];
  const myDraw = game.yourDraw ?? [];
  const myBuilt = me?.built ?? [];
  const myGold = me?.gold ?? 0;
  const myRole = game.yourRole ?? 0;
  const pickPool = game.pickPool ?? [];
  const faceUpRemoved = game.faceUpRemoved ?? [];

  // 스냅샷 컨텍스트(phase/round/callingRole/currentSeat)가 바뀌면 로컬 선택과
  // 연타 잠금을 리셋한다 — 남아 있던 선택이 다음 상황에 잘못 확정되지 않게.
  const ctxKey = `${game.phase}|${game.round}|${game.callingRole}|${game.currentSeat}`;
  useEffect(() => {
    setTargetRole(null);
    setTargetSeat(null);
    setTargetCard(null);
    setMagicMode('swap');
    setDiscardSel([]);
    setSubmitted(false);
  }, [ctxKey]);

  // ① 자원 여부는 차례 단위로만 리셋한다 (turn → keep_card → turn 왕복에서
  // 초기화되면 "금화를 이미 받았는지" 안내가 틀어진다).
  const turnKey = `${game.round}|${game.callingRole}|${game.currentSeat}`;
  useEffect(() => {
    setGathered(false);
  }, [turnKey]);

  // 카드 2장을 뽑아 1장 남기는 단계에 들어왔다면 자원은 이미 받은 것이다
  useEffect(() => {
    if (game.phase === 'keep_card') setGathered(true);
  }, [game.phase]);

  // 내 상태가 실제로 바뀌면(=서버가 내 행동을 처리했으면) 즉시 잠금 해제.
  // 건축가처럼 한 차례에 여러 번 보내야 하는 직업이 2초씩 묶이지 않게 한다.
  const mySig = `${game.phase}|${myGold}|${myBuilt.length}|${myHand.length}|${myDraw.length}`;
  useEffect(() => {
    setSubmitted(false);
  }, [mySig]);

  const lockSubmit = () => {
    setSubmitted(true);
    // 스냅샷이 오지 않아도 2초 뒤에는 풀어 재시도할 수 있게 한다
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 이번 차례에 몇 채를 지었는지 — 도시 카드 수의 증분으로 센다
  const builtBase = useRef<{ key: string; base: number }>({
    key: '',
    base: 0,
  });
  if (builtBase.current.key !== turnKey) {
    builtBase.current = { key: turnKey, base: myBuilt.length };
  }
  const builtThisTurn = Math.max(0, myBuilt.length - builtBase.current.base);

  // ---------- 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화) ----------
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

  // ---------- 지금 뭘 해야 하는가 ----------
  const isMine = !isSpectator && game.currentSeat === game.yourSeat;
  const buildLimit = ctBuildLimit(myRole);
  const buildsLeft = Math.max(0, buildLimit - builtThisTurn);

  const step: CTStep = (() => {
    if (!isMine) return 'wait';
    switch (game.phase) {
      case 'pick_roles':
        return 'pick';
      case 'keep_card':
        return 'keep';
      case 'turn':
        return gathered ? 'build' : 'gather';
      case 'ability':
        return 'ability';
      default:
        return 'wait';
    }
  })();

  const canAct = isMine && !submitted;

  // 화면 맨 위에 크게 띄우는 "지금 할 일" 한 문장
  const headline = (() => {
    switch (step) {
      case 'pick':
        return '🎴 직업 카드를 한 장 고르세요';
      case 'keep':
        return `🃏 뽑은 ${CT_DRAW_COUNT}장 중 손에 남길 건물 카드 1장을 고르세요`;
      case 'gather':
        return `💰 ① 금화 ${CT_GATHER_GOLD}를 받거나, 건물 카드를 뽑으세요`;
      case 'build':
        return buildsLeft > 0
          ? `🏗️ ② 건물을 지으세요 (이번 차례 ${buildsLeft}채 더 가능)`
          : '🏗️ ② 건설을 마쳤습니다 — 차례를 끝내세요';
      case 'ability':
        return `${ctRoleIcon(myRole)} ③ ${ctRoleName(myRole)} 능력을 쓰세요`;
      default:
        break;
    }
    if (isSpectator) return '👀 관전 중입니다';
    if (game.phase === 'pick_roles') {
      return `🎴 ${nameOf(game.currentSeat)}님이 직업을 고르는 중입니다`;
    }
    if (game.callingRole > 0) {
      return `📯 ${ctRoleTitle(game.callingRole)} 호출 — ${nameOf(game.currentSeat)}님의 차례`;
    }
    return `${nameOf(game.currentSeat)}님의 차례입니다`;
  })();

  // 한 줄 더 — 왜 그렇게 해야 하는지 / 무엇을 눌러야 하는지
  const subline = (() => {
    switch (step) {
      case 'pick':
        return `남은 직업 ${pickPool.length}장 중에서 고릅니다. 고른 직업은 호출될 때까지 아무도 모릅니다`;
      case 'keep':
        return '고르지 않은 카드는 덱으로 돌아갑니다';
      case 'gather':
        return `금화 ${CT_GATHER_GOLD} 또는 건물 카드 ${CT_DRAW_COUNT}장 뽑아 1장 남기기 — 하나만 고릅니다`;
      case 'build':
        return buildsLeft > 0
          ? '건물값만큼 금화를 냅니다. 같은 이름 건물은 두 번 지을 수 없습니다'
          : '더 지을 수 없다면 아래에서 차례를 끝내세요';
      case 'ability':
        return CT_ROLE_ABILITY[myRole] ?? '능력을 사용하거나 건너뜁니다';
      default:
        break;
    }
    if (isSpectator) return '관전 중 — 행동할 수 없습니다';
    if (game.phase === 'pick_roles') {
      return '왕관 보유자부터 한 장씩 고릅니다';
    }
    return myRole > 0
      ? `내 직업은 ${ctRoleTitle(myRole)} — ${myRole}번이 불리면 내 차례입니다`
      : '잠시만 기다려 주세요';
  })();

  // ---------- 행동 핸들러 ----------
  const handlePickRole = (role: number) => {
    if (!canAct || step !== 'pick') return;
    lockSubmit();
    onPickRole(role);
  };

  const handleGather = (kind: CTGatherKind) => {
    if (!canAct || step !== 'gather') return;
    lockSubmit();
    setGathered(true);
    onGather(kind);
  };

  const handleKeep = (index: number) => {
    if (!canAct || step !== 'keep') return;
    lockSubmit();
    onKeep(index);
  };

  const handleBuild = (card: CTCard) => {
    if (!canAct || step !== 'build') return;
    const check = ctBuildCheck(card, myGold, myBuilt, buildsLeft);
    if (!check.ok) return;
    lockSubmit();
    onBuild(card.id);
  };

  const handleAbility = (payload: CTAbilityPayload) => {
    if (!canAct || step !== 'ability') return;
    lockSubmit();
    onAbility(payload);
  };

  const handleEndTurn = () => {
    if (!canAct) return;
    lockSubmit();
    onEndTurn();
  };

  const toggleDiscard = (index: number) => {
    setDiscardSel((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index],
    );
  };

  // ---------- 능력 대상 판정 ----------
  // 암살당한 직업은 도둑이 노릴 수 없다 — 공개된 좌석에서 역으로 찾는다
  const killedRole = players.find((p) => p.killed && p.roleRevealed > 0)
    ?.roleRevealed ?? 0;

  const roleTargetCheck = (role: number) => {
    if (faceUpRemoved.includes(role)) {
      return {
        ok: false,
        reason: '앞면으로 제외돼 아무도 갖고 있지 않습니다',
      };
    }
    if (myRole === CT_ROLE_ASSASSIN) return ctAssassinTargetCheck(role);
    if (myRole === CT_ROLE_THIEF) return ctThiefTargetCheck(role, killedRole);
    return { ok: false, reason: '지목할 수 없습니다' };
  };

  const warlordTargetSeatCheck = (p: CTPlayerView) =>
    ctDestroySeatCheck(p, game.yourSeat);

  const targetPlayer =
    targetSeat === null ? null : players.find((p) => p.seat === targetSeat) ?? null;

  // ---------- 도시 진척 ----------
  const missing = ctMissingColors(myBuilt);
  const myCityValue = ctBuiltValue(myBuilt);

  // 라운드 진행 요약 — 직업 8종의 호출 상태
  const roleState = (role: number) => {
    if (faceUpRemoved.includes(role)) return 'removed';
    if (game.callingRole === role) return 'calling';
    if (game.callingRole > role) return 'done';
    return 'upcoming';
  };
  const holderOf = (role: number) =>
    players.find((p) => p.roleRevealed === role) ?? null;

  const leaderCity = players.reduce(
    (max, p) => Math.max(max, (p.built ?? []).length),
    0,
  );

  return (
    <div className="ct-board">
      <div className="ct-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="ct-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 라운드 · 왕관 · 호출 중인 직업 · ⏱ */}
      <div className={`ct-status-bar ${game.phase}`}>
        <div className="ct-status-row">
          <span className="ct-status-chip">🏰 {game.round}라운드</span>
          <span className="ct-status-chip crown">
            👑 왕관 {nameOf(game.crownSeat)}
          </span>
          <span className="ct-status-chip">
            🏗️ 최다 도시 {leaderCity}/{CT_CITY_GOAL}
          </span>
          {game.callingRole > 0 && (
            <span className="ct-status-chip calling">
              📯 {ctRoleTitle(game.callingRole)} 호출 중
            </span>
          )}
          {game.lastRound && (
            <span className="ct-status-chip last">🏁 마지막 라운드</span>
          )}
          {game.endsAt > 0 && (
            <span className={`ct-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
      </div>

      {/* 지금 할 일 — 이 게임에서 가장 중요한 한 문장 */}
      <div className={`ct-headline ${isMine ? 'mine' : 'idle'}`}>
        <span className="ct-headline-title">{headline}</span>
        <span className="ct-headline-sub">{subline}</span>
        {/* 내 차례의 3단계 진행 표시 */}
        {isMine &&
          (step === 'gather' ||
            step === 'keep' ||
            step === 'build' ||
            step === 'ability') && (
            <div className="ct-steps" aria-label="차례 진행 단계">
              <span
                className={`ct-step ${step === 'gather' || step === 'keep' ? 'active' : 'done'}`}
              >
                ① 자원
              </span>
              <span
                className={`ct-step ${
                  step === 'build'
                    ? 'active'
                    : step === 'ability'
                      ? 'done'
                      : 'todo'
                }`}
              >
                ② 건설
              </span>
              <span
                className={`ct-step ${step === 'ability' ? 'active' : 'todo'}`}
              >
                ③ 능력
              </span>
            </div>
          )}
      </div>

      {isSpectator && (
        <div className="ct-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {!isSpectator && me && (me.killed || me.robbed) && (
        <div className="ct-alert">
          {me.killed && '🗡️ 암살당했습니다 — 이번 라운드 차례를 건너뜁니다. '}
          {me.robbed && '🎭 도둑에게 금화를 빼앗겼습니다.'}
        </div>
      )}

      {game.lastAction && (
        <div className="ct-last-action">
          직전 — {game.lastAction.name}: {game.lastAction.message}
        </div>
      )}

      {/* 직업 호출 순서 1~8 — 어디까지 불렸는지 한눈에 */}
      <section className="ct-section">
        <div className="ct-section-head">
          <span className="ct-section-title">직업 호출 순서</span>
          <span className="ct-section-note">
            1번부터 8번까지 차례로 부릅니다
          </span>
        </div>
        <div className="ct-role-track">
          {CT_ROLES.map((role) => {
            const st = roleState(role);
            const holder = holderOf(role);
            const isMineRole = myRole === role;
            return (
              <div
                key={role}
                className={`ct-role-slot ${st} ${isMineRole ? 'mine' : ''}`}
                title={CT_ROLE_ABILITY[role]}
              >
                <span className="ct-role-slot-num">{role}</span>
                <span className="ct-role-slot-name">
                  {ctRoleIcon(role)} {ctRoleName(role)}
                </span>
                <span className="ct-role-slot-holder">
                  {st === 'removed'
                    ? '앞면 제외'
                    : holder
                      ? `${holder.name}${holder.killed ? ' · 암살' : ''}`
                      : isMineRole
                        ? '나 (비공개)'
                        : '비공개'}
                </span>
              </div>
            );
          })}
        </div>
        {faceUpRemoved.length > 0 && (
          <p className="ct-section-foot">
            앞면 제외 —{' '}
            {faceUpRemoved.map((r) => ctRoleName(r)).join(' · ')} (이번 라운드에는
            아무도 갖고 있지 않습니다)
          </p>
        )}
      </section>

      {/* ---------- 직업 선택 단계 ---------- */}
      {game.phase === 'pick_roles' && (
        <section className="ct-section ct-focus">
          <div className="ct-section-head">
            <span className="ct-section-title">직업 선택</span>
            <span className="ct-section-note">
              {step === 'pick'
                ? `남은 ${pickPool.length}장`
                : `${nameOf(game.currentSeat)}님이 고르는 중`}
            </span>
          </div>
          {step === 'pick' ? (
            <div className="ct-pick-grid">
              {pickPool.map((role) => (
                <button
                  key={role}
                  type="button"
                  className="ct-pick-card"
                  onClick={() => handlePickRole(role)}
                  disabled={!canAct}
                  aria-label={`${ctRoleTitle(role)} — ${CT_ROLE_ABILITY[role]}`}
                >
                  <span className="ct-pick-num">{role}</span>
                  <span className="ct-pick-name">
                    {ctRoleIcon(role)} {ctRoleName(role)}
                  </span>
                  <span className="ct-pick-desc">{CT_ROLE_ABILITY[role]}</span>
                </button>
              ))}
              {pickPool.length === 0 && (
                <span className="ct-row-empty">고를 직업이 없습니다</span>
              )}
            </div>
          ) : (
            <p className="ct-section-foot">
              {isSpectator
                ? '누가 어떤 직업을 골랐는지는 호출될 때 공개됩니다'
                : myRole > 0
                  ? `내 직업은 ${ctRoleTitle(myRole)} 입니다 — 나만 볼 수 있습니다`
                  : '내 차례가 오면 여기서 직업을 고릅니다'}
            </p>
          )}
        </section>
      )}

      {/* ---------- 뽑은 2장 중 1장 남기기 ---------- */}
      {step === 'keep' && (
        <section className="ct-section ct-focus">
          <div className="ct-section-head">
            <span className="ct-section-title">건물 카드 고르기</span>
            <span className="ct-section-note">1장만 손에 남깁니다</span>
          </div>
          <div className="ct-card-grid">
            {myDraw.map((card, index) => (
              <CitadelsBuildingTile
                key={`${card.id}-${index}`}
                card={card}
                ok={canAct}
                actionable
                reason={
                  canAct ? '이 카드를 손에 남깁니다' : '처리 중입니다...'
                }
                onTap={() => handleKeep(index)}
              />
            ))}
            {myDraw.length === 0 && (
              <span className="ct-row-empty">뽑은 카드가 없습니다</span>
            )}
          </div>
        </section>
      )}

      {/* ---------- ① 자원 ---------- */}
      {step === 'gather' && (
        <section className="ct-section ct-focus">
          <div className="ct-section-head">
            <span className="ct-section-title">① 자원 받기</span>
            <span className="ct-section-note">둘 중 하나만 고릅니다</span>
          </div>
          <div className="ct-gather-row">
            <button
              type="button"
              className="ct-gather-button gold"
              onClick={() => handleGather('gold')}
              disabled={!canAct}
            >
              <span className="ct-gather-icon">🪙</span>
              <span className="ct-gather-title">금화 {CT_GATHER_GOLD} 받기</span>
              <span className="ct-gather-desc">
                지금 금화 {myGold} → {myGold + CT_GATHER_GOLD}
              </span>
            </button>
            <button
              type="button"
              className="ct-gather-button cards"
              onClick={() => handleGather('cards')}
              disabled={!canAct}
            >
              <span className="ct-gather-icon">🃏</span>
              <span className="ct-gather-title">
                건물 카드 {CT_DRAW_COUNT}장 뽑기
              </span>
              <span className="ct-gather-desc">
                {myRole === CT_ROLE_ARCHITECT
                  ? `1장만 남깁니다 · 건축가는 이후 ${CT_ARCHITECT_DRAW}장을 더 뽑습니다`
                  : '뽑은 2장 중 1장만 남깁니다'}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ---------- 내 손패 (② 건설) ---------- */}
      {!isSpectator && (
        <section className={`ct-section ${step === 'build' ? 'ct-focus' : ''}`}>
          <div className="ct-section-head">
            <span className="ct-section-title">
              내 손패 {myHand.length}장
            </span>
            <span className="ct-section-note">
              {step === 'build'
                ? `이번 차례 ${buildsLeft}채 더 지을 수 있습니다 · 금화 ${myGold}`
                : `금화 ${myGold} · 나만 볼 수 있습니다`}
            </span>
          </div>
          <div className="ct-card-grid">
            {myHand.map((card) => {
              const check = ctBuildCheck(card, myGold, myBuilt, buildsLeft);
              // 건설 단계가 아니면 "왜 못 짓나" 대신 카드 정보를 보여준다
              const reason =
                step === 'build'
                  ? check.reason
                  : check.duplicate
                    ? '이미 지은 건물입니다'
                    : `건설 비용 ${card.cost} · 지금 금화 ${myGold}`;
              return (
                <CitadelsBuildingTile
                  key={card.id}
                  card={card}
                  ok={step === 'build' ? check.ok && canAct : false}
                  actionable={step === 'build'}
                  reason={reason}
                  onTap={() => handleBuild(card)}
                />
              );
            })}
            {myHand.length === 0 && (
              <span className="ct-row-empty">손패가 없습니다</span>
            )}
          </div>
          {step === 'build' && (
            <p className="ct-section-foot">
              건물을 누르면 바로 짓습니다.
              {myRole === CT_ROLE_ARCHITECT
                ? ' 건축가라서 이번 차례에 최대 3채까지 지을 수 있습니다.'
                : ' 이번 차례에는 1채만 지을 수 있습니다.'}
            </p>
          )}
        </section>
      )}

      {/* ---------- ③ 직업 능력 대상 선택 ---------- */}
      {step === 'ability' && (
        <section className="ct-section ct-focus ct-ability">
          <div className="ct-section-head">
            <span className="ct-section-title">
              ③ {ctRoleIcon(myRole)} {ctRoleName(myRole)} 능력
            </span>
            <span className="ct-section-note">
              {CT_ROLE_NEEDS_TARGET[myRole]
                ? '대상을 고르세요'
                : '대상 없이 적용됩니다'}
            </span>
          </div>
          <p className="ct-ability-desc">{CT_ROLE_ABILITY[myRole]}</p>

          {/* 암살자·도둑 — 직업 지목 */}
          {(myRole === CT_ROLE_ASSASSIN || myRole === CT_ROLE_THIEF) && (
            <>
              <div className="ct-target-grid">
                {CT_ROLES.map((role) => {
                  const check = roleTargetCheck(role);
                  const selected = targetRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      className={`ct-target ${check.ok ? 'ok' : 'blocked'} ${selected ? 'selected' : ''}`}
                      onClick={() => check.ok && setTargetRole(role)}
                      disabled={!check.ok || !canAct}
                      aria-label={`${ctRoleTitle(role)} — ${check.reason}`}
                    >
                      <span className="ct-target-title">
                        {role}. {ctRoleIcon(role)} {ctRoleName(role)}
                      </span>
                      <span
                        className={`ct-target-reason ${check.ok ? 'ok' : 'lack'}`}
                      >
                        {check.reason}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="ct-primary-button"
                onClick={() =>
                  targetRole !== null && handleAbility({ targetRole })
                }
                disabled={targetRole === null || !canAct}
              >
                {targetRole === null
                  ? '지목할 직업을 고르세요'
                  : myRole === CT_ROLE_ASSASSIN
                    ? `🗡️ ${ctRoleName(targetRole)} 암살하기`
                    : `🎭 ${ctRoleName(targetRole)} 털기`}
              </button>
            </>
          )}

          {/* 마술사 — 손패 교환 / 버리고 새로 뽑기 */}
          {myRole === CT_ROLE_MAGICIAN && (
            <>
              <div className="ct-mode-switch" role="group" aria-label="능력 방식">
                <button
                  type="button"
                  className={`ct-mode ${magicMode === 'swap' ? 'active' : ''}`}
                  aria-pressed={magicMode === 'swap'}
                  onClick={() => setMagicMode('swap')}
                >
                  손패 통째로 바꾸기
                </button>
                <button
                  type="button"
                  className={`ct-mode ${magicMode === 'discard' ? 'active' : ''}`}
                  aria-pressed={magicMode === 'discard'}
                  onClick={() => setMagicMode('discard')}
                >
                  버리고 새로 뽑기
                </button>
              </div>

              {magicMode === 'swap' ? (
                <>
                  <div className="ct-target-grid">
                    {players.map((p) => {
                      const check = ctMagicianTargetCheck(p, game.yourSeat);
                      const selected = targetSeat === p.seat;
                      return (
                        <button
                          key={p.seat}
                          type="button"
                          className={`ct-target ${check.ok ? 'ok' : 'blocked'} ${selected ? 'selected' : ''}`}
                          onClick={() => check.ok && setTargetSeat(p.seat)}
                          disabled={!check.ok || !canAct}
                          aria-label={`${p.name} — ${check.reason}`}
                        >
                          <span className="ct-target-title">
                            {p.name}
                            {p.bot && ' 🤖'} · 손패 {p.handCount}장
                          </span>
                          <span
                            className={`ct-target-reason ${check.ok ? 'ok' : 'lack'}`}
                          >
                            {check.reason}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="ct-primary-button"
                    onClick={() =>
                      targetSeat !== null && handleAbility({ targetSeat })
                    }
                    disabled={targetSeat === null || !canAct}
                  >
                    {targetSeat === null
                      ? '바꿀 상대를 고르세요'
                      : `🎩 ${nameOf(targetSeat)}님과 손패 바꾸기`}
                  </button>
                </>
              ) : (
                <>
                  <div className="ct-card-grid">
                    {myHand.map((card, index) => (
                      <CitadelsBuildingTile
                        key={card.id}
                        card={card}
                        ok
                        actionable
                        selected={discardSel.includes(index)}
                        reason={
                          discardSel.includes(index)
                            ? '버릴 카드로 골랐습니다'
                            : '누르면 버릴 카드로 고릅니다'
                        }
                        onTap={() => toggleDiscard(index)}
                      />
                    ))}
                    {myHand.length === 0 && (
                      <span className="ct-row-empty">버릴 손패가 없습니다</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ct-primary-button"
                    onClick={() => handleAbility({ discard: discardSel })}
                    disabled={discardSel.length === 0 || !canAct}
                  >
                    {discardSel.length === 0
                      ? '버릴 카드를 고르세요'
                      : `🎩 ${discardSel.length}장 버리고 ${discardSel.length}장 새로 뽑기`}
                  </button>
                </>
              )}
            </>
          )}

          {/* 장군 — 좌석 → 건물 순서로 고른다 */}
          {myRole === CT_ROLE_WARLORD && (
            <>
              <p className="ct-ability-step">1) 어느 도시를 칠까요?</p>
              <div className="ct-target-grid">
                {players.map((p) => {
                  const check = warlordTargetSeatCheck(p);
                  const selected = targetSeat === p.seat;
                  return (
                    <button
                      key={p.seat}
                      type="button"
                      className={`ct-target ${check.ok ? 'ok' : 'blocked'} ${selected ? 'selected' : ''}`}
                      onClick={() => {
                        if (!check.ok) return;
                        setTargetSeat(p.seat);
                        setTargetCard(null);
                      }}
                      disabled={!check.ok || !canAct}
                      aria-label={`${p.name} — ${check.reason}`}
                    >
                      <span className="ct-target-title">
                        {p.name}
                        {p.bot && ' 🤖'} · 건물 {(p.built ?? []).length}채
                      </span>
                      <span
                        className={`ct-target-reason ${check.ok ? 'ok' : 'lack'}`}
                      >
                        {check.reason}
                      </span>
                    </button>
                  );
                })}
              </div>

              {targetPlayer && (
                <>
                  <p className="ct-ability-step">
                    2) {targetPlayer.name}님의 어떤 건물을 파괴할까요? (비용 =
                    건물값 − 1)
                  </p>
                  <div className="ct-card-grid">
                    {(targetPlayer.built ?? []).map((card) => {
                      const check = ctDestroyCardCheck(card, myGold);
                      return (
                        <CitadelsBuildingTile
                          key={card.id}
                          card={card}
                          ok={check.ok && canAct}
                          actionable
                          selected={targetCard === card.id}
                          reason={check.reason}
                          badge={`파괴 ${ctDestroyCost(card)}`}
                          onTap={() => setTargetCard(card.id)}
                        />
                      );
                    })}
                    {(targetPlayer.built ?? []).length === 0 && (
                      <span className="ct-row-empty">지은 건물이 없습니다</span>
                    )}
                  </div>
                </>
              )}

              <button
                type="button"
                className="ct-primary-button"
                onClick={() =>
                  targetSeat !== null &&
                  targetCard !== null &&
                  handleAbility({ targetSeat, cardId: targetCard })
                }
                disabled={
                  targetSeat === null || targetCard === null || !canAct
                }
              >
                {targetSeat === null
                  ? '파괴할 도시를 고르세요'
                  : targetCard === null
                    ? '파괴할 건물을 고르세요'
                    : '⚔️ 파괴하기'}
              </button>
            </>
          )}

          {/* 왕·주교·상인·건축가 — 대상이 없는 능력 */}
          {!CT_ROLE_NEEDS_TARGET[myRole] && (
            <button
              type="button"
              className="ct-primary-button"
              onClick={() => handleAbility({})}
              disabled={!canAct}
            >
              {ctRoleIcon(myRole)} 능력 사용
            </button>
          )}

          <button
            type="button"
            className="ct-ghost-button"
            onClick={handleEndTurn}
            disabled={!canAct}
          >
            능력을 쓰지 않고 차례 끝내기
          </button>
        </section>
      )}

      {/* ---------- 내 도시 ---------- */}
      {!isSpectator && me && (
        <section className="ct-section">
          <div className="ct-section-head">
            <span className="ct-section-title">
              내 도시 {myBuilt.length}/{CT_CITY_GOAL}채
            </span>
            <span className="ct-section-note">
              🪙 금화 {myGold} · 건물값 합 {myCityValue} · 승점 {me.score}
            </span>
          </div>

          {/* 다섯 색을 모두 갖추면 +3 — 무엇이 빠졌는지 늘 보여준다 */}
          <div className="ct-color-progress">
            {CT_COLORS.map((c) => {
              const count = myBuilt.filter((b) => b.color === c).length;
              return (
                <span
                  key={c}
                  className={`ct-color-progress-item ${count > 0 ? 'have' : 'missing'}`}
                  title={`${ctColorTone(c)}(${ctColorLabel(c)}) ${count}채`}
                >
                  <CitadelsSwatch color={c} size={18} />
                  <span className="ct-color-progress-name">
                    {ctColorLabel(c)}
                  </span>
                  <span className="ct-color-progress-count">{count}</span>
                </span>
              );
            })}
          </div>
          <p className="ct-section-foot">
            {missing.length === 0
              ? '✅ 다섯 색을 모두 갖췄습니다 — 종료 시 승점 +3'
              : `다섯 색 보너스(+3)까지 ${missing
                  .map((c) => ctColorLabel(c))
                  .join(' · ')} 남았습니다`}
          </p>

          <div className="ct-card-grid">
            {myBuilt.map((card) => (
              <CitadelsBuildingTile
                key={card.id}
                card={card}
                ok
                reason={`완성 · 승점 ${card.cost}`}
              />
            ))}
            {myBuilt.length === 0 && (
              <span className="ct-row-empty">아직 지은 건물이 없습니다</span>
            )}
          </div>
        </section>
      )}

      {/* ---------- 남의 도시 (축소) ---------- */}
      <section className="ct-section">
        <div className="ct-section-head">
          <span className="ct-section-title">참가자</span>
          <span className="ct-section-note">
            직업은 호출될 때 공개됩니다
          </span>
        </div>
        <div className="ct-players">
          {players.map((p) => (
            <div
              key={p.seat}
              className={[
                'ct-player',
                p.seat === game.currentSeat ? 'active' : '',
                p.seat === game.yourSeat ? 'me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="ct-player-head">
                <span className="ct-player-name">
                  {p.seat === game.currentSeat && '▶ '}
                  {p.seat === game.crownSeat && '👑 '}
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="ct-player-badges">
                  {!p.connected && !p.bot && (
                    <span className="ct-badge off">끊김</span>
                  )}
                  {p.killed && <span className="ct-badge kill">암살</span>}
                  {p.robbed && <span className="ct-badge rob">도둑</span>}
                  <span className="ct-badge score">{p.score}점</span>
                </span>
              </div>
              <div className="ct-player-stats">
                <span>
                  {p.roleRevealed > 0
                    ? `${ctRoleIcon(p.roleRevealed)} ${ctRoleName(p.roleRevealed)}`
                    : '🎴 직업 비공개'}
                </span>
                <span>🪙 {p.gold}</span>
                <span>🃏 {p.handCount}장</span>
                <span>
                  🏗️ {(p.built ?? []).length}/{CT_CITY_GOAL}채
                </span>
              </div>
              <div className="ct-player-city">
                {(p.built ?? []).map((card) => (
                  <span
                    key={card.id}
                    className={`ct-mini-building c-${card.color}`}
                    title={`${card.name} · ${ctColorTone(card.color)}(${ctColorLabel(card.color)}) · 값 ${card.cost}`}
                  >
                    <CitadelsSwatch color={card.color} size={16} />
                    <span className="ct-mini-name">{card.name}</span>
                    <span className="ct-mini-cost">{card.cost}</span>
                  </span>
                ))}
                {(p.built ?? []).length === 0 && (
                  <span className="ct-mini-empty">아직 건물 없음</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 하단 행동 바 ---------- */}
      {!isSpectator && isMine && (step === 'build' || step === 'gather') && (
        <div className="ct-action-bar">
          <span className="ct-action-text">
            {step === 'gather'
              ? '먼저 ① 자원을 고르세요'
              : buildsLeft > 0
                ? `아직 ${buildsLeft}채 더 지을 수 있습니다`
                : '건설을 마쳤습니다'}
          </span>
          <div className="ct-action-buttons">
            <button
              type="button"
              className="ct-primary-button"
              onClick={handleEndTurn}
              disabled={!canAct || step === 'gather'}
            >
              차례 끝내기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
