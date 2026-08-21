import type {
  NTGameOverPayload,
  NTGameState,
  NTPlayerView,
} from '../../types/nothanks';
import { ntCardSum } from '../../types/nothanks';
import { NTRunGroups } from './NoThanksBoard';
import './NoThanksGameOver.css';

interface NoThanksGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 쇼다운으로 칩·점수 전원 공개)
  game: NTGameState;
  // nt_game_over 페이로드 (없으면 스냅샷에서 승자를 유추)
  result: NTGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 점수 — 서버 score 우선, 없으면 카드 합(시퀀스 최솟값) − 칩으로 로컬 계산
function scoreOf(p: NTPlayerView): number {
  if (typeof p.score === 'number') return p.score;
  const cardSum = ntCardSum(p.cards ?? []);
  return p.chips >= 0 ? cardSum - p.chips : cardSum;
}

// 승자 좌석들 — 서버 페이로드 우선, 없으면 최저점(동점 공동)으로 유추
function deriveWinnerSeats(
  players: NTPlayerView[],
  result: NTGameOverPayload | null,
): number[] {
  if (result?.winnerSeats && result.winnerSeats.length > 0) {
    return result.winnerSeats;
  }
  if (players.length === 0) return [];
  const best = Math.min(...players.map(scoreOf));
  return players.filter((p) => scoreOf(p) === best).map((p) => p.seat);
}

// 쇼다운 결과 화면 — 카드 합 − 칩 = 점수 내역 표, 최저점 승리 (동점 공동).
export function NoThanksGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: NoThanksGameOverProps) {
  const players = game.players ?? [];
  const winnerSeats = deriveWinnerSeats(players, result);
  const winnerNames =
    result?.winners && result.winners.length > 0
      ? result.winners
      : players.filter((p) => winnerSeats.includes(p.seat)).map((p) => p.name);
  const youWon = game.yourSeat >= 0 && winnerSeats.includes(game.yourSeat);

  // 점수 낮은 순 정렬 (같으면 좌석 순) — 최저점이 곧 1위
  const standings = [...players].sort(
    (a, b) => scoreOf(a) - scoreOf(b) || a.seat - b.seat,
  );

  return (
    <div className="nt-game-over">
      <div className="nt-game-over-container">
        <span className="nt-over-mark">🪙</span>
        <h1 className="nt-over-title">
          {winnerNames.length > 0 ? winnerNames.join(' · ') : '?'}
          {winnerNames.length > 1 ? ' 공동 승리' : '님의 승리'}
        </h1>
        <p className="nt-over-sub">
          {result?.message ?? '덱 소진 · 최저점 승리 — 칩 공개(쇼다운)'}
        </p>
        {game.yourSeat >= 0 && (
          <p className={`nt-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        {/* 점수 내역 표 — 카드 합(시퀀스 최솟값만) − 칩 = 점수 */}
        <div className="nt-over-table-wrap">
          <table className="nt-over-table">
            <thead>
              <tr>
                <th className="left">플레이어</th>
                <th>카드 합</th>
                <th>칩</th>
                <th>점수</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((p) => {
                const cardSum = ntCardSum(p.cards ?? []);
                const isWinner = winnerSeats.includes(p.seat);
                return (
                  <tr
                    key={p.seat}
                    className={isWinner ? 'winner' : undefined}
                  >
                    <td className="left">
                      <span className="nt-over-name">
                        {isWinner && '👑 '}
                        {p.name}
                        {p.seat === game.yourSeat && ' (나)'}
                        {p.bot && ' 🤖'}
                      </span>
                    </td>
                    <td>{cardSum}</td>
                    <td>− {p.chips < 0 ? '?' : p.chips}</td>
                    <td className="nt-over-score">= {scoreOf(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 획득 카드 내역 — 연속 시퀀스는 붙여서, 최솟값만 점수 */}
        <ul className="nt-over-cards">
          {standings.map((p) => (
            <li key={p.seat} className="nt-over-cards-row">
              <span className="nt-over-cards-name">{p.name}</span>
              {(p.cards ?? []).length > 0 ? (
                <NTRunGroups cards={p.cards ?? []} />
              ) : (
                <span className="nt-over-cards-none">카드 없음</span>
              )}
            </li>
          ))}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="nt-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="nt-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
