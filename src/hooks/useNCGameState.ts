import { useEffect, useState } from 'react';
import type {
  NCGameState,
  NCMessage,
  NCGameStartPayload,
  NCRoundResultPayload,
  NCGameOverPayload,
  NCErrorPayload,
  NCRoundHistory,
} from '../types/numberchange';

const initialGameState: NCGameState = {
  gameId: null,
  yourTeam: null,
  currentRound: 1,
  team1Score: 0,
  team2Score: 0,
  availableBlocks: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7], // 1~7 두 세트
  usedBlocks: [],
  opponentAvailableBlocks: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7],
  roundHistory: [],
  currentTeam: null,
  isGameStarted: false,
  isGameOver: false,
  winner: '',
  error: null,
  isWaiting: false,
  hasUsedHidden: false,
  opponentHasUsedHidden: false,
  selectedBlock1Index: null,
  selectedBlock2Index: null,
  hasSubmitted: false,
  opponentUsedHiddenNotification: false,
  opponentUsedHiddenThisRound: false,
  showHiddenBlockSelection: false,
  selectedBlockChoice: null,
  pendingSubmitUseHidden: null,
};

export const useNCGameState = (lastMessage: NCMessage | null) => {
  const [gameState, setGameState] = useState<NCGameState>(initialGameState);

  useEffect(() => {
    if (!lastMessage) return;

    console.log('[NumberChange] Received message:', lastMessage.type, lastMessage.payload);

    switch (lastMessage.type) {
      case 'nc_player_joined':
        console.log('[NumberChange] Player joined:', lastMessage.payload);
        setGameState((prev) => ({
          ...prev,
          gameId: lastMessage.payload.gameId,
          yourTeam: lastMessage.payload.yourTeam,
        }));
        break;

      case 'nc_waiting_player':
        console.log('[NumberChange] Waiting for player...');
        setGameState((prev) => ({
          ...prev,
          isWaiting: true,
          error: null,
        }));
        break;

      case 'nc_game_start':
        const startPayload = lastMessage.payload as NCGameStartPayload;
        console.log('[NumberChange] Game starting:', startPayload);
        setGameState((prev) => ({
          ...prev,
          isGameStarted: true,
          isWaiting: false,
          currentTeam: startPayload.firstTeam,
          yourTeam: startPayload.yourTeam,
        }));
        break;

      case 'nc_round_result':
        const roundPayload = lastMessage.payload as NCRoundResultPayload;
        console.log('[NumberChange] ========== ROUND_RESULT received ==========');
        console.log('[NumberChange] Payload:', roundPayload);

        setGameState((prev) => {
          // 라운드 히스토리 추가 (중복 체크)
          const historyExists = prev.roundHistory.some(h => h.round === roundPayload.round);
          const newRoundHistory: NCRoundHistory = {
            round: roundPayload.round,
            team1Block1: roundPayload.team1Block1,
            team1Block2: roundPayload.team1Block2,
            team1Total: roundPayload.team1Total,
            team2Block1: roundPayload.team2Block1,
            team2Block2: roundPayload.team2Block2,
            team2Total: roundPayload.team2Total,
            winner: roundPayload.winner,
            team1Hidden: roundPayload.team1Hidden,
            team2Hidden: roundPayload.team2Hidden,
          };

          const updatedHistory = historyExists
            ? prev.roundHistory
            : [...prev.roundHistory, newRoundHistory];

          // 내 팀이 사용한 블록 업데이트
          const myBlocks = prev.yourTeam === 'team1'
            ? [roundPayload.team1Block1, roundPayload.team1Block2]
            : [roundPayload.team2Block1, roundPayload.team2Block2];

          // 내가 받은 블록 (상대팀의 큰 블록)
          const receivedBlock = prev.yourTeam === 'team1'
            ? roundPayload.team1ReceivedBlock
            : roundPayload.team2ReceivedBlock;

          // 내 팀의 사용한 블록 중 더 큰 블록은 제거되고 상대 블록을 받음
          const largerBlock = Math.max(...myBlocks);
          let newAvailableBlocks = [...prev.availableBlocks];

          // 내가 제출한 두 블록 제거
          myBlocks.forEach(block => {
            const index = newAvailableBlocks.indexOf(block);
            if (index > -1) {
              newAvailableBlocks.splice(index, 1);
            }
          });

          // 받은 블록 추가
          newAvailableBlocks.push(receivedBlock);
          newAvailableBlocks.sort((a, b) => a - b);

          // 상대 팀의 추정 블록 업데이트
          const opponentBlocks = prev.yourTeam === 'team1'
            ? [roundPayload.team2Block1, roundPayload.team2Block2]
            : [roundPayload.team1Block1, roundPayload.team1Block2];

          const opponentReceivedBlock = prev.yourTeam === 'team1'
            ? roundPayload.team2ReceivedBlock
            : roundPayload.team1ReceivedBlock;

          let newOpponentBlocks = [...prev.opponentAvailableBlocks];
          opponentBlocks.forEach(block => {
            const index = newOpponentBlocks.indexOf(block);
            if (index > -1) {
              newOpponentBlocks.splice(index, 1);
            }
          });
          newOpponentBlocks.push(opponentReceivedBlock);
          newOpponentBlocks.sort((a, b) => a - b);

          // 히든 찬스 사용 여부 업데이트
          const myUsedHiddenThisRound = prev.yourTeam === 'team1'
            ? roundPayload.team1Hidden
            : roundPayload.team2Hidden;

          const opponentUsedHiddenThisRound = prev.yourTeam === 'team1'
            ? roundPayload.team2Hidden
            : roundPayload.team1Hidden;

          console.log('[NumberChange] Round result processing:', {
            finishedRound: roundPayload.round,
            nextRound: roundPayload.round + 1,
            myBlocks,
            receivedBlock,
            newAvailableBlocks,
            opponentBlocks,
            opponentReceivedBlock,
            newOpponentBlocks,
            myUsedHiddenThisRound,
            opponentUsedHiddenThisRound,
          });

          return {
            ...prev,
            currentRound: roundPayload.round + 1,
            team1Score: roundPayload.team1Score,
            team2Score: roundPayload.team2Score,
            roundHistory: updatedHistory,
            availableBlocks: newAvailableBlocks,
            usedBlocks: [...prev.usedBlocks, ...myBlocks.filter(b => b !== largerBlock)],
            opponentAvailableBlocks: newOpponentBlocks,
            hasUsedHidden: prev.hasUsedHidden || myUsedHiddenThisRound,
            opponentHasUsedHidden: prev.opponentHasUsedHidden || opponentUsedHiddenThisRound,
            selectedBlock1Index: null,
            selectedBlock2Index: null,
            currentTeam: roundPayload.nextTeam,
            hasSubmitted: false, // 새 라운드 시작이므로 제출 상태 초기화
            opponentUsedHiddenNotification: false, // 라운드 결과 이후 알림 닫기
            opponentUsedHiddenThisRound: false, // 새 라운드 시작
            showHiddenBlockSelection: false, // 히든 선택 UI 닫기
            selectedBlockChoice: null, // 선택 초기화
            pendingSubmitUseHidden: null, // 대기 중인 제출 초기화
          };
        });
        break;

      case 'nc_game_over':
        const overPayload = lastMessage.payload as NCGameOverPayload;
        console.log('[NumberChange] ========== GAME_OVER received ==========');
        console.log('[NumberChange] Payload:', overPayload);
        setGameState((prev) => ({
          ...prev,
          isGameOver: true,
          winner: overPayload.winner,
          team1Score: overPayload.team1Score,
          team2Score: overPayload.team2Score,
        }));
        break;

      case 'nc_use_hidden':
        console.log('[NumberChange] Opponent used hidden chance!');
        setGameState((prev) => ({
          ...prev,
          opponentUsedHiddenNotification: true,
          opponentUsedHiddenThisRound: true, // 이번 라운드에 히든 사용됨
          // 블록 선택 UI는 제출 후에 표시
        }));
        break;

      case 'nc_error':
        const errorPayload = lastMessage.payload as NCErrorPayload;
        setGameState((prev) => ({
          ...prev,
          error: errorPayload.message,
        }));
        break;
    }
  }, [lastMessage]);

  const selectBlock = (blockIndex: number) => {
    setGameState((prev) => {
      // 이미 선택된 인덱스를 다시 클릭하면 선택 해제
      if (prev.selectedBlock1Index === blockIndex) {
        return {
          ...prev,
          selectedBlock1Index: null,
        };
      }
      if (prev.selectedBlock2Index === blockIndex) {
        return {
          ...prev,
          selectedBlock2Index: null,
        };
      }

      // 첫 번째 블록이 비어있으면 거기에 저장
      if (prev.selectedBlock1Index === null) {
        return {
          ...prev,
          selectedBlock1Index: blockIndex,
        };
      }

      // 두 번째 블록이 비어있으면 거기에 저장
      if (prev.selectedBlock2Index === null) {
        return {
          ...prev,
          selectedBlock2Index: blockIndex,
        };
      }

      // 둘 다 차있으면 첫 번째를 대체
      return {
        ...prev,
        selectedBlock1Index: blockIndex,
      };
    });
  };

  const resetGame = () => {
    setGameState(initialGameState);
  };

  const isMyTurn = (): boolean => {
    return (
      gameState.isGameStarted &&
      !gameState.isGameOver &&
      gameState.currentTeam === gameState.yourTeam
    );
  };

  const canSubmit = (): boolean => {
    return (
      !gameState.hasSubmitted &&
      gameState.selectedBlock1Index !== null &&
      gameState.selectedBlock2Index !== null
    );
  };

  const markAsSubmitted = () => {
    setGameState((prev) => ({
      ...prev,
      hasSubmitted: true,
    }));
  };

  const prepareSubmit = (useHidden: boolean): boolean => {
    console.log('[NumberChange] prepareSubmit called:', {
      opponentUsedHiddenThisRound: gameState.opponentUsedHiddenThisRound,
      selectedBlockChoice: gameState.selectedBlockChoice,
      useHidden,
    });

    // 상대방이 히든을 사용했고, 아직 블록을 선택하지 않았다면 블록 선택 UI 표시
    if (gameState.opponentUsedHiddenThisRound && gameState.selectedBlockChoice === null) {
      console.log('[NumberChange] Showing hidden block selection UI');
      setGameState((prev) => ({
        ...prev,
        showHiddenBlockSelection: true,
        pendingSubmitUseHidden: useHidden, // 제출 대기 중인 히든 옵션 저장
      }));
      return false; // 아직 제출하지 말것
    }
    console.log('[NumberChange] Submit allowed');
    return true; // 제출 가능
  };

  const getSelectedBlocks = (): { block1: number; block2: number } | null => {
    if (gameState.selectedBlock1Index === null || gameState.selectedBlock2Index === null) {
      return null;
    }
    return {
      block1: gameState.availableBlocks[gameState.selectedBlock1Index],
      block2: gameState.availableBlocks[gameState.selectedBlock2Index],
    };
  };

  const dismissHiddenNotification = () => {
    setGameState((prev) => ({
      ...prev,
      opponentUsedHiddenNotification: false,
      // 블록 선택 UI는 유지
    }));
  };

  const showHiddenBlockSelector = () => {
    setGameState((prev) => ({
      ...prev,
      showHiddenBlockSelection: true,
    }));
  };

  const selectHiddenBlock = (choice: number) => {
    setGameState((prev) => ({
      ...prev,
      selectedBlockChoice: choice,
    }));
  };

  const cancelHiddenSelection = () => {
    setGameState((prev) => ({
      ...prev,
      showHiddenBlockSelection: false,
      selectedBlockChoice: null,
    }));
  };

  const confirmHiddenSelection = () => {
    setGameState((prev) => {
      console.log('[NumberChange] Block choice confirmed:', prev.selectedBlockChoice);

      return {
        ...prev,
        showHiddenBlockSelection: false,
        // selectedBlockChoice는 유지 - 제출 시 사용
        // pendingSubmitUseHidden도 유지 - 실제 제출에서 사용
      };
    });
  };

  const getPendingSubmitUseHidden = (): boolean | null => {
    return gameState.pendingSubmitUseHidden;
  };

  const clearPendingSubmit = () => {
    setGameState((prev) => ({
      ...prev,
      pendingSubmitUseHidden: null,
    }));
  };

  const getSubmitPayload = (): { block1: number; block2: number; selectedBlockChoice?: number } | null => {
    if (gameState.selectedBlock1Index === null || gameState.selectedBlock2Index === null) {
      return null;
    }
    return {
      block1: gameState.availableBlocks[gameState.selectedBlock1Index],
      block2: gameState.availableBlocks[gameState.selectedBlock2Index],
      selectedBlockChoice: gameState.selectedBlockChoice ?? undefined,
    };
  };

  return {
    gameState,
    selectBlock,
    resetGame,
    isMyTurn,
    canSubmit,
    getSelectedBlocks,
    markAsSubmitted,
    dismissHiddenNotification,
    showHiddenBlockSelector,
    selectHiddenBlock,
    cancelHiddenSelection,
    confirmHiddenSelection,
    getSubmitPayload,
    prepareSubmit,
    getPendingSubmitUseHidden,
    clearPendingSubmit,
  };
};
