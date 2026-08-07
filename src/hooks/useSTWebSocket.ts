import type { STMessage } from '../types/schottentotten';
import { useReconnectingWebSocket } from './useReconnectingWebSocket';

export const useSTWebSocket = (
  url: string,
  options: { onOpen?: (isReconnect: boolean) => void } = {},
) => {
  return useReconnectingWebSocket<STMessage>(url, {
    ...options,
    logPrefix: '[SchottenTotten] WebSocket',
  });
};
