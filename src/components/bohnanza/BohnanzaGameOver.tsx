import type {
  BZGameOverPayload,
  BZGameState,
  BZResultRow,
} from '../../types/bohnanza';
import { bzEndCycle, bzFieldEmpty, bzFieldSlots } from '../../types/bohnanza';
import { BohnanzaBeanChip } from './BohnanzaBoard';
import './BohnanzaGameOver.css';

interface BohnanzaGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: BZGameState;
  // bz_game_over 페이로드 — 신호+정산 보조 (없으면 스냅샷 result 로 그린다)
  result: BZGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

export function BohnanzaGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: BohnanzaGameOverProps) {
  const players = game.players ?? [];
  const snap = game.result ?? null;
  const winnerSeats = snap?.winnerSeats ?? result?.winnerSeats ?? [];
  const winnerNames = snap?.winnerNames ?? result?.winnerNames ?? [];
  const message = snap?.message ?? result?.message ?? '';

  // 정산 내역은 서버 rows 를 우선 쓰고, 없으면 최종 금화로 직접 세운다.
  // 정렬 규칙은 승리 규칙과 같다 — 금화 내림차순, 동점이면 손에 든 카드가 많은 쪽.
  const rows: BZResultRow[] = (() => {
    const raw = snap?.rows ?? result?.rows ?? [];
    const list =
      raw.length > 0
        ? [...raw]
        : players.map((p) => ({
            seat: p.seat,
            coins: p.coins,
            handCount: p.handCount,
          }));
    return list.sort(
      (a, b) => b.coins - a.coins || (b.handCount ?? 0) - (a.handCount ?? 0),
    );
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

  // 동점자가 있었는지 — 있으면 타이브레이크 규칙을 화면에 적어 준다
  const topCoins = rows[0]?.coins ?? 0;
  const tied = rows.filter((r) => r.coins === topCoins).length > 1;

  return (
    <div className="bz-game-over">
      <div className="bz-game-over-container">
        <span className="bz-over-mark">🫘</span>
        <h1 className="bz-over-title">{title}</h1>
        <p className="bz-over-sub">
          {message ||
            `덱이 ${bzEndCycle(players.length)}번째로 소진되어 끝났습니다 — 손패는 치우고 모든 밭을 수확해 정산했습니다`}
        </p>
        {!isSpectator && winnerSeats.length > 0 && (
          <p className={`bz-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {/* 정산 표 — 금화 내림차순, 동점이면 손에 든 카드가 많은 쪽이 위 */}
        <div className="bz-over-table-wrap">
          <table className="bz-over-table">
            <thead>
              <tr>
                <th className="left">순위</th>
                <th className="left">이름</th>
                <th>금화</th>
                <th>손패</th>
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
                    <td className="left bz-over-place">{i + 1}위</td>
                    <td className="left">
                      <span className="bz-over-name">
                        {nameOf(row.seat)}
                        {row.seat === game.yourSeat && ' (나)'}
                        {p?.bot && ' 🤖'}
                      </span>
                    </td>
                    <td className="bz-over-coins">🪙 {row.coins}</td>
                    <td className="bz-over-hand">{row.handCount ?? 0}장</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {tied && (
          <p className="bz-over-tiebreak">
            금화가 같으면 <b>손에 든 카드가 많은 사람</b>이 이깁니다
          </p>
        )}

        {/* 최종 콩밭 — 각자 무엇을 붙들고 끝냈는지 */}
        <div className="bz-over-fields">
          <span className="bz-over-section-title">최종 콩밭</span>
          {players.map((p) => {
            const fields = bzFieldSlots(p).filter((f) => !bzFieldEmpty(f));
            return (
              <div key={p.seat} className="bz-over-field-row">
                <span className="bz-over-field-name">
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                </span>
                <span className="bz-over-field-chips">
                  {fields.map((f, i) => (
                    <BohnanzaBeanChip
                      key={`${f.bean}-${i}`}
                      bean={f.bean ?? ''}
                      size="sm"
                      count={f.count}
                    />
                  ))}
                  {fields.length === 0 && (
                    <span className="bz-over-field-empty">
                      남은 콩밭이 없습니다
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* 콩 종류별로 누가 얼마나 붙들었는지 한눈에 */}
        <p className="bz-over-note">
          정산은 모든 밭을 <b>콩미터</b>대로 수확해 금화로 바꾼 결과입니다 —
          문턱에 못 미친 밭은 금화 0개였습니다.
        </p>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="bz-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="bz-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
