import { useEffect, useState } from 'react';
import type { NMEvent, NMGameState } from '../../types/nimmt';
import {
  NM_ROW_COUNT,
  NM_ROW_MAX,
  NM_TRICKS,
  nmBullheads,
  nmCardTier,
  nmRowPenalty,
} from '../../types/nimmt';
import type { NMToast } from '../../hooks/useNimmtGameState';
import './NimmtBoard.css';

interface NimmtBoardProps {
  game: NMGameState;
  toasts: NMToast[];
  onPick: (card: number) => void;
  onChooseRow: (row: number) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: NMEvent, game: NMGameState): string {
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

// 소머리 뱃지 — 🐮×n (1이면 개수 생략)
export function NMBulls({ card }: { card: number }) {
  const bulls = nmBullheads(card);
  return (
    <span className="nm-bulls" title={`소머리 ${bulls}개`}>
      🐮{bulls > 1 ? `×${bulls}` : ''}
    </span>
  );
}

export function NimmtBoard({ game, toasts, onPick, onChooseRow }: NimmtBoardProps) {
  const players = game.players ?? [];
  const rows = game.rows ?? [];
  const picks = game.picks ?? [];
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  // 내 손패 — 오름차순 정렬 (관전자·타인은 빈 배열)
  const hand = [...(game.yourHand ?? [])].sort((a, b) => a - b);

  const isPicking = game.phase === 'picking';
  const isRevealing = game.phase === 'revealing';
  const isChoosing = game.phase === 'choosing_row';
  const iAmChooser = isChoosing && game.chooserSeat === game.yourSeat;

  // 탭 선택 카드 (확인 바로 제출) — 트릭·단계가 바뀌면 초기화
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(nm_error)해도 단계·트릭이 바뀌면 풀려 재시도할 수 있다.
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    setSelectedCard(null);
    setSubmitted(false);
  }, [game.trick, game.phase, game.chooserSeat]);

  const canPick = isPicking && !isSpectator && !me?.picked && !submitted;
  const canChooseRow = iAmChooser && !submitted;

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
  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  const handleSubmitPick = () => {
    if (!canPick || selectedCard === null) return;
    setSubmitted(true);
    onPick(selectedCard);
  };

  const handleRowTap = (row: number) => {
    if (!canChooseRow) return;
    setSubmitted(true);
    onChooseRow(row);
  };

  // 일괄 공개 — 낮은 카드부터 배치되므로 오름차순으로 순차 하이라이트
  const sortedPicks = [...picks].sort((a, b) => a.card - b.card);

  // 상단 배너 보조 문구
  const bannerSub = isPicking
    ? isSpectator
      ? '전원이 카드 1장씩 동시에 고르는 중…'
      : me?.picked || submitted
        ? '제출 완료 — 다른 플레이어를 기다리는 중…'
        : '손패에서 카드 1장을 골라 제출하세요 — 전원 동시 공개됩니다'
    : isRevealing
      ? '제출 카드 일괄 공개 — 낮은 카드부터 순서대로 배치됩니다'
      : isChoosing
        ? iAmChooser
          ? '모든 행보다 낮은 카드입니다 — 가져갈(먹을) 행을 고르세요'
          : `${nameOf(game.chooserSeat)}님이 가져갈 행을 고르는 중…`
        : '';

  // 직전 배치 안내 문구
  const placement = game.lastPlacement ?? null;
  const placementText = placement
    ? placement.ate
      ? `🐮 ${nameOf(placement.seat)}님이 ${placement.row + 1}행을 먹고 ${
          placement.card
        }(으)로 새 행을 시작했습니다`
      : `${nameOf(placement.seat)}님의 ${placement.card} → ${
          placement.row + 1
        }행`
    : '';

  return (
    <div className="nm-board">
      <div className="nm-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="nm-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="nm-phase-banner">
        <span className="nm-phase-title">
          🐮 6 님트! · 라운드 {Math.min(Math.max(game.trick, 1), NM_TRICKS)}/
          {NM_TRICKS}
          {game.endsAt > 0 && (
            <span
              className={`nm-deadline ${remaining < 10_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="nm-phase-sub">{bannerSub}</span>}
      </div>

      {/* 4개 행 — 카드 겹침 열 + 소머리 합. choosing_row 에서 내가 chooser 면 탭 */}
      <div className="nm-rows">
        {Array.from({ length: NM_ROW_COUNT }).map((_, rowIdx) => {
          const rowCards = rows[rowIdx] ?? [];
          const full = rowCards.length >= NM_ROW_MAX;
          const isPlacedRow =
            placement !== null && placement.row === rowIdx && !isPicking;
          const rowClass = [
            'nm-row',
            full ? 'full' : '',
            canChooseRow ? 'choosable' : '',
            isPlacedRow ? 'placed' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const rowInner = (
            <>
              <span className="nm-row-label">{rowIdx + 1}행</span>
              <span className="nm-row-cards">
                {rowCards.map((card, i) => (
                  <span
                    key={card}
                    className={[
                      'nm-card',
                      `tier-${nmCardTier(card)}`,
                      placement !== null &&
                      placement.row === rowIdx &&
                      placement.card === card &&
                      !isPicking
                        ? 'just-placed'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ zIndex: i + 1 }}
                  >
                    <span className="nm-card-value">{card}</span>
                    <NMBulls card={card} />
                  </span>
                ))}
                {rowCards.length === 0 && (
                  <span className="nm-row-empty">비어 있음</span>
                )}
              </span>
              <span
                className="nm-row-sum"
                title="이 행을 먹으면 받는 소머리 벌점"
              >
                {full && <span className="nm-row-warn">위험!</span>}
                🐮 {nmRowPenalty(rowCards)}
              </span>
            </>
          );
          return canChooseRow ? (
            <button
              key={rowIdx}
              type="button"
              className={rowClass}
              onClick={() => handleRowTap(rowIdx)}
            >
              {rowInner}
            </button>
          ) : (
            <div key={rowIdx} className={rowClass}>
              {rowInner}
            </div>
          );
        })}
      </div>
      {canChooseRow && (
        <p className="nm-choose-hint">
          행을 탭하면 그 행의 카드를 벌점으로 가져가고 내 카드가 새 행이 됩니다
        </p>
      )}
      {placementText && !isPicking && (
        <p className={`nm-placement ${placement?.ate ? 'ate' : ''}`}>
          {placementText}
        </p>
      )}

      {/* 일괄 공개 연출 — 낮은 카드부터 순차 하이라이트 */}
      {(isRevealing || isChoosing) && sortedPicks.length > 0 && (
        <div className="nm-reveal">
          <span className="nm-reveal-title">공개된 카드 (낮은 순 배치)</span>
          <div className="nm-reveal-list">
            {sortedPicks.map((pick, i) => (
              <div
                key={pick.seat}
                className={`nm-reveal-item ${
                  pick.seat === game.yourSeat ? 'me' : ''
                }`}
                style={{ animationDelay: `${i * 0.45}s` }}
              >
                <span className={`nm-card reveal tier-${nmCardTier(pick.card)}`}>
                  <span className="nm-card-value">{pick.card}</span>
                  <NMBulls card={pick.card} />
                </span>
                <span className="nm-reveal-name">
                  {nameOf(pick.seat)}
                  {pick.seat === game.yourSeat && ' (나)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 플레이어 스트립 — 제출 현황(picking) + 소머리 벌점 합 */}
      <div className="nm-players">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const offline = !p.connected && !p.bot;
          const isChooserSeat = isChoosing && p.seat === game.chooserSeat;
          return (
            <div
              key={p.seat}
              className={[
                'nm-player',
                isMe ? 'me' : '',
                isChooserSeat ? 'chooser' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="nm-player-name">
                {p.name}
                {isMe && ' (나)'}
              </span>
              <span className="nm-player-meta">
                {p.bot && <span className="nm-badge">🤖</span>}
                {offline && <span className="nm-badge off">끊김</span>}
                {isPicking && (
                  <span
                    className={`nm-pick-status ${p.picked ? 'done' : ''}`}
                    title={p.picked ? '제출 완료' : '고르는 중'}
                  >
                    {p.picked ? '✓' : '…'}
                  </span>
                )}
                {isChooserSeat && (
                  <span className="nm-pick-status choosing" title="행 선택 중">
                    행 선택
                  </span>
                )}
                <span
                  className="nm-player-penalty"
                  title={`소머리 벌점 ${p.penalty}`}
                >
                  🐮 {p.penalty}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* 내 손패 — 미니 실물 카드 오름차순, 탭 선택 → 확인 바 제출 */}
      {!isSpectator && hand.length > 0 && (
        <div className="nm-hand-wrap">
          <span className="nm-hand-label">
            내 손패 {hand.length}장 {canPick ? '— 1장을 고르세요' : ''}
          </span>
          <div className="nm-hand">
            {hand.map((card) => (
              <button
                key={card}
                type="button"
                className={[
                  'nm-hand-card',
                  `tier-${nmCardTier(card)}`,
                  selectedCard === card ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!canPick}
                onClick={() =>
                  setSelectedCard((prev) => (prev === card ? null : card))
                }
              >
                <span className="nm-card-value">{card}</span>
                <NMBulls card={card} />
              </button>
            ))}
          </div>
          {canPick && selectedCard !== null && (
            <div className="nm-confirm-bar">
              <span className="nm-confirm-text">
                {selectedCard} 제출 (🐮 {nmBullheads(selectedCard)})
              </span>
              <button
                type="button"
                className="nm-confirm-button"
                onClick={handleSubmitPick}
              >
                이 카드 제출
              </button>
            </div>
          )}
          {isPicking && !isSpectator && (me?.picked || submitted) && (
            <p className="nm-hand-hint">
              ✓ 제출 완료 — 전원 제출하면 일괄 공개됩니다
            </p>
          )}
        </div>
      )}
      {isSpectator && (
        <p className="nm-spectator-note">
          👀 관전 중 — 손패는 각 플레이어 본인에게만 보입니다
        </p>
      )}
    </div>
  );
}
