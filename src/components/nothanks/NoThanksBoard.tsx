import { useEffect, useState } from 'react';
import type { NTEvent, NTGameState } from '../../types/nothanks';
import { ntCardSum, ntCardTier, ntGroupCards } from '../../types/nothanks';
import type { NTToast } from '../../hooks/useNoThanksGameState';
import './NoThanksBoard.css';

interface NoThanksBoardProps {
  game: NTGameState;
  toasts: NTToast[];
  onPass: () => void;
  onTake: () => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: NTEvent, game: NTGameState): string {
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
      return `${name(event.seat)}님이 칩을 내고 패스했습니다`;
    case 'take':
      return `${name(event.seat)}님이 카드를 가져갔습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 획득 카드 미니 카드 — 연속 시퀀스는 붙여서 그룹으로, 최솟값만 점수라 강조
export function NTRunGroups({ cards }: { cards: number[] }) {
  const groups = ntGroupCards(cards);
  if (groups.length === 0) return null;
  return (
    <div className="nt-runs">
      {groups.map((group) => (
        <span key={group[0]} className="nt-run">
          {group.map((v, i) => (
            <span
              key={v}
              className={`nt-mini-card tier-${ntCardTier(v)} ${
                i === 0 ? 'min' : ''
              }`}
              title={i === 0 ? `시퀀스 최솟값 — ${v}점만 계산` : '점수 미계산'}
            >
              {v}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

export function NoThanksBoard({
  game,
  toasts,
  onPass,
  onTake,
}: NoThanksBoardProps) {
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(nt_error)해도 스냅샷 필드가 바뀌면 풀려 재시도할 수 있다.
  const [submitted, setSubmitted] = useState(false);

  const players = game.players ?? [];
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const isPlaying = game.phase === 'playing';
  const myTurn =
    isPlaying && !isSpectator && game.currentSeat === game.yourSeat;
  const myChips = me?.chips ?? 0;
  // 은닉(-1)이 내 좌석에 오는 회귀 방어 — 음수면 패스 판단 불가라 잠근다
  const canPass = myTurn && !submitted && myChips > 0;
  const canTake = myTurn && !submitted && game.card > 0;

  // 턴·카드·팟이 바뀌면 연타 잠금을 푼다
  useEffect(() => {
    setSubmitted(false);
  }, [game.currentSeat, game.card, game.potChips, game.deckCount]);

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

  const handlePass = () => {
    if (!canPass) return;
    setSubmitted(true);
    onPass();
  };

  const handleTake = () => {
    if (!canTake) return;
    setSubmitted(true);
    onTake();
  };

  // 상단 배너 보조 문구
  const bannerSub = myTurn
    ? myChips === 0
      ? '칩이 없습니다 — 카드를 가져가야 합니다'
      : '칩을 내고 패스하거나, 카드와 얹힌 칩을 가져가세요'
    : isPlaying
      ? `🪙 ${nameOf(game.currentSeat)}님이 고민하는 중…`
      : '';

  // 카드 위에 얹힌 칩 더미 (시각용은 최대 7개까지만 겹쳐 그린다)
  const potStack = Math.min(game.potChips, 7);

  return (
    <div className="nt-board">
      <div className="nt-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="nt-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="nt-phase-banner">
        <span className="nt-phase-title">
          🪙 노 땡스! · 최저점 승리
          {isPlaying && game.endsAt > 0 && (
            <span
              className={`nt-deadline ${remaining < 10_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="nt-phase-sub">{bannerSub}</span>}
      </div>

      {/* 테이블 중앙 — 남은 덱 + 공개 카드(칩 더미 얹힘) */}
      <div className="nt-table">
        <div className="nt-deck">
          <div className="nt-deck-back">{game.deckCount}</div>
          <span className="nt-deck-label">남은 카드</span>
        </div>

        {game.card > 0 ? (
          <div className="nt-open-wrap">
            <div className={`nt-open-card tier-${ntCardTier(game.card)}`}>
              <span className="nt-open-index tl">{game.card}</span>
              <span className="nt-open-value">{game.card}</span>
              <span className="nt-open-index br">{game.card}</span>
              {game.potChips > 0 && (
                <div className="nt-pot" title={`얹힌 칩 ${game.potChips}개`}>
                  <span className="nt-pot-stack" aria-hidden="true">
                    {Array.from({ length: potStack }).map((_, i) => (
                      <span key={i} className="nt-pot-chip" />
                    ))}
                  </span>
                  <span className="nt-pot-count">🪙 {game.potChips}</span>
                </div>
              )}
            </div>
            <span className="nt-open-label">
              {game.potChips > 0
                ? `가져가면 칩 ${game.potChips}개가 따라옵니다`
                : '아직 얹힌 칩이 없습니다'}
            </span>
          </div>
        ) : (
          <div className="nt-open-wrap">
            <div className="nt-open-card empty">
              <span className="nt-open-value">—</span>
            </div>
            <span className="nt-open-label">다음 카드를 공개하는 중…</span>
          </div>
        )}
      </div>

      {/* 내 칩 뱃지 + 행동 버튼 (관전자는 숨김) */}
      {!isSpectator && (
        <div className="nt-actions-wrap">
          <span className="nt-my-chips" title="내 칩 (나만 보입니다)">
            🪙 내 칩 <strong>{myChips < 0 ? '?' : myChips}</strong>
          </span>
          <div className="nt-actions">
            <button
              type="button"
              className="nt-pass-button"
              onClick={handlePass}
              disabled={!canPass}
            >
              🪙 칩 내고 패스
            </button>
            <button
              type="button"
              className="nt-take-button"
              onClick={handleTake}
              disabled={!canTake}
            >
              카드 가져가기
              {game.potChips > 0 && ` (+🪙${game.potChips})`}
            </button>
          </div>
          {myTurn && myChips === 0 && (
            <span className="nt-actions-hint">
              칩이 0개라 패스할 수 없습니다
            </span>
          )}
        </div>
      )}
      {isSpectator && (
        <p className="nt-spectator-note">
          👀 관전 중 — 칩 수는 쇼다운까지 비공개입니다
        </p>
      )}

      {/* 좌석 타일 — 획득 카드는 연속 시퀀스끼리 붙여 그룹 렌더 */}
      <div className="nt-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isCurrent = isPlaying && p.seat === game.currentSeat;
          const offline = !p.connected && !p.bot;
          const cards = p.cards ?? [];
          return (
            <div
              key={p.seat}
              className={[
                'nt-tile',
                isCurrent ? 'current' : '',
                isMe ? 'me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="nt-tile-head">
                <span className="nt-tile-name">
                  {isCurrent && <span className="nt-tile-turn">▶</span>}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span
                  className="nt-tile-chips"
                  title={p.chips < 0 ? '칩 수는 비공개입니다' : '보유 칩'}
                >
                  🪙 {p.chips < 0 ? '?' : p.chips}
                </span>
              </div>
              <div className="nt-tile-badges">
                {p.bot && <span className="nt-badge">🤖 봇</span>}
                {offline && <span className="nt-badge off">끊김</span>}
              </div>
              {cards.length > 0 ? (
                <>
                  <NTRunGroups cards={cards} />
                  <span className="nt-tile-sum">
                    카드 합 {ntCardSum(cards)}점 (시퀀스 최솟값만)
                  </span>
                </>
              ) : (
                <span className="nt-tile-empty">아직 가져간 카드 없음</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
