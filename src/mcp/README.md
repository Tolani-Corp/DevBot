# DevBot MCP Client

This module connects DevBot to the FreakMe.fun Media Platform via the Model Context Protocol (MCP).

## Usage

```typescript
import { mediaPlatform } from "@/mcp/client";

// 1. Connect to the MCP Server
await mediaPlatform.connect();

// 2. Read Platform Context (Schemas, Rules)
const resources = await mediaPlatform.getResources();
const schema = await mediaPlatform.readResource("file:///platform_directory/media_sitemap_schema.json");

// 3. Execute Media Tools
const result = await mediaPlatform.createVideoPreview(
  "D:\\ingest\\raw_video.mp4",
  "D:\\ingest\\preview.mp4",
  3.0, // 3 seconds per clip
  1220 // Money shot at 20:20
);

// 4. Disconnect when done
await mediaPlatform.disconnect();
```

## Available Capabilities

- **Tools**: `create_video_preview` (FFmpeg video clipping)
- **Resources**: 
  - `file:///platform_directory/README.md` (Platform rules)
  - `file:///platform_directory/media_sitemap_schema.json` (Folder structure schema)
