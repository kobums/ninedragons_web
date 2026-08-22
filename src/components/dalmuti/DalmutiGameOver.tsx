import type {
  DMGameOverPayload,
  DMGameState,
  DMPlayerView,
} from '../../types/dalmuti';
import { DM_TOTAL_HANDS } from '../../types/dalmuti';
import './DalmutiGameOver.css';

interface DalmutiGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 3핸드 누적 점수 전원 공개)
  game: DMGameState;
  // dm_game_over 페이로드 (없으면 스냅샷에서 승자를 유추)
  result: DMGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승자 좌석들 — 서버 페이로드 우선, 없으면 최고 총점(동점 공동)으로 유추
function deriveWinnerSeats(
  players: DMPlayerView[],
  result: DMGameOverPayload | null,
): number[] {
  if (result?.winnerSeats && result.winnerSeats.length > 0) {
    return result.winnerSeats;
  }
  if (players.length === 0) return [];
  const best = Math.max(...players.map((p) => p.points));
  return players.filter((p) => p.points === best).map((p) => p.seat);
}

// 최종 결과 화면 — 3핸드 총점 순위 (동점 공동 순위).
export function DalmutiGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: DalmutiGameOverProps) {
  const players = game.players ?? [];
  const winnerSeats = deriveWinnerSeats(players, result);
  const winnerNames =
    result?.winners && result.winners.length > 0
      ? result.winners
      : players.filter((p) => winnerSeats.includes(p.seat)).map((p) => p.name);
  const youWon = game.yourSeat >= 0 && winnerSeats.includes(game.yourSeat);

  // 총점 높은 순 정렬 (같으면 좌석 순) — 동점은 공동 순위
  const standings = [...players].sort(
    (a, b) => b.points - a.points || a.seat - b.seat,
  );
  const placeOf = (p: DMPlayerView) =>
    standings.findIndex((s) => s.points === p.points) + 1;

  return (
    <div className="dm-game-over">
      <div className="dm-game-over-container">
        <span className="dm-over-mark">👑</span>
        <h1 className="dm-over-title">
          {winnerNames.length > 0 ? winnerNames.join(' · ') : '?'}
          {winnerNames.length > 1 ? ' 공동 우승' : '님의 우승'}
        </h1>
        <p className="dm-over-sub">
          {result?.message ?? `${DM_TOTAL_HANDS}핸드 종료 — 총점 최고가 위대한 달무티`}
        </p>
        {game.yourSeat >= 0 && (
          <p className={`dm-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 위대한 달무티가 되었습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        {/* 3핸드 총점 순위 표 */}
        <div className="dm-over-table-wrap">
          <table className="dm-over-table">
            <thead>
              <tr>
                <th>순위</th>
                <th className="left">플레이어</th>
                <th>총점</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((p) => {
                const isWinner = winnerSeats.includes(p.seat);
                const place = placeOf(p);
                return (
                  <tr key={p.seat} className={isWinner ? 'winner' : undefined}>
                    <td className="dm-over-place">
                      {place === 1 ? '👑 1위' : `${place}위`}
                    </td>
                    <td className="left">
                      <span className="dm-over-name">
                        {p.name}
                        {p.seat === game.yourSeat && ' (나)'}
                        {p.bot && ' 🤖'}
                      </span>
                    </td>
                    <td className="dm-over-score">{p.points}점</td>
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
            className="dm-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="dm-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
