import { vi } from "vitest";

/**
 * Mock Anthropic SDK for tests.
 * Returns configurable Claude API responses.
 */
export function createMockAnthropicResponse(jsonResponse: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(jsonResponse),
      },
    ],
    model: "claude-sonnet-4-20250514",
    role: "assistant" as const,
    stop_reason: "end_turn" as const,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

export function createMockAnthropicClient(defaultResponse?: Record<string, unknown>) {
  const response = defaultResponse ?? { result: "mock" };
  return {
    messages: {
      create: vi.fn().mockResolvedValue(createMockAnthropicResponse(response)),
    },
  };
}

/**
 * Helper to set up mock for @anthropic-ai/sdk module.
 * Call this BEFORE importing the module under test.
 */
export function setupAnthropicMock(defaultResponse?: Record<string, unknown>) {
  const mockClient = createMockAnthropicClient(defaultResponse);

  vi.mock("@anthropic-ai/sdk", () => ({
    default: vi.fn().mockImplementation(() => mockClient),
  }));

  return mockClient;
}
