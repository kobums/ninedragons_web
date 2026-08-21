import { useEffect, useMemo, useState } from 'react';
import type { CREvent, CRGameState } from '../../types/cockroach';
import {
  CR_ANIMALS,
  CR_LOSE_COUNT,
  CR_WARN_COUNT,
  crAnimalMeta,
  crClaimText,
} from '../../types/cockroach';
import type { CRToast } from '../../hooks/useCockroachGameState';
import './CockroachBoard.css';

interface CockroachBoardProps {
  game: CRGameState;
  // cr_peek 로 받은 릴레이 카드 실물 (없으면 null)
  peek: string | null;
  toasts: CRToast[];
  onPassCard: (card: string, targetSeat: number, claim: string) => void;
  onRelay: (targetSeat: number, claim: string) => void;
  onJudge: (truth: boolean) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: CREvent, game: CRGameState): string {
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
    case 'pass':
      return `${name(event.seat)}님이 카드를 건넸습니다`;
    case 'relay':
      return `${name(event.seat)}님이 몰래 보고 넘겼습니다`;
    case 'judge_right':
      return `${name(event.seat)}님이 판정에 성공했습니다`;
    case 'judge_wrong':
      return `${name(event.seat)}님이 판정에 실패했습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 진열 그리드 — 동물 이모지 × 개수. 3장 경고색, 4장(패배) 위험색.
// 종료 화면에서도 재사용한다.
export function CRDisplayGrid({
  display,
}: {
  display: Record<string, number>;
}) {
  // 정해진 동물 순서 먼저, 서버가 보낸 낯선 키는 뒤에 그대로
  const known = CR_ANIMALS.filter((a) => (display[a] ?? 0) > 0);
  const extra = Object.keys(display).filter(
    (a) => !CR_ANIMALS.includes(a as (typeof CR_ANIMALS)[number]) &&
      (display[a] ?? 0) > 0,
  );
  const entries = [...known, ...extra];
  if (entries.length === 0) {
    return <span className="cr-display-empty">진열 없음</span>;
  }
  return (
    <div className="cr-display">
      {entries.map((animal) => {
        const count = display[animal] ?? 0;
        const meta = crAnimalMeta(animal);
        const level =
          count >= CR_LOSE_COUNT ? 'danger' : count >= CR_WARN_COUNT ? 'warn' : '';
        return (
          <span
            key={animal}
            className={`cr-display-cell ${level}`}
            title={`${meta.label} ${count}장${
              count === CR_WARN_COUNT ? ' — 1장만 더 모이면 패배!' : ''
            }`}
          >
            <span className="cr-display-emoji">{meta.emoji}</span>
            <span className="cr-display-count">×{count}</span>
          </span>
        );
      })}
    </div>
  );
}

// 동물 선언 선택 그리드 (8종) — 전달·릴레이 오버레이 공용
function CRAnimalPicker({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (animal: string) => void;
}) {
  return (
    <div className="cr-animal-grid">
      {CR_ANIMALS.map((animal) => {
        const meta = crAnimalMeta(animal);
        return (
          <button
            key={animal}
            type="button"
            className={`cr-animal-option ${value === animal ? 'selected' : ''}`}
            onClick={() => onPick(animal)}
          >
            <span className="cr-animal-option-emoji">{meta.emoji}</span>
            <span className="cr-animal-option-label">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CockroachBoard({
  game,
  peek,
  toasts,
  onPassCard,
  onRelay,
  onJudge,
}: CockroachBoardProps) {
  const players = game.players ?? [];
  const chain = game.chain ?? [];
  const hand = game.yourHand ?? [];
  const isSpectator = game.yourSeat < 0;
  const isPassing = game.phase === 'passing';
  const isDeciding = game.phase === 'deciding';
  const myPass = isPassing && !isSpectator && game.passerSeat === game.yourSeat;
  const iAmHolder =
    isDeciding && !isSpectator && game.holderSeat === game.yourSeat;

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  // 릴레이 경로 — 원 전달자 → 경유 좌석들 → 현재 결정권자.
  // chain 이 원 전달자를 포함하든 안 하든 중복 없이 한 줄로 읽히게 만든다.
  const routeSeats = useMemo(() => {
    const seats: number[] = [];
    for (const s of [game.passerSeat, ...chain, game.holderSeat]) {
      if (s < 0 || seats.includes(s)) continue;
      seats.push(s);
    }
    return seats;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.passerSeat, game.holderSeat, chain.join(',')]);

  // 나에게 카드를 직접 건넨 사람 = 경로에서 내 바로 앞 사람
  const handedBySeat =
    routeSeats.length >= 2 ? routeSeats[routeSeats.length - 2] : game.passerSeat;

  // 넘기기 가능 대상 — 아직 카드를 못 본 사람 (나·원 전달자·경유자 제외)
  const relayTargets = players.filter(
    (p) =>
      p.seat !== game.yourSeat &&
      p.seat !== game.passerSeat &&
      !chain.includes(p.seat),
  );
  const canRelay = iAmHolder && relayTargets.length > 0;

  // 전달 대상 — 나를 제외한 전원
  const passTargets = players.filter((p) => p.seat !== game.yourSeat);

  // ---------- 로컬 UI 상태 ----------
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지
  const [submitted, setSubmitted] = useState(false);
  // 전달자: 선택한 손패 인덱스 (같은 동물이 여러 장이라 인덱스로 추적)
  const [passIdx, setPassIdx] = useState<number | null>(null);
  const [passTarget, setPassTarget] = useState<number | null>(null);
  const [passClaim, setPassClaim] = useState<string | null>(null);
  // 결정권자: 넘기기 확인 패널 열림 여부 + 대상·선언
  const [relayOpen, setRelayOpen] = useState(false);
  const [relayTarget, setRelayTarget] = useState<number | null>(null);
  const [relayClaim, setRelayClaim] = useState<string | null>(null);

  // 턴 컨텍스트가 바뀌면 (스냅샷 반영) 로컬 선택·잠금을 전부 리셋한다
  const chainKey = chain.join(',');
  useEffect(() => {
    setSubmitted(false);
    setPassIdx(null);
    setPassTarget(null);
    setPassClaim(null);
    setRelayOpen(false);
    setRelayTarget(null);
    setRelayClaim(null);
  }, [
    game.phase,
    game.passerSeat,
    game.holderSeat,
    game.claim,
    chainKey,
    hand.length,
  ]);

  // cr_peek 는 서버가 deciding 진입 시 선제 발송한다 — 실물은
  // [몰래 보고 넘기기]를 눌러 패널을 연 뒤에만 화면에 노출한다
  // (수신만으로 패널을 열면 판정 선택을 건너뛰게 된다).

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

  // ---------- 핸들러 ----------
  const passCard = passIdx !== null ? (hand[passIdx] ?? null) : null;

  const handleSendPass = () => {
    if (submitted || !myPass) return;
    if (passCard === null || passTarget === null || passClaim === null) return;
    setSubmitted(true);
    onPassCard(passCard, passTarget, passClaim);
  };

  const handleSendRelay = () => {
    if (submitted || !iAmHolder) return;
    if (relayTarget === null || relayClaim === null) return;
    setSubmitted(true);
    onRelay(relayTarget, relayClaim);
  };

  const handleJudge = (truth: boolean) => {
    if (submitted || !iAmHolder || relayOpen) return;
    setSubmitted(true);
    onJudge(truth);
  };

  // 상단 배너 보조 문구
  const bannerSub = myPass
    ? '손패에서 카드 1장을 골라, 대상과 선언을 정해 건네세요'
    : isPassing
      ? `🂠 ${nameOf(game.passerSeat)}님이 건넬 카드를 고르는 중…`
      : iAmHolder
        ? relayOpen
          ? '카드를 몰래 확인했습니다 — 새 선언으로 다른 사람에게 넘기세요'
          : '선언이 참인지 거짓인지 판정하거나, 몰래 보고 넘기세요'
        : isDeciding
          ? `🤔 ${nameOf(game.holderSeat)}님이 판정을 고민하는 중…`
          : '';

  const claimMeta = crAnimalMeta(game.claim);
  const peekMeta = peek !== null ? crAnimalMeta(peek) : null;

  return (
    <div className="cr-board">
      <div className="cr-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="cr-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="cr-phase-banner">
        <span className="cr-phase-title">
          🪳 바퀴벌레 포커 · 블러핑 전달
          {(isPassing || isDeciding) && game.endsAt > 0 && (
            <span
              className={`cr-deadline ${remaining < 10_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="cr-phase-sub">{bannerSub}</span>}
      </div>

      {/* 릴레이 체인 — 원 전달자 → 경유 → 결정권자 + 선언 뱃지 */}
      {isDeciding && routeSeats.length >= 2 && (
        <div className="cr-chain">
          <span className="cr-chain-route">
            {routeSeats.map((seat, i) => (
              <span key={seat} className="cr-chain-step">
                {i > 0 && (
                  <span className="cr-chain-arrow" aria-hidden="true">
                    →
                  </span>
                )}
                <span
                  className={`cr-chain-name ${
                    seat === game.holderSeat
                      ? 'holder'
                      : i === 0
                        ? 'origin'
                        : ''
                  }`}
                >
                  {nameOf(seat)}
                  {seat === game.yourSeat && ' (나)'}
                </span>
              </span>
            ))}
          </span>
          {game.claim && (
            <span className="cr-chain-claim" title="현재 선언">
              {claimMeta.emoji} 「{claimMeta.label}」
            </span>
          )}
        </div>
      )}

      {/* 결정권자 화면 — 큰 선언 카드 + 판정/넘기기 */}
      {iAmHolder && !relayOpen && (
        <div className="cr-decide">
          <div className="cr-claim-card">
            <span className="cr-claim-emoji" aria-hidden="true">
              {claimMeta.emoji}
            </span>
            <span className="cr-claim-text">{crClaimText(game.claim)}</span>
            <span className="cr-claim-from">
              {nameOf(handedBySeat)}님이 건넸습니다
            </span>
          </div>
          <div className="cr-judge-actions">
            <button
              type="button"
              className="cr-judge-button true"
              onClick={() => handleJudge(true)}
              disabled={submitted}
            >
              참이다
            </button>
            <button
              type="button"
              className="cr-judge-button false"
              onClick={() => handleJudge(false)}
              disabled={submitted}
            >
              거짓이다
            </button>
          </div>
          {canRelay ? (
            <button
              type="button"
              className="cr-relay-open-button"
              onClick={() => setRelayOpen(true)}
              disabled={submitted}
            >
              👀 몰래 보고 넘기기
            </button>
          ) : (
            <p className="cr-decide-hint">
              더 넘길 사람이 없습니다 — 판정만 가능합니다
            </p>
          )}
          <p className="cr-decide-note">
            틀리면 이 카드가 내 진열에 쌓입니다 (같은 동물 {CR_LOSE_COUNT}장 =
            패배)
          </p>
        </div>
      )}

      {/* 넘기기 확인 패널 — cr_peek 실물 + 대상·선언 선택 */}
      {iAmHolder && relayOpen && (
        <div className="cr-panel">
          <span className="cr-panel-title">👀 몰래 확인한 실물</span>
          {peekMeta ? (
            <div className="cr-real-card">
              <span className="cr-real-emoji" aria-hidden="true">
                {peekMeta.emoji}
              </span>
              <span className="cr-real-label">{peekMeta.label}</span>
            </div>
          ) : (
            <p className="cr-panel-waiting">실물 확인 중…</p>
          )}
          <p className="cr-panel-note">
            이 카드를 새 선언으로 넘깁니다 — 카드를 본 뒤에는 판정으로 돌아갈
            수 없습니다
          </p>

          <div className="cr-pick-group">
            <span className="cr-pick-label">누구에게 넘길까요?</span>
            <div className="cr-target-row">
              {relayTargets.map((p) => (
                <button
                  key={p.seat}
                  type="button"
                  className={`cr-target-option ${
                    relayTarget === p.seat ? 'selected' : ''
                  }`}
                  onClick={() => setRelayTarget(p.seat)}
                >
                  {p.name}
                  {p.bot && ' 🤖'}
                </button>
              ))}
            </div>
          </div>

          <div className="cr-pick-group">
            <span className="cr-pick-label">뭐라고 선언할까요?</span>
            <CRAnimalPicker value={relayClaim} onPick={setRelayClaim} />
          </div>

          <button
            type="button"
            className="cr-send-button"
            onClick={handleSendRelay}
            disabled={submitted || relayTarget === null || relayClaim === null}
          >
            {relayTarget !== null && relayClaim !== null
              ? `${nameOf(relayTarget)}님에게 「${
                  crAnimalMeta(relayClaim).label
                }」라고 넘기기`
              : '대상과 선언을 고르세요'}
          </button>
          {peek === null && (
            <button
              type="button"
              className="cr-back-button"
              onClick={() => setRelayOpen(false)}
            >
              돌아가서 판정하기
            </button>
          )}
        </div>
      )}

      {/* 전달자 화면 — 카드를 골랐으면 대상·선언 오버레이 패널 */}
      {myPass && passIdx !== null && passCard !== null && (
        <div className="cr-panel">
          <span className="cr-panel-title">🂠 이 카드를 건넵니다</span>
          <div className="cr-real-card">
            <span className="cr-real-emoji" aria-hidden="true">
              {crAnimalMeta(passCard).emoji}
            </span>
            <span className="cr-real-label">{crAnimalMeta(passCard).label}</span>
          </div>
          <p className="cr-panel-note">
            실물은 나만 봅니다 — 선언은 거짓말이어도 됩니다
          </p>

          <div className="cr-pick-group">
            <span className="cr-pick-label">누구에게 건넬까요?</span>
            <div className="cr-target-row">
              {passTargets.map((p) => (
                <button
                  key={p.seat}
                  type="button"
                  className={`cr-target-option ${
                    passTarget === p.seat ? 'selected' : ''
                  }`}
                  onClick={() => setPassTarget(p.seat)}
                >
                  {p.name}
                  {p.bot && ' 🤖'}
                </button>
              ))}
            </div>
          </div>

          <div className="cr-pick-group">
            <span className="cr-pick-label">뭐라고 선언할까요?</span>
            <CRAnimalPicker value={passClaim} onPick={setPassClaim} />
          </div>

          <button
            type="button"
            className="cr-send-button"
            onClick={handleSendPass}
            disabled={submitted || passTarget === null || passClaim === null}
          >
            {passTarget !== null && passClaim !== null
              ? `${nameOf(passTarget)}님에게 「${
                  crAnimalMeta(passClaim).label
                }」라고 건네기`
              : '대상과 선언을 고르세요'}
          </button>
          <button
            type="button"
            className="cr-back-button"
            onClick={() => setPassIdx(null)}
          >
            다른 카드 고르기
          </button>
        </div>
      )}

      {/* 내 손패 (본인만) — 전달 차례에만 탭 가능 */}
      {!isSpectator && (
        <div className="cr-hand-wrap">
          <span className="cr-hand-label">
            내 손패 {hand.length}장 (나만 보입니다)
            {myPass && hand.length > 0 && ' — 건넬 카드를 탭하세요'}
          </span>
          {hand.length > 0 ? (
            <div className="cr-hand">
              {hand.map((animal, i) => {
                const meta = crAnimalMeta(animal);
                return (
                  <button
                    key={`${animal}-${i}`}
                    type="button"
                    className={`cr-hand-card ${
                      myPass && passIdx === i ? 'selected' : ''
                    }`}
                    disabled={!myPass || submitted}
                    onClick={() => setPassIdx(i)}
                    title={meta.label}
                  >
                    <span className="cr-hand-emoji" aria-hidden="true">
                      {meta.emoji}
                    </span>
                    <span className="cr-hand-name">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="cr-hand-empty">
              손패가 없습니다 — 내 차례가 오면 패배합니다!
            </span>
          )}
        </div>
      )}
      {isSpectator && (
        <p className="cr-spectator-note">
          👀 관전 중 — 손패와 릴레이 카드 실물은 보이지 않습니다
        </p>
      )}

      {/* 좌석 타일 — 진열 그리드 (동물 이모지 × 개수) */}
      <div className="cr-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isActor =
            (isPassing && p.seat === game.passerSeat) ||
            (isDeciding && p.seat === game.holderSeat);
          const offline = !p.connected && !p.bot;
          return (
            <div
              key={p.seat}
              className={[
                'cr-tile',
                isActor ? 'current' : '',
                isMe ? 'me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="cr-tile-head">
                <span className="cr-tile-name">
                  {isActor && <span className="cr-tile-turn">▶</span>}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="cr-tile-hand" title="남은 손패 장수">
                  🂠 {p.handCount}장
                </span>
              </div>
              <div className="cr-tile-badges">
                {p.bot && <span className="cr-badge">🤖 봇</span>}
                {offline && <span className="cr-badge off">끊김</span>}
                {isDeciding && p.seat === game.passerSeat && (
                  <span className="cr-badge">전달자</span>
                )}
                {isDeciding && chain.includes(p.seat) &&
                  p.seat !== game.holderSeat && (
                    <span className="cr-badge">경유</span>
                  )}
              </div>
              <CRDisplayGrid display={p.display ?? {}} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
