import { useEffect, useRef, useState } from 'react';

export type LogMessage = {
  type: 'log' | 'task:started' | 'task:completed' | 'connected';
  data?: any;
  message?: string;
  timestamp: string;
};

export const useDevBotStream = (url: string = 'ws://localhost:8080') => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (status === 'connected') return;

    setStatus('connecting');
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setStatus('connected');
      addLog({ type: 'connected', message: 'Connected to DevBot Stream', timestamp: new Date().toISOString() });
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        addLog({ ...data, timestamp: new Date().toISOString() });
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.current.onclose = () => {
      setStatus('disconnected');
      addLog({ type: 'log', message: 'Stream disconnected. Reconnecting...', timestamp: new Date().toISOString() });
      setTimeout(() => setStatus('disconnected'), 3000); // Trigger re-render to retry
    };

    return () => {
      ws.current?.close();
    };
  }, [url, status]); // Simple reconnection logic

  const addLog = (log: LogMessage) => {
    setLogs((prev) => [log, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  return { logs, status };
};
