import { useCallback, useEffect, useRef, useState } from 'react';
import type { JOClue, JOEvent, JOGameState } from '../../types/justone';
import { JO_TEXT_MAX_LEN, joNormalize } from '../../types/justone';
import type { JOToast } from '../../hooks/useJustOneGameState';
import './JustOneBoard.css';

interface JustOneBoardProps {
  game: JOGameState;
  toasts: JOToast[];
  onClue: (text: string) => void;
  onGuess: (text: string) => void;
  onPass: () => void;
  onAccept: () => void;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: JOEvent, game: JOGameState): string {
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
    case 'clue':
      return `${name(event.seat)}님이 단서를 제출했습니다`;
    case 'guess':
      return `${name(event.seat)}님이 답을 제출했습니다`;
    case 'pass':
      return `${name(event.seat)}님이 이번 라운드를 넘겼습니다`;
    case 'accept':
      return `${name(event.seat)}님이 정답으로 인정했습니다`;
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 모바일 키보드가 올라오면 보이는 영역이 줄어 입력창이 가려진다.
// 포커스 직후 한 번, 그리고 키보드가 열려 뷰포트가 바뀔 때마다
// 입력창을 화면 가운데로 끌어올린다.
function useKeyboardSafeInput() {
  const ref = useRef<HTMLInputElement | null>(null);

  const bringIntoView = useCallback(() => {
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const handleResize = () => {
      // 이 입력창에 포커스가 있을 때만 — 키보드가 이것 때문에 열린 경우다
      if (document.activeElement !== ref.current) return;
      bringIntoView();
    };
    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, [bringIntoView]);

  // 키보드가 다 올라온 뒤에 스크롤해야 위치가 맞는다
  const handleFocus = useCallback(() => {
    window.setTimeout(bringIntoView, 300);
  }, [bringIntoView]);

  return { ref, onFocus: handleFocus };
}

// 단서 한 장 — 소거된 단서는 판정 후에만 취소선으로 함께 보여준다
function ClueCard({ clue, mine }: { clue: JOClue; mine: boolean }) {
  return (
    <li className={`jo-clue-card ${clue.removed ? 'removed' : ''}`}>
      <span className="jo-clue-text">{clue.text || '(빈 단서)'}</span>
      <span className="jo-clue-by">
        {clue.name}
        {mine && ' (나)'}
        {clue.removed && ' · 겹쳐서 소거'}
      </span>
    </li>
  );
}

export function JustOneBoard({
  game,
  toasts,
  onClue,
  onGuess,
  onPass,
  onAccept,
}: JustOneBoardProps) {
  const [clueText, setClueText] = useState('');
  const [guessText, setGuessText] = useState('');
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 스냅샷 컨텍스트(라운드·단계)가 바뀌면 풀린다.
  const [cluePending, setCluePending] = useState(false);
  const [guessPending, setGuessPending] = useState(false);
  const [acceptPending, setAcceptPending] = useState(false);

  const clueInput = useKeyboardSafeInput();
  const guessInput = useKeyboardSafeInput();

  const players = game.players ?? [];
  const clues = game.clues ?? [];
  const history = game.history ?? [];

  const isSpectator = game.yourSeat < 0;
  const isGuesser = !isSpectator && game.guesserSeat === game.yourSeat;
  const isClueGiver = !isSpectator && !isGuesser;

  const phase = game.phase;
  const myClue = game.yourClue ?? '';
  // "제출했다"의 단일 판정 — 서버 스냅샷(yourClue)이 우선, 그 전엔 로컬 잠금
  const clueLocked = cluePending || myClue !== '';

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';
  const guesserName = nameOf(game.guesserSeat);

  const totalCluePlayers = Math.max(0, players.length - 1);
  const submittedCount = game.submittedCount ?? 0;

  // 라운드·단계가 바뀌면 입력값과 연타 잠금을 전부 리셋한다
  useEffect(() => {
    setClueText('');
    setGuessText('');
    setCluePending(false);
    setGuessPending(false);
    setAcceptPending(false);
  }, [game.round, game.phase]);

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
  const seconds = Math.ceil(remaining / 1000);

  // ---------- 제출 핸들러 ----------

  const trimmedClue = clueText.trim();
  const canSubmitClue =
    phase === 'clue' && isClueGiver && !clueLocked && trimmedClue.length > 0;

  const handleClueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitClue) return;
    setCluePending(true);
    // 제출과 동시에 키보드를 내려 잠긴 결과가 바로 보이게 한다
    clueInput.ref.current?.blur();
    onClue(trimmedClue);
  };

  const trimmedGuess = guessText.trim();
  const canSubmitGuess =
    phase === 'guess' && isGuesser && !guessPending && trimmedGuess.length > 0;

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitGuess) return;
    setGuessPending(true);
    guessInput.ref.current?.blur();
    onGuess(trimmedGuess);
  };

  const handlePass = () => {
    if (phase !== 'guess' || !isGuesser || guessPending) return;
    setGuessPending(true);
    onPass();
  };

  const handleAccept = () => {
    if (acceptPending) return;
    setAcceptPending(true);
    onAccept();
  };

  // ---------- 파생 표시값 ----------

  // 제시어 — 단서 제공자에게만 온다. 라운드 종료 시엔 history 로도 보강한다.
  const roundHistory = history.find((h) => h.round === game.round);
  const revealedWord = game.word ?? roundHistory?.word ?? '';

  // 소거된 단서는 판정 후(judging·round_end)에만 함께 보여준다
  const cluesRevealed =
    phase === 'guess' || phase === 'judging' || phase === 'round_end';
  const showRemoved = phase === 'judging' || phase === 'round_end';
  const visibleClues = showRemoved ? clues : clues.filter((c) => !c.removed);
  const removedCount = clues.filter((c) => c.removed).length;
  const survivedCount = clues.length - removedCount;

  const judged = game.judged ?? null;
  const guess = game.guess ?? '';

  // 인정 창 — 출제자·관전자를 뺀 전원에게 [정답 인정] 버튼
  const showAcceptWindow =
    phase === 'judging' && !isSpectator && !isGuesser && !judged?.correct;

  // 제시어와 겹치는 단서는 서버가 지운다 — 제출 전에 미리 알려 준다
  const clueCollidesWithWord = (() => {
    if (!trimmedClue || !game.word) return false;
    const a = joNormalize(trimmedClue);
    const b = joNormalize(game.word);
    if (!a || !b) return false;
    return a.includes(b) || b.includes(a);
  })();

  // 상단 배너 보조 문구 — 단계 × 역할
  const bannerSub = (() => {
    if (isSpectator) {
      return phase === 'clue'
        ? `👀 관전 중 — 단서를 적는 중입니다 (${submittedCount}/${totalCluePlayers}명)`
        : `👀 관전 중 — 출제자는 ${guesserName}님입니다`;
    }
    switch (phase) {
      case 'clue':
        return isGuesser
          ? '✏️ 당신이 맞히는 차례입니다 — 다른 참가자들이 단서를 적는 중'
          : clueLocked
            ? '단서를 냈습니다 — 다른 참가자를 기다리는 중'
            : '제시어를 떠올릴 단어 하나를 적으세요';
      case 'guess':
        return isGuesser
          ? '살아남은 단서를 보고 제시어를 맞혀 보세요'
          : `${guesserName}님이 답을 고르는 중…`;
      case 'judging':
        return judged?.correct
          ? '정답입니다!'
          : isGuesser
            ? '다른 참가자들의 인정을 기다리는 중…'
            : '뜻이 통했다면 정답으로 인정해 주세요';
      case 'round_end':
        return '다음 라운드를 준비하는 중…';
      default:
        return '';
    }
  })();

  return (
    <div className="jo-board">
      <div className="jo-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="jo-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 — 라운드 n/총 + 점수 + ⏱ 카운트다운 */}
      <div className="jo-phase-banner">
        <span className="jo-phase-title">
          <span className="jo-round">
            라운드 {game.round}/{game.totalRounds}
          </span>
          <span className="jo-score" title="협력 점수 (정답 +1 · 오답 −1)">
            🎯 {game.score}점
          </span>
          {game.endsAt > 0 && remaining > 0 && (
            <span className={`jo-deadline ${seconds <= 10 ? 'urgent' : ''}`}>
              ⏱ {seconds}초
            </span>
          )}
        </span>
        {bannerSub && <span className="jo-phase-sub">{bannerSub}</span>}
      </div>

      {/* 제시어 카드 — 단서 제공자에게만 크게, 출제자·관전자는 자리표시 */}
      <div className="jo-word-wrap">
        {revealedWord ? (
          <div className="jo-word-card">
            <span className="jo-word-label">제시어</span>
            <span className="jo-word-text">{revealedWord}</span>
            {phase === 'clue' && (
              <span className="jo-word-hint">
                이 단어를 떠올리게 할 단어 하나를 적으세요
              </span>
            )}
          </div>
        ) : (
          <div className="jo-word-card secret">
            <span className="jo-word-label">제시어</span>
            <span className="jo-word-text secret">제시어는 비밀입니다</span>
            <span className="jo-word-hint">
              {isGuesser
                ? '당신이 맞혀야 하는 단어입니다'
                : '출제자에게는 공개되지 않습니다'}
            </span>
          </div>
        )}
      </div>

      {/* 단서 입력 — 단서 단계의 단서 제공자만 (관전자·출제자는 숨김) */}
      {phase === 'clue' && isClueGiver && (
        <div className="jo-panel">
          {clueLocked ? (
            <div className="jo-locked">
              <span className="jo-locked-label">🔒 제출 완료</span>
              <span className="jo-locked-value">
                {myClue || trimmedClue || '—'}
              </span>
              <span className="jo-locked-note">
                이번 라운드에는 바꿀 수 없습니다
              </span>
            </div>
          ) : (
            <form className="jo-input-form" onSubmit={handleClueSubmit}>
              <label className="jo-input-label" htmlFor="joClueInput">
                내 단서 (한 단어 · 띄어쓰기 없이)
              </label>
              <div className="jo-input-row">
                <input
                  id="joClueInput"
                  ref={clueInput.ref}
                  onFocus={clueInput.onFocus}
                  className="jo-text-input"
                  type="text"
                  value={clueText}
                  onChange={(e) => setClueText(e.target.value)}
                  placeholder="예: 바다"
                  maxLength={JO_TEXT_MAX_LEN}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  aria-label="단서 입력"
                />
                <span
                  className={`jo-counter ${
                    clueText.length >= JO_TEXT_MAX_LEN ? 'full' : ''
                  }`}
                  aria-hidden="true"
                >
                  {clueText.length}/{JO_TEXT_MAX_LEN}
                </span>
              </div>
              {clueCollidesWithWord && (
                <span className="jo-input-warn">
                  제시어와 겹치는 단서는 자동으로 지워집니다
                </span>
              )}
              <button
                type="submit"
                className="jo-submit-button"
                disabled={!canSubmitClue}
              >
                단서 제출
              </button>
              <span className="jo-input-note">
                엔터로도 제출됩니다 · 최대 {JO_TEXT_MAX_LEN}자
              </span>
            </form>
          )}
          <div className="jo-progress">
            <span className="jo-progress-text">
              {submittedCount}/{totalCluePlayers}명 제출
            </span>
            <span className="jo-progress-bar" aria-hidden="true">
              <span
                className="jo-progress-fill"
                style={{
                  width: `${
                    totalCluePlayers > 0
                      ? Math.min(100, (submittedCount / totalCluePlayers) * 100)
                      : 0
                  }%`,
                }}
              />
            </span>
          </div>
        </div>
      )}

      {/* 단서 단계의 출제자 — 대기 화면 (입력 UI 없음) */}
      {phase === 'clue' && isGuesser && (
        <div className="jo-panel jo-wait-panel">
          <span className="jo-wait-title">
            다른 참가자들이 단서를 적는 중…
          </span>
          <div className="jo-progress">
            <span className="jo-progress-text">
              {submittedCount}/{totalCluePlayers}명 제출
            </span>
            <span className="jo-progress-bar" aria-hidden="true">
              <span
                className="jo-progress-fill"
                style={{
                  width: `${
                    totalCluePlayers > 0
                      ? Math.min(100, (submittedCount / totalCluePlayers) * 100)
                      : 0
                  }%`,
                }}
              />
            </span>
          </div>
        </div>
      )}

      {/* 단서 목록 — 추리 단계부터. 소거된 단서는 판정 후에 취소선으로 함께 */}
      {cluesRevealed && (
        <div className="jo-panel">
          <span className="jo-panel-title">
            {showRemoved
              ? `단서 ${clues.length}개 중 ${survivedCount}개 생존`
              : `살아남은 단서 ${visibleClues.length}개`}
          </span>
          {visibleClues.length > 0 ? (
            <ul className="jo-clue-list">
              {visibleClues.map((clue) => (
                <ClueCard
                  key={`${clue.seat}-${clue.text}`}
                  clue={clue}
                  mine={clue.seat === game.yourSeat}
                />
              ))}
            </ul>
          ) : (
            <p className="jo-empty">
              살아남은 단서가 없습니다 — 전부 겹쳤습니다
            </p>
          )}
          {showRemoved && removedCount > 0 && (
            <span className="jo-panel-note">
              취소선 {removedCount}개는 겹치거나 제시어와 닿아 지워졌습니다
            </span>
          )}
        </div>
      )}

      {/* 답 입력 + 넘기기 — 추리 단계의 출제자만 */}
      {phase === 'guess' && isGuesser && (
        <div className="jo-panel">
          {guessPending ? (
            <div className="jo-locked">
              <span className="jo-locked-label">🔒 제출 완료</span>
              <span className="jo-locked-value">{trimmedGuess || '넘김'}</span>
              <span className="jo-locked-note">판정을 기다리는 중…</span>
            </div>
          ) : (
            <form className="jo-input-form" onSubmit={handleGuessSubmit}>
              <label className="jo-input-label" htmlFor="joGuessInput">
                내 답
              </label>
              <div className="jo-input-row">
                <input
                  id="joGuessInput"
                  ref={guessInput.ref}
                  onFocus={guessInput.onFocus}
                  className="jo-text-input"
                  type="text"
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  placeholder="제시어를 입력하세요"
                  maxLength={JO_TEXT_MAX_LEN}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  aria-label="답 입력"
                />
                <span
                  className={`jo-counter ${
                    guessText.length >= JO_TEXT_MAX_LEN ? 'full' : ''
                  }`}
                  aria-hidden="true"
                >
                  {guessText.length}/{JO_TEXT_MAX_LEN}
                </span>
              </div>
              <div className="jo-actions">
                <button
                  type="submit"
                  className="jo-submit-button"
                  disabled={!canSubmitGuess}
                >
                  답 제출
                </button>
                <button
                  type="button"
                  className="jo-skip-button"
                  onClick={handlePass}
                >
                  넘기기 (0점)
                </button>
              </div>
              <span className="jo-input-note">
                엔터로도 제출됩니다 · 오답은 −1점, 넘기면 0점
              </span>
            </form>
          )}
        </div>
      )}

      {/* 판정 — 제출된 답 + 인정 창 */}
      {(phase === 'judging' || phase === 'round_end') && (
        <div
          className={`jo-panel jo-verdict ${
            judged ? (judged.correct ? 'correct' : 'wrong') : ''
          }`}
        >
          <span className="jo-verdict-line">
            <span className="jo-verdict-label">
              {guesserName}님의 답
            </span>
            <span className="jo-verdict-value">{guess || '넘김'}</span>
          </span>
          {revealedWord && (
            <span className="jo-verdict-line">
              <span className="jo-verdict-label">제시어</span>
              <span className="jo-verdict-value">{revealedWord}</span>
            </span>
          )}
          {judged && (
            <span className="jo-verdict-mark">
              {judged.correct
                ? judged.accepted
                  ? '⭕ 인정 — 정답 처리 (+1점)'
                  : '⭕ 정답 (+1점)'
                : phase === 'round_end'
                  ? guess
                    ? '❌ 오답 (−1점)'
                    : '➖ 넘김 (0점)'
                  : '판정 중…'}
            </span>
          )}
          {judged?.message && (
            <span className="jo-verdict-note">{judged.message}</span>
          )}

          {showAcceptWindow && (
            <div className="jo-accept-wrap">
              <span className="jo-accept-hint">
                뜻이 통하는 답이라면 한 명만 인정해도 정답이 됩니다
              </span>
              <button
                type="button"
                className="jo-accept-button"
                onClick={handleAccept}
                disabled={acceptPending}
              >
                {acceptPending ? '✓ 인정했습니다' : '정답 인정'}
              </button>
            </div>
          )}
          {phase === 'judging' && isSpectator && (
            <span className="jo-verdict-note">
              👀 관전 중 — 인정은 참가자만 할 수 있습니다
            </span>
          )}
        </div>
      )}

      {/* 좌석 스트립 — 제출 여부 ✓ · 출제자 ✏️ */}
      <div className="jo-seat-strip">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const offline = !p.connected && !p.bot;
          return (
            <div
              key={p.seat}
              className={[
                'jo-seat-chip',
                p.isGuesser ? 'guesser' : '',
                isMe ? 'me' : '',
                offline ? 'offline' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="jo-seat-mark">
                {p.isGuesser ? '✏️' : p.submitted ? '✓' : '·'}
              </span>
              <span className="jo-seat-name">
                {p.name}
                {isMe && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="jo-seat-state">
                {p.isGuesser
                  ? '출제자'
                  : offline
                    ? '끊김'
                    : p.submitted
                      ? '제출'
                      : '작성 중'}
              </span>
            </div>
          );
        })}
      </div>

      {isSpectator && (
        <p className="jo-spectator-note">
          👀 관전 중 — 단서·답 제출은 참가자만 할 수 있습니다
        </p>
      )}
    </div>
  );
}
