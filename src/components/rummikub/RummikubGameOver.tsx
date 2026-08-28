import type {
  RUGameOverPayload,
  RUGameState,
  RUResultRow,
} from '../../types/rummikub';
import {
  RU_JOKER_PENALTY,
  RU_NO_MELD_PENALTY,
  ruRackPenalty,
  ruTileKey,
} from '../../types/rummikub';
import { RummikubTile } from './RummikubBoard';
import './RummikubGameOver.css';

interface RummikubGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: RUGameState;
  // ru_game_over 페이로드 — 신호+정산 보조 (없으면 스냅샷 result 로 그린다)
  result: RUGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

export function RummikubGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: RummikubGameOverProps) {
  const players = game.players ?? [];
  const snap = game.result ?? null;
  const winnerSeats = snap?.winnerSeats ?? result?.winnerSeats ?? [];
  const winnerNames = snap?.winnerNames ?? result?.winnerNames ?? [];
  const message = snap?.message ?? result?.message ?? '';

  // 정산 내역은 서버 rows 를 우선 쓰고, 없으면 최종 점수로 직접 세운다
  const rows: RUResultRow[] = (() => {
    const raw = snap?.rows ?? result?.rows ?? [];
    if (raw.length > 0) return [...raw].sort((a, b) => b.score - a.score);
    return [...players]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ seat: p.seat, score: p.score }));
  })();

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? `${seat + 1}번`;
  const playerOf = (seat: number) => players.find((p) => p.seat === seat);

  const isWinner = (seat: number) => winnerSeats.includes(seat);
  const youWon = game.yourSeat >= 0 && isWinner(game.yourSeat);
  const isSpectator = game.yourSeat < 0;

  const title =
    winnerNames.length > 1
      ? `🤝 공동 승리 — ${winnerNames.join(' · ')}`
      : winnerNames.length === 1
        ? `🏆 ${winnerNames[0]} 승리`
        : '게임 종료';

  const sets = game.sets ?? [];
  const myRack = game.yourRack ?? [];
  const myPenalty = ruRackPenalty(myRack);

  return (
    <div className="ru-game-over">
      <div className="ru-game-over-container">
        <span className="ru-over-mark">🁢</span>
        <h1 className="ru-over-title">{title}</h1>
        <p className="ru-over-sub">
          {message ||
            '받침대를 먼저 비운 사람이 승리합니다 — 타일더미가 떨어지면 남은 타일 점수가 가장 낮은 사람이 승리합니다'}
        </p>
        {!isSpectator && winnerSeats.length > 0 && (
          <p className={`ru-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {/* 정산 내역 — 점수 내림차순 */}
        <div className="ru-over-table-wrap">
          <table className="ru-over-table">
            <thead>
              <tr>
                <th className="left">순위</th>
                <th className="left">이름</th>
                <th>점수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const p = playerOf(row.seat);
                return (
                  <tr
                    key={row.seat}
                    className={isWinner(row.seat) ? 'winner' : undefined}
                  >
                    <td className="left ru-over-place">{i + 1}위</td>
                    <td className="left">
                      <span className="ru-over-name">
                        {nameOf(row.seat)}
                        {row.seat === game.yourSeat && ' (나)'}
                        {p?.bot && ' 🤖'}
                        {p && !p.melded && (
                          <span className="ru-over-tag">미등록</span>
                        )}
                      </span>
                      {row.detail && (
                        <span className="ru-over-detail">{row.detail}</span>
                      )}
                    </td>
                    <td
                      className={`ru-over-score ${row.score < 0 ? 'minus' : ''}`}
                    >
                      {row.score > 0 ? `+${row.score}` : row.score}점
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="ru-over-legend">
          패자는 받침대에 남은 타일의 숫자 합이 마이너스이고(조커는{' '}
          {RU_JOKER_PENALTY}점), 그 합계가 그대로 승자의 플러스 점수가 됩니다.
          등록도 못 하고 끝난 사람은 타일 점수와 무관하게 벌점{' '}
          {RU_NO_MELD_PENALTY}점입니다.
        </p>

        {/* 내 받침대에 남은 타일 */}
        {!isSpectator && (
          <div className="ru-over-rack">
            <span className="ru-over-section-title">
              내 받침대 — 남은 {myRack.length}개 · {myPenalty}점
            </span>
            <div className="ru-over-tiles">
              {myRack.map((tile) => (
                <RummikubTile key={ruTileKey(tile)} tile={tile} size="sm" />
              ))}
              {myRack.length === 0 && (
                <span className="ru-over-empty">
                  받침대를 비웠습니다 — 루미큐브! 🎉
                </span>
              )}
            </div>
          </div>
        )}

        {/* 마지막 테이블 */}
        <div className="ru-over-board">
          <span className="ru-over-section-title">
            마지막 테이블 · 세트 {sets.length}개
          </span>
          <div className="ru-over-sets">
            {sets.map((set, i) => (
              <div key={i} className="ru-over-set">
                {(set ?? []).map((tile) => (
                  <RummikubTile key={ruTileKey(tile)} tile={tile} size="sm" />
                ))}
              </div>
            ))}
            {sets.length === 0 && (
              <span className="ru-over-empty">테이블이 비어 있습니다</span>
            )}
          </div>
        </div>

        {/* 남은 타일 수 */}
        <div className="ru-over-players">
          {players.map((p) => (
            <div key={p.seat} className="ru-over-player">
              <span className="ru-over-player-name">
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="ru-over-player-meta">
                남은 타일 {p.rackCount}개 · {p.melded ? '등록✔' : '미등록'}
              </span>
            </div>
          ))}
        </div>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="ru-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="ru-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
