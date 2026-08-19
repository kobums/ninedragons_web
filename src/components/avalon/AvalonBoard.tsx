import { useEffect, useState } from 'react';
import type { AVEvent, AVGameState, AVPlayerView, AVRole } from '../../types/avalon';
import { AV_ROLE_LABEL, isEvilRole } from '../../types/avalon';
import type { AVToast } from '../../hooks/useAvalonGameState';
import './AvalonBoard.css';

interface AvalonBoardProps {
  game: AVGameState;
  toasts: AVToast[];
  onPick: (seats: number[]) => void;
  onTeamVote: (approve: boolean) => void;
  onQuest: (success: boolean) => void;
  onAssassinate: (seat: number) => void;
}

const ROLE_ICON: Record<Exclude<AVRole, ''>, string> = {
  merlin: '🔮',
  good: '🛡️',
  assassin: '🗡️',
  evil: '🌑',
};

const ROLE_DESC: Record<Exclude<AVRole, ''>, string> = {
  merlin: '악의 세력이 누구인지 알고 있습니다 — 들키면 암살당하니 조심하세요',
  good: '원정을 성공시켜 카멜롯을 지키세요',
  assassin: '원정을 방해하고, 선이 3승 하면 멀린을 찾아 암살하세요',
  evil: '정체를 숨기고 원정에 실패 카드를 섞으세요',
};

const PHASE_LABEL: Record<string, string> = {
  team_pick: '원정대 지명',
  team_vote: '원정대 투표',
  quest: '원정 수행',
  assassin: '암살자의 시간',
  game_over: '게임 종료',
};

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: AVEvent, game: AVGameState): string {
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
    case 'bot_takeover':
      return `${name(event.seat)}님 자리를 봇이 이어받습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

export function AvalonBoard({
  game,
  toasts,
  onPick,
  onTeamVote,
  onQuest,
  onAssassinate,
}: AvalonBoardProps) {
  // 리더의 원정대 로컬 선택 (확정 전까지 서버에 안 나간다)
  const [pickSelected, setPickSelected] = useState<number[]>([]);
  // 원정 카드 로컬 선택 (탭 → 확인 흐름)
  const [questCard, setQuestCard] = useState<'success' | 'fail' | null>(null);
  // 암살 대상 로컬 선택
  const [assassinSelected, setAssassinSelected] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(av_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 제출 여부는 스냅샷(votedTeam·questDone·phase)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  // 단계·라운드·리더가 바뀌면 로컬 입력 상태를 리셋한다
  useEffect(() => {
    setPickSelected([]);
    setQuestCard(null);
    setAssassinSelected(null);
    setSubmitted(false);
  }, [game.phase, game.round, game.rejectCount, game.leaderSeat]);

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

  const me = game.players.find((p) => p.seat === game.yourSeat);
  const role = game.yourRole;
  const amEvil = isEvilRole(role);
  const evilSet = new Set(game.evilSeats ?? []);
  const isLeader = game.leaderSeat === game.yourSeat;
  const isPick = game.phase === 'team_pick';
  const isVote = game.phase === 'team_vote';
  const isQuest = game.phase === 'quest';
  const isAssassin = game.phase === 'assassin';

  // 서버가 빈 목록을 null 로 보내는 회귀가 있어도 죽지 않게 방어한다
  const questSizes = game.questSizes ?? [];
  const results = game.results ?? [];
  const requiredSize = questSizes[game.round - 1] ?? 0;
  const teamSet = new Set(game.team ?? []);
  const teamVotes = game.teamVotes ?? [];
  const playerCount = game.players.length;
  // 7인 이상의 4라운드만 실패 2장이어야 원정 실패
  const twoFailRound = playerCount >= 7 ? 4 : 0;

  const nameOf = (seat: number) =>
    game.players.find((p) => p.seat === seat)?.name ?? '?';

  const myVoted = me?.votedTeam ?? false;
  const myQuestDone = me?.questDone ?? false;
  const amOnTeam = me?.onTeam ?? false;
  const votedCount = game.players.filter((p) => p.votedTeam).length;
  const questDoneCount = game.players.filter((p) => p.questDone).length;

  const canPick = isPick && isLeader && !submitted;
  const canVote = isVote && !myVoted && !submitted;
  const canQuest = isQuest && amOnTeam && !myQuestDone && !submitted;

  // 리더의 타일 탭 — 정원까지 선택, 이미 뽑은 타일은 다시 탭해 해제
  const togglePick = (seat: number) => {
    setPickSelected((prev) =>
      prev.includes(seat)
        ? prev.filter((s) => s !== seat)
        : prev.length < requiredSize
          ? [...prev, seat]
          : prev,
    );
  };

  const selectable = (p: AVPlayerView): boolean => {
    if (!canPick) return false;
    // 정원이 찼으면 해제만 가능
    return pickSelected.includes(p.seat) || pickSelected.length < requiredSize;
  };

  const handleConfirmPick = () => {
    if (pickSelected.length !== requiredSize) return;
    lockSubmit();
    onPick(pickSelected);
  };

  const handleVote = (approve: boolean) => {
    if (!canVote) return;
    lockSubmit();
    onTeamVote(approve);
  };

  const handleConfirmQuest = () => {
    if (!canQuest || questCard === null) return;
    lockSubmit();
    onQuest(questCard === 'success');
    setQuestCard(null);
  };

  const handleConfirmAssassinate = () => {
    if (assassinSelected === null || submitted) return;
    lockSubmit();
    onAssassinate(assassinSelected);
  };

  // 직전 원정 결과 배너의 성공/실패 판정 — 결과 배열이 근거,
  // 없으면 실패 장수로 보수적으로 유추한다
  const lastOutcome =
    results.length > 0
      ? results[results.length - 1]
      : game.lastQuest && game.lastQuest.fails > 0
        ? 'evil'
        : 'good';

  // 상단 배너 보조 문구
  const bannerSub = (() => {
    if (isPick) {
      if (isLeader)
        return `원정대 ${requiredSize}명을 지명하세요 (${pickSelected.length}/${requiredSize}) — 시간 초과 시 자동 지명됩니다`;
      return `👑 ${nameOf(game.leaderSeat)}님이 원정대를 뽑는 중…`;
    }
    if (isVote) {
      if (myVoted) return '투표 제출 완료 — 전원 제출 시 일괄 공개됩니다';
      return '제안된 원정대에 찬성/반대를 던지세요 — 시간 초과 시 찬성 처리됩니다';
    }
    if (isQuest) {
      if (amOnTeam) {
        if (myQuestDone) return '카드 제출 완료 — 다른 원정대원을 기다립니다';
        return '원정 카드를 비밀리에 제출하세요 — 시간 초과 시 성공 처리됩니다';
      }
      return '원정대가 임무를 수행 중입니다…';
    }
    if (isAssassin) {
      if (role === 'assassin')
        return '멀린이라 생각되는 선 플레이어를 지목하세요';
      return '🗡️ 암살자가 멀린을 찾는 중…';
    }
    return '';
  })();

  return (
    <div className="av-board">
      <div className="av-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="av-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="av-phase-banner">
        <span className="av-phase-title">
          ⚔️ 라운드 {game.round}/5 · {PHASE_LABEL[game.phase] ?? game.phase}
          {game.endsAt > 0 && (
            <span className={`av-deadline ${remaining < 20_000 ? 'urgent' : ''}`}>
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="av-phase-sub">{bannerSub}</span>}
      </div>

      {/* 원정 트랙 — 원 5개 + 부결 트래커 */}
      <div className="av-track-wrap">
        <div className="av-quest-track">
          {questSizes.map((size, i) => {
            const result = results[i];
            const current = !result && i + 1 === game.round;
            return (
              <div key={i} className="av-quest-slot">
                <div
                  className={[
                    'av-quest-circle',
                    result === 'good' ? 'good' : '',
                    result === 'evil' ? 'evil' : '',
                    current ? 'current' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {result === 'good' ? '✓' : result === 'evil' ? '✕' : size}
                </div>
                {twoFailRound === i + 1 && (
                  <span className="av-two-fail-mark" title="실패 2장 필요">
                    ✕✕
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="av-reject-track">
          <span className="av-reject-label">부결 {game.rejectCount}/5</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={[
                'av-reject-cell',
                i < game.rejectCount ? 'filled' : '',
                i === 4 ? 'last' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>
        {twoFailRound > 0 && (
          <p className="av-track-note">
            ✕✕ {twoFailRound}번째 원정은 실패 2장이어야 실패합니다
          </p>
        )}
      </div>

      {/* 직전 원정 결과 발표 배너 — 새 결과마다 key 교체로 연출 재생 */}
      {game.lastQuest && (
        <div
          key={`quest-result-${results.length}`}
          className={`av-quest-announce ${lastOutcome}`}
        >
          {lastOutcome === 'good' ? '🛡️' : '💥'} 지난 원정 — 실패{' '}
          {game.lastQuest.fails}장 / {game.lastQuest.size}장 →{' '}
          {lastOutcome === 'good' ? '원정 성공' : '원정 실패'}
        </div>
      )}

      {/* 내 역할 카드 — 첫 배정 시 key 교체로 등장 연출이 다시 돈다 */}
      {role !== '' && (
        <div
          key={`role-${role}`}
          className={`av-role-card role-${role} ${amEvil ? 'faction-evil' : 'faction-good'}`}
        >
          <div className="av-role-head">
            <span className="av-role-icon">{ROLE_ICON[role]}</span>
            <span className="av-role-name">{AV_ROLE_LABEL[role]}</span>
            <span className={`av-faction-chip ${amEvil ? 'evil' : 'good'}`}>
              {amEvil ? '악' : '선'}
            </span>
          </div>
          <p className="av-role-desc">{ROLE_DESC[role]}</p>
          {evilSet.size > 0 && (role === 'merlin' || amEvil) && (
            <p className="av-role-mates">
              {role === 'merlin' ? '악의 세력: ' : '동료: '}
              {[...evilSet]
                .filter((seat) => seat !== game.yourSeat)
                .map((seat) => nameOf(seat))
                .join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* 플레이어 타일 그리드 */}
      <div className="av-grid">
        {game.players.map((p) => {
          const canTap = selectable(p);
          const isMe = p.seat === game.yourSeat;
          const offline = !p.connected && !p.bot;
          const picked = canPick
            ? pickSelected.includes(p.seat)
            : teamSet.has(p.seat) || p.onTeam;
          const evilMark = evilSet.has(p.seat) && !isMe;
          return (
            <button
              key={p.seat}
              type="button"
              className={[
                'av-tile',
                canTap ? 'selectable' : '',
                picked ? 'picked' : '',
                isMe ? 'me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => canTap && togglePick(p.seat)}
              disabled={!canTap}
            >
              <span className="av-tile-name">
                {p.seat === game.leaderSeat && (
                  <span className="av-tile-crown">👑</span>
                )}
                {p.name}
                {isMe && ' (나)'}
              </span>
              <span className="av-tile-badges">
                {p.bot && <span className="av-badge">🤖</span>}
                {evilMark && (
                  <span className="av-badge evil-mark">
                    {amEvil ? '🌑 동료' : '🌑 악'}
                  </span>
                )}
                {picked && <span className="av-badge team">⚔️ 원정대</span>}
                {isVote && p.votedTeam && (
                  <span className="av-badge voted">✓ 투표</span>
                )}
                {isQuest && p.questDone && (
                  <span className="av-badge voted">✓ 제출</span>
                )}
                {offline && <span className="av-badge off">끊김</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* team_vote — 제안 팀 + 찬반 큰 버튼 + 제출 현황 */}
      {isVote && (
        <div className="av-vote-panel">
          <p className="av-vote-team-line">
            👑 {nameOf(game.leaderSeat)}님의 제안 —{' '}
            {(game.team ?? []).map((s) => nameOf(s)).join(' · ')}
          </p>
          {canVote ? (
            <div className="av-vote-buttons">
              <button
                type="button"
                className="av-vote-button approve"
                onClick={() => handleVote(true)}
              >
                👍 찬성
              </button>
              <button
                type="button"
                className="av-vote-button reject"
                onClick={() => handleVote(false)}
              >
                👎 반대
              </button>
            </div>
          ) : (
            <p className="av-vote-done">투표 제출 완료</p>
          )}
          <p className="av-vote-progress">
            제출 {votedCount}/{playerCount} — 전원 제출 시 일괄 공개
          </p>
        </div>
      )}

      {/* 직전 원정대 투표 일괄 공개 목록 (해소 후 스냅샷에 실려온다) */}
      {teamVotes.length > 0 && (
        <div className="av-vote-list">
          <span className="av-vote-list-title">
            원정대 투표 결과 — 찬성 {teamVotes.filter((v) => v.approve).length} ·
            반대 {teamVotes.filter((v) => !v.approve).length}
          </span>
          <div className="av-vote-rows">
            {teamVotes.map((v) => (
              <span
                key={v.voter}
                className={`av-vote-row ${v.approve ? 'approve' : 'reject'}`}
              >
                {nameOf(v.voter)} {v.approve ? '👍' : '👎'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* quest — 원정대원만 성공/실패 카드 */}
      {isQuest && amOnTeam && (
        <div className="av-quest-panel">
          {canQuest ? (
            <>
              <div className="av-quest-cards">
                <button
                  type="button"
                  className={`av-quest-card success ${questCard === 'success' ? 'selected' : ''}`}
                  onClick={() =>
                    setQuestCard((prev) => (prev === 'success' ? null : 'success'))
                  }
                >
                  <span className="av-quest-card-icon">🛡️</span>
                  성공
                </button>
                <button
                  type="button"
                  className={`av-quest-card fail ${questCard === 'fail' ? 'selected' : ''}`}
                  onClick={() =>
                    setQuestCard((prev) => (prev === 'fail' ? null : 'fail'))
                  }
                  disabled={!amEvil}
                >
                  <span className="av-quest-card-icon">💥</span>
                  실패
                </button>
              </div>
              {!amEvil && (
                <p className="av-quest-hint">
                  선의 세력은 성공 카드만 낼 수 있습니다
                </p>
              )}
            </>
          ) : (
            <p className="av-quest-hint">
              카드 제출 완료 — 결과는 집계로만 공개됩니다
            </p>
          )}
          <p className="av-vote-progress">
            제출 {questDoneCount}/{game.team?.length ?? requiredSize}
          </p>
        </div>
      )}
      {isQuest && !amOnTeam && (
        <p className="av-quest-waiting">
          ⚔️ 원정대가 임무를 수행 중입니다… ({questDoneCount}/
          {game.team?.length ?? requiredSize})
        </p>
      )}

      {/* 하단 확인 바 — 원정대 확정 */}
      {canPick && pickSelected.length === requiredSize && (
        <div className="av-confirm-bar">
          <span className="av-confirm-text">
            {pickSelected.map((s) => nameOf(s)).join(' · ')} — 이 원정대로
            확정할까요?
          </span>
          <div className="av-confirm-actions">
            <button
              type="button"
              className="av-confirm-button"
              onClick={handleConfirmPick}
            >
              확정
            </button>
            <button
              type="button"
              className="av-cancel-button"
              onClick={() => setPickSelected([])}
            >
              다시
            </button>
          </div>
        </div>
      )}

      {/* 하단 확인 바 — 원정 카드 제출 */}
      {canQuest && questCard !== null && (
        <div className="av-confirm-bar">
          <span className="av-confirm-text">
            {questCard === 'success' ? '성공' : '실패'} 카드를 제출할까요?
            (비공개)
          </span>
          <div className="av-confirm-actions">
            <button
              type="button"
              className="av-confirm-button"
              onClick={handleConfirmQuest}
            >
              제출
            </button>
            <button
              type="button"
              className="av-cancel-button"
              onClick={() => setQuestCard(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 암살 오버레이 */}
      {isAssassin && (
        <div className="av-assassin-overlay">
          <div className="av-assassin-card">
            {role === 'assassin' ? (
              <>
                <h2 className="av-assassin-title">🗡️ 멀린을 찾아라</h2>
                <p className="av-assassin-sub">
                  선의 세력이 원정 3승을 거뒀습니다 — 멀린을 맞히면 악의
                  역전승입니다
                  {game.endsAt > 0 && ` · ⏱ ${mmss(remaining)}`}
                </p>
                <div className="av-assassin-grid">
                  {game.players
                    .filter((p) => !evilSet.has(p.seat) && p.seat !== game.yourSeat)
                    .map((p) => (
                      <button
                        key={p.seat}
                        type="button"
                        className={`av-assassin-tile ${assassinSelected === p.seat ? 'selected' : ''}`}
                        onClick={() =>
                          setAssassinSelected((prev) =>
                            prev === p.seat ? null : p.seat,
                          )
                        }
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
                {assassinSelected !== null && (
                  <button
                    type="button"
                    className="av-confirm-button wide"
                    onClick={handleConfirmAssassinate}
                    disabled={submitted}
                  >
                    {nameOf(assassinSelected)}님을 암살
                  </button>
                )}
              </>
            ) : (
              <>
                <h2 className="av-assassin-title">🗡️ 암살자의 시간</h2>
                <p className="av-assassin-sub">
                  암살자가 멀린을 찾는 중…
                  {game.endsAt > 0 && ` ⏱ ${mmss(remaining)}`}
                </p>
                {role === 'merlin' && (
                  <p className="av-assassin-merlin">🔮 당신이 멀린입니다 — 무운을 빕니다</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
