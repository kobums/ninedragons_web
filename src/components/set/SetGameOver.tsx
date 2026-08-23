import type {
  SEGameOverPayload,
  SEGameState,
  SEPlayerView,
} from '../../types/set';
import './SetGameOver.css';

interface SetGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 점수는 처음부터 전부 공개였다)
  game: SEGameState;
  // se_game_over 페이로드 (없으면 스냅샷 result 나 최고점으로 유추)
  result: SEGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승자 좌석들 — 페이로드 → 스냅샷 result → 최고점(동점 공동) 순으로 찾는다
function deriveWinnerSeats(
  players: SEPlayerView[],
  game: SEGameState,
  result: SEGameOverPayload | null,
): number[] {
  const fromPayload = result?.winnerSeats ?? [];
  if (fromPayload.length > 0) return fromPayload;
  const fromSnapshot = game.result?.winnerSeats ?? [];
  if (fromSnapshot.length > 0) return fromSnapshot;
  if (players.length === 0) return [];
  const best = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === best).map((p) => p.seat);
}

export function SetGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: SetGameOverProps) {
  const players = game.players ?? [];
  const winnerSeats = deriveWinnerSeats(players, game, result);
  const winnerNames =
    result?.winnerNames && result.winnerNames.length > 0
      ? result.winnerNames
      : game.result?.winnerNames && game.result.winnerNames.length > 0
        ? game.result.winnerNames
        : players.filter((p) => winnerSeats.includes(p.seat)).map((p) => p.name);
  const youWon = game.yourSeat >= 0 && winnerSeats.includes(game.yourSeat);

  // 점수 높은 순 (같으면 좌석 순) — 동점은 같은 순위로 묶는다
  const standings = [...players].sort(
    (a, b) => b.score - a.score || a.seat - b.seat,
  );
  const rankOf = (score: number) =>
    standings.filter((p) => p.score > score).length + 1;

  return (
    <div className="se-scope se-game-over">
      <div className="se-game-over-container">
        <span className="se-over-mark">🔺</span>
        <h1 className="se-over-title">
          {winnerNames.length > 0 ? winnerNames.join(' · ') : '?'}
          {winnerNames.length > 1 ? ' 공동 승리' : '님의 승리'}
        </h1>
        <p className="se-over-sub">
          {result?.message ??
            game.result?.message ??
            `세트 ${game.setsFound}개 발견 · 덱과 바닥에 더는 세트가 없습니다`}
        </p>
        {game.yourSeat >= 0 && (
          <p className={`se-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        <div className="se-over-table-wrap">
          <table className="se-over-table">
            <thead>
              <tr>
                <th>순위</th>
                <th className="left">플레이어</th>
                <th>점수</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((p) => {
                const isWinner = winnerSeats.includes(p.seat);
                return (
                  <tr key={p.seat} className={isWinner ? 'winner' : undefined}>
                    <td className="se-over-rank">{rankOf(p.score)}</td>
                    <td className="left">
                      <span className="se-over-name">
                        {isWinner && '👑 '}
                        {p.name}
                        {p.seat === game.yourSeat && ' (나)'}
                        {p.bot && ' 🤖'}
                      </span>
                    </td>
                    <td className="se-over-score">{p.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="se-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="se-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
