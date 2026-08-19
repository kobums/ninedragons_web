import type { MTResult } from '../../types/mighty';
import { BID_SUIT_LABEL } from './mightyRules';
import './MightyGameOver.css';

interface MightyGameOverProps {
  result: MTResult;
  // 내 좌석 (승패 타이틀 판정용 — 이름은 중복될 수 있어 좌석으로 판정). 모르면 null.
  yourSeat: number | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 단판 승부 결과 오버레이 — 사설 방이면 같은 방 재대결, 아니면 "새 게임 찾기"만.
export function MightyGameOver({
  result,
  yourSeat,
  roomCode,
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

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="mt-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button type="button" className="mt-primary-button" onClick={onFindNewGame}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
