import type { JOGameOverPayload, JOGameState } from '../../types/justone';
import { joGrade } from '../../types/justone';
import './JustOneGameOver.css';

interface JustOneGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 총점·라운드별 기록 공개)
  game: JOGameState;
  // jo_game_over 페이로드 (없으면 스냅샷에서 총점을 읽는다)
  result: JOGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 협력 게임이라 승패가 아니라 팀 총점과 등급 문구를 보여준다.
export function JustOneGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: JustOneGameOverProps) {
  const score = result?.score ?? game.score ?? 0;
  const totalRounds = result?.totalRounds ?? game.totalRounds ?? 0;
  // 기록은 스냅샷 우선 — 종료 페이로드는 보조 (둘 다 없으면 빈 표)
  const history =
    (game.history ?? []).length > 0 ? (game.history ?? []) : (result?.history ?? []);
  const grade = joGrade(score, totalRounds);
  const correctCount = history.filter((h) => h.correct).length;

  return (
    <div className="jo-scope jo-game-over">
      <div className="jo-game-over-container">
        <span className="jo-over-mark">{grade.mark}</span>
        <h1 className="jo-over-title">
          {score}점 / {totalRounds}점
        </h1>
        <p className={`jo-over-grade ${grade.key}`}>{grade.label}</p>
        <p className="jo-over-sub">{result?.message ?? grade.message}</p>

        {totalRounds > 0 && (
          <div className="jo-over-meter" aria-hidden="true">
            <span
              className="jo-over-meter-fill"
              style={{
                width: `${Math.min(100, (Math.max(0, score) / totalRounds) * 100)}%`,
              }}
            />
          </div>
        )}

        {/* 라운드별 기록 — 제시어 · 답 · 정오 */}
        {history.length > 0 ? (
          <>
            <p className="jo-over-count">
              {history.length}라운드 중 {correctCount}라운드 정답
            </p>
            <div className="jo-over-table-wrap">
              <table className="jo-over-table">
                <thead>
                  <tr>
                    <th>R</th>
                    <th className="left">제시어</th>
                    <th className="left">답</th>
                    <th>결과</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={h.round}
                      className={h.correct ? 'correct' : undefined}
                    >
                      <td>{h.round}</td>
                      <td className="left">
                        <span className="jo-over-word">{h.word || '—'}</span>
                      </td>
                      <td className="left">
                        <span
                          className={`jo-over-guess ${h.correct ? '' : 'miss'}`}
                        >
                          {h.guess || '넘김'}
                        </span>
                      </td>
                      <td>{h.correct ? '⭕' : h.guess ? '❌' : '➖'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="jo-over-count">기록이 없습니다</p>
        )}

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="jo-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="jo-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
