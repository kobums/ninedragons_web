import type {
  SLGameOverPayload,
  SLGameState,
  SLPlayerView,
} from '../../types/splendor';
import {
  SL_GEMS,
  SL_TARGET_POINTS,
  SL_TOKEN_LABEL,
  slTotalCards,
} from '../../types/splendor';
import { SplendorGemIcon } from './SplendorBoard';
import './SplendorGameOver.css';

interface SplendorGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: SLGameState;
  // sl_game_over 페이로드 — 신호+승자 보조 (없으면 스냅샷 result 로 그린다)
  result: SLGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 명성 점수 내림차순 → 동점이면 개발 카드 수가 적은 쪽이 앞 (공식 타이브레이크)
function rank(a: SLPlayerView, b: SLPlayerView): number {
  if (b.points !== a.points) return b.points - a.points;
  return slTotalCards(a.cards) - slTotalCards(b.cards);
}

export function SplendorGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: SplendorGameOverProps) {
  const players = [...(game.players ?? [])].sort(rank);
  const snap = game.result ?? null;
  const winnerSeats = snap?.winnerSeats ?? result?.winnerSeats ?? [];
  const winnerNames = snap?.winnerNames ?? result?.winnerNames ?? [];
  const message = snap?.message ?? result?.message ?? '';

  const isWinner = (seat: number) => winnerSeats.includes(seat);
  const youWon = game.yourSeat >= 0 && isWinner(game.yourSeat);
  const isSpectator = game.yourSeat < 0;

  const title =
    winnerNames.length > 1
      ? `🤝 공동 승리 — ${winnerNames.join(' · ')}`
      : winnerNames.length === 1
        ? `🏆 ${winnerNames[0]} 승리`
        : '게임 종료';

  return (
    <div className="sl-game-over">
      <div className="sl-game-over-container">
        <span className="sl-over-mark">💎</span>
        <h1 className="sl-over-title">{title}</h1>
        <p className="sl-over-sub">
          {message || `명성 점수 ${SL_TARGET_POINTS}점 도달로 마무리되었습니다`}
        </p>
        {!isSpectator && winnerSeats.length > 0 && (
          <p className={`sl-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {/* 명성 점수 순위 — 동점은 개발 카드 수가 적은 쪽이 앞선다 */}
        <div className="sl-over-table-wrap">
          <table className="sl-over-table">
            <thead>
              <tr>
                <th className="left">순위</th>
                <th className="left">이름</th>
                <th>명성 점수</th>
                <th>개발 카드</th>
                <th>귀족 타일</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr
                  key={p.seat}
                  className={isWinner(p.seat) ? 'winner' : undefined}
                >
                  <td className="left sl-over-place">{i + 1}위</td>
                  <td className="left">
                    <span className="sl-over-name">
                      {p.name}
                      {p.seat === game.yourSeat && ' (나)'}
                      {p.bot && ' 🤖'}
                    </span>
                  </td>
                  <td className="sl-over-score">{p.points}</td>
                  <td>{slTotalCards(p.cards)}</td>
                  <td>{(p.nobles ?? []).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 색별 보너스 카드 분포 — 어떤 색으로 엔진을 굴렸는지 */}
        <div className="sl-over-gems">
          {players.map((p) => (
            <div key={p.seat} className="sl-over-gem-row">
              <span className="sl-over-gem-name">{p.name}</span>
              <span className="sl-over-gem-chips">
                {SL_GEMS.map((gem) => (
                  <span
                    key={gem}
                    className="sl-over-gem-chip"
                    title={`${SL_TOKEN_LABEL[gem]} 보너스 ${p.cards?.[gem] ?? 0}장`}
                  >
                    <SplendorGemIcon gem={gem} size={13} />
                    <span>{p.cards?.[gem] ?? 0}</span>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="sl-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="sl-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
