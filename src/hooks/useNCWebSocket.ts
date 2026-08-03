import type { NCMessage } from '../types/numberchange';
import { useReconnectingWebSocket } from './useReconnectingWebSocket';

export const useNCWebSocket = (
  url: string,
  options: { onOpen?: (isReconnect: boolean) => void } = {},
) => {
  return useReconnectingWebSocket<NCMessage>(url, {
    ...options,
    logPrefix: '[NumberChange] WebSocket',
  });
};
