import { useEffect, useState } from 'react';
import type { CNEvent, CNGameState } from '../../types/codenames';
import {
  CN_CLUE_COUNTS,
  CN_TEAM_LABEL,
  CN_TEAM_MARK,
  cnTeamLabel,
} from '../../types/codenames';
import type { CNToast } from '../../hooks/useCodenamesGameState';
import './CodenamesBoard.css';

interface CodenamesBoardProps {
  game: CNGameState;
  toasts: CNToast[];
  // 스파이마스터 — 힌트 기록 (단어 + 숫자 1~9)
  onClue: (word: string, count: number) => void;
  // 요원 — 카드 지목 (0~24)
  onPick: (index: number) => void;
  // 요원 — "그만" (턴 종료)
  onEndTurn: () => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: CNEvent, game: CNGameState): string {
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

export function CodenamesBoard({
  game,
  toasts,
  onClue,
  onPick,
  onEndTurn,
}: CodenamesBoardProps) {
  // 요원 2단계 지목 — 탭으로 고르고 확정 바에서 보낸다
  const [selected, setSelected] = useState<number | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지 (cn_error 로 거부돼도 곧 풀린다)
  const [submitted, setSubmitted] = useState(false);
  // 스파이마스터 힌트 입력
  const [clueWord, setClueWord] = useState('');
  const [clueCount, setClueCount] = useState<number | null>(null);

  // 관전(yourSeat -1)·요원 스냅샷에는 keyCard 가 없다 — 반드시 방어
  const keyCard = game.keyCard ?? [];
  const board = game.board ?? [];
  const players = game.players ?? [];
  const clue = game.clue ?? null;
  const clueHistory = game.clueHistory ?? [];

  const isSpectator = game.yourSeat < 0;
  const isSpymaster = game.yourRole === 'spymaster';
  const myTeamTurn = game.yourTeam !== '' && game.yourTeam === game.currentTeam;
  const isCluePhase = game.phase === 'clue';
  const isGuessPhase = game.phase === 'guess';
  // 스파이마스터 — 우리 팀 clue 단계에 힌트를 기록한다
  const canClue = isCluePhase && isSpymaster && myTeamTurn && !isSpectator;
  // 요원 — 우리 팀 guess 단계에 카드를 지목한다 (팀당 아무나)
  const canPick =
    isGuessPhase && game.yourRole === 'agent' && myTeamTurn && !isSpectator;
  const revealedCount = board.filter((c) => c.revealed).length;

  // 턴·단계·공개 수가 바뀌면 로컬 선택·입력 잠금을 리셋한다
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [game.phase, game.currentTeam, revealedCount, clue?.remaining]);

  // 힌트 입력은 내 clue 차례가 끝날 때 비운다
  useEffect(() => {
    if (!canClue) {
      setClueWord('');
      setClueCount(null);
    }
  }, [canClue]);

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

  const handleCardTap = (index: number) => {
    if (!canPick || submitted) return;
    const card = board[index];
    if (!card || card.revealed) return;
    setSelected((prev) => (prev === index ? null : index));
  };

  const confirmPick = () => {
    if (selected === null || submitted) return;
    setSubmitted(true);
    onPick(selected);
    setSelected(null);
  };

  const handleClueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = clueWord.trim();
    if (!canClue || submitted || !word || clueCount === null) return;
    setSubmitted(true);
    onClue(word, clueCount);
  };

  const handleEndTurn = () => {
    if (!canPick || submitted) return;
    setSubmitted(true);
    onEndTurn();
  };

  // 상단 배너 보조 문구
  const turnLabel = `${CN_TEAM_MARK[game.currentTeam]} ${CN_TEAM_LABEL[game.currentTeam]}`;
  const bannerSub = isCluePhase
    ? canClue
      ? '힌트를 음성으로 말하고 아래에 기록하세요'
      : `${turnLabel} 스파이마스터가 힌트를 고민하는 중…`
    : isGuessPhase
      ? canPick
        ? '힌트에 맞는 단어 카드를 탭해 지목하세요'
        : `${turnLabel} 요원들이 추리하는 중…`
      : '';

  const selectedWord = selected !== null ? board[selected]?.word : '';

  return (
    <div className="cn-board">
      <div className="cn-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="cn-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className={`cn-phase-banner ${game.currentTeam}`}>
        <span className="cn-phase-title">
          🕵️ 코드네임 · {turnLabel} 차례
          {game.endsAt > 0 && (
            <span
              className={`cn-deadline ${remaining < 15_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="cn-phase-sub">{bannerSub}</span>}
      </div>

      {/* 남은 단어 배지 + 내 팀·역할 */}
      <div className="cn-score-row">
        <span className="cn-left-badge red">🔴 적 {game.redLeft}</span>
        <span className="cn-left-badge blue">🔵 청 {game.blueLeft}</span>
        {isSpectator ? (
          <span className="cn-me-badge">👀 관전</span>
        ) : (
          game.yourTeam !== '' && (
            <span className={`cn-me-badge ${game.yourTeam}`}>
              {CN_TEAM_MARK[game.yourTeam]}{' '}
              {game.yourRole === 'spymaster' ? '🕵️ 스파이마스터' : '요원'} (나)
            </span>
          )
        )}
      </div>

      {/* 현재 힌트 */}
      {clue && (
        <div className={`cn-clue-card ${game.currentTeam}`}>
          <span className="cn-clue-label">힌트</span>
          <span className="cn-clue-word">
            {clue.word} · {clue.count}
          </span>
          <span className="cn-clue-remaining">
            남은 기회 {Math.max(0, clue.remaining)}회
          </span>
        </div>
      )}

      {/* 스파이마스터 힌트 입력 (단어 + 숫자 1~9) */}
      {canClue && (
        <form className="cn-clue-form" onSubmit={handleClueSubmit}>
          <input
            type="text"
            className="cn-clue-input"
            value={clueWord}
            onChange={(e) => setClueWord(e.target.value)}
            placeholder="힌트 단어 (한 단어)"
            maxLength={20}
            aria-label="힌트 단어"
          />
          <div className="cn-clue-counts" role="group" aria-label="힌트 숫자">
            {CN_CLUE_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                className={`cn-count-chip ${clueCount === n ? 'selected' : ''}`}
                onClick={() =>
                  setClueCount((prev) => (prev === n ? null : n))
                }
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="cn-primary-button"
            disabled={submitted || !clueWord.trim() || clueCount === null}
          >
            {clueWord.trim() && clueCount !== null
              ? `"${clueWord.trim()} · ${clueCount}" 기록`
              : '힌트 기록'}
          </button>
        </form>
      )}

      {/* 5×5 단어 카드 그리드 — 280px에서도 5열 유지 */}
      <div className="cn-grid" role="grid" aria-label="단어 보드">
        {board.map((card, i) => {
          const key = keyCard[i] ?? '';
          const clickable = canPick && !submitted && !card.revealed;
          return (
            <button
              key={`${i}-${card.word}`}
              type="button"
              className={[
                'cn-card',
                card.revealed ? `revealed ${card.color || 'neutral'}` : '',
                !card.revealed && key ? `key-${key}` : '',
                selected === i ? 'selected' : '',
                clickable ? 'clickable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!clickable}
              onClick={() => handleCardTap(i)}
            >
              <span className="cn-card-inner">
                <span className="cn-card-face front">
                  <span className="cn-card-word">{card.word}</span>
                  {!card.revealed && key === 'assassin' && (
                    <span className="cn-key-mark" aria-hidden="true">
                      ☠
                    </span>
                  )}
                </span>
                <span className="cn-card-face back">
                  <span className="cn-card-word">
                    {card.color === 'assassin' ? '☠' : card.word}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 요원 확정 바 — 탭한 카드를 다시 확인하고 보낸다 */}
      {canPick && selected !== null && (
        <div className="cn-confirm-bar">
          <span className="cn-confirm-text">
            <strong>{selectedWord}</strong> — 이 단어를 지목할까요?
          </span>
          <div className="cn-confirm-actions">
            <button
              type="button"
              className="cn-confirm-button"
              onClick={confirmPick}
              disabled={submitted}
            >
              확정
            </button>
            <button
              type="button"
              className="cn-cancel-button"
              onClick={() => setSelected(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* "그만" — 추리를 멈추고 턴을 넘긴다 */}
      {canPick && selected === null && (
        <button
          type="button"
          className="cn-endturn-button"
          onClick={handleEndTurn}
          disabled={submitted}
        >
          🛑 그만 (턴 종료)
        </button>
      )}

      {isSpectator && (
        <p className="cn-spectator-note">
          👀 관전 중 — 키 카드 없이 공개 보드만 표시됩니다
        </p>
      )}

      {/* 힌트 히스토리 */}
      {clueHistory.length > 0 && (
        <div className="cn-history">
          <h2 className="cn-history-title">힌트 히스토리</h2>
          <ul className="cn-history-list">
            {clueHistory.map((entry, i) => (
              <li key={i} className={`cn-history-item ${entry.team}`}>
                <span className="cn-history-team">
                  {CN_TEAM_MARK[entry.team]} {cnTeamLabel(entry.team)}
                </span>
                <span className="cn-history-clue">
                  {entry.word} · {entry.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 팀 명단 (접속 상태 포함) */}
      <div className="cn-roster">
        {(['red', 'blue'] as const).map((team) => (
          <div key={team} className={`cn-roster-team ${team}`}>
            <span className="cn-roster-title">
              {CN_TEAM_MARK[team]} {CN_TEAM_LABEL[team]}
            </span>
            <span className="cn-roster-names">
              {players
                .filter((p) => p.team === team)
                .map((p) => (
                  <span
                    key={p.seat}
                    className={`cn-roster-name ${!p.connected && !p.bot ? 'off' : ''}`}
                  >
                    {p.role === 'spymaster' && '🕵️ '}
                    {p.name}
                    {p.bot && ' 🤖'}
                    {p.seat === game.yourSeat && ' (나)'}
                  </span>
                ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
