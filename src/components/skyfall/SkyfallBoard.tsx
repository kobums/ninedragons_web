import { useEffect, useState } from 'react';
import type {
  SFEvent,
  SFGameState,
  SFPlayerView,
  SFRole,
} from '../../types/skyfall';
import { SF_ROLE_LABEL } from '../../types/skyfall';
import type { SFToast } from '../../hooks/useSkyfallGameState';
import './SkyfallBoard.css';

interface SkyfallBoardProps {
  game: SFGameState;
  toasts: SFToast[];
  onNightAction: (target: number) => void;
  onVote: (target: number) => void;
}

const ROLE_ICON: Record<Exclude<SFRole, ''>, string> = {
  mafia: '🔪',
  police: '🔍',
  doctor: '💊',
  citizen: '🕯️',
};

const ROLE_DESC: Record<Exclude<SFRole, ''>, string> = {
  mafia: '밤마다 동료와 함께 한 명을 지목해 제거합니다',
  police: '밤마다 한 명을 조사해 마피아 여부를 확인합니다',
  doctor: '밤마다 한 명을 지목해 마피아의 습격에서 지킵니다',
  citizen: '낮 토론과 투표로 마피아를 찾아내세요',
};

// 밤 행동 안내 문구 (행동 역할만)
const NIGHT_PROMPT: Partial<Record<SFRole, string>> = {
  mafia: '암살할 대상을 선택하세요',
  police: '조사할 대상을 선택하세요',
  doctor: '치료할 대상을 선택하세요 (자신 포함)',
};

const NIGHT_VERB: Partial<Record<SFRole, string>> = {
  mafia: '암살',
  police: '조사',
  doctor: '치료',
};

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: SFEvent, game: SFGameState): string {
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
      return '게임이 시작되었습니다';
    case 'night_begin':
      return '🌙 밤이 되었습니다';
    case 'day_result':
      return '☀️ 아침이 밝았습니다';
    case 'vote_begin':
      return '🗳️ 투표를 시작합니다';
    case 'executed':
      return `⚖️ ${name(event.seat)}님이 처형되었습니다`;
    case 'no_execution':
      return '이번 낮에는 아무도 처형되지 않았습니다';
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
  }
}

export function SkyfallBoard({
  game,
  toasts,
  onNightAction,
  onVote,
}: SkyfallBoardProps) {
  // 타일 탭 → 확인 흐름의 로컬 선택 상태
  const [selected, setSelected] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(sf_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 제출 여부는 스냅샷(yourActionDone·votes)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 단계·날짜가 바뀌면 로컬 입력 상태를 리셋한다
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [game.phase, game.dayNo]);

  // 밤 행동·낮 투표 마감 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화)
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

  const me = game.players.find((p) => p.seat === game.yourSeat);
  const amAlive = me?.alive ?? false;
  const role = game.yourRole;
  const isNight = game.phase === 'night';
  const isVote = game.phase === 'day_vote';
  const mafiaSet = new Set(game.mafiaSeats ?? []);
  const votes = game.votes ?? [];
  const myVote = votes.find((v) => v.voter === game.yourSeat);

  const nameOf = (seat: number) =>
    game.players.find((p) => p.seat === seat)?.name ?? '?';

  // 밤에 내가 행동할 차례인지 (시민·사망자·제출 완료자는 대기)
  const canAct =
    isNight &&
    amAlive &&
    role !== '' &&
    role !== 'citizen' &&
    // 해소 전에는 서버가 덮어쓰기를 허용한다 — 제출 후에도 다시 지목해 변경 가능
    !submitted;

  const canVote = isVote && amAlive && !submitted;

  // 이 타일을 지금 탭할 수 있는가
  const selectable = (p: SFPlayerView): boolean => {
    if (!p.alive) return false;
    if (canAct) {
      // 마피아는 동료를 지목할 수 없고, 의사만 자기 자신을 지킬 수 있다
      if (role === 'mafia' && mafiaSet.has(p.seat)) return false;
      if (role !== 'doctor' && p.seat === game.yourSeat) return false;
      return true;
    }
    if (canVote) return true;
    return false;
  };

  const handleTileTap = (p: SFPlayerView) => {
    if (!selectable(p)) return;
    setSelected((prev) => (prev === p.seat ? null : p.seat));
  };

  const handleConfirm = () => {
    if (selected === null) return;
    lockSubmit();
    if (canAct) onNightAction(selected);
    else if (canVote) onVote(selected);
    setSelected(null);
  };

  const handleAbstain = () => {
    if (!canVote) return;
    lockSubmit();
    setSelected(null);
    onVote(-1);
  };

  // 좌석별 득표 수 (공개 투표)
  const voteCount = (seat: number) =>
    votes.filter((v) => v.target === seat).length;
  const hasVoted = (seat: number) => votes.some((v) => v.voter === seat);

  // 상단 배너 보조 문구
  const bannerSub = (() => {
    if (isNight) {
      if (canAct && (game.night?.yourActionDone ?? false))
        return '제출 완료 — 해소 전에는 다시 지목해 변경할 수 있습니다';
      if (canAct) return NIGHT_PROMPT[role] ?? '';
      return '마을이 잠들었습니다… 밤이 지나가길 기다립니다';
    }
    if (game.phase === 'day_result') return '밤 사이 무슨 일이 있었을까요…';
    if (isVote) {
      if (!amAlive) return '사망자는 투표할 수 없습니다 — 관전 중';
      if (myVote) return '투표 완료 — 마감 전에는 다시 탭해 변경할 수 있습니다';
      if (canVote) return '처형할 사람을 지목하거나 기권하세요';
      return '';
    }
    return '';
  })();

  const pendingCount = game.night?.pendingCount ?? 0;

  return (
    <div className={`sf-board ${isNight ? 'night' : 'day'}`}>
      <div className="sf-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="sf-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 단계 배너 */}
      <div className={`sf-phase-banner ${isNight ? 'night' : 'day'}`}>
        <span className="sf-phase-title">
          {isNight ? '🌙' : '☀️'} {game.dayNo}일차 · {isNight ? '밤' : '낮'}
          {game.endsAt > 0 && (
            <span className={`sf-deadline ${remaining < 20_000 ? 'urgent' : ''}`}>
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="sf-phase-sub">{bannerSub}</span>}
      </div>

      {/* 관전자(yourSeat -1, me 없음)에게는 사망 배너를 띄우지 않는다 */}
      {me && !amAlive && (
        <div className="sf-dead-banner">
          💀 당신은 사망했습니다 — 관전 중입니다
        </div>
      )}

      {/* 낮 발표 배너 (day_result 크게, 이후엔 칩으로) */}
      {game.announcement && game.phase === 'day_result' && (
        <div
          className={`sf-announce ${game.announcement.kind === 'killed' ? 'killed' : 'saved'}`}
        >
          {game.announcement.kind === 'killed'
            ? `💀 ${nameOf(game.announcement.seat)}님이 살해당했습니다`
            : '🕊️ 아무도 죽지 않았습니다'}
        </div>
      )}
      {game.announcement && isVote && (
        <div className="sf-announce-chip">
          {game.announcement.kind === 'killed'
            ? `지난 밤 — ${nameOf(game.announcement.seat)}님 사망`
            : '지난 밤 — 아무도 죽지 않았습니다'}
        </div>
      )}

      {/* 내 역할 카드 — 첫 배정 시 key 교체로 등장 연출이 다시 돈다 */}
      {role !== '' && (
        <div key={`role-${role}`} className={`sf-role-card role-${role}`}>
          <div className="sf-role-head">
            <span className="sf-role-icon">{ROLE_ICON[role]}</span>
            <span className="sf-role-name">{SF_ROLE_LABEL[role]}</span>
          </div>
          <p className="sf-role-desc">{ROLE_DESC[role]}</p>
          {role === 'mafia' && mafiaSet.size > 1 && (
            <p className="sf-role-mates">
              동료:{' '}
              {[...mafiaSet]
                .filter((seat) => seat !== game.yourSeat)
                .map((seat) => {
                  const dead =
                    game.players.find((p) => p.seat === seat)?.alive === false;
                  return `${dead ? '💀 ' : ''}${nameOf(seat)}`;
                })
                .join(' · ')}
            </p>
          )}
          {role === 'police' && game.investigation && (
            <span
              className={`sf-invest-chip ${game.investigation.isMafia ? 'mafia' : 'clear'}`}
            >
              🔍 {nameOf(game.investigation.seat)} —{' '}
              {game.investigation.isMafia ? '마피아입니다' : '마피아가 아닙니다'}
            </span>
          )}
        </div>
      )}

      {/* 플레이어 타일 그리드 */}
      <div className="sf-grid">
        {game.players.map((p) => {
          const canTap = selectable(p);
          const isMe = p.seat === game.yourSeat;
          const offline = !p.connected && !p.bot;
          const nVotes = isVote ? voteCount(p.seat) : 0;
          const mateMark =
            role === 'mafia' && mafiaSet.has(p.seat) && !isMe;
          return (
            <button
              key={p.seat}
              type="button"
              className={[
                'sf-tile',
                p.alive ? '' : 'dead',
                canTap ? 'selectable' : '',
                selected === p.seat ? 'selected' : '',
                isMe ? 'me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleTileTap(p)}
              disabled={!canTap}
            >
              <span className="sf-tile-name">
                {p.name}
                {isMe && ' (나)'}
              </span>
              <span className="sf-tile-badges">
                {p.bot && <span className="sf-badge">🤖</span>}
                {mateMark && <span className="sf-badge mate">🔪 동료</span>}
                {offline && <span className="sf-badge off">끊김</span>}
                {isVote && p.alive && hasVoted(p.seat) && (
                  <span className="sf-badge voted">✓ 투표</span>
                )}
                {nVotes > 0 && p.alive && (
                  <span className="sf-badge count">{nVotes}표</span>
                )}
              </span>
              {!p.alive && (
                <span className="sf-tile-dead-line">
                  💀 사망
                  {p.role !== '' && (
                    <span className={`sf-role-chip role-${p.role}`}>
                      {SF_ROLE_LABEL[p.role]}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 밤 대기 — 인원수만 (역할 목록은 사망자 역할 추론 여지가 있어 비공개) */}
      {isNight && pendingCount > 0 && (
        <p className="sf-night-pending">
          아직 {pendingCount}명이 행동 중입니다…
        </p>
      )}

      {/* 공개 투표 목록 */}
      {isVote && votes.length > 0 && (
        <div className="sf-vote-list">
          <span className="sf-vote-list-title">공개 투표</span>
          {votes.map((v) => (
            <span key={v.voter} className="sf-vote-row">
              {nameOf(v.voter)} →{' '}
              {v.target < 0 ? (
                <em>기권</em>
              ) : (
                <strong>{nameOf(v.target)}</strong>
              )}
            </span>
          ))}
        </div>
      )}

      {/* 하단 확인 바 — 타일 탭 후 확정 */}
      {selected !== null && (canAct || canVote) && (
        <div className="sf-confirm-bar">
          <span className="sf-confirm-text">
            {canAct
              ? `${nameOf(selected)}님을 ${NIGHT_VERB[role] ?? '지목'}할까요?`
              : `${nameOf(selected)}님에게 투표할까요?`}
          </span>
          <div className="sf-confirm-actions">
            <button
              type="button"
              className="sf-confirm-button"
              onClick={handleConfirm}
            >
              확인
            </button>
            <button
              type="button"
              className="sf-cancel-button"
              onClick={() => setSelected(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 기권 버튼 (투표 중, 아직 미선택 상태) */}
      {canVote && selected === null && (
        <button
          type="button"
          className="sf-abstain-button"
          onClick={handleAbstain}
        >
          기권하기
        </button>
      )}

      {/* 처형 발표 오버레이 */}
      {game.phase === 'execution' && (
        <div className="sf-exec-overlay">
          <div className="sf-exec-card">
            {game.execution && game.execution.seat >= 0 ? (
              <>
                <h2 className="sf-exec-title">
                  ⚖️ {nameOf(game.execution.seat)}님이 처형되었습니다
                </h2>
                {game.execution.role && (
                  <span
                    className={`sf-role-chip big role-${game.execution.role}`}
                  >
                    {ROLE_ICON[game.execution.role]}{' '}
                    {SF_ROLE_LABEL[game.execution.role]}
                  </span>
                )}
              </>
            ) : (
              <h2 className="sf-exec-title">
                이번 낮에는 아무도 처형되지 않았습니다
              </h2>
            )}
            <p className="sf-exec-sub">잠시 후 밤이 찾아옵니다…</p>
          </div>
        </div>
      )}
    </div>
  );
}
