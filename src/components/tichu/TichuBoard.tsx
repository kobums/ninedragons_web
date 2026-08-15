import { useEffect, useState } from 'react';
import type { TichuCard, TichuGameState, TichuPlayer } from '../../types/tichu';
import { COMBO_LABELS, rankLabel, teamOfSeat } from '../../types/tichu';
import type { TichuToast } from '../../hooks/useTichuGameState';
import { TichuCardView } from './TichuCardView';
import './TichuBoard.css';

const WISH_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

interface TichuBoardProps {
  game: TichuGameState;
  toasts: TichuToast[];
  onCallGrand: (call: boolean) => void;
  onCallTichu: () => void;
  onExchange: (left: TichuCard, partner: TichuCard, right: TichuCard) => void;
  onPlay: (cards: TichuCard[], wish?: number) => void;
  onPass: () => void;
  onDragonGive: (seat: number) => void;
  onReady: () => void;
}

// 좌석 명패 — 이름·손패 수·티츄 배지·아웃 순위·봇/접속 표시
function SeatPlate({
  player,
  isTurn,
  isYou,
  dragonPending,
}: {
  player: TichuPlayer | undefined;
  isTurn: boolean;
  isYou?: boolean;
  dragonPending: boolean;
}) {
  if (!player) return null;
  const team = teamOfSeat(player.seat) === '02' ? 'team02' : 'team13';
  const offline = !player.connected && !player.bot;
  const classes = [
    'tc-plate',
    team,
    isTurn ? 'turn' : '',
    offline ? 'offline' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="tc-plate-name">
        {player.bot && <span className="tc-plate-bot">🤖</span>}
        <span>{player.name}</span>
        {isYou && <span className="tc-plate-you">(나)</span>}
      </div>
      <div className="tc-plate-badges">
        <span className="tc-plate-count">카드 {player.handCount}</span>
        {player.tichu !== '' && (
          <span className={`tc-badge tc-badge-${player.tichu}`}>
            {player.tichu === 'grand' ? '그랜드 티츄' : '티츄'}
          </span>
        )}
        {player.out && player.outRank > 0 && (
          <span className="tc-badge tc-badge-out">{player.outRank}위</span>
        )}
        {offline && <span className="tc-badge tc-badge-offline">연결 끊김</span>}
        {dragonPending && <span className="tc-badge tc-badge-dragon">🐉 전달 대기</span>}
      </div>
    </div>
  );
}

export function TichuBoard({
  game,
  toasts,
  onCallGrand,
  onCallTichu,
  onExchange,
  onPlay,
  onPass,
  onDragonGive,
  onReady,
}: TichuBoardProps) {
  // 로컬 입력 상태 — 서버가 최종 판정하므로 여기서는 선택만 관리한다
  const [selected, setSelected] = useState<TichuCard[]>([]);
  const [wish, setWish] = useState<number | null>(null);
  // 교환 슬롯 — 화면 배치 순서 [왼쪽(rel 1), 파트너(rel 2), 오른쪽(rel 3)]
  const [exchangeSlots, setExchangeSlots] = useState<(TichuCard | null)[]>([
    null,
    null,
    null,
  ]);

  // 단계·핸드가 바뀌면 로컬 입력을 리셋한다
  useEffect(() => {
    setSelected([]);
    setWish(null);
    setExchangeSlots([null, null, null]);
  }, [game.phase, game.handNo]);

  // 손패에서 사라진 카드는 선택·슬롯에서도 걷어낸다
  const handKey = game.yourHand.join('|');
  useEffect(() => {
    const hand = new Set(game.yourHand);
    setSelected((prev) => prev.filter((c) => hand.has(c)));
    setExchangeSlots((prev) =>
      prev.map((c) => (c !== null && hand.has(c) ? c : null)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey]);

  // 내 좌석이 항상 아래 — (seat - yourSeat + 4) % 4 → 아래/왼쪽/위/오른쪽
  const seatAt = (rel: number) => (game.yourSeat + rel) % 4;
  const playerAt = (rel: number) =>
    game.players.find((p) => p.seat === seatAt(rel));
  const me = playerAt(0);
  const leftPlayer = playerAt(1);
  const partnerPlayer = playerAt(2);
  const rightPlayer = playerAt(3);

  const nameOf = (seat: number) =>
    game.players.find((p) => p.seat === seat)?.name ?? `좌석 ${seat}`;

  const myTurn = game.currentTurn === game.yourSeat;
  const inExchangeInput = game.phase === 'exchange' && !game.exchangeDone;
  const iAmOut = me?.out ?? false;
  const canDeclareTichu =
    Boolean(me) &&
    !iAmOut &&
    me!.tichu === '' &&
    ((game.phase === 'exchange' && game.exchangeDone) ||
      (game.phase === 'play' && game.yourHand.length === 14));

  const handClickable =
    inExchangeInput || (game.phase === 'play' && !iAmOut);

  const handleCardClick = (card: TichuCard) => {
    if (inExchangeInput) {
      setExchangeSlots((prev) => {
        const already = prev.indexOf(card);
        if (already >= 0) {
          const next = [...prev];
          next[already] = null;
          return next;
        }
        const empty = prev.indexOf(null);
        if (empty < 0) return prev;
        const next = [...prev];
        next[empty] = card;
        return next;
      });
      return;
    }
    if (game.phase !== 'play') return;
    setSelected((prev) =>
      prev.includes(card) ? prev.filter((c) => c !== card) : [...prev, card],
    );
  };

  const handlePlay = () => {
    if (selected.length === 0) return;
    // 손패 정렬 순서 그대로 보낸다
    const cards = game.yourHand.filter((c) => selected.includes(c));
    const wishValue =
      selected.includes('MAH') && wish !== null ? wish : undefined;
    onPlay(cards, wishValue);
    setSelected([]);
    setWish(null);
  };

  const exchangeReady = exchangeSlots.every((c) => c !== null);
  const handleExchangeSubmit = () => {
    if (!exchangeReady) return;
    // 와이어 계약: left=(seat+3)%4, right=(seat+1)%4.
    // 화면 회전상 (seat+1)은 왼쪽, (seat+3)은 오른쪽에 그려지므로
    // 화면 오른쪽 슬롯이 와이어 left, 화면 왼쪽 슬롯이 와이어 right 다.
    onExchange(exchangeSlots[2]!, exchangeSlots[1]!, exchangeSlots[0]!);
  };

  const dragonChoosing = game.dragonPendingSeat === game.yourSeat;
  const readyCount = game.players.filter((p) => p.ready).length;
  const myTeam = teamOfSeat(game.yourSeat);

  const exchangeSlotDefs = [
    { label: '왼쪽', player: leftPlayer, idx: 0 },
    { label: '파트너', player: partnerPlayer, idx: 1 },
    { label: '오른쪽', player: rightPlayer, idx: 2 },
  ];

  return (
    <div className="tc-board">
      {/* 이벤트 토스트 피드 */}
      <div className="tc-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="tc-toast">
            {toast.event.message || toast.event.kind}
          </div>
        ))}
      </div>

      {/* 점수 헤더 */}
      <header className="tc-header">
        <div className={`tc-score team02 ${myTeam === '02' ? 'mine' : ''}`}>
          <span className="tc-score-label">0·2 팀</span>
          <strong>{game.scores.team02}</strong>
        </div>
        <div className="tc-header-mid">
          <span>목표 {game.targetScore}</span>
          <span>핸드 {game.handNo}</span>
          {game.wishRank >= 2 && (
            <span className="tc-wish-chip">소원 {rankLabel(game.wishRank)}</span>
          )}
        </div>
        <div className={`tc-score team13 ${myTeam === '13' ? 'mine' : ''}`}>
          <span className="tc-score-label">1·3 팀</span>
          <strong>{game.scores.team13}</strong>
        </div>
      </header>

      {/* 테이블 — 파트너 위, 이웃 좌우, 나 아래 */}
      <div className="tc-table">
        <div className="tc-pos-top">
          <SeatPlate
            player={partnerPlayer}
            isTurn={game.currentTurn === seatAt(2)}
            dragonPending={game.dragonPendingSeat === seatAt(2)}
          />
        </div>
        <div className="tc-pos-left">
          <SeatPlate
            player={leftPlayer}
            isTurn={game.currentTurn === seatAt(1)}
            dragonPending={game.dragonPendingSeat === seatAt(1)}
          />
        </div>

        <div className="tc-pos-center">
          {game.phase === 'grand' && game.grandAnswered && (
            <div className="tc-center-note">
              다른 플레이어의 그랜드 선언을 기다리는 중...
            </div>
          )}

          {game.phase === 'exchange' && (
            <div className="tc-center-note">
              {game.exchangeDone
                ? '교환 완료 — 다른 플레이어를 기다리는 중...'
                : '줄 카드 3장을 고르세요'}
            </div>
          )}

          {game.phase === 'play' &&
            game.dragonPendingSeat >= 0 &&
            !dragonChoosing && (
              <div className="tc-center-note">
                🐉 {nameOf(game.dragonPendingSeat)}님이 용 트릭을 전달할 상대를
                고르는 중...
              </div>
            )}

          {game.phase === 'play' && game.trick.length > 0 && (
            <div className="tc-trick">
              {game.trick.map((play, i) => (
                <div
                  key={`${play.seat}-${i}`}
                  className={`tc-trick-play ${
                    i === game.trick.length - 1 ? 'last' : ''
                  }`}
                >
                  <span className="tc-trick-meta">
                    {nameOf(play.seat)} · {COMBO_LABELS[play.combo]}
                  </span>
                  <div className="tc-trick-cards">
                    {play.cards.map((card) => (
                      <TichuCardView key={card} card={card} size="sm" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {game.phase === 'play' &&
            game.trick.length === 0 &&
            game.dragonPendingSeat < 0 && (
              <div className="tc-center-note">
                {game.currentTurn >= 0
                  ? myTurn
                    ? '내가 리드할 차례입니다'
                    : `${nameOf(game.currentTurn)}님의 리드`
                  : '새 트릭'}
              </div>
            )}
        </div>

        <div className="tc-pos-right">
          <SeatPlate
            player={rightPlayer}
            isTurn={game.currentTurn === seatAt(3)}
            dragonPending={game.dragonPendingSeat === seatAt(3)}
          />
        </div>
        <div className="tc-pos-bottom">
          <SeatPlate
            player={me}
            isYou
            isTurn={myTurn}
            dragonPending={dragonChoosing}
          />
        </div>
      </div>

      {/* 교환 슬롯 패널 */}
      {inExchangeInput && (
        <div className="tc-exchange-panel">
          <div className="tc-exchange-slots">
            {exchangeSlotDefs.map(({ label, player, idx }) => (
              <div key={idx} className="tc-exchange-slot">
                <span className="tc-exchange-target">
                  {label} · {player?.name ?? '?'}
                </span>
                {exchangeSlots[idx] ? (
                  <TichuCardView
                    card={exchangeSlots[idx]!}
                    size="sm"
                    onClick={() => handleCardClick(exchangeSlots[idx]!)}
                  />
                ) : (
                  <div className="tc-exchange-empty">?</div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="tc-primary-button"
            disabled={!exchangeReady}
            onClick={handleExchangeSubmit}
          >
            교환 제출
          </button>
        </div>
      )}

      {/* 내 손패 */}
      <div className="tc-hand-area">
        {game.yourHand.length > 0 ? (
          <div className="tc-hand">
            {game.yourHand.map((card) => (
              <TichuCardView
                key={card}
                card={card}
                size="md"
                selected={
                  selected.includes(card) || exchangeSlots.includes(card)
                }
                onClick={
                  handClickable ? () => handleCardClick(card) : undefined
                }
              />
            ))}
          </div>
        ) : (
          iAmOut && (
            <div className="tc-out-note">
              아웃 — {me && me.outRank > 0 ? `${me.outRank}위` : '완주'}
            </div>
          )
        )}
      </div>

      {/* 액션 바 */}
      {game.phase === 'play' && !iAmOut && (
        <div className="tc-action-bar">
          <span className="tc-turn-note">
            {myTurn
              ? game.lastPlay
                ? '내 차례입니다'
                : '내가 리드합니다'
              : game.currentTurn >= 0
                ? `${nameOf(game.currentTurn)}님 차례`
                : ''}
          </span>

          {selected.includes('MAH') && (
            <div className="tc-wish-picker">
              <span className="tc-wish-label">참새 소원</span>
              <div className="tc-wish-options">
                <button
                  type="button"
                  className={`tc-wish-option ${wish === null ? 'active' : ''}`}
                  onClick={() => setWish(null)}
                >
                  없음
                </button>
                {WISH_RANKS.map((rank) => (
                  <button
                    key={rank}
                    type="button"
                    className={`tc-wish-option ${wish === rank ? 'active' : ''}`}
                    onClick={() => setWish(rank)}
                  >
                    {rankLabel(rank)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="tc-action-buttons">
            {canDeclareTichu && (
              <button
                type="button"
                className="tc-tichu-button"
                onClick={onCallTichu}
              >
                티츄 선언
              </button>
            )}
            <button
              type="button"
              className="tc-primary-button"
              disabled={selected.length === 0}
              onClick={handlePlay}
            >
              내기
            </button>
            <button
              type="button"
              className="tc-pass-button"
              disabled={!myTurn || !game.lastPlay}
              onClick={onPass}
            >
              패스
            </button>
          </div>
        </div>
      )}

      {game.phase === 'exchange' && game.exchangeDone && canDeclareTichu && (
        <div className="tc-action-bar">
          <div className="tc-action-buttons">
            <button
              type="button"
              className="tc-tichu-button"
              onClick={onCallTichu}
            >
              티츄 선언
            </button>
          </div>
        </div>
      )}

      {/* 그랜드 티츄 오버레이 */}
      {game.phase === 'grand' && !game.grandAnswered && (
        <div className="tc-overlay">
          <div className="tc-overlay-panel">
            <h2 className="tc-overlay-title">그랜드 티츄?</h2>
            <p className="tc-overlay-desc">
              처음 8장을 보고 선언하세요 (성공 +200 / 실패 -200)
            </p>
            <div className="tc-overlay-cards">
              {game.yourHand.map((card) => (
                <TichuCardView key={card} card={card} size="md" />
              ))}
            </div>
            <div className="tc-overlay-actions">
              <button
                type="button"
                className="tc-primary-button"
                onClick={() => onCallGrand(true)}
              >
                그랜드 티츄 선언
              </button>
              <button
                type="button"
                className="tc-pass-button"
                onClick={() => onCallGrand(false)}
              >
                패스
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 용 트릭 전달 오버레이 */}
      {dragonChoosing && (
        <div className="tc-overlay">
          <div className="tc-overlay-panel">
            <h2 className="tc-overlay-title">🐉 용 트릭 전달</h2>
            <p className="tc-overlay-desc">
              용으로 트릭을 가져왔습니다. 상대팀 중 누구에게 줄까요?
            </p>
            <div className="tc-overlay-actions">
              {[leftPlayer, rightPlayer].map(
                (p) =>
                  p && (
                    <button
                      key={p.seat}
                      type="button"
                      className="tc-primary-button"
                      onClick={() => onDragonGive(p.seat)}
                    >
                      {p.name}
                    </button>
                  ),
              )}
            </div>
          </div>
        </div>
      )}

      {/* 핸드 정산 오버레이 */}
      {game.phase === 'hand_end' && (
        <div className="tc-overlay">
          <div className="tc-overlay-panel">
            <h2 className="tc-overlay-title">핸드 {game.handNo} 정산</h2>
            {game.handResult && (
              <>
                <div className="tc-result-rows">
                  <div
                    className={`tc-result-row team02 ${
                      myTeam === '02' ? 'mine' : ''
                    }`}
                  >
                    <span>0·2 팀 {myTeam === '02' ? '(우리)' : ''}</span>
                    <span className="tc-result-delta">
                      {game.handResult.team02Delta >= 0 ? '+' : ''}
                      {game.handResult.team02Delta}
                    </span>
                    <strong>{game.scores.team02}</strong>
                  </div>
                  <div
                    className={`tc-result-row team13 ${
                      myTeam === '13' ? 'mine' : ''
                    }`}
                  >
                    <span>1·3 팀 {myTeam === '13' ? '(우리)' : ''}</span>
                    <span className="tc-result-delta">
                      {game.handResult.team13Delta >= 0 ? '+' : ''}
                      {game.handResult.team13Delta}
                    </span>
                    <strong>{game.scores.team13}</strong>
                  </div>
                </div>
                {game.handResult.detail && (
                  <p className="tc-result-detail">{game.handResult.detail}</p>
                )}
              </>
            )}
            <p className="tc-overlay-desc">준비 {readyCount}/4</p>
            <button
              type="button"
              className="tc-primary-button"
              disabled={me?.ready ?? false}
              onClick={onReady}
            >
              {me?.ready ? '다른 플레이어 대기 중...' : '다음 핸드'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
