import type {
  KGGameOverPayload,
  KGGameState,
} from '../../types/skullking';
import { kgMaxRound } from '../../types/skullking';
import './SkullKingGameOver.css';

interface SkullKingGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 총점 확정 상태)
  game: KGGameState;
  // kg_game_over 페이로드 — 신호+승자 보조 (없으면 스냅샷 총점으로 판정한다)
  result: KGGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 최종 순위 오버레이 — 총점 최고 승 (동점 공동 우승)
export function SkullKingGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: SkullKingGameOverProps) {
  const players = game.players ?? [];
  const maxRound = game.maxRound > 0 ? game.maxRound : kgMaxRound(players.length);

  // 총점 내림차순. 동점은 공동 순위로 묶는다.
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const best = ranked.length > 0 ? ranked[0].score : 0;
  // 서버가 승자를 알려주면 그대로 쓰고, 없으면 총점 최고를 승자로 본다
  const serverWinners =
    result?.winnerSeats ??
    (result?.winnerSeat !== undefined ? [result.winnerSeat] : null);
  const winnerSeats =
    serverWinners ??
    ranked.filter((p) => p.score === best).map((p) => p.seat);
  const winnerSet = new Set(winnerSeats);

  const rankOf = (score: number) =>
    ranked.filter((p) => p.score > score).length + 1;

  const youWon = game.yourSeat >= 0 && winnerSet.has(game.yourSeat);
  const winnerNames = winnerSeats
    .map((seat) => players.find((p) => p.seat === seat)?.name ?? '?')
    .join(', ');

  const title =
    winnerSeats.length > 1
      ? '🏴‍☠️ 공동 우승'
      : winnerSeats.length === 1
        ? `🏴‍☠️ ${winnerNames} 승리`
        : '게임 종료';

  return (
    <div className="kg-scope kg-game-over">
      <div className="kg-game-over-container">
        <h1 className="kg-over-title">{title}</h1>
        <p className="kg-over-message">
          {result?.message ??
            `${maxRound}라운드를 모두 마쳤습니다 — 총점 ${best}점`}
        </p>
        {winnerSeats.length > 1 && (
          <p className="kg-over-reason">{winnerNames}님이 동점입니다</p>
        )}
        {game.yourSeat >= 0 && (
          <p className={`kg-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '아쉽지만 다음 항해에…'}
          </p>
        )}

        {/* 총점 순위 */}
        <ul className="kg-over-roster">
          {ranked.map((p) => {
            const rank = rankOf(p.score);
            return (
              <li
                key={p.seat}
                className={`kg-over-row ${winnerSet.has(p.seat) ? 'winner' : ''}`}
              >
                <span className="kg-over-rank">{rank}위</span>
                <span className="kg-over-name">
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="kg-over-score">{p.score}점</span>
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="kg-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="kg-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
