import type { DVGameOver as DVGameOverPayload } from '../../types/davinci';
import { DVTileRow } from './DVTileRow';
import './DVGameOver.css';

interface DVGameOverProps {
  result: DVGameOverPayload;
  yourSeat: number | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onPlayAgain: () => void;
}

export function DVGameOver({ result, yourSeat, roomCode, onPlayAgain }: DVGameOverProps) {
  const youWon = yourSeat !== null && result.winnerSeat === yourSeat;

  return (
    <div className="dv-game-over">
      <div className="dv-game-over-container">
        <h1 className="dv-over-title">{youWon ? '🏆 승리!' : '게임 종료'}</h1>
        <p className="dv-over-winner">
          승자: <strong>{result.winnerName}</strong>
          {result.reason === 'forfeit_win' && ' (상대 몰수패)'}
        </p>

        <div className="dv-over-board">
          {result.players.map((p) => (
            <DVTileRow
              key={p.seat}
              player={p}
              isYou={p.seat === yourSeat}
              isCurrent={p.seat === result.winnerSeat}
            />
          ))}
        </div>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="dv-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button type="button" className="dv-primary-button" onClick={onPlayAgain}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
