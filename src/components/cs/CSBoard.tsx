import type { CSEvent, CSGameState } from '../../types/cantstop';
import { CS_COLS, csColLen } from '../../types/cantstop';
import './CSBoard.css';

const DIE_FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

interface CSBoardProps {
  game: CSGameState;
  lastEvent: CSEvent | null;
  onRoll: () => void;
  onChoose: (sums: number[]) => void;
  onStop: () => void;
}

export function CSBoard({ game, lastEvent, onRoll, onChoose, onStop }: CSBoardProps) {
  const me = game.yourSide;
  const myTurn = game.phase === 'play' && game.currentSide === me;
  const opponentName = me === 'south' ? game.northName : game.southName;

  const myProgress = me === 'south' ? game.southProgress : game.northProgress;
  const oppProgress = me === 'south' ? game.northProgress : game.southProgress;

  const myClaims = Object.values(game.claimed).filter((s) => s === me).length;
  const oppClaims = Object.values(game.claimed).filter((s) => s !== me).length;

  const choosing = myTurn && (game.options?.length ?? 0) > 0;

  const statusText = (() => {
    if (lastEvent?.kind === 'bust')
      return lastEvent.side === me ? '💥 버스트! 이번 턴 전진을 잃었습니다' : '💥 상대가 버스트!';
    if (lastEvent?.kind === 'claim')
      return lastEvent.side === me
        ? `⛰️ ${lastEvent.col} 컬럼 완등!`
        : `⛰️ 상대가 ${lastEvent.col} 컬럼 완등`;
    if (!myTurn) return `${opponentName}님의 차례...`;
    if (choosing) return '오를 컬럼 조합을 고르세요';
    if (game.canStop) return '더 굴릴까요, 여기서 멈출까요?';
    return '내 차례 — 주사위를 굴리세요';
  })();

  return (
    <div className="cs-board-page">
      <div className="cs-score-bar">
        <span className="cs-score-side mine">나 ⛰️ {myClaims}/3</span>
        <span className="cs-score-side">
          {opponentName} ⛰️ {oppClaims}/3
        </span>
      </div>

      <div className="cs-mountain">
        {CS_COLS.map((col) => {
          const len = csColLen(col);
          const claimedBy = game.claimed[String(col)];
          const myPos = myProgress[String(col)] ?? 0;
          const oppPos = oppProgress[String(col)] ?? 0;
          const tempPos = game.temp[String(col)];
          const tempMine = game.currentSide === me;

          return (
            <div
              key={col}
              className={[
                'cs-col',
                claimedBy ? (claimedBy === me ? 'claimed-mine' : 'claimed-opp') : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="cs-col-steps">
                {Array.from({ length: len }).map((_, i) => {
                  const step = len - i; // 위에서 아래로 그리므로 위가 꼭대기
                  return (
                    <div key={step} className={`cs-step${step === len ? ' top' : ''}`}>
                      {tempPos === step && (
                        <span className={`cs-marker temp${tempMine ? ' mine' : ' opp'}`} />
                      )}
                      {myPos === step && <span className="cs-marker banked mine" />}
                      {oppPos === step && <span className="cs-marker banked opp" />}
                    </div>
                  );
                })}
              </div>
              <div className="cs-col-label">{col}</div>
            </div>
          );
        })}
      </div>

      {game.dice && (
        <div className="cs-dice">
          {game.dice.map((d, i) => (
            <span key={i} className="cs-die">
              {DIE_FACE[d]}
            </span>
          ))}
        </div>
      )}

      {choosing && (
        <div className="cs-options">
          {(game.options ?? []).map((opt) => (
            <button
              key={opt.sums.join('-')}
              type="button"
              className="cs-option-button"
              onClick={() => onChoose(opt.sums)}
            >
              {opt.sums.join(' + ')}
            </button>
          ))}
        </div>
      )}

      {myTurn && !choosing && (
        <div className="cs-actions">
          <button type="button" className="cs-action-button" onClick={onRoll}>
            🎲 굴리기
          </button>
          {game.canStop && (
            <button type="button" className="cs-action-button stop" onClick={onStop}>
              ✋ 멈추기
            </button>
          )}
        </div>
      )}

      <div className={`cs-status${lastEvent?.kind === 'bust' ? ' bust' : ''}`}>{statusText}</div>
    </div>
  );
}
