import { useEffect } from 'react';
import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useNCGameState } from '../../hooks/useNCGameState';
import { NCWaitingRoom } from './NCWaitingRoom';
import { NCGameBoard } from './NCGameBoard';
import { NCGameOver } from './NCGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ErrorToast } from '../ErrorToast';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import type { NCMessage, TeamColor } from '../../types/numberchange';
import { NC_SESSION_KEY, getSessionId } from '../../utils/session';


export function NumberChangeApp() {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<NCMessage>(buildWsUrl(GAMES.numberchange.wsPath), {
    logPrefix: GAMES.numberchange.logPrefix,
    onOpen: () => {
      // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
      const sessionId = getSessionId(NC_SESSION_KEY);
      if (sessionId) {
        sendMessage({ type: 'nc_rejoin_game', payload: { sessionId } });
      }
    },
  });
  const {
    gameState,
    clearError,
    selectBlock,
    resetGame,
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

  const handleJoinGame = (playerName: string, team?: TeamColor, vsBot?: boolean) => {
    console.log('[NumberChange] Joining game with:', playerName, team, { vsBot });
    sendMessage({
      type: 'nc_join_game',
      payload: {
        playerName,
        team,
        vsBot,
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


  // 게임 시작 전에만 전체 화면 연결 대기 표시
  // 게임 중 끊김은 화면을 유지한 채 배너로 알리고 자동 재접속을 기다린다
  if (!isConnected && !gameState.isGameStarted) {
    return <ConnectingScreen />;
  }

  console.log('[NumberChange] Rendering decision:', {
    showWaitingRoom: !gameState.isGameStarted,
    showGameBoard: gameState.isGameStarted && !gameState.isGameOver,
    showGameOver: gameState.isGameOver,
  });

  return (
    <div className="app mood-cream">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={gameState.opponentDisconnected}
        isGameActive={gameState.isGameStarted && !gameState.isGameOver}
      />
      <ErrorToast error={gameState.error} onClear={clearError} />
      <GameInfoButton game="numberchange" />

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
          rematchOffered={gameState.rematchOffered}
          onRematch={() => sendMessage({ type: 'nc_rematch' })}
        />
      )}
    </div>
  );
}
