import type {
  IPGameOverPayload,
  IPGameState,
} from '../../types/indianpoker';
import './IndianPokerGameOver.css';

interface IndianPokerGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: IPGameState;
  // ip_game_over 페이로드 — 승자 좌석 보조 (없으면 스냅샷에서 유도)
  gameOver: IPGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승부 결과 오버레이 — 칩 순위표. 사설 방이면 같은 방 재대결 버튼.
export function IndianPokerGameOver({
  game,
  gameOver,
  roomCode,
  onFindNewGame,
}: IndianPokerGameOverProps) {
  const players = game.players ?? [];

  // 승자 좌석: 페이로드 우선 → 최다 칩 보유자(동점 공동 승)로 유도
  const maxChips = players.reduce((max, p) => Math.max(max, p.chips), 0);
  const winnerSeats =
    gameOver?.winnerSeats && gameOver.winnerSeats.length > 0
      ? gameOver.winnerSeats
      : players.filter((p) => p.chips === maxChips && maxChips > 0).map((p) => p.seat);

  const winners = players.filter((p) => winnerSeats.includes(p.seat));
  const isSpectator = game.yourSeat < 0;
  const youWon = !isSpectator && winnerSeats.includes(game.yourSeat);

  // 칩 → 생존 순으로 정렬한 최종 순위표
  const roster = [...players].sort(
    (a, b) => b.chips - a.chips || Number(b.alive) - Number(a.alive),
  );

  return (
    <div className="ip-game-over">
      <div className="ip-game-over-container">
        <span className="ip-over-icon">{youWon ? '🏆' : '🃏'}</span>
        <h1 className="ip-over-title">
          {winners.length > 0
            ? `${winners.map((w) => w.name).join(', ')} 승리`
            : '게임 종료'}
        </h1>
        {!isSpectator && (
          <p className={`ip-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon
              ? '🪙 최다 칩의 주인은 당신입니다'
              : (gameOver?.message ?? '다음 판에서 설욕하세요')}
          </p>
        )}

        <ul className="ip-over-roster">
          {roster.map((p, i) => (
            <li
              key={p.seat}
              className={[
                'ip-over-row',
                p.alive ? '' : 'dead',
                winnerSeats.includes(p.seat) ? 'winner' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="ip-over-name">
                <span className="ip-over-rank">{i + 1}위</span>
                {winnerSeats.includes(p.seat) ? '🏆 ' : p.alive ? '' : '💸 '}
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="ip-over-chips">🪙 {p.chips}</span>
            </li>
          ))}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (다인 게임 공통 흐름)
          <button
            type="button"
            className="ip-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="ip-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
