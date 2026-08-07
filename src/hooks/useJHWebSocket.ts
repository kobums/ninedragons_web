import type { JHMessage } from '../types/jekyllhyde';
import { useReconnectingWebSocket } from './useReconnectingWebSocket';

export const useJHWebSocket = (
  url: string,
  options: { onOpen?: (isReconnect: boolean) => void } = {},
) => {
  return useReconnectingWebSocket<JHMessage>(url, {
    ...options,
    logPrefix: '[JekyllHyde] WebSocket',
  });
};
