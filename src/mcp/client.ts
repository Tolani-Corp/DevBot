import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

export class MediaPlatformClient {
  private client: Client;
  private transport!: StdioClientTransport;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client(
      {
        name: "devbot-media-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  async connect() {
    if (this.isConnected) return;

    const mcpServerPath = path.resolve(
      process.cwd(),
      "../freakme.fun/mcp/dist/index.js"
    );

    this.transport = new StdioClientTransport({
      command: "node",
      args: [mcpServerPath],
    });

    await this.client.connect(this.transport);
    this.isConnected = true;
    console.log("Connected to FreakMe Media Platform MCP Server");
  }

  async getTools() {
    return await this.client.listTools();
  }

  async getResources() {
    return await this.client.listResources();
  }

  async readResource(uri: string) {
    return await this.client.readResource({ uri });
  }

  async createVideoPreview(inputPath: string, outputPath: string, clipDuration?: number, moneyShotTime?: number) {
    const args: any = { inputPath, outputPath };
    if (clipDuration) args.clipDuration = clipDuration;
    if (moneyShotTime) args.moneyShotTime = moneyShotTime;

    return await this.client.callTool({
      name: "create_video_preview",
      arguments: args,
    });
  }

  async disconnect() {
    if (!this.isConnected) return;
    await this.transport.close();
    this.isConnected = false;
  }
}

// Singleton instance
export const mediaPlatform = new MediaPlatformClient();
