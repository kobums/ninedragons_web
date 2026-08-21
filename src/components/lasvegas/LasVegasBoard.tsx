import { useEffect, useState } from 'react';
import type {
  VGCasinoView,
  VGEvent,
  VGGameState,
} from '../../types/lasvegas';
import { VG_ROUNDS, vgMoney } from '../../types/lasvegas';
import type { VGToast } from '../../hooks/useLasVegasGameState';
import './LasVegasBoard.css';

interface LasVegasBoardProps {
  game: VGGameState;
  toasts: VGToast[];
  onPlace: (face: number) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: VGEvent, game: VGGameState): string {
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

// 주사위 눈 → 3×3 그리드에서 도트가 켜지는 칸 인덱스 (0~8) — 요트 도트 렌더 결
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// 주사위 한 개 — 눈금 도트 CSS 렌더 (크기·색은 클래스로 변주)
function VGDie({
  value,
  className = '',
  shaking = false,
}: {
  value: number;
  className?: string;
  shaking?: boolean;
}) {
  const pips = PIP_LAYOUT[value] ?? [];
  return (
    <span
      className={`vg-die ${shaking ? 'rolling' : ''} ${className}`}
      aria-label={`주사위 ${value || '?'}`}
    >
      <span className="vg-die-face" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className={`vg-pip-cell${pips.includes(i) ? ' on' : ''}`}
          />
        ))}
      </span>
    </span>
  );
}

// 좌석 → 색 클래스 (5색 순환 — vg-scope 변수)
const seatClass = (seat: number) =>
  `vg-sc${((seat % 5) + 5) % 5}`;

// 카지노 정산 미리보기 — round_end 연출용 (동수 상쇄·지폐 획득 강조).
// 실제 정산은 서버가 하고, 여기 값은 표시 전용이다.
interface VGSettlement {
  cancelledSeats: Set<number>;
  // bills 배열 인덱스(desc 정렬 그대로) → 받는 좌석 (남으면 undefined = 버림)
  billAwards: (number | undefined)[];
}

function settleCasino(casino: VGCasinoView): VGSettlement {
  const placed = casino.placed ?? {};
  const entries = Object.entries(placed)
    .map(([s, n]) => ({ seat: Number(s), count: n }))
    .filter((e) => Number.isFinite(e.seat) && e.count > 0);

  // 같은 배치 수끼리 묶기 — 2명 이상이면 서로 상쇄(전부 제외)
  const byCount = new Map<number, number[]>();
  for (const e of entries) {
    byCount.set(e.count, [...(byCount.get(e.count) ?? []), e.seat]);
  }
  const cancelledSeats = new Set<number>();
  const survivors: { seat: number; count: number }[] = [];
  for (const [count, seats] of byCount) {
    if (seats.length > 1) {
      for (const s of seats) cancelledSeats.add(s);
    } else {
      survivors.push({ seat: seats[0], count });
    }
  }
  survivors.sort((a, b) => b.count - a.count || a.seat - b.seat);

  const bills = casino.bills ?? [];
  const billAwards = bills.map((_, i) => survivors[i]?.seat);
  return { cancelledSeats, billAwards };
}

export function LasVegasBoard({ game, toasts, onPlace }: LasVegasBoardProps) {
  const players = game.players ?? [];
  const casinos = game.casinos ?? [];
  const dice = game.dice ?? [];
  const isSpectator = game.yourSeat < 0;
  const isPlacing = game.phase === 'placing';
  const isRoundEnd = game.phase === 'round_end';
  const myTurn = isPlacing && !isSpectator && game.currentSeat === game.yourSeat;

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';
  const me = players.find((p) => p.seat === game.yourSeat);

  // 배치 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(vg_error)해도 다음 스냅샷/턴 갱신으로 다시 풀린다.
  const diceKey = dice.join(',');
  const turnSignature = `${game.round}-${game.currentSeat}-${diceKey}`;
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnSignature]);

  // 굴림 연출 — 새 주사위 스냅샷(차례 시작 시 서버 자동 굴림)마다 CSS 셰이크
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (dice.length === 0) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnSignature]);

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

  // 굴린 주사위 → 같은 눈 그룹 (눈 오름차순)
  const groups: { face: number; count: number }[] = [];
  for (let face = 1; face <= 6; face += 1) {
    const count = dice.filter((d) => d === face).length;
    if (count > 0) groups.push({ face, count });
  }

  const canPlace = myTurn && !submitted && groups.length > 0;
  const handlePlace = (face: number) => {
    if (!canPlace) return;
    setSubmitted(true);
    onPlace(face);
  };

  // 상단 배너 보조 문구
  const bannerSub = isRoundEnd
    ? (game.roundResult?.message ?? '라운드 정산 — 동수 배치는 서로 상쇄됩니다')
    : myTurn
      ? '같은 눈 그룹을 탭하면 그 눈의 카지노에 전부 배치됩니다'
      : isPlacing
        ? `🎲 ${nameOf(game.currentSeat)}님의 차례…`
        : '';

  return (
    <div className="vg-board">
      <div className="vg-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="vg-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className={`vg-phase-banner ${isRoundEnd ? 'settle' : ''}`}>
        <span className="vg-phase-title">
          🎰 라스베가스 · 라운드 {game.round}/{VG_ROUNDS}
          {isPlacing && game.endsAt > 0 && (
            <span
              className={`vg-deadline ${remaining < 10_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="vg-phase-sub">{bannerSub}</span>}
      </div>

      {/* 플레이어 현황 — 좌석 색·남은 주사위·총액 (전부 공개) */}
      <div className="vg-players">
        {players.map((p) => {
          const isCurrent = isPlacing && p.seat === game.currentSeat;
          return (
            <div
              key={p.seat}
              className={[
                'vg-player',
                seatClass(p.seat),
                isCurrent ? 'current' : '',
                p.seat === game.yourSeat ? 'me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="vg-player-dot" aria-hidden="true" />
              <span className="vg-player-name">
                {isCurrent && <span className="vg-turn-mark">▶</span>}
                {p.name}
                {p.bot && ' 🤖'}
                {p.seat === game.yourSeat && ' (나)'}
                {!p.connected && !p.bot && ' ⚠️'}
              </span>
              <span className="vg-player-dice" title="남은 주사위">
                🎲{p.diceLeft}
              </span>
              <span className="vg-player-cash">{vgMoney(p.cash)}</span>
            </div>
          );
        })}
      </div>

      {/* 카지노 6칸 그리드 */}
      <div className="vg-casino-grid">
        {casinos.map((casino, idx) => {
          const face = casino.face ?? idx + 1;
          const bills = casino.bills ?? [];
          const placed = casino.placed ?? {};
          const placedEntries = Object.entries(placed)
            .map(([s, n]) => ({ seat: Number(s), count: n }))
            .filter((e) => Number.isFinite(e.seat) && e.count > 0)
            .sort((a, b) => b.count - a.count || a.seat - b.seat);
          // round_end 정산 연출 — 상쇄·지폐 획득 강조
          const settlement = isRoundEnd ? settleCasino(casino) : null;
          const placeable = canPlace && groups.some((g) => g.face === face);

          return (
            <div
              key={face}
              className={`vg-casino ${placeable ? 'placeable' : ''}`}
            >
              <div className="vg-casino-head">
                <VGDie value={face} className="vg-casino-die" />
              </div>

              <div className="vg-bills">
                {bills.length === 0 ? (
                  <span className="vg-bills-empty">지폐 없음</span>
                ) : (
                  bills.map((bill, i) => {
                    const awardSeat = settlement?.billAwards[i];
                    return (
                      <span
                        key={i}
                        className={[
                          'vg-bill',
                          awardSeat !== undefined
                            ? `awarded ${seatClass(awardSeat)}`
                            : '',
                          settlement && awardSeat === undefined
                            ? 'discarded'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {vgMoney(bill)}
                        {awardSeat !== undefined && (
                          <span className="vg-bill-to">
                            → {nameOf(awardSeat)}
                          </span>
                        )}
                      </span>
                    );
                  })
                )}
              </div>

              {placedEntries.length > 0 && (
                <div className="vg-placed">
                  {placedEntries.map(({ seat, count }) => {
                    const cancelled =
                      settlement?.cancelledSeats.has(seat) ?? false;
                    return (
                      <span
                        key={seat}
                        className={[
                          'vg-placed-badge',
                          seatClass(seat),
                          cancelled ? 'cancelled' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        title={`${nameOf(seat)} — 주사위 ${count}개${
                          cancelled ? ' (동수 상쇄)' : ''
                        }`}
                      >
                        <span className="vg-placed-dot" aria-hidden="true" />
                        {count}
                        {cancelled && (
                          <span className="vg-cancel-tag">상쇄</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 주사위 패널 — 굴린 주사위를 같은 눈 그룹으로 (전원 공개) */}
      <div className="vg-dice-panel">
        {dice.length > 0 ? (
          <>
            <p className="vg-dice-owner">
              {myTurn
                ? `내가 굴린 주사위 ${dice.length}개`
                : `${nameOf(game.currentSeat)}님이 굴린 주사위 ${dice.length}개`}
              {me && (
                <span className="vg-dice-left-badge">
                  내 남은 주사위 {me.diceLeft}개
                </span>
              )}
            </p>
            <div className="vg-dice-groups">
              {groups.map((group) => {
                const groupDice = (
                  <>
                    <span className="vg-group-dice">
                      {Array.from({ length: group.count }).map((_, i) => (
                        <VGDie
                          key={i}
                          value={group.face}
                          shaking={shaking}
                        />
                      ))}
                    </span>
                    <span className="vg-group-label">
                      {group.face}번 ×{group.count}
                    </span>
                  </>
                );
                return myTurn ? (
                  <button
                    key={group.face}
                    type="button"
                    className="vg-dice-group tappable"
                    disabled={!canPlace}
                    onClick={() => handlePlace(group.face)}
                    aria-label={`${group.face}번 카지노에 주사위 ${group.count}개 배치`}
                  >
                    {groupDice}
                  </button>
                ) : (
                  <span key={group.face} className="vg-dice-group">
                    {groupDice}
                  </span>
                );
              })}
            </div>
            {myTurn && (
              <p className="vg-dice-hint">
                {submitted
                  ? '배치 중...'
                  : '그룹을 탭하면 그 눈의 카지노에 전부 배치됩니다'}
              </p>
            )}
          </>
        ) : (
          <p className="vg-dice-hint">
            {isRoundEnd
              ? '💵 라운드 정산 중 — 카지노별 지폐가 분배됩니다'
              : me && me.diceLeft === 0
                ? '내 주사위를 전부 배치했습니다 — 정산을 기다리세요'
                : `${nameOf(game.currentSeat)}님의 굴림을 기다리는 중...`}
          </p>
        )}
        {isSpectator && (
          <p className="vg-spectator-note">
            👀 관전 중 — 주사위와 지폐는 전원 공개입니다
          </p>
        )}
      </div>
    </div>
  );
}
