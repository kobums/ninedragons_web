import { DV_JOKER_VALUE } from '../../types/davinci';
import type { DVGameState } from '../../types/davinci';
import './DVActionPanel.css';

interface DVActionPanelProps {
  game: DVGameState;
  myTurn: boolean;
  selectedTarget: { seat: number; tileIndex: number } | null;
  guessValue: number | null;
  onPickValue: (value: number) => void;
  onConfirmGuess: () => void;
  onDraw: () => void;
  onContinue: (cont: boolean) => void;
}

function currentName(game: DVGameState): string {
  return game.players.find((p) => p.seat === game.currentSeat)?.name ?? '상대';
}

export function DVActionPanel({
  game,
  myTurn,
  selectedTarget,
  guessValue,
  onPickValue,
  onConfirmGuess,
  onDraw,
  onContinue,
}: DVActionPanelProps) {
  // 초기 조커 배치 단계
  if (game.phase === 'joker_setup') {
    const myPending = (game.yourPendingJokers?.length ?? 0) > 0;
    return (
      <div className="dv-action-panel">
        <p className="dv-action-hint">
          {myPending
            ? '조커(★)를 놓을 위치를 내 줄에서 선택하세요. 조커는 아무 곳에나 놓을 수 있고, 이후 옮길 수 없습니다.'
            : '다른 플레이어가 조커를 배치하는 중...'}
        </p>
      </div>
    );
  }

  if (!myTurn) {
    return (
      <div className="dv-action-panel">
        <p className="dv-action-hint">{currentName(game)}님의 차례입니다...</p>
      </div>
    );
  }

  switch (game.phase) {
    case 'draw':
      return (
        <div className="dv-action-panel">
          <button type="button" className="dv-primary-button" onClick={onDraw}>
            더미에서 타일 뽑기 ({game.deckCount}장 남음)
          </button>
        </div>
      );

    case 'guess':
      if (!selectedTarget) {
        return (
          <div className="dv-action-panel">
            <p className="dv-action-hint">추리할 상대의 비공개 타일을 선택하세요</p>
          </div>
        );
      }
      return (
        <div className="dv-action-panel">
          <p className="dv-action-hint">선택한 타일의 값을 추리하세요</p>
          <div className="dv-number-pad">
            {Array.from({ length: 12 }).map((_, v) => (
              <button
                key={v}
                type="button"
                className={`dv-pad-button ${guessValue === v ? 'picked' : ''}`}
                onClick={() => onPickValue(v)}
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              className={`dv-pad-button joker ${guessValue === DV_JOKER_VALUE ? 'picked' : ''}`}
              onClick={() => onPickValue(DV_JOKER_VALUE)}
            >
              ★
            </button>
          </div>
          <button
            type="button"
            className="dv-primary-button"
            disabled={guessValue === null}
            onClick={onConfirmGuess}
          >
            추리!
          </button>
        </div>
      );

    case 'continue_choice':
      return (
        <div className="dv-action-panel">
          <p className="dv-action-hint">정답! 계속 추리하시겠습니까?</p>
          <div className="dv-choice-buttons">
            <button type="button" className="dv-primary-button" onClick={() => onContinue(true)}>
              계속 추리
            </button>
            <button type="button" className="dv-ghost-button" onClick={() => onContinue(false)}>
              여기서 멈추기
            </button>
          </div>
          {game.drawnTile && (
            <p className="dv-action-sub">멈추면 뽑은 타일이 비공개로 내 줄에 들어갑니다</p>
          )}
        </div>
      );

    case 'place_drawn_joker':
      return (
        <div className="dv-action-panel">
          <p className="dv-action-hint">
            뽑은 조커(★)를 놓을 위치를 내 줄에서 선택하세요
            {game.drawnTile?.revealed ? ' — 추리에 실패해 공개 상태로 놓입니다' : ''}
          </p>
        </div>
      );

    case 'reveal_own':
      return (
        <div className="dv-action-panel">
          <p className="dv-action-hint">추리 실패! 공개할 내 타일을 선택하세요</p>
        </div>
      );

    default:
      return null;
  }
}
