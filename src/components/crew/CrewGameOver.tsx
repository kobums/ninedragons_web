import type { CWGameOverPayload, CWGameState } from '../../types/crew';
import {
  CW_DEFAULT_MAX_MISSION,
  CW_FAIL_TEXT,
  CW_SUIT_LABEL,
  CW_SUIT_MARK,
  cwCardKey,
} from '../../types/crew';
import './CrewGameOver.css';

interface CrewGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: CWGameState;
  // cw_game_over 페이로드 — 신호+결과 보조 (없으면 스냅샷 result 로 그린다)
  result: CWGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 협력 게임이라 승패는 전원 공동이다 — 몇 단계까지 갔는지가 기록.
export function CrewGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: CrewGameOverProps) {
  const players = game.players ?? [];
  const tasks = game.tasks ?? [];
  const snap = game.result ?? null;
  const maxMission = game.maxMission || CW_DEFAULT_MAX_MISSION;

  const cleared = snap?.cleared ?? result?.cleared ?? false;
  const failedReason = snap?.failedReason ?? result?.failedReason ?? '';
  // 실패라면 그 단계에서 멈춘 것이므로 직전 단계까지가 클리어 기록
  const reachedMission = snap?.mission ?? result?.mission ?? game.mission;
  const clearedCount = cleared
    ? maxMission
    : Math.max(0, Math.min(maxMission, reachedMission - 1));

  const title = cleared ? '🚀 전 임무 완수' : '💥 임무 실패';
  const message =
    snap?.message ??
    result?.message ??
    (cleared
      ? `${maxMission}단계까지 모두 돌파했습니다`
      : failedReason !== ''
        ? CW_FAIL_TEXT[failedReason]
        : '임무를 완수하지 못했습니다');

  const pct = maxMission > 0 ? (clearedCount / maxMission) * 100 : 0;

  return (
    <div className="cw-scope cw-game-over">
      <div className="cw-game-over-container">
        <h1 className={`cw-over-title ${cleared ? 'cleared' : 'failed'}`}>
          {title}
        </h1>
        <p className="cw-over-message">{message}</p>

        {/* 기록 — 클리어한 임무 단계 수 */}
        <div className="cw-over-score">
          <span className="cw-over-score-value">
            {clearedCount}
            <span className="cw-over-score-max"> / {maxMission}</span>
          </span>
          <span className="cw-over-score-label">클리어한 임무 단계</span>
          <div className="cw-over-track">
            <div
              className={`cw-over-fill ${cleared ? 'cleared' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!cleared && (
            <span className="cw-over-reach">
              {reachedMission}단계에서 멈췄습니다
            </span>
          )}
        </div>

        {/* 마지막 라운드의 임무 결과 */}
        {tasks.length > 0 && (
          <ul className="cw-over-tasks">
            {tasks.map((task) => (
              <li
                key={`${cwCardKey(task)}-${task.seat}`}
                className={`cw-over-task ${task.done ? 'done' : 'fail'}`}
              >
                <span className={`cw-over-task-card suit-${task.suit}`}>
                  {task.rank} {CW_SUIT_MARK[task.suit]}
                </span>
                <span className="cw-over-task-name">
                  {players.find((p) => p.seat === task.seat)?.name ?? '?'}
                </span>
                <span className="cw-over-task-state">
                  {task.done ? '✅' : '❌'}
                </span>
                <span className="cw-over-task-suit">
                  {CW_SUIT_LABEL[task.suit]}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* 탑승 대원 — 마지막 라운드에 맡았던 임무 성적 */}
        <ul className="cw-over-roster">
          {players.map((p) => {
            const mine = tasks.filter((t) => t.seat === p.seat);
            const mineDone = mine.filter((t) => t.done).length;
            const allDone = mine.length > 0 && mineDone === mine.length;
            return (
              <li key={p.seat} className="cw-over-row">
                <span className="cw-over-name">
                  {p.seat === game.commanderSeat && '🚀 '}
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className={`cw-over-tag ${allDone ? 'ok' : ''}`}>
                  {mine.length === 0
                    ? '임무 없음'
                    : `임무 ${mineDone}/${mine.length}`}
                </span>
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="cw-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재도전
          </button>
        )}
        <button
          type="button"
          className="cw-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
