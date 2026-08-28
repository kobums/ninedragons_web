import type {
  SUGameOverPayload,
  SUGameState,
  SUResultRow,
} from '../../types/startups';
import {
  suCompanyList,
  suFaceUp,
  suMoney,
} from '../../types/startups';
import { StartupsCompanyBadge } from './StartupsBoard';
import './StartupsGameOver.css';

interface StartupsGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: SUGameState;
  // su_game_over 페이로드 — 신호+정산 보조 (없으면 스냅샷 result 로 그린다)
  result: SUGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

export function StartupsGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: StartupsGameOverProps) {
  const players = game.players ?? [];
  const snap = game.result ?? null;
  const winnerSeats = snap?.winnerSeats ?? result?.winnerSeats ?? [];
  const winnerNames = snap?.winnerNames ?? result?.winnerNames ?? [];
  const message = snap?.message ?? result?.message ?? '';

  // 정산 내역은 서버 rows 를 우선 쓰고, 없으면 최종 돈으로 직접 세운다
  const rows: SUResultRow[] = (() => {
    const raw = snap?.rows ?? result?.rows ?? [];
    if (raw.length > 0) return [...raw].sort((a, b) => b.money - a.money);
    return [...players]
      .sort((a, b) => b.money - a.money)
      .map((p) => ({ seat: p.seat, money: p.money }));
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

  const companies = game.companies ?? [];
  const companyList = suCompanyList(companies);

  return (
    <div className="su-game-over">
      <div className="su-game-over-container">
        <span className="su-over-mark">📈</span>
        <h1 className="su-over-title">{title}</h1>
        <p className="su-over-sub">
          {message || '덱이 떨어져 정산했습니다 — 최종 돈이 가장 많은 사람이 승리합니다'}
        </p>
        {!isSpectator && winnerSeats.length > 0 && (
          <p className={`su-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {/* 정산 내역 — 최종 돈 내림차순 */}
        <div className="su-over-table-wrap">
          <table className="su-over-table">
            <thead>
              <tr>
                <th className="left">순위</th>
                <th className="left">이름</th>
                <th>최종 돈</th>
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
                    <td className="left su-over-place">{i + 1}위</td>
                    <td className="left">
                      <span className="su-over-name">
                        {nameOf(row.seat)}
                        {row.seat === game.yourSeat && ' (나)'}
                        {p?.bot && ' 🤖'}
                      </span>
                      {row.detail && (
                        <span className="su-over-detail">{row.detail}</span>
                      )}
                    </td>
                    <td className="su-over-money">{suMoney(row.money)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 회사별 대주주 — 누가 어느 회사를 먹었는지 */}
        <div className="su-over-companies">
          <span className="su-over-section-title">회사별 대주주</span>
          {companyList.map((co) => {
            const server = companies.find((c) => c.id === co.id);
            const seat = server?.majoritySeat ?? -1;
            return (
              <div key={co.id} className={`su-over-company su-tone-${co.tone}`}>
                <StartupsCompanyBadge company={co} size="sm" />
                <span className="su-over-company-major">
                  {seat < 0
                    ? '대주주 없음 (동수)'
                    : `👑 ${nameOf(seat)}${seat === game.yourSeat ? ' (나)' : ''}`}
                </span>
                <span className="su-over-company-value">
                  1장당 {co.size}원
                </span>
              </div>
            );
          })}
        </div>

        {/* 최종 보유 — 각자 앞면 카드가 어떻게 갈렸는지 */}
        <div className="su-over-holdings">
          {players.map((p) => {
            const owned = companyList.filter((co) => suFaceUp(p, co.id) > 0);
            return (
              <div key={p.seat} className="su-over-holding-row">
                <span className="su-over-holding-name">{p.name}</span>
                <span className="su-over-holding-chips">
                  {owned.map((co) => (
                    <span
                      key={co.id}
                      className={`su-over-holding-chip su-tone-${co.tone}`}
                      title={`${co.name} ${suFaceUp(p, co.id)}장`}
                    >
                      <span aria-hidden="true">{co.emoji}</span>
                      <span>{co.name}</span>
                      <b>{suFaceUp(p, co.id)}</b>
                    </span>
                  ))}
                  {owned.length === 0 && (
                    <span className="su-over-holding-empty">보유 없음</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="su-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="su-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
