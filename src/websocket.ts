import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { AgentTask, AgentResult } from './agents/types';
import { EventEmitter } from 'events';

// Global specific Event Emitter for Agent status updates
export const agentEvents = new EventEmitter();

interface Client {
  ws: WebSocket;
  id: string;
}

export class DevBotWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    console.log(`📡 DevBot WebSocket Server started on port ${port}`);

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const id = req.headers['sec-websocket-key'] || Math.random().toString(36).substring(7);
      console.log(`🔌 New client connected: ${id}`);
      
      this.clients.set(id, { ws, id });

      ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to DevBot Stream 🚀' }));

      ws.on('close', () => {
        console.log(`Client disconnected: ${id}`);
        this.clients.delete(id);
      });
      
      ws.on('error', (err) => {
          console.error(`WS Error for ${id}:`, err);
      });
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for internal agent events and broadcast them
    agentEvents.on('task:started', (task: AgentTask) => {
      this.broadcast({ type: 'task:started', data: task });
    });

    agentEvents.on('task:completed', (result: AgentResult) => {
      this.broadcast({ type: 'task:completed', data: result });
    });

    agentEvents.on('log', (log: any) => {
      this.broadcast({ type: 'log', data: log });
    });
  }

  public broadcast(message: any) {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }
}

// Singleton instance
let serverInstance: DevBotWebSocketServer | null = null;

export function startWebSocketServer(port: number = 8080) {
    if (!serverInstance) {
        serverInstance = new DevBotWebSocketServer(port);
    }
    return serverInstance;
}
