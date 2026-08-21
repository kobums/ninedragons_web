import type { CPGameOverPayload, CPGameState } from '../../types/coup';
import { CP_ROLES } from '../../types/coup';
import './CoupGameOver.css';

interface CoupGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: CPGameState;
  // cp_game_over 페이로드 — 승자 좌석 보조 (없으면 스냅샷에서 유도)
  gameOver: CPGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승부 결과 오버레이 — 최후 생존자 + 최종 순위표. 사설 방이면 같은 방 재대결.
export function CoupGameOver({
  game,
  gameOver,
  roomCode,
  onFindNewGame,
}: CoupGameOverProps) {
  const players = game.players ?? [];

  // 승자 좌석: 페이로드 우선 → 최후 생존자(alive)로 유도
  const winnerSeats =
    gameOver?.winnerSeats && gameOver.winnerSeats.length > 0
      ? gameOver.winnerSeats
      : players.filter((p) => p.alive).map((p) => p.seat);

  const winners = players.filter((p) => winnerSeats.includes(p.seat));
  const isSpectator = game.yourSeat < 0;
  const youWon = !isSpectator && winnerSeats.includes(game.yourSeat);

  // 생존 → 남은 카드 → 칩 순으로 정렬한 최종 순위표
  const roster = [...players].sort(
    (a, b) =>
      Number(b.alive) - Number(a.alive) ||
      b.cardCount - a.cardCount ||
      b.chips - a.chips,
  );

  return (
    <div className="cp-game-over">
      <div className="cp-game-over-container">
        <span className="cp-over-icon">{youWon ? '👑' : '🗡️'}</span>
        <h1 className="cp-over-title">
          {winners.length > 0
            ? `${winners.map((w) => w.name).join(', ')} 승리`
            : '게임 종료'}
        </h1>
        {!isSpectator && (
          <p className={`cp-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon
              ? '👑 궁정의 마지막 생존자는 당신입니다'
              : (gameOver?.message ?? '다음 음모에서 설욕하세요')}
          </p>
        )}

        <ul className="cp-over-roster">
          {roster.map((p, i) => {
            const revealed = p.revealed ?? [];
            return (
              <li
                key={p.seat}
                className={[
                  'cp-over-row',
                  p.alive ? '' : 'dead',
                  winnerSeats.includes(p.seat) ? 'winner' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="cp-over-name">
                  <span className="cp-over-rank">{i + 1}위</span>
                  {winnerSeats.includes(p.seat) ? '👑 ' : p.alive ? '' : '☠️ '}
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="cp-over-info">
                  {revealed.length > 0 && (
                    <span className="cp-over-revealed">
                      {revealed.map((r) => CP_ROLES[r]?.name ?? r).join('·')}
                    </span>
                  )}
                  <span className="cp-over-chips">🪙 {p.chips}</span>
                </span>
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (다인 게임 공통 흐름)
          <button
            type="button"
            className="cp-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="cp-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
