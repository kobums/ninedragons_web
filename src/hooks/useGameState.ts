import { useEffect, useState, useCallback } from 'react';
import type {
  GameState,
  Message,
  GameStartPayload,
  GameStatePayload,
  RoundResultPayload,
  GameOverPayload,
  ErrorPayload,
  TilePlayedPayload,
  RoundHistory,
} from '../types/game';
import { ND_SESSION_KEY, clearSessionId, saveSessionId } from '../utils/session';

const ALL_TILES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const initialGameState: GameState = {
  gameId: null,
  yourColor: null,
  currentRound: 1,
  blueWins: 0,
  redWins: 0,
  blueName: '',
  redName: '',
  availableTiles: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  usedTiles: [],
  opponentUsedTiles: [],
  roundHistory: [],
  currentRoundTiles: {},
  currentPlayer: null,
  isGameStarted: false,
  isGameOver: false,
  lastRoundResult: null,
  winner: '',
  error: null,
  isWaiting: false,
  opponentDisconnected: false,
  rematchOffered: false,
};

export const useGameState = (lastMessage: Message | null) => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  useEffect(() => {
    if (!lastMessage) return;

    console.log('Received message:', lastMessage.type, lastMessage.payload);

    switch (lastMessage.type) {
      case 'player_joined':
        console.log('Player joined:', lastMessage.payload);
        if (lastMessage.payload.sessionId) {
          saveSessionId(ND_SESSION_KEY, lastMessage.payload.sessionId);
        }
        setGameState((prev) => ({
          ...prev,
          gameId: lastMessage.payload.gameId,
          yourColor: lastMessage.payload.yourColor,
        }));
        break;

      case 'waiting_player':
        console.log('Waiting for player...');
        setGameState((prev) => ({
          ...prev,
          isWaiting: true,
          error: null,
        }));
        break;

      case 'game_start':
        const startPayload = lastMessage.payload as GameStartPayload;
        console.log('Game starting:', startPayload);
        // 재대결 시에도 같은 메시지로 새 게임이 시작되므로
        // 이전 게임의 누적 상태(라운드/타일/승수/gameOver)를 초기값으로 리셋한다.
        // 처음 매칭에서는 어차피 모두 초기값이라 동작이 같다.
        setGameState((prev) => ({
          ...initialGameState,
          gameId: prev.gameId,
          isGameStarted: true,
          isWaiting: false,
          currentPlayer: startPayload.firstPlayer,
          yourColor: startPayload.yourColor,
          blueName: startPayload.blueName || '',
          redName: startPayload.redName || '',
        }));
        break;

      case 'tile_played':
        const tilePayload = lastMessage.payload as TilePlayedPayload;
        console.log('Tile played:', tilePayload);
        setGameState((prev) => {
          const newCurrentRoundTiles = { ...prev.currentRoundTiles };
          newCurrentRoundTiles[tilePayload.color] = tilePayload.tile;

          // 라운드 동기화 - 서버에서 받은 라운드가 현재 라운드와 다르면 업데이트
          const syncedRound = tilePayload.round !== prev.currentRound
            ? tilePayload.round
            : prev.currentRound;

          // 상대방이 낸 패라면 즉시 opponentUsedTiles 업데이트
          const isOpponentTile = tilePayload.color !== prev.yourColor;
          const newOpponentUsedTiles = isOpponentTile
            ? [...prev.opponentUsedTiles, tilePayload.tile]
            : prev.opponentUsedTiles;

          console.log('Current round tiles after tile_played:', {
            before: prev.currentRoundTiles,
            after: newCurrentRoundTiles,
            currentRound: syncedRound,
            serverRound: tilePayload.round,
            isOpponentTile,
            opponentUsedTiles: newOpponentUsedTiles,
          });

          return {
            ...prev,
            currentRound: syncedRound,
            currentPlayer: tilePayload.nextPlayer,
            currentRoundTiles: newCurrentRoundTiles,
            opponentUsedTiles: newOpponentUsedTiles,
          };
        });
        break;

      case 'round_result':
        const roundPayload = lastMessage.payload as RoundResultPayload;
        console.log('========== ROUND_RESULT received ==========');
        console.log('Payload:', roundPayload);
        setGameState((prev) => {
          console.log('Previous state before round_result:', {
            currentRound: prev.currentRound,
            currentRoundTiles: prev.currentRoundTiles,
            historyLength: prev.roundHistory.length,
          });

          // 라운드 히스토리 추가 (중복 체크)
          const historyExists = prev.roundHistory.some(h => h.round === roundPayload.round);
          const newRoundHistory: RoundHistory = {
            round: roundPayload.round,
            blueTile: roundPayload.blueTile,
            redTile: roundPayload.redTile,
            winner: roundPayload.winner,
          };

          const updatedHistory = historyExists
            ? prev.roundHistory
            : [...prev.roundHistory, newRoundHistory];

          console.log('Round result processing:', {
            finishedRound: roundPayload.round,
            nextRound: roundPayload.round + 1,
            historyExists,
            historyCount: updatedHistory.length,
            clearingCurrentRoundTiles: prev.currentRoundTiles,
            newHistory: newRoundHistory,
          });

          // opponentUsedTiles는 tile_played에서 이미 업데이트되었으므로 그대로 유지
          const newState = {
            ...prev,
            currentRound: roundPayload.round + 1,
            blueWins: roundPayload.blueWins,
            redWins: roundPayload.redWins,
            lastRoundResult: roundPayload,
            currentPlayer: roundPayload.nextPlayer,
            roundHistory: updatedHistory,
            currentRoundTiles: {}, // 다음 라운드를 위해 초기화
          };

          console.log('New state after round_result:', {
            currentRound: newState.currentRound,
            currentRoundTiles: newState.currentRoundTiles,
            historyLength: newState.roundHistory.length,
          });
          console.log('========================================');

          return newState;
        });
        break;

      case 'game_state': {
        // 재접속 성공: 서버 스냅샷으로 전체 상태 복원
        const statePayload = lastMessage.payload as GameStatePayload;
        console.log('========== GAME_STATE (rejoin) received ==========');
        console.log('Payload:', statePayload);

        const yourUsed =
          statePayload.yourColor === 'blue'
            ? statePayload.blueUsedTiles
            : statePayload.redUsedTiles;
        const opponentUsed =
          statePayload.yourColor === 'blue'
            ? statePayload.redUsedTiles
            : statePayload.blueUsedTiles;

        const currentRoundTiles: { blue?: number; red?: number } = {};
        if (statePayload.blueRoundTile !== null) {
          currentRoundTiles.blue = statePayload.blueRoundTile;
        }
        if (statePayload.redRoundTile !== null) {
          currentRoundTiles.red = statePayload.redRoundTile;
        }

        setGameState({
          ...initialGameState,
          gameId: statePayload.gameId,
          yourColor: statePayload.yourColor,
          currentRound: statePayload.currentRound,
          blueWins: statePayload.blueWins,
          redWins: statePayload.redWins,
          blueName: statePayload.blueName,
          redName: statePayload.redName,
          currentPlayer: statePayload.currentPlayer,
          usedTiles: yourUsed ?? [],
          availableTiles: ALL_TILES.filter((t) => !(yourUsed ?? []).includes(t)),
          opponentUsedTiles: opponentUsed ?? [],
          roundHistory: statePayload.roundHistory ?? [],
          currentRoundTiles,
          isGameStarted: true,
          isWaiting: false,
          opponentDisconnected: !statePayload.opponentConnected,
        });
        break;
      }

      case 'opponent_disconnected':
        console.log('Opponent disconnected:', lastMessage.payload);
        setGameState((prev) => ({
          ...prev,
          opponentDisconnected: true,
        }));
        break;

      case 'opponent_reconnected':
        console.log('Opponent reconnected');
        setGameState((prev) => ({
          ...prev,
          opponentDisconnected: false,
        }));
        break;

      case 'session_expired':
        // 복구할 게임이 없음: 세션을 비우고 로비로
        console.log('Session expired, back to lobby');
        clearSessionId(ND_SESSION_KEY);
        setGameState((prev) => {
          // 게임 종료(재대결 창 만료) 화면은 유지한다 — 세션 만료는 정리 신호일 뿐
          if (prev.isGameOver) return prev;
          return initialGameState;
        });
        break;

      case 'game_over':
        const overPayload = lastMessage.payload as GameOverPayload;
        console.log('========== GAME_OVER received ==========');
        console.log('Payload:', overPayload);
        clearSessionId(ND_SESSION_KEY);
        setGameState((prev) => {
          console.log('Round history at game over:', {
            historyLength: prev.roundHistory.length,
            history: prev.roundHistory,
          });
          return {
            ...prev,
            isGameOver: true,
            winner: overPayload.winner,
            blueWins: overPayload.blueWins,
            redWins: overPayload.redWins,
          };
        });
        break;

      case 'rematch_offer':
        // 상대가 재대결을 신청함 — 게임 종료 화면에 표시
        console.log('Rematch offered by opponent');
        setGameState((prev) => ({
          ...prev,
          rematchOffered: true,
        }));
        break;

      case 'error':
        const errorPayload = lastMessage.payload as ErrorPayload;
        setGameState((prev) => ({
          ...prev,
          error: errorPayload.message,
        }));
        break;
    }
  }, [lastMessage]);

  const playTile = (tile: number) => {
    // 사용한 타일만 로컬에서 즉시 업데이트 (UI 비활성화용)
    // currentRoundTiles와 currentPlayer는 서버로부터 tile_played 메시지로 업데이트됨
    console.log('playTile called:', {
      tile,
      currentRound: gameState.currentRound,
      currentRoundTiles: gameState.currentRoundTiles,
      yourColor: gameState.yourColor,
    });

    setGameState((prev) => ({
      ...prev,
      usedTiles: [...prev.usedTiles, tile],
      availableTiles: prev.availableTiles.filter((t) => t !== tile),
    }));
  };

  const resetGame = () => {
    clearSessionId(ND_SESSION_KEY);
    setGameState(initialGameState);
  };

  const isMyTurn = (): boolean => {
    return (
      gameState.isGameStarted &&
      !gameState.isGameOver &&
      gameState.currentPlayer === gameState.yourColor
    );
  };

  // 에러 토스트 해제용 — alert 대체 (ErrorToast)
  const clearError = useCallback(() => {
    setGameState((prev) => ({ ...prev, error: null }));
  }, []);

  return { gameState, playTile, resetGame, isMyTurn, clearError };
};
