import { useEffect, useRef, useState, useCallback } from 'react';
import { StoredMessage } from './types';

interface WSState {
  connected: boolean;
  messages: StoredMessage[];
}

export function useWebSocket(url: string): WSState & { reset: () => void } {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect(): void {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string);
          if (payload.event === 'init') {
            setMessages(payload.data as StoredMessage[]);
          } else if (payload.event === 'new-message') {
            setMessages((prev) => [payload.data as StoredMessage, ...prev]);
          } else if (payload.event === 'reset') {
            setMessages([]);
          }
        } catch {
          // ignore malformed frames
        }
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimeout);
      ws.close();
    };
  }, [url]);

  const reset = useCallback(async () => {
    await fetch('/reset', { method: 'POST' });
  }, []);

  return { connected, messages, reset };
}
