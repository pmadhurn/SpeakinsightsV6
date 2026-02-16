import { useRef, useState, useCallback, useEffect } from 'react';

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  /** Called when a parsed JSON message arrives */
  onMessage?: (data: unknown) => void;
  /** Called on successful connection */
  onOpen?: () => void;
  /** Called when the connection closes */
  onClose?: (event: CloseEvent) => void;
  /** Called on connection error */
  onError?: (event: Event) => void;
  /** Whether to auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Base reconnect interval in ms (default: 1000). Uses exponential backoff up to maxReconnectInterval. */
  reconnectInterval?: number;
  /** Max reconnect interval in ms (default: 30000) */
  maxReconnectInterval?: number;
}

export function useWebSocket(url?: string, options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    autoReconnect = true,
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const urlRef = useRef(url);
  const callbacksRef = useRef({ onMessage, onOpen, onClose, onError });

  const [isConnected, setIsConnected] = useState(false);

  // Keep refs up to date without re-triggering connect
  useEffect(() => {
    callbacksRef.current = { onMessage, onOpen, onClose, onError };
  }, [onMessage, onOpen, onClose, onError]);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (targetUrl?: string) => {
      const wsUrl = targetUrl || urlRef.current;
      if (!wsUrl) return;

      // Close any existing connection
      if (wsRef.current) {
        intentionalCloseRef.current = true;
        wsRef.current.close();
      }

      clearReconnectTimer();
      intentionalCloseRef.current = false;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        retriesRef.current = 0;
        callbacksRef.current.onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onMessage?.(data);
        } catch {
          callbacksRef.current.onMessage?.(event.data);
        }
      };

      ws.onerror = (event) => {
        callbacksRef.current.onError?.(event);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;
        callbacksRef.current.onClose?.(event);

        // Auto-reconnect unless intentional close or server explicitly rejected
        if (!intentionalCloseRef.current && autoReconnect && event.code < 4000) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, retriesRef.current),
            maxReconnectInterval
          );
          retriesRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => {
            connect(wsUrl);
          }, delay);
        }
      };

      wsRef.current = ws;
    },
    [autoReconnect, reconnectInterval, maxReconnectInterval, clearReconnectTimer]
  );

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearReconnectTimer]);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
    };
  }, [clearReconnectTimer]);

  return { sendMessage, isConnected, connect, disconnect };
}

export default useWebSocket;
