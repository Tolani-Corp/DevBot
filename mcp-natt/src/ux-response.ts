import { randomUUID } from "node:crypto";

type McpTextContent = { type: "text"; text: string };
type McpUnknownContent = { type: string; [key: string]: unknown };

type McpResponse = {
  content: Array<McpTextContent | McpUnknownContent>;
  isError?: boolean;
};

type ResponseStatus = "success" | "partial" | "error";
type ConfidenceLevel = "low" | "medium" | "high";

type UxAction = {
  label: string;
  command: string;
  impact: string;
};

type UxEnvelope = {
  status: ResponseStatus;
  summary: string;
  highlights: string[];
  data: Record<string, unknown>;
  actions: UxAction[];
  confidence: {
    level: ConfidenceLevel;
    rationale: string;
  };
  meta: {
    toolName: string;
    durationMs: number;
    timestamp: string;
    requestId: string;
    cached: boolean;
    truncated: boolean;
  };
};

type BuildUxResponseInput = {
  toolName: string;
  result: McpResponse;
  startedAt: number;
  cached?: boolean;
  truncated?: boolean;
};

const ENVELOPE_KEYS = ["status", "summary", "highlights", "data", "actions", "confidence", "meta"];

function isStructuredEnvelope(payload: unknown): payload is UxEnvelope {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return ENVELOPE_KEYS.every((key) => key in record);
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractSummary(toolName: string, text: string, status: ResponseStatus): string {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";

  if (firstLine.length > 0) {
    return firstLine.slice(0, 220);
  }

  if (status === "error") {
    return `Tool ${toolName} failed to complete successfully.`;
  }

  return `Tool ${toolName} completed successfully.`;
}

function extractHighlights(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^[-*#\s]+/, "").trim())
    .filter((line) => line.length > 0);

  return lines.slice(0, 5);
}

function createActions(status: ResponseStatus, toolName: string): UxAction[] {
  if (status === "error") {
    return [
      {
        label: "Retry with narrower scope",
        command: `${toolName} with specific filters`,
        impact: "Reduces ambiguous or overloaded tool execution paths.",
      },
      {
        label: "Inspect tool arguments",
        command: `validate inputs for ${toolName}`,
        impact: "Catches missing or malformed parameters before re-run.",
      },
    ];
  }

  return [
    {
      label: "Apply recommended findings",
      command: `review ${toolName} result data`,
      impact: "Turns analysis output into concrete remediation actions.",
    },
    {
      label: "Run a follow-up tool",
      command: `execute related ${toolName} workflow`,
      impact: "Validates and deepens the current result set.",
    },
  ];
}

function deriveStatus(result: McpResponse, text: string): ResponseStatus {
  if (result.isError) {
    return "error";
  }

  if (text.toLowerCase().includes("not found") || text.toLowerCase().includes("no ")) {
    return "partial";
  }

  return "success";
}

export function buildUxResponse(input: BuildUxResponseInput): McpResponse {
  const textBlocks = input.result.content
    .filter((item) => item.type === "text")
    .map((item) => String((item as McpTextContent).text ?? ""));

  const joinedText = textBlocks.join("\n\n").trim();
  const status = deriveStatus(input.result, joinedText);
  const parsed = joinedText.length > 0 ? safeJsonParse(joinedText) : null;
  const parsedEnvelope = isStructuredEnvelope(parsed) ? parsed : null;

  if (parsedEnvelope) {
    const mergedEnvelope: UxEnvelope = {
      ...parsedEnvelope,
      meta: {
        ...parsedEnvelope.meta,
        toolName: input.toolName,
        durationMs: Date.now() - input.startedAt,
        timestamp: new Date().toISOString(),
        requestId: parsedEnvelope.meta.requestId || randomUUID(),
        cached: input.cached ?? false,
        truncated: input.truncated ?? false,
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(mergedEnvelope, null, 2) }],
      isError: status === "error",
    };
  }

  const envelope: UxEnvelope = {
    status,
    summary: extractSummary(input.toolName, joinedText, status),
    highlights: extractHighlights(joinedText),
    data: parsed && typeof parsed === "object"
      ? { payload: parsed }
      : {
          payload: {
            text: joinedText,
          },
        },
    actions: createActions(status, input.toolName),
    confidence: {
      level: status === "error" ? "low" : "medium",
      rationale:
        status === "error"
          ? "Tool execution reported an error path. Verify inputs and retry."
          : "Response normalized by the shared MCP UX envelope for consistent rendering.",
    },
    meta: {
      toolName: input.toolName,
      durationMs: Date.now() - input.startedAt,
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      cached: input.cached ?? false,
      truncated: input.truncated ?? false,
    },
  };

  return {
    content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }],
    isError: status === "error",
  };
}
