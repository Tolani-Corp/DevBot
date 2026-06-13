import { useEffect, useRef, useState } from "react";

export type StreamTaskData = {
  id?: string;
  taskId?: string;
  description?: string;
  [key: string]: unknown;
};

export type LogMessage = {
  type: "log" | "task:started" | "task:completed" | "connected";
  data?: StreamTaskData;
  message?: string;
  timestamp: string;
};

function normalizeLog(raw: Partial<LogMessage>): LogMessage {
  const allowedTypes = new Set([
    "log",
    "task:started",
    "task:completed",
    "connected",
  ]);

  return {
    type: allowedTypes.has(String(raw.type))
      ? (raw.type as LogMessage["type"])
      : "log",
    data: raw.data,
    message: raw.message,
    timestamp: raw.timestamp ?? new Date().toISOString(),
  };
}

export const useDevBotStream = (url: string = "ws://localhost:8080") => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [status, setStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let closedByEffect = false;

    const addLog = (log: LogMessage) => {
      setLogs((prev) => [log, ...prev].slice(0, 100));
    };

    const connect = () => {
      setStatus("connecting");
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        setStatus("connected");
        addLog({
          type: "connected",
          message: "Connected to DevBot execution stream",
          timestamp: new Date().toISOString(),
        });
      };

      socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data) as Partial<LogMessage>;
          addLog(normalizeLog(raw));
        } catch (error) {
          console.error("Failed to parse WS message", error);
        }
      };

      socket.onclose = () => {
        if (closedByEffect) return;
        setStatus("disconnected");
        addLog({
          type: "log",
          message: "Stream disconnected. Reconnecting...",
          timestamp: new Date().toISOString(),
        });
        retryTimer = setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws.current?.close();
    };
  }, [url]);

  return { logs, status };
};
