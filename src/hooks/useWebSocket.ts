import type { Message } from '../types/game';
import { useReconnectingWebSocket } from './useReconnectingWebSocket';

export const useWebSocket = (
  url: string,
  options: { onOpen?: (isReconnect: boolean) => void } = {},
) => {
  return useReconnectingWebSocket<Message>(url, {
    ...options,
    logPrefix: '[NineDragons] WebSocket',
  });
};
