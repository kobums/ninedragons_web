import { useEffect } from 'react';
import { useNCWebSocket } from '../../hooks/useNCWebSocket';
import { useNCGameState } from '../../hooks/useNCGameState';
import { NCWaitingRoom } from './NCWaitingRoom';
import { NCGameBoard } from './NCGameBoard';
import { NCGameOver } from './NCGameOver';
import type { TeamColor } from '../../types/numberchange';

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
// const WS_URL = `${protocol}//ninedragonsapi.gowoobro.com/ws/numberchange`;
const WS_URL = `${protocol}//localhost:8003/ws/numberchange`;

export function NumberChangeApp() {
  const { isConnected, lastMessage, sendMessage } = useNCWebSocket(WS_URL);
  const {
    gameState,
    selectBlock,
    resetGame,
    isMyTurn,
    canSubmit,
    getSelectedBlocks,
    markAsSubmitted,
    dismissHiddenNotification,
    selectHiddenBlock,
    confirmHiddenSelection,
    getSubmitPayload,
    prepareSubmit,
    getPendingSubmitUseHidden,
    clearPendingSubmit,
  } = useNCGameState(lastMessage);

  useEffect(() => {
    console.log('[NumberChange] === Game state updated ===', {
      isGameStarted: gameState.isGameStarted,
      isWaiting: gameState.isWaiting,
      yourTeam: gameState.yourTeam,
      gameId: gameState.gameId,
      currentRound: gameState.currentRound,
      currentTeam: gameState.currentTeam,
    });
  }, [gameState]);

  const handleJoinGame = (playerName: string, team?: TeamColor) => {
    console.log('[NumberChange] Joining game with:', playerName, team);
    sendMessage({
      type: 'nc_join_game',
      payload: {
        playerName,
        team,
      },
    });
  };

  const handleSelectBlock = (blockIndex: number) => {
    selectBlock(blockIndex);
  };

  const handleSubmit = (useHidden: boolean) => {
    if (!canSubmit()) return;

    // 상대방이 히든을 사용했다면 블록 선택 UI 먼저 표시
    if (!prepareSubmit(useHidden)) {
      return; // 블록 선택 UI가 표시되었으므로 제출하지 않음
    }

    const payload = getSubmitPayload();
    if (!payload) return;

    console.log('[NumberChange] Submitting blocks:', {
      block1: payload.block1,
      block2: payload.block2,
      useHidden,
      selectedBlockChoice: payload.selectedBlockChoice,
    });

    sendMessage({
      type: 'nc_submit_blocks',
      payload: {
        block1: payload.block1,
        block2: payload.block2,
        useHidden,
        selectedBlockChoice: payload.selectedBlockChoice,
      },
    });

    // 제출 완료 표시
    markAsSubmitted();
    clearPendingSubmit();
  };

  const handleDismissHiddenNotification = () => {
    dismissHiddenNotification();
  };

  const handleSelectHiddenBlock = (choice: number) => {
    selectHiddenBlock(choice);
  };

  const handleConfirmHiddenSelection = () => {
    const choice = gameState.selectedBlockChoice;
    if (choice === null) return;

    confirmHiddenSelection();

    // 이미 제출한 상태라면 블록 선택만 서버로 전송
    if (gameState.hasSubmitted) {
      console.log('[NumberChange] Sending block selection:', choice);
      sendMessage({
        type: 'nc_select_block',
        payload: {
          selectedBlockChoice: choice,
        },
      });
    } else {
      // 아직 제출하지 않은 상태라면 제출
      const pendingUseHidden = getPendingSubmitUseHidden();
      if (pendingUseHidden !== null) {
        setTimeout(() => {
          handleSubmit(pendingUseHidden);
        }, 100);
      }
    }
  };

  const handlePlayAgain = () => {
    resetGame();
    window.location.reload();
  };

  useEffect(() => {
    if (gameState.error) {
      alert(gameState.error);
    }
  }, [gameState.error]);

  if (!isConnected) {
    return (
      <div className="app">
        <div className="connecting">서버에 연결 중...</div>
      </div>
    );
  }

  console.log('[NumberChange] Rendering decision:', {
    showWaitingRoom: !gameState.isGameStarted,
    showGameBoard: gameState.isGameStarted && !gameState.isGameOver,
    showGameOver: gameState.isGameOver,
  });

  return (
    <div className="app">
      {!gameState.isGameStarted && (
        <NCWaitingRoom
          onJoinGame={handleJoinGame}
          isWaiting={gameState.isWaiting}
          hasJoined={gameState.yourTeam !== null}
        />
      )}

      {gameState.isGameStarted && !gameState.isGameOver && (
        <NCGameBoard
          gameState={gameState}
          onSelectBlock={handleSelectBlock}
          onSubmit={handleSubmit}
          isMyTurn={isMyTurn()}
          canSubmit={canSubmit()}
          getSelectedBlocks={getSelectedBlocks}
          onDismissHiddenNotification={handleDismissHiddenNotification}
          onSelectHiddenBlock={handleSelectHiddenBlock}
          onConfirmHiddenSelection={handleConfirmHiddenSelection}
        />
      )}

      {gameState.isGameOver && (
        <NCGameOver
          winner={gameState.winner}
          team1Score={gameState.team1Score}
          team2Score={gameState.team2Score}
          team1Name={gameState.team1Name}
          team2Name={gameState.team2Name}
          yourTeam={gameState.yourTeam}
          roundHistory={gameState.roundHistory}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
