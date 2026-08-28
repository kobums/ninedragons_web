import type {
  RRGameOverPayload,
  RRGameState,
  RRPlayerView,
} from '../../types/ricochet';
import './RicochetGameOver.css';

interface RicochetGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 리코셰는 처음부터 전부 공개였다)
  game: RRGameState;
  // rr_game_over 페이로드 (없으면 스냅샷 result 나 최고 획득 수로 유추)
  result: RRGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승자 좌석들 — 페이로드 → 스냅샷 result → 최다 획득(동점 공동) 순
function deriveWinnerSeats(
  players: RRPlayerView[],
  game: RRGameState,
  result: RRGameOverPayload | null,
): number[] {
  const fromPayload = result?.winnerSeats ?? [];
  if (fromPayload.length > 0) return fromPayload;
  const fromSnapshot = game.result?.winnerSeats ?? [];
  if (fromSnapshot.length > 0) return fromSnapshot;
  if (players.length === 0) return [];
  const best = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === best).map((p) => p.seat);
}

export function RicochetGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: RicochetGameOverProps) {
  const players = game.players ?? [];
  const winnerSeats = deriveWinnerSeats(players, game, result);
  const winnerNames =
    result?.winnerNames && result.winnerNames.length > 0
      ? result.winnerNames
      : game.result?.winnerNames && game.result.winnerNames.length > 0
        ? game.result.winnerNames
        : players.filter((p) => winnerSeats.includes(p.seat)).map((p) => p.name);
  const youWon = game.yourSeat >= 0 && winnerSeats.includes(game.yourSeat);

  // 획득 많은 순 (같으면 좌석 순) — 동점은 같은 순위로 묶는다
  const standings = [...players].sort(
    (a, b) => b.score - a.score || a.seat - b.seat,
  );
  const rankOf = (score: number) =>
    standings.filter((p) => p.score > score).length + 1;
  const totalTaken = players.reduce((sum, p) => sum + p.score, 0);

  return (
    <div className="rr-scope rr-game-over">
      <div className="rr-game-over-container">
        <span className="rr-over-mark">🤖</span>
        <h1 className="rr-over-title">
          {winnerNames.length > 0 ? winnerNames.join(' · ') : '?'}
          {winnerNames.length > 1 ? ' 공동 승리' : '님의 승리'}
        </h1>
        <p className="rr-over-sub">
          {result?.message ??
            game.result?.message ??
            `목표 ${game.goalTotal}개 중 ${totalTaken}개를 나눠 가졌습니다`}
        </p>
        {game.yourSeat >= 0 && (
          <p className={`rr-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        <div className="rr-over-list">
          {standings.map((p) => {
            const isWinner = winnerSeats.includes(p.seat);
            return (
              <div
                key={p.seat}
                className={`rr-over-card ${isWinner ? 'winner' : ''}`}
              >
                <span className="rr-over-name">
                  <span className="rr-over-rank">{rankOf(p.score)}</span>
                  {isWinner && '👑 '}
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="rr-over-score">목표 {p.score}개</span>
              </div>
            );
          })}
        </div>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="rr-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="rr-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
