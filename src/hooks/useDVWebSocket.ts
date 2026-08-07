import type { DVMessage } from '../types/davinci';
import { useReconnectingWebSocket } from './useReconnectingWebSocket';

export const useDVWebSocket = (
  url: string,
  options: { onOpen?: (isReconnect: boolean) => void } = {},
) => {
  return useReconnectingWebSocket<DVMessage>(url, {
    ...options,
    logPrefix: '[DaVinci] WebSocket',
  });
};
