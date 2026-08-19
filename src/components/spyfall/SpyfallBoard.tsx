import { useEffect, useState } from 'react';
import type { SPEvent, SPGameState } from '../../types/spyfall';
import type { SPToast } from '../../hooks/useSpyfallGameState';
import './SpyfallBoard.css';

interface SpyfallBoardProps {
  game: SPGameState;
  toasts: SPToast[];
  onGuess: (location: string) => void;
  onVote: (target: number) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: SPEvent, game: SPGameState): string {
  if (event.message) return event.message;
  const name = (seat?: number) =>
    // 퇴장 이벤트는 스냅샷에서 좌석이 이미 빠진 뒤라 이벤트의 name 이 우선
    game.players.find((p) => p.seat === seat)?.name ?? event.name ?? '?';

  switch (event.kind) {
    case 'joined':
      return `${name(event.seat)}님이 입장했습니다`;
    case 'left':
      return `${name(event.seat)}님이 나갔습니다`;
    case 'started':
      return '🕵️ 게임 시작 — 스파이를 찾아내세요';
    case 'guess':
      return '🕵️ 스파이가 정답을 추리했습니다';
    case 'vote_begin':
      return '🗳️ 시간 종료 — 스파이 투표를 시작합니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    // react 등 토스트로 쓰지 않는 이벤트 — 훅에서 걸러지지만 타입상 방어
    default:
      return '';
  }
}

// 남은 시간 mm:ss (음수 방지)
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SpyfallBoard({
  game,
  toasts,
  onGuess,
  onVote,
}: SpyfallBoardProps) {
  // 서버 endsAt(unixMillis) 기준 로컬 1초 카운트다운
  const [now, setNow] = useState(() => Date.now());
  // 스파이의 추리 후보 (탭 → 확인 흐름)
  const [guessPick, setGuessPick] = useState<string | null>(null);
  // 투표 지목 후보
  const [votePick, setVotePick] = useState<number | null>(null);
  // 비스파이 개인 소거 메모 — 로컬 전용, 서버에 보내지 않는다
  const [struck, setStruck] = useState<ReadonlySet<string>>(new Set());
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(sp_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 제출 여부는 스냅샷(voted·votes·result)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const isPlaying = game.phase === 'playing';
  const isVoting = game.phase === 'voting';

  useEffect(() => {
    if ((!isPlaying && !isVoting) || game.endsAt <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const sync = () => setNow(Date.now());
    // 백그라운드 탭 복귀 직후 낡은 시간이 보이지 않게 즉시 재동기화
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [isPlaying, isVoting, game.endsAt]);

  // 단계가 바뀌면 로컬 입력 상태를 리셋한다 (소거 메모는 유지)
  useEffect(() => {
    setGuessPick(null);
    setVotePick(null);
    setSubmitted(false);
  }, [game.phase]);

  const remaining = game.endsAt > 0 ? game.endsAt - now : 0;
  const urgent = isPlaying && game.endsAt > 0 && remaining < 60_000;

  const locations = game.locations ?? [];
  const votes = game.votes ?? [];
  const me = game.players.find((p) => p.seat === game.yourSeat);
  const myVoted =
    (me?.voted ?? false) || votes.some((v) => v.voter === game.yourSeat);

  const nameOf = (seat: number) =>
    game.players.find((p) => p.seat === seat)?.name ?? '?';

  // 관전자(yourSeat -1)는 행동 잠금 — 서버도 에러 처리하지만 UI 부터 막는다
  const isSpectator = game.yourSeat < 0;
  const canGuess = !isSpectator && isPlaying && game.isSpy && !submitted;
  // 집계 전에는 서버가 덮어쓰기를 허용한다 — 투표 후에도 다시 지목해 변경 가능
  const canVote = !isSpectator && isVoting && !submitted;

  // 장소 타일 탭 — 스파이는 추리 후보 선택, 그 외에는 개인 소거 토글
  const handleLocationTap = (loc: string) => {
    if (canGuess) {
      setGuessPick((prev) => (prev === loc ? null : loc));
      return;
    }
    setStruck((prev) => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  };

  const handleTileTap = (seat: number) => {
    if (!canVote || seat === game.yourSeat) return;
    setVotePick((prev) => (prev === seat ? null : seat));
  };

  const handleConfirmGuess = () => {
    if (guessPick === null || !canGuess) return;
    lockSubmit();
    onGuess(guessPick);
    setGuessPick(null);
  };

  const handleConfirmVote = () => {
    if (votePick === null || !canVote) return;
    lockSubmit();
    onVote(votePick);
    setVotePick(null);
  };

  // 좌석별 득표 수 (공개 투표)
  const voteCount = (seat: number) =>
    votes.filter((v) => v.target === seat).length;

  const votedCount = game.players.filter((p) => p.voted).length;

  const category = game.category || '장소';

  const bannerSub = (() => {
    if (isPlaying) {
      if (game.endsAt > 0 && remaining <= 0) return '곧 투표가 시작됩니다…';
      if (isSpectator) return '요원들의 대화를 지켜보는 중…';
      return game.isSpy
        ? `정체를 숨기고 대화에서 ${category} 정답을 알아내세요`
        : `스파이에게 ${category} 정답을 들키지 않게 질문하세요`;
    }
    if (isVoting) {
      if (isSpectator)
        return `스파이 투표가 진행 중입니다 (${votedCount}/${game.players.length})`;
      if (myVoted)
        return `투표 완료 (${votedCount}/${game.players.length}) — 마감 전에는 다시 탭해 변경할 수 있습니다`;
      return '스파이로 의심되는 사람을 지목하세요';
    }
    return '';
  })();

  return (
    <div className="sp-board">
      <div className="sp-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="sp-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 배너 — playing: 타이머 / voting: 투표 안내 */}
      <div className={`sp-phase-banner ${isVoting ? 'voting' : ''} ${urgent ? 'urgent' : ''}`}>
        {isPlaying ? (
          <>
            <span className="sp-timer-caption">남은 시간</span>
            <span className={`sp-timer-digits ${urgent ? 'urgent' : ''}`}>
              {formatRemaining(remaining)}
            </span>
          </>
        ) : (
          <>
            <span className="sp-phase-title">🗳️ 스파이 투표</span>
            {isVoting && game.endsAt > 0 && (
              <span className={`sp-timer-digits ${remaining < 20_000 ? 'urgent' : ''}`}>
                {formatRemaining(remaining)}
              </span>
            )}
          </>
        )}
        {bannerSub && <span className="sp-phase-sub">{bannerSub}</span>}
      </div>

      {/* 내 카드 — key 교체로 배정 연출이 다시 돈다.
          관전자는 정체 카드가 없다 (isSpy false·location '' 로 와서 오해 소지). */}
      {isSpectator ? (
        <div className="sp-identity-card agent">
          <span className="sp-identity-caption">관전</span>
          <p className="sp-identity-desc">
            공개 정보만 볼 수 있습니다 — 정답과 스파이는 종료 시 공개됩니다
          </p>
        </div>
      ) : (
      <div
        key={`identity-${game.isSpy ? 'spy' : game.location}`}
        className={`sp-identity-card ${game.isSpy ? 'spy' : 'agent'}`}
      >
        {game.isSpy ? (
          <>
            <span className="sp-identity-title">🕵️ 당신은 스파이</span>
            <p className="sp-identity-desc">
              {isPlaying
                ? `아래 ${category} 목록에서 탭해 추리할 수 있습니다 — 적중하면 즉시 승리, 빗나가면 즉시 패배`
                : '들키지 않았기를 빌어보세요…'}
            </p>
          </>
        ) : (
          <>
            <span className="sp-identity-caption">{category}</span>
            <span className="sp-identity-location">{game.location}</span>
            <p className="sp-identity-desc">
              당신만 아는 것이 아닙니다 — 스파이만 모릅니다
            </p>
          </>
        )}
      </div>
      )}

      {/* 장소 목록 24곳 */}
      <div className="sp-locations">
        <div className="sp-section-head">
          <span className="sp-section-title">{category} 목록</span>
          <span className="sp-section-hint">
            {canGuess
              ? '탭해서 추리할 정답 선택'
              : '탭하면 개인 메모용으로 지워집니다'}
          </span>
        </div>
        <div className="sp-location-grid">
          {locations.map((loc) => {
            const mine = !game.isSpy && loc === game.location;
            const picked = guessPick === loc;
            const isStruck = !picked && struck.has(loc);
            return (
              <button
                key={loc}
                type="button"
                className={[
                  'sp-location',
                  mine ? 'mine' : '',
                  picked ? 'picked' : '',
                  isStruck ? 'struck' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleLocationTap(loc)}
              >
                {loc}
              </button>
            );
          })}
        </div>
      </div>

      {/* 플레이어 타일 — voting 에서 탭 지목 */}
      <div className="sp-players">
        <div className="sp-section-head">
          <span className="sp-section-title">요원 명단</span>
          {isVoting && (
            <span className="sp-section-hint">
              투표 {votedCount}/{game.players.length}
            </span>
          )}
        </div>
        <div className="sp-player-grid">
          {game.players.map((p) => {
            const isMe = p.seat === game.yourSeat;
            const canTap = canVote && !isMe;
            const offline = !p.connected && !p.bot;
            const nVotes = isVoting ? voteCount(p.seat) : 0;
            return (
              <button
                key={p.seat}
                type="button"
                className={[
                  'sp-tile',
                  canTap ? 'selectable' : '',
                  votePick === p.seat ? 'selected' : '',
                  isMe ? 'me' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleTileTap(p.seat)}
                disabled={!canTap}
              >
                <span className="sp-tile-name">
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="sp-tile-badges">
                  {p.bot && <span className="sp-badge">🤖</span>}
                  {offline && <span className="sp-badge off">끊김</span>}
                  {isVoting && p.voted && (
                    <span className="sp-badge voted">✓ 투표</span>
                  )}
                  {nVotes > 0 && (
                    <span className="sp-badge count">{nVotes}표</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 공개 투표 목록 */}
      {isVoting && votes.length > 0 && (
        <div className="sp-vote-list">
          <span className="sp-vote-list-title">공개 투표</span>
          {votes.map((v) => (
            <span key={v.voter} className="sp-vote-row">
              {nameOf(v.voter)} → <strong>{nameOf(v.target)}</strong>
            </span>
          ))}
        </div>
      )}

      {/* 하단 확인 바 — 추리 확정 */}
      {canGuess && guessPick !== null && (
        <div className="sp-confirm-bar">
          <span className="sp-confirm-text">
            정답을 <strong>{guessPick}</strong>(으)로 추리할까요? 틀리면 즉시
            패배합니다
          </span>
          <div className="sp-confirm-actions">
            <button
              type="button"
              className="sp-confirm-button"
              onClick={handleConfirmGuess}
            >
              추리 확정
            </button>
            <button
              type="button"
              className="sp-cancel-button"
              onClick={() => setGuessPick(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 하단 확인 바 — 투표 확정 */}
      {canVote && votePick !== null && (
        <div className="sp-confirm-bar">
          <span className="sp-confirm-text">
            <strong>{nameOf(votePick)}</strong>님을 스파이로 지목할까요?
          </span>
          <div className="sp-confirm-actions">
            <button
              type="button"
              className="sp-confirm-button"
              onClick={handleConfirmVote}
            >
              확인
            </button>
            <button
              type="button"
              className="sp-cancel-button"
              onClick={() => setVotePick(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
