import type {
  NMGameOverPayload,
  NMGameState,
  NMPlayerView,
} from '../../types/nimmt';
import './NimmtGameOver.css';

interface NimmtGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 벌점 전원 공개)
  game: NMGameState;
  // nm_game_over 페이로드 (없으면 스냅샷에서 승자를 유추)
  result: NMGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승자 좌석들 — 서버 페이로드 우선, 없으면 소머리 최소(동점 공동)로 유추
function deriveWinnerSeats(
  players: NMPlayerView[],
  result: NMGameOverPayload | null,
): number[] {
  if (result?.winnerSeats && result.winnerSeats.length > 0) {
    return result.winnerSeats;
  }
  if (players.length === 0) return [];
  const best = Math.min(...players.map((p) => p.penalty));
  return players.filter((p) => p.penalty === best).map((p) => p.seat);
}

// 종료 화면 — 소머리 벌점 최소가 승리 (동점 공동), 한 딜 승부.
export function NimmtGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: NimmtGameOverProps) {
  const players = game.players ?? [];
  const winnerSeats = deriveWinnerSeats(players, result);
  const winnerNames =
    result?.winners && result.winners.length > 0
      ? result.winners
      : players.filter((p) => winnerSeats.includes(p.seat)).map((p) => p.name);
  const youWon = game.yourSeat >= 0 && winnerSeats.includes(game.yourSeat);

  // 벌점 낮은 순 정렬 (같으면 좌석 순) — 소머리 최소가 곧 1위
  const standings = [...players].sort(
    (a, b) => a.penalty - b.penalty || a.seat - b.seat,
  );
  const maxPenalty = Math.max(1, ...players.map((p) => p.penalty));

  return (
    <div className="nm-game-over">
      <div className="nm-game-over-container">
        <span className="nm-over-mark">🐮</span>
        <h1 className="nm-over-title">
          {winnerNames.length > 0 ? winnerNames.join(' · ') : '?'}
          {winnerNames.length > 1 ? ' 공동 승리' : '님의 승리'}
        </h1>
        <p className="nm-over-sub">
          {result?.message ?? '10라운드 종료 · 소머리 벌점 최소 승리'}
        </p>
        {game.yourSeat >= 0 && (
          <p className={`nm-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        {/* 벌점 순위 — 소머리 합 막대와 함께 */}
        <ul className="nm-over-list">
          {standings.map((p) => {
            const isWinner = winnerSeats.includes(p.seat);
            return (
              <li
                key={p.seat}
                className={`nm-over-row ${isWinner ? 'winner' : ''}`}
              >
                <span className="nm-over-name">
                  {isWinner && '👑 '}
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="nm-over-bar-wrap" aria-hidden="true">
                  <span
                    className="nm-over-bar"
                    style={{
                      width: `${Math.round((p.penalty / maxPenalty) * 100)}%`,
                    }}
                  />
                </span>
                <span className="nm-over-penalty">🐮 {p.penalty}</span>
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="nm-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="nm-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
