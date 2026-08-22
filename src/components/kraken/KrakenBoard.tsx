import { useEffect, useState } from 'react';
import type {
  KRCard,
  KREvent,
  KRGameState,
  KRPlayerView,
} from '../../types/kraken';
import {
  KR_CARD_ICON,
  KR_CARD_LABEL,
  KR_ROLE_ICON,
  KR_ROLE_LABEL,
  KR_ROLE_POOL,
  KR_TOTAL_ROUNDS,
} from '../../types/kraken';
import type { KRToast } from '../../hooks/useKrakenGameState';
import './KrakenBoard.css';

interface KrakenBoardProps {
  game: KRGameState;
  toasts: KRToast[];
  // 지목 — 타 좌석의 미공개 카드 1장을 뒤집는다
  onPoint: (targetSeat: number, cardIndex: number) => void;
  // 손패 선언 (거짓 가능) — 꽝 수는 남은 장수에서 자동 계산된다
  onClaim: (treasure: number, kraken: number) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: KREvent, game: KRGameState): string {
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
      return '🃏 카드를 다시 나눕니다';
    case 'round_end':
      return '🌀 라운드 종료 — 남은 카드를 회수합니다';
    case 'claim':
      return `${name(event.seat)}님이 손패를 선언했습니다`;
    case 'auto_point':
      return '⏳ 시간 초과 — 무작위로 지목되었습니다';
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

export function KrakenBoard({
  game,
  toasts,
  onPoint,
  onClaim,
}: KrakenBoardProps) {
  // 카드 탭 → 확인 흐름의 로컬 선택 상태 (좌석 + 카드 인덱스)
  const [selected, setSelected] = useState<{
    seat: number;
    index: number;
  } | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지 (지목·선언 공용).
  // 서버가 거부(kr_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 진행 여부는 스냅샷(currentSeat·revealsLeft)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 선언 입력 초안 (보물 수 스테퍼 + 크라켄 토글)
  const [claimTreasure, setClaimTreasure] = useState(0);
  const [claimKraken, setClaimKraken] = useState(false);

  const players = game.players ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)는 지목·선언 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;
  const yourHand = game.yourHand ?? [];
  const found = game.found ?? { treasure: 0, treasureTotal: 0, kraken: 0 };
  const role = game.yourRole ?? '';
  const pool = game.rolePool ?? KR_ROLE_POOL[players.length] ?? null;

  // 스냅샷 컨텍스트(라운드·지목권·남은 공개 수)가 바뀌면 로컬 선택과
  // 연타 잠금을 리셋한다 — 남아 있던 선택이 다음 상황에 잘못 확정되지 않게.
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [game.round, game.currentSeat, game.revealsLeft, game.phase]);

  // 라운드가 바뀌면 카드가 재배분되고 서버 선언도 초기화된다 → 초안도 리셋
  useEffect(() => {
    setClaimTreasure(0);
    setClaimKraken(false);
  }, [game.round]);

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

  const isRevealing = game.phase === 'revealing';
  const isRoundEnd = game.phase === 'round_end';
  const isMyTurn = isRevealing && !isSpectator && game.currentSeat === game.yourSeat;
  const canPoint = isMyTurn && !submitted;

  const canTarget = (p: KRPlayerView) =>
    canPoint && p.seat !== game.yourSeat && p.handCount > 0;

  const handleCardTap = (p: KRPlayerView, index: number) => {
    if (!canTarget(p)) return;
    setSelected((prev) =>
      prev && prev.seat === p.seat && prev.index === index
        ? null
        : { seat: p.seat, index },
    );
  };

  const handleConfirmPoint = () => {
    if (!selected || !canPoint) return;
    lockSubmit();
    onPoint(selected.seat, selected.index);
    setSelected(null);
  };

  // 선언은 내 차례가 아니어도 언제든 낼 수 있다 (거짓 허용·구속력 없음)
  const maxTreasure = yourHand.length;
  const claimBlank = Math.max(
    0,
    maxTreasure - claimTreasure - (claimKraken ? 1 : 0),
  );
  const claimOverflow = claimTreasure + (claimKraken ? 1 : 0) > maxTreasure;
  const canClaim =
    !isSpectator && isRevealing && maxTreasure > 0 && !claimOverflow;

  const handleClaim = () => {
    if (!canClaim) return;
    onClaim(claimTreasure, claimKraken ? 1 : 0);
  };

  // 공개 진척 바
  const treasureTotal = Math.max(1, found.treasureTotal);
  const treasurePct = Math.min(100, (found.treasure / treasureTotal) * 100);

  const reveal = game.lastReveal ?? null;
  // 스냅샷마다 key 를 갈아 끼워 플립 연출을 다시 돌린다
  const revealKey = reveal
    ? `${game.round}-${game.revealsLeft}-${reveal.seat}-${reveal.bySeat}-${reveal.card}`
    : 'none';

  const headline = (() => {
    if (isRoundEnd) return '🌀 라운드 정산';
    if (isSpectator) return `${nameOf(game.currentSeat)}님이 지목 중`;
    if (isMyTurn) return '🎯 내 차례 — 카드를 지목하세요';
    return `${nameOf(game.currentSeat)}님이 지목 중`;
  })();

  const subline = (() => {
    if (isRoundEnd)
      return '남은 카드를 모두 회수해 다음 라운드에 다시 나눕니다';
    if (isSpectator) return '관전 중 — 카드 내용은 공개된 것만 보입니다';
    if (isMyTurn)
      return '자기 자신을 제외한 다른 참가자의 뒷면 카드 1장을 탭하세요';
    return '토론으로 정보를 나누고, 지목권이 오길 기다리세요';
  })();

  return (
    <div className="kr-scope kr-board">
      <div className="kr-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="kr-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 라운드 / 남은 공개 수 / 카운트다운 */}
      <div className={`kr-status-bar ${game.phase}`}>
        <div className="kr-status-row">
          <span className="kr-status-chip">
            라운드 {game.round}/{KR_TOTAL_ROUNDS}
          </span>
          <span className="kr-status-chip">남은 공개 {game.revealsLeft}</span>
          {game.endsAt > 0 && (
            <span
              className={`kr-timer ${remaining <= 10_000 ? 'urgent' : ''}`}
            >
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="kr-status-title">{headline}</span>
        <span className="kr-status-sub">{subline}</span>
      </div>

      {/* 공개 진척 — 보물 n/N + 크라켄 표시 */}
      <div className="kr-progress">
        <div className="kr-progress-head">
          <span className="kr-progress-label">
            💎 보물 {found.treasure}/{found.treasureTotal}
          </span>
          <span
            className={`kr-kraken-mark ${found.kraken > 0 ? 'hit' : ''}`}
            title="크라켄 공개 여부"
          >
            {found.kraken > 0 ? '🐙 크라켄 공개!' : '☠ 크라켄 미공개'}
          </span>
        </div>
        <div className="kr-progress-track">
          <div className="kr-progress-fill" style={{ width: `${treasurePct}%` }} />
        </div>
      </div>

      {/* 내 역할 카드 — 본인만 (은닉 스냅샷: 관전자는 yourRole 부재) */}
      {!isSpectator && role !== '' && (
        <div key={`role-${role}`} className={`kr-role-card role-${role}`}>
          <div className="kr-role-head">
            <span className="kr-role-icon">{KR_ROLE_ICON[role]}</span>
            <span className="kr-role-name">{KR_ROLE_LABEL[role]}</span>
          </div>
          <p className="kr-role-desc">
            {role === 'expedition'
              ? '보물 전부를 찾아내면 이깁니다 — 크라켄이 열리면 집니다'
              : '크라켄을 열게 유도하거나 4라운드까지 시간을 끄세요'}
          </p>
          {pool && (
            <p className="kr-role-pool">
              역할 풀 🗺 {pool.expedition} · 💀 {pool.skeleton} (총{' '}
              {pool.expedition + pool.skeleton}장 중 {players.length}장만 배분 —
              실제 진영 구성은 아무도 모릅니다)
            </p>
          )}
        </div>
      )}
      {isSpectator && (
        <div className="kr-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {/* 공개 연출 — 방금 뒤집힌 카드 */}
      {reveal && (
        <div key={revealKey} className={`kr-reveal card-${reveal.card}`}>
          <span className="kr-reveal-card">{KR_CARD_ICON[reveal.card]}</span>
          <span className="kr-reveal-text">
            {reveal.message ??
              `${nameOf(reveal.bySeat)} → ${nameOf(reveal.seat)}님의 카드: ${
                KR_CARD_LABEL[reveal.card]
              }`}
          </span>
        </div>
      )}

      {/* 라운드 정산 */}
      {isRoundEnd && (
        <div className="kr-round-end">
          <span className="kr-round-end-title">
            라운드 {game.round} 종료
          </span>
          <span className="kr-round-end-sub">
            {game.round < KR_TOTAL_ROUNDS
              ? `잠시 후 라운드 ${game.round + 1} — 각자 ${Math.max(
                  1,
                  6 - (game.round + 1),
                )}장씩 다시 받습니다`
              : '마지막 라운드가 끝났습니다'}
          </span>
        </div>
      )}

      {/* 내 손패 — 뒷면 카드 위에 나만 보이는 내용 배지 */}
      {!isSpectator && (
        <div className="kr-my-hand">
          <div className="kr-section-head">
            <span className="kr-section-title">내 손패</span>
            <span className="kr-section-note">
              {yourHand.length > 0
                ? '나만 볼 수 있습니다'
                : '남은 카드가 없습니다'}
            </span>
          </div>
          <div className="kr-hand-row">
            {yourHand.map((card: KRCard, i) => (
              <div key={i} className={`kr-hand-card card-${card}`}>
                <span className="kr-hand-icon">{KR_CARD_ICON[card]}</span>
                <span className="kr-hand-label">{KR_CARD_LABEL[card]}</span>
              </div>
            ))}
            {yourHand.length === 0 && (
              <span className="kr-hand-empty">— 전부 공개되었습니다 —</span>
            )}
          </div>
        </div>
      )}

      {/* 좌석 그리드 — 미공개 카드 뒷면 버튼 × handCount */}
      <div className="kr-seats">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const offline = !p.connected && !p.bot;
          const revealed = p.revealedThisRound ?? [];
          const claim = p.claim ?? null;
          const targetable = canTarget(p);
          return (
            <div
              key={p.seat}
              className={[
                'kr-seat',
                isMe ? 'me' : '',
                p.seat === game.currentSeat ? 'active' : '',
                targetable ? 'targetable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="kr-seat-head">
                <span className="kr-seat-name">
                  {p.seat === game.currentSeat && '🎯 '}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="kr-seat-badges">
                  {p.bot && <span className="kr-badge">🤖</span>}
                  {offline && <span className="kr-badge off">끊김</span>}
                  <span className="kr-badge count">{p.handCount}장</span>
                </span>
              </div>

              {/* 미공개 카드 뒷면 — 내 차례에 탭하면 하단 확정 바가 뜬다 */}
              <div className="kr-back-row">
                {Array.from({ length: Math.max(0, p.handCount) }).map(
                  (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={[
                        'kr-back-card',
                        targetable ? 'selectable' : '',
                        selected &&
                        selected.seat === p.seat &&
                        selected.index === i
                          ? 'selected'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleCardTap(p, i)}
                      disabled={!targetable}
                      aria-label={`${p.name}님의 ${i + 1}번째 카드`}
                    >
                      🂠
                    </button>
                  ),
                )}
                {p.handCount === 0 && (
                  <span className="kr-back-empty">카드 없음</span>
                )}
              </div>

              {/* 이번 라운드에 이 좌석에서 나온 카드 */}
              {revealed.length > 0 && (
                <div className="kr-revealed-row">
                  {revealed.map((card, i) => (
                    <span
                      key={i}
                      className={`kr-revealed-chip card-${card}`}
                      title={KR_CARD_LABEL[card]}
                    >
                      {KR_CARD_ICON[card]}
                    </span>
                  ))}
                </div>
              )}

              {/* 선언 pill — 거짓일 수 있다 */}
              {claim && (
                <span className="kr-claim-pill">
                  선언 💎 {claim.treasure}
                  {claim.kraken ? ' · 🐙 있음' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 선언 입력 — 보물 수 스테퍼 + 크라켄 토글 */}
      {!isSpectator && isRevealing && yourHand.length > 0 && (
        <div className="kr-claim-box">
          <div className="kr-section-head">
            <span className="kr-section-title">손패 선언</span>
            <span className="kr-section-note">거짓말해도 됩니다</span>
          </div>
          <div className="kr-claim-controls">
            <div className="kr-stepper">
              <button
                type="button"
                className="kr-step-button"
                onClick={() => setClaimTreasure((v) => Math.max(0, v - 1))}
                disabled={claimTreasure <= 0}
                aria-label="보물 수 줄이기"
              >
                −
              </button>
              <span className="kr-step-value">💎 {claimTreasure}</span>
              <button
                type="button"
                className="kr-step-button"
                onClick={() =>
                  setClaimTreasure((v) => Math.min(maxTreasure, v + 1))
                }
                disabled={claimTreasure >= maxTreasure}
                aria-label="보물 수 늘리기"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className={`kr-toggle ${claimKraken ? 'on' : ''}`}
              onClick={() => setClaimKraken((v) => !v)}
              aria-pressed={claimKraken}
            >
              🐙 크라켄 {claimKraken ? '있음' : '없음'}
            </button>
          </div>
          <p className="kr-claim-summary">
            {claimOverflow
              ? `손패는 ${maxTreasure}장뿐입니다 — 수를 줄여주세요`
              : `💎 ${claimTreasure} · 🐙 ${claimKraken ? 1 : 0} · ⬜ ${claimBlank} (총 ${maxTreasure}장)`}
          </p>
          <button
            type="button"
            className="kr-claim-button"
            onClick={handleClaim}
            disabled={!canClaim}
          >
            선언하기
          </button>
        </div>
      )}

      {/* 하단 확정 바 — 카드 탭 후 지목 확정 */}
      {selected && canPoint && (
        <div className="kr-confirm-bar">
          <span className="kr-confirm-text">
            {nameOf(selected.seat)}님의 {selected.index + 1}번째 카드를
            뒤집을까요?
          </span>
          <div className="kr-confirm-actions">
            <button
              type="button"
              className="kr-confirm-button"
              onClick={handleConfirmPoint}
            >
              지목
            </button>
            <button
              type="button"
              className="kr-cancel-button"
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
