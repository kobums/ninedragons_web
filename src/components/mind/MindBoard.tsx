import { useEffect, useState } from 'react';
import type { MIEvent, MIGameState } from '../../types/mind';
import { miRewardText, miSeconds } from '../../types/mind';
import type { MIToast } from '../../hooks/useMindGameState';
import './MindBoard.css';

interface MindBoardProps {
  game: MIGameState;
  toasts: MIToast[];
  // 카드 지정이 없다 — 서버가 내 최저 카드를 낸다
  onPlay: () => void;
  onStarPropose: () => void;
  onStarAccept: () => void;
  onStarDecline: () => void;
}

// 화면에 그리는 더미 최대 장수 — 그 앞은 '…' 로 접는다
const PILE_VISIBLE = 40;

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글).
// play·mistake·star_* 는 훅에서 걸러진다 (보드가 스냅샷으로 직접 그린다).
function toastText(event: MIEvent, game: MIGameState): string {
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
      return `🌙 ${game.round}라운드 — 각자 ${game.round}장`;
    case 'round_clear':
      return '✨ 라운드 성공';
    case 'life_up':
      return '❤️ 생명을 하나 얻었습니다';
    case 'star_up':
      return '⭐ 수리검을 하나 얻었습니다';
    case 'star_used':
      return '⭐ 수리검 발동 — 전원 최저 카드를 버립니다';
    case 'star_failed':
      return '수리검 제안이 무산되었습니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'timeout':
      return '⏳ 제한 시간이 끝났습니다';
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

export function MindBoard({
  game,
  toasts,
  onPlay,
  onStarPropose,
  onStarAccept,
  onStarDecline,
}: MindBoardProps) {
  const players = game.players ?? [];
  const pile = game.pile ?? [];
  // 서버가 오름차순으로 주지만, 정렬이 화면 로직의 전제라 한 번 더 보증한다
  const hand = [...(game.yourHand ?? [])].sort((a, b) => a - b);
  const isSpectator = game.yourSeat < 0;
  const isPlaying = game.phase === 'playing';
  const isReady = game.phase === 'ready';
  const isRoundEnd = game.phase === 'round_end';
  // 낼 수 있는 카드는 늘 최저 하나뿐이다 (0 = 손이 비었다)
  const lowest = hand.length > 0 ? hand[0] : 0;
  const vote = game.starVote ?? null;
  const mistake = game.lastMistake ?? null;

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';
  const whoOf = (seat: number) =>
    seat === game.yourSeat ? '내가' : `${nameOf(seat)}님이`;

  // ---- 서버 타임스탬프 기준 시계 -----------------------------------------
  // 차례가 없어 "내 차례" 같은 기준점이 없다. 시간 표시는 전부 서버 endsAt 을
  // 기준으로 계산하고, 백그라운드 복귀 시 즉시 재동기화한다.
  const [now, setNow] = useState(() => Date.now());
  const voteSec = vote ? miSeconds(vote.endsAt, now) : 0;
  const readySec = isReady ? miSeconds(game.endsAt, now) : 0;
  // 초 단위 카운트다운이 도는 동안에만 빠르게 돈다
  const fast = (isReady && readySec > 0) || (vote !== null && voteSec > 0);
  const tickMs = fast ? 200 : 1000;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    // 백그라운드에선 타이머가 멈추므로 복귀 순간 서버 시각 기준으로 재동기화한다
    const sync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    sync();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, [tickMs]);

  // 단계·투표가 바뀌면 즉시 시계를 맞춘다 (카운트다운이 한 틱 늦게 뜨지 않도록)
  const voteEndsAt = vote?.endsAt ?? 0;
  useEffect(() => {
    setNow(Date.now());
  }, [game.phase, game.endsAt, voteEndsAt]);

  // ---- 연타 잠금 ----------------------------------------------------------
  // mi_play 는 카드를 지정하지 않으므로, 응답 전에 두 번 누르면 최저 카드
  // 두 장이 연달아 나간다. 손패가 바뀔 때까지 버튼을 잠근다.
  const [pendingCard, setPendingCard] = useState(0);
  const handKey = hand.join(',');
  useEffect(() => {
    setPendingCard(0);
  }, [handKey]);
  // 서버 응답이 유실돼도 영원히 잠기지 않게 하는 안전장치
  useEffect(() => {
    if (pendingCard === 0) return;
    const timer = window.setTimeout(() => setPendingCard(0), 2000);
    return () => window.clearTimeout(timer);
  }, [pendingCard]);

  const canPlay = isPlaying && !isSpectator && lowest > 0 && pendingCard === 0;
  const handlePlay = () => {
    if (!canPlay) return;
    setPendingCard(lowest);
    onPlay();
  };

  // 수리검 제안·투표도 같은 이유로 한 번만 나가게 잠근다
  const voteKey = vote ? `${vote.proposer}:${vote.endsAt}` : '';
  const [proposing, setProposing] = useState(false);
  const [voteSent, setVoteSent] = useState(false);
  useEffect(() => {
    setProposing(false);
    setVoteSent(false);
  }, [voteKey]);
  useEffect(() => {
    if (!proposing) return;
    const timer = window.setTimeout(() => setProposing(false), 2000);
    return () => window.clearTimeout(timer);
  }, [proposing]);

  const iAmProposer = vote !== null && vote.proposer === game.yourSeat;
  const iAccepted =
    vote !== null && (vote.accepted ?? []).includes(game.yourSeat);
  const canPropose =
    isPlaying &&
    !isSpectator &&
    vote === null &&
    game.stars > 0 &&
    lowest > 0 &&
    !proposing;
  const canVote =
    isPlaying && !isSpectator && vote !== null && !iAmProposer && !iAccepted &&
    !voteSent;

  // ---- 실수 연출 ----------------------------------------------------------
  // 스냅샷이 바뀔 때마다 key 를 갈아 끼워 연출을 다시 돌린다.
  const mistakeKey = mistake
    ? `${mistake.seat}:${mistake.played}:${(mistake.burned ?? [])
        .map((b) => `${b.seat}-${b.card}`)
        .join(',')}`
    : 'none';
  // 생명 감소를 눈에 띄게 — 실수가 새로 뜨는 순간 하트 줄을 흔든다
  const [lifeHit, setLifeHit] = useState(false);
  useEffect(() => {
    if (mistakeKey === 'none') return;
    setLifeHit(true);
    const timer = window.setTimeout(() => setLifeHit(false), 1200);
    return () => window.clearTimeout(timer);
  }, [mistakeKey]);

  // ---- 표시값 -------------------------------------------------------------
  const maxRound = game.maxRound > 0 ? game.maxRound : game.round;
  const shownPile = pile.length > PILE_VISIBLE ? pile.slice(-PILE_VISIBLE) : pile;
  const hiddenPile = pile.length - shownPile.length;
  // 전체 캡(20분)까지 남은 시간 — ready 의 endsAt 은 3초 카운트다운이라 제외
  const capLeft = !isReady && game.endsAt > 0 ? Math.max(0, game.endsAt - now) : 0;
  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const reward = isRoundEnd ? miRewardText(game.round) : '';

  return (
    <div className="mi-scope mi-board">
      <div className="mi-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="mi-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 HUD — 차례가 없으므로 "누구 차례" 자리가 없다. 라운드·생명·수리검뿐. */}
      <div className="mi-hud">
        <span className="mi-hud-round">
          라운드 <strong>{game.round}</strong>
          <span className="mi-hud-round-max"> / {maxRound}</span>
        </span>
        <div className="mi-hud-right">
          <span
            className={`mi-hud-meter life ${lifeHit ? 'hit' : ''}`}
            aria-label={`생명 ${game.lives}개`}
          >
            <span className="mi-hud-icon" aria-hidden="true">
              ❤️
            </span>
            <strong className="mi-hud-count">×{game.lives}</strong>
          </span>
          <span
            className="mi-hud-meter star"
            aria-label={`수리검 ${game.stars}개`}
          >
            <span className="mi-hud-icon" aria-hidden="true">
              ⭐
            </span>
            <strong className="mi-hud-count">×{game.stars}</strong>
          </span>
          {capLeft > 0 && (
            <span className="mi-hud-clock" aria-label="남은 시간">
              ⏱ {mmss(capLeft)}
            </span>
          )}
        </div>
      </div>

      {/* 중앙 무대 — 직전에 나온 수 하나가 이 화면의 주인공이다 */}
      <div className="mi-stage">
        {isReady ? (
          <div className="mi-ready" role="status" aria-live="polite">
            <span className="mi-ready-label">
              {game.round}라운드 · 각자 {game.round}장
            </span>
            {readySec > 0 && readySec <= 10 ? (
              <span key={readySec} className="mi-ready-count">
                {readySec}
              </span>
            ) : (
              <span className="mi-ready-soon">곧 시작합니다</span>
            )}
            <span className="mi-ready-hint">
              숨을 고르세요 — 신호는 오직 침묵입니다
            </span>
          </div>
        ) : (
          <>
            <span className="mi-stage-label">직전에 나온 수</span>
            <span
              key={game.lastPlayed}
              className={`mi-stage-number ${game.lastPlayed > 0 ? '' : 'empty'}`}
              aria-live="polite"
            >
              {game.lastPlayed > 0 ? game.lastPlayed : '—'}
            </span>
            <span className="mi-stage-sub">
              {game.lastPlayed > 0
                ? `이보다 큰 수만 남아야 합니다`
                : '아직 아무도 내지 않았습니다'}
            </span>
          </>
        )}
      </div>

      {/* 실수 연출 — 누가 무엇을 냈고 어떤 카드들이 터졌는지 그대로 펼친다 */}
      {mistake && (
        <div key={mistakeKey} className="mi-mistake" role="status">
          <div className="mi-mistake-head">
            <span className="mi-mistake-mark" aria-hidden="true">
              💥
            </span>
            <span className="mi-mistake-title">
              {whoOf(mistake.seat)} <strong>{mistake.played}</strong>
              {'을(를) 냈습니다 — 생명 −1'}
            </span>
          </div>
          {(mistake.burned ?? []).length > 0 && (
            <>
              <span className="mi-mistake-sub">
                더 작은 카드 {mistake.burned.length}장이 터졌습니다
              </span>
              <div className="mi-mistake-cards">
                {mistake.burned.map((b, i) => (
                  <span key={`${b.seat}-${b.card}-${i}`} className="mi-burned">
                    <span className="mi-burned-num">{b.card}</span>
                    <span className="mi-burned-owner">{nameOf(b.seat)}</span>
                  </span>
                ))}
              </div>
            </>
          )}
          {mistake.message && (
            <span className="mi-mistake-note">{mistake.message}</span>
          )}
        </div>
      )}

      {/* 지나간 더미 — 중앙 숫자를 방해하지 않게 작게 깐다 */}
      <div className="mi-pile-wrap">
        {pile.length === 0 ? (
          <span className="mi-pile-empty">더미가 비어 있습니다</span>
        ) : (
          <div className="mi-pile">
            {hiddenPile > 0 && (
              <span className="mi-pile-more">…{hiddenPile}장</span>
            )}
            {shownPile.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className={`mi-pile-card ${
                  i === shownPile.length - 1 ? 'last' : ''
                }`}
              >
                {n}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 라운드 성공 — 보상 안내 */}
      {isRoundEnd && (
        <div className="mi-round-end" role="status">
          <span className="mi-round-end-title">
            ✨ {game.round}라운드 성공
          </span>
          {reward && <span className="mi-round-end-reward">{reward}</span>}
          <span className="mi-round-end-sub">
            {game.round >= maxRound
              ? '마지막 라운드였습니다'
              : `${game.round + 1}라운드를 준비합니다 — 각자 ${
                  game.round + 1
                }장`}
          </span>
        </div>
      )}

      {/* 관전자는 손패·내기·수리검 UI 를 전부 감춘다 (yourHand 키 자체가 없다) */}
      {isSpectator ? (
        <p className="mi-hint spectator">
          👀 관전 중 — 중앙 숫자와 더미는 볼 수 있지만 카드를 낼 수는 없습니다
        </p>
      ) : (
        <>
          {/* 내 손패 — 낼 수 있는 건 최저 하나뿐이라 나머지는 흐리게 둔다 */}
          <div className="mi-hand-wrap">
            <span className="mi-hand-label">
              내 카드 {hand.length}장
              {hand.length > 1 && ' · 최저 카드만 낼 수 있습니다'}
            </span>
            {hand.length === 0 ? (
              <p className="mi-hand-empty">
                카드를 다 냈습니다 — 남은 사람을 기다립니다
              </p>
            ) : (
              <div className="mi-hand">
                {hand.map((n, i) => (
                  <span
                    key={n}
                    className={`mi-card ${i === 0 ? 'lowest' : 'dim'}`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 큼직한 내기 버튼 — 낼 숫자를 버튼에 그대로 박는다 */}
          <button
            type="button"
            className={`mi-play-button ${pendingCard > 0 ? 'pending' : ''}`}
            onClick={handlePlay}
            disabled={!canPlay}
            aria-label={
              lowest > 0 ? `${lowest} 내기` : '낼 수 있는 카드가 없습니다'
            }
          >
            {lowest > 0 ? (
              <>
                <span className="mi-play-num">{lowest}</span>
                <span className="mi-play-text">
                  {pendingCard > 0 ? '내는 중…' : '내기'}
                </span>
              </>
            ) : (
              <span className="mi-play-text">낼 카드가 없습니다</span>
            )}
          </button>

          {/* 수리검 — 제안 / 투표 바 */}
          <div className="mi-star-bar">
            {vote ? (
              <div className="mi-vote">
                <span className="mi-vote-head">
                  ⭐ {whoOf(vote.proposer)} 수리검을 제안했습니다
                  <span className="mi-vote-sec"> {voteSec}초</span>
                </span>
                <span className="mi-vote-sub">
                  찬성 {(vote.accepted ?? []).length}/
                  {Math.max(1, players.length)} · 발동하면 전원이 최저 카드
                  1장을 버립니다
                </span>
                {canVote ? (
                  <div className="mi-vote-actions">
                    <button
                      type="button"
                      className="mi-vote-button yes"
                      onClick={() => {
                        setVoteSent(true);
                        onStarAccept();
                      }}
                    >
                      찬성
                    </button>
                    <button
                      type="button"
                      className="mi-vote-button no"
                      onClick={() => {
                        setVoteSent(true);
                        onStarDecline();
                      }}
                    >
                      반대
                    </button>
                  </div>
                ) : (
                  <span className="mi-vote-waiting">
                    {iAmProposer
                      ? '전원의 응답을 기다립니다'
                      : voteSent || iAccepted
                        ? '응답했습니다 — 나머지를 기다립니다'
                        : '응답할 수 없습니다'}
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="mi-star-button"
                onClick={() => {
                  if (!canPropose) return;
                  setProposing(true);
                  onStarPropose();
                }}
                disabled={!canPropose}
              >
                ⭐ 수리검 쓰자
                <span className="mi-star-left"> (남은 {game.stars}개)</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* 좌석 스트립 — 차례가 없으니 남은 장수와 접속 상태만 보여준다 */}
      <div className="mi-seats">
        {players.map((p) => {
          const offline = !p.connected && !p.bot;
          return (
            <div
              key={p.seat}
              className={[
                'mi-seat',
                p.seat === game.yourSeat ? 'me' : '',
                p.handCount === 0 ? 'done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="mi-seat-name">
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="mi-seat-meta">
                <strong className="mi-seat-count">{p.handCount}</strong>
                <span className="mi-seat-unit">장</span>
                {offline && <span className="mi-seat-off">끊김</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
