import { useEffect, useMemo, useState } from 'react';
import type { DMEvent, DMGameState } from '../../types/dalmuti';
import {
  DM_JOKER,
  DM_TOTAL_HANDS,
  dmGroupHand,
  dmRankBadge,
  dmRankName,
  dmRankTier,
} from '../../types/dalmuti';
import type { DMToast } from '../../hooks/useDalmutiGameState';
import './DalmutiBoard.css';

interface DalmutiBoardProps {
  game: DMGameState;
  toasts: DMToast[];
  // cards: 제출할 숫자 배열 (조커 = 13)
  onPlay: (cards: number[]) => void;
  onPass: () => void;
}

// 현재 제출 선택 — rank 13 은 조커 단독 제출
interface DMSelection {
  rank: number;
  count: number;
}

// 이벤트 토스트 문구 — 서버 message 우선, 없으면 kind 로 조립 (전부 한글)
function toastText(event: DMEvent, game: DMGameState): string {
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
    case 'pass':
      return `${name(event.seat)}님이 패스했습니다`;
    case 'new_lead':
      return `${name(event.seat)}님이 새 리드를 잡았습니다`;
    case 'out':
      return `${name(event.seat)}님이 손을 모두 털었습니다!`;
    case 'hand_end':
      return '핸드가 끝났습니다';
    case 'game_over':
      return '게임이 종료되었습니다';
    default:
      return '';
  }
}

// 카드 한 장 — 실물 결 간소화: 코너 인덱스(우하단 180°) + 중앙 숫자 + 계급 이름
function DmCardFace({ rank, small }: { rank: number; small?: boolean }) {
  return (
    <span
      className={`dm-card tier-${dmRankTier(rank)} ${small ? 'sm' : ''}`}
      aria-hidden="true"
    >
      <span className="dm-card-index tl">{rank}</span>
      <span className="dm-card-center">
        <span className="dm-card-rank">{rank === DM_JOKER ? '★' : rank}</span>
        <span className="dm-card-name">{dmRankName(rank)}</span>
      </span>
      <span className="dm-card-index br">{rank}</span>
    </span>
  );
}

export function DalmutiBoard({ game, toasts, onPlay, onPass }: DalmutiBoardProps) {
  // 제출 직후 ~ 다음 스냅샷 사이의 연타 방지.
  // 서버가 거부(dm_error)해도 스냅샷 컨텍스트가 바뀌면 풀려 재시도할 수 있다.
  const [submitted, setSubmitted] = useState(false);
  const [selection, setSelection] = useState<DMSelection | null>(null);
  // 조커 그룹 탭 → "N으로 내기" 숫자 선택 패널
  const [jokerPanelOpen, setJokerPanelOpen] = useState(false);

  const players = game.players ?? [];
  const hand = game.yourHand ?? [];
  const tableSet = game.tableSet ?? null;
  const isSpectator = game.yourSeat < 0;
  const me = players.find((p) => p.seat === game.yourSeat);
  const isPlaying = game.phase === 'playing';
  const isHandEnd = game.phase === 'hand_end';
  const myTurn =
    isPlaying && !isSpectator && game.currentSeat === game.yourSeat;
  // 리드 = 이길 대상이 없는 상태 (자유롭게 세트를 낸다)
  const isLead = myTurn && tableSet === null;

  const groups = useMemo(() => dmGroupHand(hand), [hand]);
  const jokerCount = groups.find((g) => g.rank === DM_JOKER)?.count ?? 0;
  const naturalOf = (rank: number) =>
    groups.find((g) => g.rank === rank)?.count ?? 0;

  // 기본 필터 (유효성 최종 판정은 서버) — 리드가 아니면
  // tableSet 과 같은 장수·더 낮은 숫자만 활성
  const canFollowWith = (rank: number): boolean => {
    if (!tableSet) return true;
    if (rank === DM_JOKER) return false; // 조커 단독(=13)은 무엇도 못 이긴다
    return (
      rank < tableSet.rank && naturalOf(rank) + jokerCount >= tableSet.count
    );
  };
  // 조커를 섞어 낼 수 있는 상대 그룹 목록 (조커 패널 선택지)
  const jokerTargets = groups
    .filter((g) => g.rank !== DM_JOKER)
    .filter((g) => (tableSet ? canFollowWith(g.rank) : true))
    .map((g) => g.rank);

  // 컨텍스트가 바뀌면 선택·패널·연타 잠금을 리셋한다
  const tableKey = tableSet
    ? `${tableSet.rank}-${tableSet.count}-${tableSet.seat}`
    : 'lead';
  const handKey = hand.join(',');
  useEffect(() => {
    setSelection(null);
    setJokerPanelOpen(false);
    setSubmitted(false);
  }, [game.currentSeat, game.handNo, game.phase, tableKey, handKey]);

  // 카운트다운 (서버 endsAt 기준, 탭 복귀 시 즉시 재동기화)
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

  // ---------- 선택 · 제출 ----------

  const selectGroup = (rank: number) => {
    if (!myTurn || submitted) return;
    if (rank === DM_JOKER) {
      // 조커는 "무엇으로 낼지" 먼저 고른다
      setJokerPanelOpen(true);
      return;
    }
    if (tableSet && !canFollowWith(rank)) return;
    setJokerPanelOpen(false);
    setSelection((prev) =>
      prev?.rank === rank
        ? null // 같은 그룹 다시 탭 = 선택 해제
        : { rank, count: tableSet ? tableSet.count : naturalOf(rank) },
    );
  };

  // 조커 패널에서 숫자 선택 — 그 숫자 세트에 조커를 합쳐 낸다
  const pickJokerTarget = (rank: number) => {
    setJokerPanelOpen(false);
    setSelection({
      rank,
      count: tableSet
        ? tableSet.count
        : Math.max(1, naturalOf(rank) + jokerCount),
    });
  };

  // 조커 단독 제출 (리드 전용 — 13 취급)
  const pickJokerAlone = () => {
    setJokerPanelOpen(false);
    setSelection({ rank: DM_JOKER, count: jokerCount });
  };

  const maxCountOf = (sel: DMSelection) =>
    sel.rank === DM_JOKER ? jokerCount : naturalOf(sel.rank) + jokerCount;

  const stepCount = (delta: number) => {
    if (!selection || tableSet) return; // 팔로우는 장수가 고정
    const next = selection.count + delta;
    if (next < 1 || next > maxCountOf(selection)) return;
    setSelection({ ...selection, count: next });
  };

  const jokersUsed = selection
    ? selection.rank === DM_JOKER
      ? selection.count
      : Math.max(0, selection.count - naturalOf(selection.rank))
    : 0;

  const selectionValid =
    selection !== null &&
    selection.count >= 1 &&
    selection.count <= maxCountOf(selection) &&
    (tableSet
      ? selection.rank < tableSet.rank && selection.count === tableSet.count
      : true);

  const canSubmit = myTurn && !submitted && selectionValid;
  // 리드는 패스할 수 없다 (반드시 세트를 낸다)
  const canPass = myTurn && !submitted && tableSet !== null;

  const handleSubmit = () => {
    if (!canSubmit || !selection) return;
    const naturals =
      selection.rank === DM_JOKER
        ? 0
        : Math.min(selection.count, naturalOf(selection.rank));
    const cards = [
      ...Array.from({ length: naturals }, () => selection.rank),
      ...Array.from({ length: selection.count - naturals }, () => DM_JOKER),
    ];
    setSubmitted(true);
    onPlay(cards);
  };

  const handlePass = () => {
    if (!canPass) return;
    setSubmitted(true);
    onPass();
  };

  // ---------- 문구 ----------

  const bannerSub = isHandEnd
    ? '핸드 종료 — 순위를 집계했습니다'
    : myTurn
      ? isLead
        ? '리드입니다 — 같은 숫자 세트를 자유롭게 내세요'
        : `${tableSet?.count}장 · ${tableSet?.rank}보다 낮은 숫자만 낼 수 있습니다`
      : isPlaying
        ? `${nameOf(game.currentSeat)}님이 고민하는 중…`
        : '';

  // 테이블 세트 무더기는 시각용으로 최대 8장까지만 겹쳐 그린다
  const tableStack = tableSet ? Math.min(tableSet.count, 8) : 0;
  const handResult = game.handResult ?? null;

  return (
    <div className="dm-board">
      <div className="dm-toasts">
        {toasts.map((toast) => {
          const text = toastText(toast.event, game);
          return text ? (
            <div key={toast.id} className="dm-toast">
              {text}
            </div>
          ) : null;
        })}
      </div>

      {/* 상단 단계 배너 */}
      <div className="dm-phase-banner">
        <span className="dm-phase-title">
          👑 위대한 달무티 · {game.handNo}/{DM_TOTAL_HANDS}핸드
          {game.endsAt > 0 && !isHandEnd && (
            <span
              className={`dm-deadline ${remaining < 10_000 ? 'urgent' : ''}`}
            >
              ⏱ {mmss(remaining)}
            </span>
          )}
        </span>
        {bannerSub && <span className="dm-phase-sub">{bannerSub}</span>}
      </div>

      {/* 테이블 중앙 — 현재 이길 대상 세트 (rank × count 카드 무더기) */}
      <div className="dm-table">
        {tableSet ? (
          <div className="dm-table-set">
            <div className="dm-table-stack">
              {Array.from({ length: tableStack }).map((_, i) => (
                <DmCardFace key={i} rank={tableSet.rank} />
              ))}
              <span className="dm-table-count">×{tableSet.count}</span>
            </div>
            <span className="dm-table-label">
              {nameOf(tableSet.seat)}님이 낸 <strong>{tableSet.rank}</strong>{' '}
              {tableSet.count}장 — 더 낮은 숫자 {tableSet.count}장으로 이기세요
            </span>
          </div>
        ) : (
          <div className="dm-table-set">
            <div className="dm-table-empty">
              <span className="dm-table-empty-mark">👑</span>
            </div>
            <span className="dm-table-label">
              {isPlaying
                ? `새 리드 — ${nameOf(game.currentSeat)}님이 자유롭게 냅니다`
                : '테이블이 비어 있습니다'}
            </span>
          </div>
        )}
      </div>

      {/* 좌석 타일 — 남은 장수·순위 뱃지·현재 차례 하이라이트 */}
      <div className="dm-grid">
        {players.map((p) => {
          const isMe = p.seat === game.yourSeat;
          const isCurrent = isPlaying && p.seat === game.currentSeat;
          const offline = !p.connected && !p.bot;
          const badge = dmRankBadge(p.rank);
          return (
            <div
              key={p.seat}
              className={[
                'dm-tile',
                isCurrent ? 'current' : '',
                isMe ? 'me' : '',
                p.out ? 'out' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="dm-tile-head">
                <span className="dm-tile-name">
                  {isCurrent && <span className="dm-tile-turn">▶</span>}
                  {p.name}
                  {isMe && ' (나)'}
                </span>
                <span className="dm-tile-points">누적 {p.points}점</span>
              </div>
              <div className="dm-tile-sub">
                {p.out ? (
                  <span className="dm-tile-out">완주</span>
                ) : (
                  <span className="dm-tile-count">🂠 남은 {p.handCount}장</span>
                )}
                {badge && (
                  <span
                    className={`dm-rank-badge ${p.rank === 1 ? 'first' : ''}`}
                  >
                    {badge}
                  </span>
                )}
                {p.bot && <span className="dm-badge">🤖 봇</span>}
                {offline && <span className="dm-badge off">끊김</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 내 손패 — 랭크별 그룹 (같은 숫자 스택 + 장수 뱃지) */}
      {!isSpectator && (
        <div className="dm-hand-area">
          <div className="dm-hand-head">
            <span className="dm-hand-title">내 손패 {hand.length}장</span>
            <span className="dm-hand-hint">낮을수록 강합니다 (1이 최강)</span>
          </div>

          {hand.length > 0 ? (
            <div className="dm-hand">
              {groups.map((g) => {
                const disabledByRule =
                  myTurn &&
                  tableSet !== null &&
                  (g.rank === DM_JOKER
                    ? jokerTargets.length === 0
                    : !canFollowWith(g.rank));
                const selected =
                  selection !== null &&
                  (selection.rank === g.rank ||
                    // 조커가 섞여 나가는 선택이면 조커 그룹도 살짝 밝힌다
                    (g.rank === DM_JOKER && jokersUsed > 0));
                return (
                  <button
                    key={g.rank}
                    type="button"
                    className={[
                      'dm-group',
                      selected ? 'selected' : '',
                      disabledByRule ? 'dim' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={!myTurn || submitted || disabledByRule}
                    onClick={() => selectGroup(g.rank)}
                    aria-label={`${g.rank}번 카드 ${g.count}장${
                      g.rank === DM_JOKER ? ' (어릿광대)' : ''
                    }`}
                  >
                    <span className="dm-group-stack">
                      {Array.from({ length: Math.min(g.count, 4) }).map(
                        (_, i) => (
                          <DmCardFace key={i} rank={g.rank} small />
                        ),
                      )}
                    </span>
                    <span className="dm-group-count">×{g.count}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="dm-hand-empty">
              {me?.out
                ? '손을 모두 털었습니다 — 다른 참가자를 기다리는 중'
                : '손패가 비어 있습니다'}
            </p>
          )}

          {/* 조커 "N으로 내기" 숫자 선택 패널 */}
          {jokerPanelOpen && myTurn && (
            <div className="dm-joker-panel">
              <span className="dm-joker-title">
                ★ 어릿광대 {jokerCount}장 — 어떤 숫자로 낼까요?
              </span>
              <div className="dm-joker-options">
                {jokerTargets.map((rank) => (
                  <button
                    key={rank}
                    type="button"
                    className="dm-joker-option"
                    onClick={() => pickJokerTarget(rank)}
                  >
                    {rank}
                    <small>{dmRankName(rank)}</small>
                  </button>
                ))}
                {!tableSet && (
                  <button
                    type="button"
                    className="dm-joker-option alone"
                    onClick={pickJokerAlone}
                  >
                    13
                    <small>단독 제출</small>
                  </button>
                )}
              </div>
              {jokerTargets.length === 0 && tableSet && (
                <span className="dm-joker-none">
                  어릿광대를 섞어도 이길 수 있는 세트가 없습니다
                </span>
              )}
              <button
                type="button"
                className="dm-joker-cancel"
                onClick={() => setJokerPanelOpen(false)}
              >
                닫기
              </button>
            </div>
          )}

          {/* 제출/패스 바 — 내 차례에만 */}
          {myTurn && (
            <div className="dm-actions-wrap">
              {selection && (
                <div className="dm-stepper-row">
                  <div className="dm-stepper">
                    <button
                      type="button"
                      className="dm-step-button"
                      onClick={() => stepCount(-1)}
                      disabled={tableSet !== null || selection.count <= 1}
                      aria-label="한 장 줄이기"
                    >
                      −
                    </button>
                    <span className="dm-step-count">
                      {selection.rank === DM_JOKER ? '★' : selection.rank} ·{' '}
                      {selection.count}장
                    </span>
                    <button
                      type="button"
                      className="dm-step-button"
                      onClick={() => stepCount(1)}
                      disabled={
                        tableSet !== null ||
                        selection.count >= maxCountOf(selection)
                      }
                      aria-label="한 장 늘리기"
                    >
                      ＋
                    </button>
                  </div>
                  {jokersUsed > 0 && (
                    <span className="dm-joker-note">
                      ★ 어릿광대 {jokersUsed}장을{' '}
                      {selection.rank === DM_JOKER
                        ? '13 단독으로'
                        : `${selection.rank}(으)로`}{' '}
                      냅니다
                    </span>
                  )}
                </div>
              )}
              <div className="dm-actions">
                <button
                  type="button"
                  className="dm-pass-button"
                  onClick={handlePass}
                  disabled={!canPass}
                >
                  {isLead ? '리드는 패스 불가' : '패스'}
                </button>
                <button
                  type="button"
                  className="dm-play-button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  {selection
                    ? `${
                        selection.rank === DM_JOKER ? '어릿광대' : selection.rank
                      } ${selection.count}장 내기`
                    : '카드를 선택하세요'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {isSpectator && (
        <p className="dm-spectator-note">
          👀 관전 중 — 손패는 각자 본인에게만 보입니다
        </p>
      )}

      {/* hand_end 순위 연출 */}
      {isHandEnd && handResult && (
        <div className="dm-hand-end-overlay">
          <div className="dm-hand-end-panel">
            <span className="dm-hand-end-mark">🏁</span>
            <h2 className="dm-hand-end-title">
              {game.handNo}번째 핸드 종료
            </h2>
            {handResult.message && (
              <p className="dm-hand-end-message">{handResult.message}</p>
            )}
            <ol className="dm-hand-end-order">
              {(handResult.order ?? []).map((seat, i) => (
                <li key={seat} className={i === 0 ? 'first' : ''}>
                  <span className="dm-hand-end-rank">
                    {dmRankBadge(i + 1)}
                  </span>
                  <span className="dm-hand-end-name">
                    {nameOf(seat)}
                    {seat === game.yourSeat && ' (나)'}
                  </span>
                  <span className="dm-hand-end-points">
                    +{Math.max(0, players.length - 1 - i)}점
                  </span>
                </li>
              ))}
            </ol>
            {game.endsAt > 0 && (
              <p className="dm-hand-end-countdown">
                {game.handNo < DM_TOTAL_HANDS
                  ? `다음 핸드까지 ⏱ ${mmss(remaining)}`
                  : `최종 결과 집계까지 ⏱ ${mmss(remaining)}`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
