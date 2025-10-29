import { useState } from 'react';
import type { TeamColor } from '../../types/numberchange';
import './NCWaitingRoom.css';

interface NCWaitingRoomProps {
  onJoinGame: (playerName: string, team?: TeamColor) => void;
  isWaiting: boolean;
  hasJoined: boolean;
}

export function NCWaitingRoom({ onJoinGame, isWaiting, hasJoined }: NCWaitingRoomProps) {
  const [playerName, setPlayerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamColor | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onJoinGame(playerName, selectedTeam);
    }
  };

  return (
    <div className="nc-waiting-room">
      <div className="nc-waiting-container">
        <h1 className="nc-title">넘버체인지</h1>
        <p className="nc-subtitle">숫자 블록 합계 대결 게임</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="nc-join-form">
            <div className="nc-form-group">
              <label htmlFor="playerName">플레이어 이름</label>
              <input
                type="text"
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>

            <div className="nc-form-group">
              <label>팀 선택 (선택사항)</label>
              <div className="nc-team-buttons">
                <button
                  type="button"
                  className={`nc-team-button team1 ${selectedTeam === 'team1' ? 'selected' : ''}`}
                  onClick={() => setSelectedTeam(selectedTeam === 'team1' ? undefined : 'team1')}
                >
                  팀 1
                </button>
                <button
                  type="button"
                  className={`nc-team-button team2 ${selectedTeam === 'team2' ? 'selected' : ''}`}
                  onClick={() => setSelectedTeam(selectedTeam === 'team2' ? undefined : 'team2')}
                >
                  팀 2
                </button>
              </div>
              <small className="nc-team-hint">
                팀을 선택하지 않으면 자동 배정됩니다
              </small>
            </div>

            <button type="submit" className="nc-join-button">
              게임 참가
            </button>
          </form>
        ) : (
          <div className="nc-waiting-message">
            <div className="nc-spinner"></div>
            <p>상대방을 기다리는 중...</p>
            <small>다른 플레이어가 참가할 때까지 기다려주세요</small>
          </div>
        )}

        <div className="nc-game-rules">
          <h3>게임 규칙</h3>
          <ul>
            <li>각 팀은 1~7 숫자 블록 두 세트를 가집니다</li>
            <li>매 라운드마다 두 개의 블록을 선택하여 제출합니다</li>
            <li>합계가 더 큰 팀이 1점을 획득합니다</li>
            <li>제출한 블록 중 큰 블록은 상대 팀과 교환합니다</li>
            <li>각 팀은 게임 중 히든 찬스를 한 번 사용할 수 있습니다</li>
            <li>총 12라운드를 진행하며, 먼저 7점을 획득하면 즉시 승리합니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
