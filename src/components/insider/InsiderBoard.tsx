import { useEffect, useState } from 'react';
import type { IDEvent, IDGameState, IDPlayerView } from '../../types/insider';
import { ID_ROLE_ICON, ID_ROLE_LABEL } from '../../types/insider';
import type { IDToast } from '../../hooks/useInsiderGameState';
import './InsiderBoard.css';

interface InsiderBoardProps {
  game: IDGameState;
  toasts: IDToast[];
  // 마스터 전용 — 누군가 정답을 말했다
  onCorrect: () => void;
  // 마스터 전용 — 토론을 끝내고 투표를 연다
  onOpenVote: () => void;
  onVote: (seat: number) => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: IDEvent, game: IDGameState): string {
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
    case 'correct':
      return '✅ 정답이 나왔습니다! 토론을 시작하세요';
    case 'vote_begin':
      return '🗳️ 투표를 시작합니다';
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

export function InsiderBoard({
  game,
  toasts,
  onCorrect,
  onOpenVote,
  onVote,
}: InsiderBoardProps) {
  // 타일 탭 → 확인 흐름의 로컬 선택 상태
  const [selected, setSelected] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지 (마스터 버튼·투표 공용).
  // 서버가 거부(id_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 제출 여부는 스냅샷(voted·phase)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 단계가 바뀌면 로컬 입력 상태를 리셋한다 (스냅샷 컨텍스트 변경 방어)
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [game.phase]);

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

  const players = game.players ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)는 행동 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;
  const role = game.yourRole;
  const isMaster = !isSpectator && role === 'master';
  const isQuestion = game.phase === 'question';
  const isDiscussion = game.phase === 'discussion';
  const isVoting = game.phase === 'voting';
  // 개표 완료 여부 — result 가 채워지면 투표 타일 대신 개표 연출을 그린다
  const counted = isVoting && game.result != null;

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  const canVote = isVoting && !isSpectator && !counted && !(me?.voted ?? false) && !submitted;

  const handleTileTap = (p: IDPlayerView) => {
    if (!canVote) return;
    setSelected((prev) => (prev === p.seat ? null : p.seat));
  };

  const handleConfirmVote = () => {
    if (selected === null || !canVote) return;
    lockSubmit();
    onVote(selected);
    setSelected(null);
  };

  const handleCorrect = () => {
    if (submitted) return;
    lockSubmit();
    onCorrect();
  };

  const handleOpenVote = () => {
    if (submitted) return;
    lockSubmit();
    onOpenVote();
  };

  const votedCount = players.filter((p) => p.voted).length;

  // 단계별 제목·안내
  const phaseTitle = isQuestion
    ? '🔍 질문 타임'
    : isDiscussion
      ? '🗣️ 토론 타임'
      : counted
        ? '📣 개표'
        : '🗳️ 투표';
  const phaseSub = (() => {
    if (isQuestion) {
      if (isMaster)
        return '예/아니오로만 답하세요 — 누군가 정답을 말하면 [정답 나옴]을 누르세요';
      return `음성으로 ${nameOf(game.masterSeat)}님에게 질문하며 제시어를 맞히세요`;
    }
    if (isDiscussion) {
      if (isMaster)
        return '"정답자가 인사이더인가?" — 토론이 끝나면 [투표 시작]을 누르세요';
      return '"정답자가 인사이더인가?" 음성으로 토론하세요';
    }
    if (counted) return '최다 득표자가 공개됩니다 (동표면 마스터 지목이 결정)';
    if (isSpectator) return '전원이 인사이더로 의심되는 1인을 비공개 지목합니다';
    if (me?.voted) return '투표 완료 — 개표를 기다립니다';
    return '인사이더로 의심되는 1인의 좌석을 탭해 지목하세요';
  })();

  // 개표 연출 — 득표 내림차순 정렬, 최다 득표자 강조
  const tally = counted
    ? [...players].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    : [];
  const maxVotes = tally.length > 0 ? (tally[0].votes ?? 0) : 0;

  return (
    <div className="id-scope id-board">
      <div className="id-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="id-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 단계 배너 + 큰 타이머 */}
      <div className={`id-phase-banner ${game.phase}`}>
        <span className="id-phase-title">{phaseTitle}</span>
        {game.endsAt > 0 && (
          <span
            className={`id-timer ${remaining < 30_000 ? 'urgent' : ''} ${
              isVoting ? 'small' : ''
            }`}
          >
            {mmss(remaining)}
          </span>
        )}
        <span className="id-phase-sub">{phaseSub}</span>
      </div>

      {/* 내 역할 카드 — 첫 배정 시 key 교체로 등장 연출이 다시 돈다 */}
      {!isSpectator && role !== '' && (
        <div key={`role-${role}`} className={`id-role-card role-${role}`}>
          <div className="id-role-head">
            <span className="id-role-icon">{ID_ROLE_ICON[role]}</span>
            <span className="id-role-name">{ID_ROLE_LABEL[role]}</span>
            {role === 'master' && (
              <span className="id-role-public">전원에게 공개</span>
            )}
          </div>
          <p className="id-role-desc">
            {role === 'master'
              ? '질문에 예/아니오로만 답하는 진행자입니다 — 정체가 모두에게 공개됩니다'
              : role === 'insider'
                ? '제시어를 아는 내부자입니다 — 정체를 들키지 않고 정답이 나오게 유도하세요'
                : '질문으로 제시어를 맞히고, 숨어 있는 인사이더를 찾아내세요'}
          </p>
        </div>
      )}
      {isSpectator && (
        <div className="id-spectator-note">👀 관전 중 — 행동할 수 없습니다</div>
      )}

      {/* 제시어 카드 — 마스터·인사이더에게만 (은닉 스냅샷: 그 외에는 word 부재) */}
      {!isSpectator && game.word && (
        <div className="id-word-card">
          <span className="id-word-label">제시어</span>
          <span className="id-word">{game.word}</span>
          <span className="id-word-hint">
            {role === 'insider'
              ? '다른 사람에게 보이지 않게 조심하세요'
              : '이 단어가 정답입니다'}
          </span>
        </div>
      )}

      {/* 마스터 전용 진행 버튼 */}
      {isMaster && isQuestion && (
        <button
          type="button"
          className="id-master-button"
          onClick={handleCorrect}
          disabled={submitted}
        >
          ✅ 정답 나옴
        </button>
      )}
      {isMaster && isDiscussion && (
        <button
          type="button"
          className="id-master-button"
          onClick={handleOpenVote}
          disabled={submitted}
        >
          🗳️ 투표 시작
        </button>
      )}

      {/* 개표 연출 — 득표 순 릴레이 공개 */}
      {counted ? (
        <div className="id-tally">
          {tally.map((p, i) => (
            <div
              key={p.seat}
              className={`id-tally-row ${
                (p.votes ?? 0) === maxVotes && maxVotes > 0 ? 'top' : ''
              }`}
              style={{ animationDelay: `${i * 0.35}s` }}
            >
              <span className="id-tally-name">
                {p.seat === game.masterSeat && '👁 '}
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
              </span>
              <span className="id-tally-votes">{p.votes ?? 0}표</span>
            </div>
          ))}
        </div>
      ) : (
        /* 플레이어 타일 그리드 — 투표 단계엔 탭해서 지목 */
        <div className="id-grid">
          {players.map((p) => {
            const canTap = canVote;
            const isMe = p.seat === game.yourSeat;
            const offline = !p.connected && !p.bot;
            return (
              <button
                key={p.seat}
                type="button"
                className={[
                  'id-tile',
                  canTap ? 'selectable' : '',
                  selected === p.seat ? 'selected' : '',
                  isMe ? 'me' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleTileTap(p)}
                disabled={!canTap}
              >
                <span className="id-tile-name">
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="id-tile-badges">
                  {p.seat === game.masterSeat && (
                    <span className="id-badge master">👁 마스터</span>
                  )}
                  {p.bot && <span className="id-badge">🤖</span>}
                  {offline && <span className="id-badge off">끊김</span>}
                  {isVoting && p.voted && (
                    <span className="id-badge voted">✓ 투표</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 투표 진행 현황 */}
      {isVoting && !counted && (
        <p className="id-vote-pending">
          {votedCount}/{players.length}명 투표 완료 — 비공개 투표입니다
        </p>
      )}

      {/* 하단 확인 바 — 타일 탭 후 확정 */}
      {selected !== null && canVote && (
        <div className="id-confirm-bar">
          <span className="id-confirm-text">
            {nameOf(selected)}님을 인사이더로 지목할까요?
          </span>
          <div className="id-confirm-actions">
            <button
              type="button"
              className="id-confirm-button"
              onClick={handleConfirmVote}
            >
              확인
            </button>
            <button
              type="button"
              className="id-cancel-button"
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
