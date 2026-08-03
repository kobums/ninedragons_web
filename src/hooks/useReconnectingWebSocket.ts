import { useCallback, useEffect, useRef, useState } from 'react';

interface ReconnectingWebSocketOptions {
  /** 연결(재연결 포함)될 때마다 호출. isReconnect가 true면 끊겼다 다시 붙은 경우 */
  onOpen?: (isReconnect: boolean) => void;
  logPrefix?: string;
}

const MAX_RECONNECT_DELAY = 10000;

// 모바일에서 다른 앱으로 전환하면 OS가 탭을 정지시켜 WebSocket이 끊긴다.
// 이 훅은 끊김을 감지해 지수 백오프로 자동 재접속하고,
// 앱으로 돌아온 순간(visibilitychange/pageshow/online)에는 즉시 재접속한다.
export const useReconnectingWebSocket = <T,>(
  url: string,
  options: ReconnectingWebSocketOptions = {},
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const prefix = optionsRef.current.logPrefix ?? '[WebSocket]';
    let disposed = false;
    let attempts = 0;
    let hasConnectedOnce = false;
    let reconnectTimer: number | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (disposed) return;
      clearReconnectTimer();

      const existing = wsRef.current;
      if (
        existing &&
        (existing.readyState === WebSocket.OPEN ||
          existing.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`${prefix} connected`);
        setIsConnected(true);
        attempts = 0;
        const isReconnect = hasConnectedOnce;
        hasConnectedOnce = true;
        optionsRef.current.onOpen?.(isReconnect);
      };

      ws.onmessage = (event) => {
        try {
          // 개행으로 구분된 여러 JSON 메시지를 처리
          const messages = event.data
            .trim()
            .split('\n')
            .filter((line: string) => line.trim());

          messages.forEach((messageStr: string, index: number) => {
            try {
              const message: T = JSON.parse(messageStr);
              // 각 메시지를 순차적으로 처리하기 위해 타이머 사용
              setTimeout(() => {
                setLastMessage(message);
              }, index * 10);
            } catch (parseError) {
              console.error(`${prefix} Error parsing message:`, parseError, messageStr);
            }
          });
        } catch (error) {
          console.error(`${prefix} Error processing message:`, error, event.data);
        }
      };

      ws.onerror = (error) => {
        console.error(`${prefix} error:`, error);
      };

      ws.onclose = () => {
        console.log(`${prefix} disconnected`);
        setIsConnected(false);
        if (disposed) return;

        const delay = Math.min(1000 * 2 ** attempts, MAX_RECONNECT_DELAY);
        attempts += 1;
        console.log(`${prefix} reconnecting in ${delay}ms`);
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    // 백그라운드에선 타이머가 돌지 않으므로, 복귀 이벤트에서 즉시 재접속한다
    const reconnectNow = () => {
      if (disposed) return;
      const ws = wsRef.current;
      if (
        !ws ||
        ws.readyState === WebSocket.CLOSED ||
        ws.readyState === WebSocket.CLOSING
      ) {
        attempts = 0;
        connect();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconnectNow();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', reconnectNow);
    window.addEventListener('online', reconnectNow);

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', reconnectNow);
      window.removeEventListener('online', reconnectNow);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [url]);

  const sendMessage = useCallback((message: T) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected', ws?.readyState);
    }
  }, []);

  return { isConnected, lastMessage, sendMessage };
};
