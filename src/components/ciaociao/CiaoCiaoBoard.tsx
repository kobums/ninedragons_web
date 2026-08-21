import { useEffect, useState } from 'react';
import type { CCEvent, CCGameState, CCLastReveal } from '../../types/ciaociao';
import {
  CC_BRIDGE_LEN,
  CC_PIP_CELLS,
  CC_WIN_CROSSED,
  ccClampPos,
} from '../../types/ciaociao';
import type { CCToast } from '../../hooks/useCiaoCiaoGameState';
import './CiaoCiaoBoard.css';

interface CiaoCiaoBoardProps {
  game: CCGameState;
  toasts: CCToast[];
  onDeclare: (value: number) => void;
  onDoubt: () => void;
  onAllow: () => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: CCEvent, game: CCGameState): string {
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
    case 'declared':
      return `${name(event.seat)}님이 선언했습니다`;
    case 'doubt':
      return `${name(event.seat)}님이 의심합니다!`;
    case 'allow':
      return `${name(event.seat)}님이 믿기로 했습니다`;
    case 'eliminated':
      return `${name(event.seat)}님이 말을 전부 잃어 탈락했습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 주사위 한 개 — 1~4는 3×3 CSS 도트, 0(X)은 ☠ (YachtBoard 도트 결)
export function CCDie({
  value,
  size = 'md',
}: {
  value: number;
  size?: 'md' | 'sm';
}) {
  const isX = value === 0;
  return (
    <span
      className={`cc-die ${size === 'sm' ? 'sm' : ''} ${isX ? 'x' : ''}`}
      role="img"
      aria-label={isX ? '주사위 X' : `주사위 ${value}`}
    >
      {isX ? (
        <span className="cc-die-skull" aria-hidden="true">
          ☠
        </span>
      ) : (
        <span className="cc-die-face" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className={`cc-pip-cell ${
                (CC_PIP_CELLS[value] ?? []).includes(i) ? 'on' : ''
              }`}
            />
          ))}
        </span>
      )}
    </span>
  );
}

// 판정 결과 문구 — 서버 message 우선, 없으면 로컬 조립
function revealText(reveal: CCLastReveal, nameOf: (s: number) => string): string {
  if (reveal.message) return reveal.message;
  const doubter = reveal.doubterSeat ?? -1;
  const lied = reveal.actual === 0 || reveal.declared !== reveal.actual;
  if (doubter < 0) {
    return `모두 믿었습니다 — ${nameOf(reveal.seat)}님의 말이 ${reveal.declared}칸 전진`;
  }
  return lied
    ? `${nameOf(doubter)}님의 의심 적중! ${nameOf(reveal.seat)}님의 말이 다리에서 떨어졌습니다 💨`
    : `의심 실패! ${nameOf(doubter)}님의 말이 떨어지고, ${nameOf(reveal.seat)}님은 ${reveal.declared}칸 전진`;
}

export function CiaoCiaoBoard({
  game,
  toasts,
  onDeclare,
  onDoubt,
  onAllow,
}: CiaoCiaoBoardProps) {
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(cc_error)해도 단계 필드가 바뀌면 풀려 재시도할 수 있다.
  const [submitted, setSubmitted] = useState(false);
  // 의심 창에서 내가 이미 [믿는다] 를 눌렀는지 (버튼 잠금 + 안내)
  const [judged, setJudged] = useState<'doubt' | 'allow' | null>(null);

  const players = game.players ?? [];
  const bridgeLen = game.bridgeLen ?? CC_BRIDGE_LEN;
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const isRolling = game.phase === 'rolling';
  const isDoubtWindow = game.phase === 'doubt_window';
  const myTurn =
    isRolling && !isSpectator && game.currentSeat === game.yourSeat;
  // 내 차례인데 서버 개인화 스냅샷이 아직 값을 안 실었을 수 있다 — undefined 방어
  const hasRoll = myTurn && typeof game.yourRoll === 'number';
  const rolledX = hasRoll && game.yourRoll === 0;
  // 의심 창 판단 자격: 좌석 보유 + 생존 + 선언자 본인 아님
  const canJudge =
    isDoubtWindow &&
    !isSpectator &&
    (me?.alive ?? false) &&
    game.currentSeat !== game.yourSeat;

  // 단계·차례·선언이 바뀌면 연타 잠금을 푼다
  useEffect(() => {
    setSubmitted(false);
    setJudged(null);
  }, [game.phase, game.currentSeat, game.declared, game.endsAt]);

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
  const seconds = Math.ceil(remaining / 1000);

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  const handleDeclare = (value: number) => {
    if (!myTurn || submitted) return;
    setSubmitted(true);
    onDeclare(value);
  };

  const handleDoubt = () => {
    if (!canJudge || judged) return;
    setJudged('doubt');
    onDoubt();
  };

  const handleAllow = () => {
    if (!canJudge || judged) return;
    setJudged('allow');
    onAllow();
  };

  // 상단 배너 보조 문구
  const bannerSub = myTurn
    ? rolledX
      ? '☠ X가 나왔습니다 — 반드시 거짓 선언!'
      : '컵 속 주사위는 나만 봅니다 — 값을 선언하세요 (거짓말 가능)'
    : isRolling
      ? `🎲 ${nameOf(game.currentSeat)}님이 컵 속 주사위를 확인하는 중…`
      : isDoubtWindow
        ? canJudge
          ? `${nameOf(game.currentSeat)}님의 「${game.declared ?? '?'}」 선언 — 믿을까요?`
          : `다른 플레이어들이 ${nameOf(game.currentSeat)}님의 선언을 판단하는 중…`
        : '';

  // 판정 공개 — 내용이 바뀔 때마다 카드 뒤집힘 연출을 다시 튼다
  const reveal = game.lastReveal ?? null;
  const revealKey = reveal
    ? `${reveal.seat}-${reveal.declared}-${reveal.actual}-${
        reveal.doubterSeat ?? -1
      }-${reveal.result ?? ''}`
    : '';
  const revealLied =
    reveal !== null &&
    (reveal.actual === 0 || reveal.declared !== reveal.actual);
  const revealDropSeat = reveal
    ? (reveal.doubterSeat ?? -1) < 0
      ? -1
      : revealLied
        ? reveal.seat
        : (reveal.doubterSeat ?? -1)
    : -1;

  // 다리 칸별 말 토큰 (좌석 색) — onBridge 위치는 1~bridgeLen 으로 접는다
  const pawnsAt = (cell: number) =>
    players.flatMap((p) =>
      (p.onBridge ?? [])
        .filter((pos) => ccClampPos(pos, bridgeLen) === cell)
        .map((pos, i) => ({ seat: p.seat, key: `${p.seat}-${pos}-${i}` })),
    );

  return (
    <div className="cc-board">
      <div className="cc-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="cc-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="cc-phase-banner">
        <span className="cc-phase-title">
          🌉 차오차오 · 말 {CC_WIN_CROSSED}개 먼저 통과
          {game.endsAt > 0 && (
            <span className={`cc-deadline ${remaining < 5_000 ? 'urgent' : ''}`}>
              ⏱ {seconds}초
            </span>
          )}
        </span>
        {bannerSub && <span className="cc-phase-sub">{bannerSub}</span>}
      </div>

      {/* 판정 공개 연출 — 실제 값 카드가 뒤집히며 결과가 공개된다 */}
      {reveal && (
        <div key={revealKey} className="cc-reveal">
          <div className="cc-reveal-dice">
            <div className="cc-reveal-slot">
              <span className="cc-reveal-label">선언</span>
              <CCDie value={reveal.declared} size="sm" />
            </div>
            <span className="cc-reveal-vs">→</span>
            <div className="cc-reveal-slot">
              <span className="cc-reveal-label">실제</span>
              <span className="cc-reveal-flip">
                <CCDie value={reveal.actual} size="sm" />
              </span>
            </div>
          </div>
          <p className={`cc-reveal-text ${revealLied ? 'lied' : 'honest'}`}>
            {revealText(reveal, nameOf)}
            {revealDropSeat >= 0 && (
              <span
                className={`cc-pawn cc-reveal-drop cc-seat-color-${revealDropSeat % 4}`}
                aria-hidden="true"
              />
            )}
          </p>
        </div>
      )}

      {/* 다리 — 가로 7칸 트랙 + 통과 🏁 존 */}
      <div className="cc-bridge-wrap">
        <div className="cc-bridge" role="img" aria-label="다리 트랙">
          <div className="cc-bridge-end start">
            <span className="cc-bridge-end-icon">⛺</span>
            <span className="cc-bridge-end-label">출발</span>
          </div>
          {Array.from({ length: bridgeLen }).map((_, i) => {
            const cell = i + 1;
            const pawns = pawnsAt(cell);
            return (
              <div key={cell} className="cc-cell">
                <span className="cc-cell-num" aria-hidden="true">
                  {cell}
                </span>
                {pawns.length > 0 && (
                  <span className="cc-cell-pawns">
                    {pawns.map((pw) => (
                      <span
                        key={pw.key}
                        className={`cc-pawn cc-seat-color-${pw.seat % 4}`}
                        title={nameOf(pw.seat)}
                      />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
          <div className="cc-bridge-end goal">
            <span className="cc-bridge-end-icon">🏁</span>
            <span className="cc-bridge-end-label">통과</span>
            <span className="cc-goal-flags">
              {players
                .filter((p) => p.crossed > 0)
                .map((p) => (
                  <span key={p.seat} className="cc-goal-flag" title={p.name}>
                    <span
                      className={`cc-pawn cc-seat-color-${p.seat % 4}`}
                      aria-hidden="true"
                    />
                    ×{p.crossed}
                  </span>
                ))}
            </span>
          </div>
        </div>
        <p className="cc-bridge-hint">
          널빤지 다리 {bridgeLen}칸 — 끝을 넘으면 통과, 거짓이 들키면 낙하 💨
        </p>
      </div>

      {/* 내 차례 rolling — 컵 + 나만 보이는 주사위 + 선언 버튼 */}
      {myTurn && (
        <div className="cc-roll-panel">
          <div className="cc-cup-row">
            <span className="cc-cup" aria-hidden="true">
              <span className="cc-cup-body" />
              <span className="cc-cup-rim" />
            </span>
            {hasRoll ? (
              <div className="cc-secret">
                <CCDie value={game.yourRoll as number} />
                <span className="cc-secret-label">🤫 나만 보입니다</span>
              </div>
            ) : (
              <div className="cc-secret">
                <span className="cc-secret-rolling">주사위를 굴리는 중…</span>
              </div>
            )}
          </div>
          {rolledX && (
            <p className="cc-x-warning">
              ☠ X — 어떤 숫자든 <strong>반드시 거짓 선언!</strong>
            </p>
          )}
          <div className="cc-declare-row">
            {[1, 2, 3, 4].map((v) => (
              <button
                key={v}
                type="button"
                className="cc-declare-button"
                onClick={() => handleDeclare(v)}
                disabled={!hasRoll || submitted}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="cc-declare-hint">
            선언한 값만큼 전진합니다 — 과장할수록 의심받기 쉽습니다
          </p>
        </div>
      )}

      {/* 의심 창 — 선언 값 카드 + 하단 판단 바 */}
      {isDoubtWindow && (
        <div className="cc-doubt-panel">
          <div className="cc-declared-card">
            <span className="cc-declared-name">
              {nameOf(game.currentSeat)}님의 선언
            </span>
            <CCDie value={game.declared ?? 1} />
            <span className="cc-declared-value">「{game.declared ?? '?'}」</span>
          </div>
          {canJudge ? (
            <div className="cc-doubt-bar">
              <button
                type="button"
                className="cc-doubt-button"
                onClick={handleDoubt}
                disabled={judged !== null}
              >
                🤨 의심
              </button>
              <button
                type="button"
                className="cc-allow-button"
                onClick={handleAllow}
                disabled={judged !== null}
              >
                👌 믿는다
              </button>
            </div>
          ) : (
            <p className="cc-doubt-passive">
              {isSpectator
                ? '👀 관전 중 — 생존자들의 판단을 기다립니다'
                : game.currentSeat === game.yourSeat
                  ? '내 선언 — 다른 플레이어들의 판단을 기다립니다…'
                  : '판단 자격이 없습니다 — 결과를 기다립니다'}
            </p>
          )}
          {judged && (
            <p className="cc-doubt-passive">
              {judged === 'doubt'
                ? '🤨 의심을 선언했습니다 — 판정을 기다립니다'
                : '👌 믿기로 했습니다 — 다른 생존자를 기다립니다'}
            </p>
          )}
        </div>
      )}

      {isSpectator && !isDoubtWindow && (
        <p className="cc-spectator-note">
          👀 관전 중 — 컵 속 주사위 값은 본인에게만 보입니다
        </p>
      )}

      {/* 좌석 스트립 — 남은 말·통과 수 */}
      <div className="cc-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isCurrent =
            (isRolling || isDoubtWindow) && p.seat === game.currentSeat;
          const offline = !p.connected && !p.bot;
          const onBridge = p.onBridge ?? [];
          return (
            <div
              key={p.seat}
              className={[
                'cc-tile',
                `cc-seat-color-${p.seat % 4}`,
                isCurrent ? 'current' : '',
                isMe ? 'me' : '',
                !p.alive ? 'dead' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="cc-tile-head">
                <span className="cc-tile-name">
                  {isCurrent && <span className="cc-tile-turn">▶</span>}
                  <span className="cc-pawn" aria-hidden="true" />
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="cc-tile-crossed" title="통과시킨 말">
                  🏁 {p.crossed}/{CC_WIN_CROSSED}
                </span>
              </div>
              <div className="cc-tile-badges">
                {p.bot && <span className="cc-badge">🤖 봇</span>}
                {offline && <span className="cc-badge off">끊김</span>}
                {!p.alive && <span className="cc-badge off">💨 탈락</span>}
              </div>
              <div className="cc-tile-pawns">
                <span className="cc-tile-pawns-label">남은 말</span>
                {p.pawnsLeft > 0 ? (
                  <span className="cc-tile-pawns-row">
                    {Array.from({ length: Math.max(0, p.pawnsLeft) }).map(
                      (_, i) => (
                        <span key={i} className="cc-pawn" aria-hidden="true" />
                      ),
                    )}
                  </span>
                ) : (
                  <span className="cc-tile-pawns-none">없음</span>
                )}
                {onBridge.length > 0 && (
                  <span className="cc-tile-onbridge">
                    다리 위 {onBridge.length}개
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
