import { useEffect, useRef, useState } from 'react';
import type { NCMessage } from '../types/numberchange';

export const useNCWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<NCMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[NumberChange] WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        console.log('[NumberChange] Raw message data:', event.data);

        // 개행으로 구분된 여러 JSON 메시지를 처리
        const messages = event.data.trim().split('\n').filter((line: string) => line.trim());

        // 여러 메시지를 순차적으로 처리하기 위해 각각 setLastMessage 호출
        messages.forEach((messageStr: string, index: number) => {
          try {
            const message: NCMessage = JSON.parse(messageStr);
            console.log(`[NumberChange] Received message ${index + 1}/${messages.length}:`, message);

            // 각 메시지를 순차적으로 처리하기 위해 타이머 사용
            setTimeout(() => {
              setLastMessage(message);
            }, index * 10); // 10ms 간격으로 메시지 처리
          } catch (parseError) {
            console.error('[NumberChange] Error parsing individual message:', parseError);
            console.error('[NumberChange] Failed message string:', messageStr);
          }
        });
      } catch (error) {
        console.error('[NumberChange] Error processing message:', error);
        console.error('[NumberChange] Raw data that failed to process:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('[NumberChange] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[NumberChange] WebSocket disconnected');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const sendMessage = (message: NCMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[NumberChange] Sending message:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('[NumberChange] WebSocket is not connected', wsRef.current?.readyState);
    }
  };

  return { isConnected, lastMessage, sendMessage };
};
