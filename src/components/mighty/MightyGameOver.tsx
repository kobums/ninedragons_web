import type { MTResult } from '../../types/mighty';
import { BID_SUIT_LABEL } from './mightyRules';
import './MightyGameOver.css';

interface MightyGameOverProps {
  result: MTResult;
  // 내 좌석 (승패 타이틀 판정용 — 이름은 중복될 수 있어 좌석으로 판정). 모르면 null.
  yourSeat: number | null;
  onFindNewGame: () => void;
}

// 단판 승부 결과 오버레이. 재대결 없음 — "새 게임 찾기"만 제공한다.
export function MightyGameOver({
  result,
  yourSeat,
  onFindNewGame,
}: MightyGameOverProps) {
  const onDeclarerTeam =
    yourSeat !== null &&
    (yourSeat === result.contract.declarer || yourSeat === result.friendSeat);
  const youWon = yourSeat !== null && (onDeclarerTeam ? result.win : !result.win);

  const title =
    yourSeat === null
      ? result.win
        ? '공약 성공!'
        : '공약 실패'
      : youWon
        ? '🏆 승리!'
        : '패배';

  return (
    <div className="mt-game-over">
      <div className="mt-game-over-container">
        <h1 className="mt-over-title">{title}</h1>
        <p className={`mt-over-verdict ${result.win ? 'win' : 'lose'}`}>
          공약 {BID_SUIT_LABEL[result.contract.suit]} {result.contract.count} —{' '}
          {result.win ? '주공팀 성공' : '주공팀 실패'}
        </p>

        <div className="mt-over-teams">
          <div className={`mt-over-team ${result.win ? 'winner' : ''}`}>
            <h2>주공팀</h2>
            <p className="mt-over-names">{result.declarerTeam.join(' · ')}</p>
            <p className="mt-over-points">
              점수카드 <strong>{result.declarerPoints}</strong>장
            </p>
          </div>
          <div className={`mt-over-team ${result.win ? '' : 'winner'}`}>
            <h2>수비팀</h2>
            <p className="mt-over-names">{result.defenderTeam.join(' · ')}</p>
            <p className="mt-over-points">
              점수카드 <strong>{result.defenderPoints}</strong>장
            </p>
          </div>
        </div>

        <button type="button" className="mt-primary-button" onClick={onFindNewGame}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
