import type {
  CNGameOverPayload,
  CNGameState,
  CNTeam,
} from '../../types/codenames';
import { CN_TEAM_LABEL, CN_TEAM_MARK } from '../../types/codenames';
import './CodenamesGameOver.css';

interface CodenamesGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: CNGameState;
  // cn_game_over 페이로드 (없으면 스냅샷의 winner 를 쓴다)
  result: CNGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 팀전 결과 화면 — 승리 팀·암살자 사유·최종 보드·같은 방 재대결.
export function CodenamesGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: CodenamesGameOverProps) {
  const winner: CNTeam | '' = result?.winner || game.winner || '';
  const loseReason = result?.loseReason || game.loseReason || '';
  const loser: CNTeam | '' =
    winner === 'red' ? 'blue' : winner === 'blue' ? 'red' : '';
  const youWon = game.yourTeam !== '' && game.yourTeam === winner;
  const board = game.board ?? [];
  const players = game.players ?? [];

  const reasonText =
    loseReason === 'assassin' && loser !== ''
      ? `☠️ ${CN_TEAM_LABEL[loser]}이 암살자를 지목했습니다`
      : winner !== ''
        ? `${CN_TEAM_LABEL[winner]}이 자기 팀 단어를 모두 찾았습니다`
        : '';

  return (
    <div className="cn-game-over">
      <div className="cn-over-container">
        <span className="cn-over-mark">
          {loseReason === 'assassin' ? '☠️' : '🕵️'}
        </span>
        <h1 className={`cn-over-title ${winner}`}>
          {winner !== ''
            ? `${CN_TEAM_MARK[winner]} ${CN_TEAM_LABEL[winner]} 승리!`
            : '게임 종료'}
        </h1>
        {reasonText && <p className="cn-over-sub">{reasonText}</p>}
        {game.yourTeam !== '' && (
          <p className={`cn-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        {/* 최종 보드 — 종료 스냅샷의 공개 색으로 그린다 (미공개는 종이색) */}
        {board.length > 0 && (
          <div className="cn-over-grid" aria-label="최종 보드">
            {board.map((card, i) => (
              <span
                key={`${i}-${card.word}`}
                className={`cn-over-cell ${card.color || 'hidden'}`}
              >
                {card.color === 'assassin' ? '☠' : card.word}
              </span>
            ))}
          </div>
        )}

        <ul className="cn-over-roster">
          {(['red', 'blue'] as const).map((team) => (
            <li
              key={team}
              className={`cn-over-row ${team} ${team === winner ? 'winner' : ''}`}
            >
              <span className="cn-over-team">
                {team === winner && '👑 '}
                {CN_TEAM_MARK[team]} {CN_TEAM_LABEL[team]}
              </span>
              <span className="cn-over-names">
                {players
                  .filter((p) => p.team === team)
                  .map((p) => (
                    <span key={p.seat} className="cn-over-name">
                      {p.role === 'spymaster' && '🕵️ '}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {p.seat === game.yourSeat && ' (나)'}
                    </span>
                  ))}
              </span>
            </li>
          ))}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="cn-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="cn-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
