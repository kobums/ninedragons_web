import { useEffect, useMemo, useState } from 'react';
import type {
  CWCard,
  CWEvent,
  CWGameState,
  CWHint,
  CWTask,
} from '../../types/crew';
import {
  CW_DEFAULT_MAX_MISSION,
  CW_FAIL_TEXT,
  CW_HINT_DESC,
  CW_HINT_LABEL,
  CW_SUIT_LABEL,
  CW_SUIT_MARK,
  cwCardKey,
  cwCommunicable,
  cwHintTruthful,
  cwLegalIndexes,
  cwSameCard,
  cwSortHand,
} from '../../types/crew';
import type { CWToast } from '../../hooks/useCrewGameState';
import './CrewBoard.css';

interface CrewBoardProps {
  game: CWGameState;
  toasts: CWToast[];
  // 카드 내기 — index 는 서버 yourHand 기준 인덱스
  onPlay: (index: number) => void;
  // 소통 — 손패의 색 카드 1장을 공개하며 그 색 안에서의 위치를 선언한다
  onCommunicate: (index: number, hint: CWHint) => void;
}

const HINTS: readonly CWHint[] = ['highest', 'lowest', 'only'];

// 카드 한 장 — 색 + 한 글자 마크로 무늬를 이중 표기한다 (색약 대비)
function CardFace({
  card,
  size = 'md',
}: {
  card: CWCard;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      className={`cw-card suit-${card.suit} size-${size}`}
      title={`${CW_SUIT_LABEL[card.suit]} ${card.rank}`}
    >
      <span className="cw-card-rank">{card.rank}</span>
      <span className="cw-card-mark">{CW_SUIT_MARK[card.suit]}</span>
    </span>
  );
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립
function toastText(event: CWEvent, game: CWGameState): string {
  if (event.message) return event.message;
  const name = (seat?: number) =>
    // 퇴장 이벤트는 스냅샷에서 좌석이 이미 빠진 뒤라 이벤트의 name 이 우선
    (game.players ?? []).find((p) => p.seat === seat)?.name ??
    event.name ??
    '?';

  switch (event.kind) {
    case 'joined':
      return `${name(event.seat)}님이 탑승했습니다`;
    case 'left':
      return `${name(event.seat)}님이 하선했습니다`;
    case 'started':
      return '🚀 출항했습니다';
    case 'round_start':
      return `임무 ${game.mission}단계 시작 — 카드를 나눕니다`;
    case 'round_end':
      return '✅ 이번 라운드의 임무를 모두 완수했습니다';
    case 'communicate':
      return `${name(event.seat)}님이 카드를 공개했습니다`;
    case 'task_done':
      return '✅ 임무 하나를 완수했습니다';
    case 'trick_won':
      return `${name(event.seat)}님이 트릭을 가져갔습니다`;
    case 'auto_play':
      return '⏳ 시간 초과 — 카드가 자동으로 제출되었습니다';
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

export function CrewBoard({
  game,
  toasts,
  onPlay,
  onCommunicate,
}: CrewBoardProps) {
  // 낼 카드 선택 (서버 yourHand 인덱스)
  const [selected, setSelected] = useState<number | null>(null);
  // 소통 모드 — 켜면 손패 탭이 "공개할 카드 고르기"로 바뀐다
  const [commOpen, setCommOpen] = useState(false);
  const [commIndex, setCommIndex] = useState<number | null>(null);
  const [commHint, setCommHint] = useState<CWHint | null>(null);
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지 (내기·소통 공용).
  // 서버가 거부(cw_error)해도 잠깐 뒤 풀려 재시도할 수 있다 —
  // 진짜 진행 여부는 스냅샷(currentSeat·trick)이 결정한다.
  const [submitted, setSubmitted] = useState(false);
  const lockSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const players = game.players ?? [];
  const trick = game.trick ?? [];
  const tasks = game.tasks ?? [];
  const yourHand = game.yourHand ?? [];
  const me = players.find((p) => p.seat === game.yourSeat);
  // 관전자(yourSeat -1)는 손패·내기·소통 UI 전부 숨김
  const isSpectator = game.yourSeat < 0 || !me;
  const maxMission = game.maxMission || CW_DEFAULT_MAX_MISSION;

  // 스냅샷 컨텍스트(임무·차례·트릭 길이·단계)가 바뀌면 로컬 선택과 연타 잠금을
  // 리셋한다 — 남아 있던 선택이 다음 상황에 잘못 확정되지 않게.
  useEffect(() => {
    setSelected(null);
    setCommIndex(null);
    setCommHint(null);
    setSubmitted(false);
  }, [game.mission, game.currentSeat, trick.length, game.phase]);

  const tokenLeft = me?.tokenLeft ?? 0;
  const trickEmpty = trick.length === 0;
  // 소통은 토큰이 남아 있고 트릭이 비어 있을 때만 (트릭 시작 시점에만)
  const commAvailable =
    !isSpectator && game.phase === 'playing' && tokenLeft > 0 && trickEmpty;

  // 쓸 수 없게 된 순간 소통 모드를 닫는다 — 열린 채로 남아 손패 탭이
  // "내기"로 돌아가지 못하는 상태를 막는다
  useEffect(() => {
    if (!commAvailable) {
      setCommOpen(false);
      setCommIndex(null);
      setCommHint(null);
    }
  }, [commAvailable]);

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
  const clock = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}초`;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  const isPlaying = game.phase === 'playing';
  const isRoundEnd = game.phase === 'round_end';
  const isMyTurn = isPlaying && !isSpectator && game.currentSeat === game.yourSeat;

  // 따라내기 의무 — 낼 수 없는 카드는 흐리게 (서버가 최종 판정)
  const legal = useMemo(
    () => cwLegalIndexes(yourHand, game.leadSuit),
    // 손패 구성이 같으면 재계산할 필요가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yourHand.map(cwCardKey).join('|'), game.leadSuit],
  );
  const sortedHand = useMemo(
    () => cwSortHand(yourHand),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yourHand.map(cwCardKey).join('|')],
  );

  const canPlay = isMyTurn && !submitted && !commOpen;
  const canCommunicate = commAvailable && !submitted;

  const handleHandTap = (index: number) => {
    if (commOpen) {
      if (!canCommunicate || !cwCommunicable(yourHand, index)) return;
      setCommIndex((prev) => (prev === index ? null : index));
      setCommHint(null);
      return;
    }
    if (!canPlay || !legal.has(index)) return;
    setSelected((prev) => (prev === index ? null : index));
  };

  const handleConfirmPlay = () => {
    if (selected === null || !canPlay) return;
    lockSubmit();
    onPlay(selected);
    setSelected(null);
  };

  const handleReveal = () => {
    if (commIndex === null || commHint === null || !canCommunicate) return;
    if (!cwHintTruthful(yourHand, commIndex, commHint)) return;
    lockSubmit();
    onCommunicate(commIndex, commHint);
    setCommOpen(false);
    setCommIndex(null);
    setCommHint(null);
  };

  // ---------- 임무 ----------
  const doneCount = tasks.filter((t) => t.done).length;
  const taskPct = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;
  // 이번 트릭에 나와 있는 임무 카드 = 지금 이 순간 승패가 갈리는 카드
  const liveTaskKeys = new Set(
    trick
      .map((t) => cwCardKey(t.card))
      .filter((key) => tasks.some((task) => cwCardKey(task) === key)),
  );
  const isLive = (task: CWTask) => liveTaskKeys.has(cwCardKey(task));
  const remainingOf = (seat: number) =>
    tasks.filter((t) => t.seat === seat && !t.done).length;

  // 실패는 곧바로 게임 종료지만, round_end 스냅샷에 실패가 실려 와도 죽지 않게
  const failedReason = game.result?.failedReason ?? '';
  const roundFailed = game.result != null && !game.result.cleared && failedReason !== '';

  const headline = (() => {
    if (isRoundEnd)
      return roundFailed
        ? `💥 임무 ${game.mission}단계 실패`
        : `🎉 임무 ${game.mission}단계 완수`;
    if (isSpectator) return `${nameOf(game.currentSeat)}님이 카드를 내는 중`;
    if (isMyTurn) return '🎯 내 차례 — 카드를 내세요';
    return `${nameOf(game.currentSeat)}님이 카드를 내는 중`;
  })();

  const subline = (() => {
    // roundFailed 가 참이면 failedReason 은 이미 '' 이 아니다
    if (isRoundEnd && roundFailed) return CW_FAIL_TEXT[failedReason];
    if (isRoundEnd)
      return game.mission < maxMission
        ? `잠시 후 ${game.mission + 1}단계 — 임무가 ${game.mission + 1}개로 늘어납니다`
        : '마지막 단계까지 완수했습니다';
    if (isSpectator) return '관전 중 — 공개된 정보만 보입니다';
    if (isMyTurn)
      return game.leadSuit === ''
        ? '이 트릭의 리드입니다 — 아무 카드나 낼 수 있습니다'
        : `리드는 ${CW_SUIT_LABEL[game.leadSuit]} — 같은 색이 있으면 반드시 그 색을 내야 합니다`;
    return '말은 못 합니다. 공개된 카드와 나온 카드로 의도를 읽으세요';
  })();

  return (
    <div className="cw-scope cw-board">
      <div className="cw-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="cw-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      {/* 상단 — 임무 단계 / 사령관 / 카운트다운 */}
      <div className={`cw-status-bar ${game.phase}`}>
        <div className="cw-status-row">
          <span className="cw-status-chip">
            임무 {game.mission}/{maxMission}단계
          </span>
          <span className="cw-status-chip commander">
            🚀 사령관 {nameOf(game.commanderSeat)}
          </span>
          {game.endsAt > 0 && (
            <span className={`cw-timer ${remaining <= 10_000 ? 'urgent' : ''}`}>
              ⏱ {clock(remaining)}
            </span>
          )}
        </div>
        <span className="cw-status-title">{headline}</span>
        <span className="cw-status-sub">{subline}</span>
      </div>

      {/* ★ 임무 패널 — 이 게임의 얼굴. 누가 무엇을 책임지는가. */}
      <div className="cw-missions">
        <div className="cw-section-head">
          <span className="cw-section-title">
            🛰 임무 {doneCount}/{tasks.length}
          </span>
          <span className="cw-section-note">
            {tasks.length === 0
              ? '임무 배정을 기다리는 중'
              : doneCount === tasks.length
                ? '전부 완수'
                : '담당자가 직접 따내야 합니다'}
          </span>
        </div>
        <div className="cw-mission-track">
          <div className="cw-mission-fill" style={{ width: `${taskPct}%` }} />
        </div>

        {tasks.length === 0 ? (
          <p className="cw-empty-note">아직 배정된 임무가 없습니다</p>
        ) : (
          <ul className="cw-mission-list">
            {tasks.map((task) => {
              const mine = !isSpectator && task.seat === game.yourSeat;
              const live = !task.done && isLive(task);
              return (
                <li
                  key={`${cwCardKey(task)}-${task.seat}`}
                  className={[
                    'cw-mission-item',
                    task.done ? 'done' : '',
                    mine ? 'mine' : '',
                    live ? 'live' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <CardFace card={task} size="md" />
                  <span className="cw-mission-who">
                    <span className="cw-mission-owner">
                      {nameOf(task.seat)}
                      {mine && <span className="cw-mission-you"> (나)</span>}
                    </span>
                    <span className="cw-mission-role">
                      {task.done
                        ? '이 카드를 따냈습니다'
                        : live
                          ? '지금 이 트릭에 나와 있습니다'
                          : '이 카드가 든 트릭을 이겨야 합니다'}
                    </span>
                  </span>
                  <span
                    className={`cw-mission-state ${
                      task.done ? 'ok' : live ? 'warn' : ''
                    }`}
                  >
                    {task.done ? '✅ 완료' : live ? '⚠ 진행 중' : '미완료'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 중앙 트릭 */}
      <div className="cw-trick-panel">
        <div className="cw-section-head">
          <span className="cw-section-title">이번 트릭</span>
          <span className="cw-section-note">
            {game.leadSuit === '' ? (
              '리드 대기'
            ) : (
              <>
                리드{' '}
                <span className={`cw-lead-chip suit-${game.leadSuit}`}>
                  {CW_SUIT_MARK[game.leadSuit]} {CW_SUIT_LABEL[game.leadSuit]}
                </span>
              </>
            )}
          </span>
        </div>

        <div className="cw-trick-row">
          {trick.length === 0 && (
            <span className="cw-empty-note">
              {nameOf(game.currentSeat)}님이 첫 카드를 냅니다
            </span>
          )}
          {trick.map((t, i) => {
            const isTask = tasks.some((task) => cwSameCard(task, t.card));
            return (
              <div
                key={`${t.seat}-${cwCardKey(t.card)}-${i}`}
                className={`cw-trick-slot ${isTask ? 'task' : ''}`}
              >
                <CardFace card={t.card} size="lg" />
                <span className="cw-trick-name">{nameOf(t.seat)}</span>
                {isTask && <span className="cw-trick-task-flag">임무</span>}
              </div>
            );
          })}
        </div>

        {game.lastTrick && (
          <div className="cw-last-trick">
            <span className="cw-last-trick-label">
              지난 트릭 · {nameOf(game.lastTrick.winnerSeat)} 획득
            </span>
            <span className="cw-last-trick-cards">
              {(game.lastTrick.cards ?? []).map((t, i) => (
                <CardFace
                  key={`${t.seat}-${cwCardKey(t.card)}-${i}`}
                  card={t.card}
                  size="sm"
                />
              ))}
            </span>
          </div>
        )}
      </div>

      {/* 좌석 스트립 — 남은 장수 · 소통 토큰 · 공개 카드 */}
      <div className="cw-seats">
        {players.map((p) => {
          const isMe = !isSpectator && p.seat === game.yourSeat;
          const offline = !p.connected && !p.bot;
          const revealed = p.revealed ?? null;
          const left = remainingOf(p.seat);
          return (
            <div
              key={p.seat}
              className={[
                'cw-seat',
                isMe ? 'me' : '',
                p.seat === game.currentSeat ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="cw-seat-head">
                <span className="cw-seat-name">
                  {p.seat === game.currentSeat && '▶ '}
                  {p.seat === game.commanderSeat && '🚀 '}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="cw-seat-badges">
                  {p.bot && <span className="cw-badge">🤖</span>}
                  {offline && <span className="cw-badge off">끊김</span>}
                  <span className="cw-badge count">{p.handCount}장</span>
                </span>
              </div>

              <div className="cw-seat-meta">
                <span
                  className={`cw-badge token ${p.tokenLeft > 0 ? 'on' : ''}`}
                >
                  🛰 {p.tokenLeft > 0 ? '소통 가능' : '소통 완료'}
                </span>
                <span className={`cw-badge task ${left === 0 ? 'ok' : ''}`}>
                  {left === 0 ? '✅ 임무 없음' : `임무 ${left}개`}
                </span>
              </div>

              {revealed && (
                <span
                  className={`cw-reveal-pill suit-${revealed.card.suit}`}
                  title={CW_HINT_DESC[revealed.hint]}
                >
                  <CardFace card={revealed.card} size="sm" />
                  <span className="cw-reveal-hint">
                    {CW_HINT_LABEL[revealed.hint]}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 라운드 종료 — 성공 축하 / (방어적으로) 실패 사유 */}
      {isRoundEnd && (
        <div className={`cw-round-end ${roundFailed ? 'failed' : ''}`}>
          <span className="cw-round-end-title">
            {roundFailed
              ? `임무 ${game.mission}단계 실패`
              : `임무 ${game.mission}단계 완수`}
          </span>
          <span className="cw-round-end-sub">
            {roundFailed
              ? (game.result?.message ?? CW_FAIL_TEXT[failedReason])
              : game.mission < maxMission
                ? `다음은 ${game.mission + 1}단계 — 소통 토큰이 다시 채워집니다`
                : '전 단계를 통과했습니다'}
          </span>
        </div>
      )}

      {isSpectator ? (
        <div className="cw-spectator-note">
          👀 관전 중 — 손패와 소통은 보이지 않습니다
        </div>
      ) : (
        <>
          {/* 소통 바 — 토큰이 남아 있고 트릭이 비어 있을 때만 */}
          {isPlaying && tokenLeft > 0 && (
            <div className={`cw-comm-bar ${commOpen ? 'open' : ''}`}>
              <div className="cw-section-head">
                <span className="cw-section-title">🛰 소통 (라운드 1회)</span>
                <span className="cw-section-note">
                  {trickEmpty
                    ? '카드 → 위치 → 공개'
                    : '트릭이 시작돼 지금은 쓸 수 없습니다'}
                </span>
              </div>

              {!commOpen ? (
                <button
                  type="button"
                  className="cw-comm-open-button"
                  onClick={() => setCommOpen(true)}
                  disabled={!canCommunicate}
                >
                  {trickEmpty
                    ? '카드 한 장 공개하기'
                    : '다음 트릭 시작 때 사용할 수 있습니다'}
                </button>
              ) : (
                <>
                  <p className="cw-comm-step">
                    {commIndex === null
                      ? '① 아래 손패에서 공개할 색 카드를 고르세요 (로켓·중간 숫자는 공개 불가)'
                      : '② 그 색 안에서의 위치를 선언하세요 — 거짓 선언은 서버가 거부합니다'}
                  </p>

                  {/* 스냅샷이 손패를 바꾼 직후의 한 프레임을 방어한다 */}
                  {commIndex !== null && yourHand[commIndex] && (
                    <div className="cw-comm-picked">
                      <CardFace card={yourHand[commIndex]} size="md" />
                      <span className="cw-comm-picked-text">
                        {CW_SUIT_LABEL[yourHand[commIndex].suit]}{' '}
                        {yourHand[commIndex].rank}
                      </span>
                    </div>
                  )}

                  <div className="cw-hint-row">
                    {HINTS.map((hint) => {
                      const ok =
                        commIndex !== null &&
                        cwHintTruthful(yourHand, commIndex, hint);
                      return (
                        <button
                          key={hint}
                          type="button"
                          className={`cw-hint-button ${
                            commHint === hint ? 'on' : ''
                          } ${commIndex !== null && !ok ? 'false' : ''}`}
                          onClick={() => setCommHint(hint)}
                          disabled={!ok}
                          title={
                            commIndex === null
                              ? '먼저 카드를 고르세요'
                              : ok
                                ? CW_HINT_DESC[hint]
                                : '이 카드로는 거짓이 되는 선언입니다'
                          }
                        >
                          {CW_HINT_LABEL[hint]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="cw-comm-actions">
                    <button
                      type="button"
                      className="cw-primary-button"
                      onClick={handleReveal}
                      disabled={
                        commIndex === null ||
                        commHint === null ||
                        !canCommunicate
                      }
                    >
                      공개하기
                    </button>
                    <button
                      type="button"
                      className="cw-ghost-button"
                      onClick={() => {
                        setCommOpen(false);
                        setCommIndex(null);
                        setCommHint(null);
                      }}
                    >
                      취소
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 내 손패 — 색별 정렬, 낼 수 없는 카드는 흐림 */}
          <div className={`cw-my-hand ${commOpen ? 'comm-mode' : ''}`}>
            <div className="cw-section-head">
              <span className="cw-section-title">
                내 손패 {yourHand.length}장
              </span>
              <span className="cw-section-note">
                {commOpen
                  ? '공개할 카드를 고르세요'
                  : isMyTurn
                    ? '낼 수 없는 카드는 흐리게 표시됩니다'
                    : '내 차례를 기다리는 중'}
              </span>
            </div>
            <div className="cw-hand-row">
              {sortedHand.map(({ card, index }, i) => {
                const prev = i > 0 ? sortedHand[i - 1].card : null;
                const suitBreak = prev !== null && prev.suit !== card.suit;
                const isTask = tasks.some((t) => cwSameCard(t, card));
                const mineTask = tasks.some(
                  (t) => cwSameCard(t, card) && t.seat === game.yourSeat,
                );
                const dim = commOpen
                  ? !cwCommunicable(yourHand, index)
                  : isMyTurn && !legal.has(index);
                const active = commOpen
                  ? commIndex === index
                  : selected === index;
                const clickable = commOpen
                  ? cwCommunicable(yourHand, index)
                  : canPlay && legal.has(index);
                return (
                  <button
                    key={`${cwCardKey(card)}-${index}`}
                    type="button"
                    className={[
                      'cw-hand-card',
                      `suit-${card.suit}`,
                      suitBreak ? 'suit-break' : '',
                      dim ? 'dim' : '',
                      active ? 'active' : '',
                      clickable ? 'clickable' : '',
                      isTask ? 'is-task' : '',
                      mineTask ? 'my-task' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleHandTap(index)}
                    disabled={!clickable}
                    aria-label={`${CW_SUIT_LABEL[card.suit]} ${card.rank}${
                      isTask ? ' (임무 카드)' : ''
                    }`}
                  >
                    <span className="cw-hand-rank">{card.rank}</span>
                    <span className="cw-hand-mark">
                      {CW_SUIT_MARK[card.suit]}
                    </span>
                    {isTask && (
                      <span className="cw-hand-task-dot">
                        {mineTask ? '★' : '•'}
                      </span>
                    )}
                  </button>
                );
              })}
              {yourHand.length === 0 && (
                <span className="cw-empty-note">— 손패를 다 냈습니다 —</span>
              )}
            </div>
            {tasks.length > 0 && yourHand.length > 0 && (
              <p className="cw-hand-legend">
                ★ 내 임무 카드 · • 다른 대원의 임무 카드
              </p>
            )}
          </div>
        </>
      )}

      {/* 하단 확정 바 — 카드 탭 후 내기 확정 */}
      {selected !== null && canPlay && yourHand[selected] && (
        <div className="cw-confirm-bar">
          <span className="cw-confirm-text">
            <CardFace card={yourHand[selected]} size="sm" />
            {` ${CW_SUIT_LABEL[yourHand[selected].suit]} ${
              yourHand[selected].rank
            } 를 낼까요?`}
          </span>
          <div className="cw-confirm-actions">
            <button
              type="button"
              className="cw-confirm-button"
              onClick={handleConfirmPlay}
            >
              내기
            </button>
            <button
              type="button"
              className="cw-cancel-button"
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
