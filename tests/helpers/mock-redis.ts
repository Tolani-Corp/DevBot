import { vi } from "vitest";

/**
 * Mock Redis and BullMQ for tests.
 */
export function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    multi: vi.fn().mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 1], [null, 1]]),
    }),
    quit: vi.fn().mockResolvedValue("OK"),
    disconnect: vi.fn(),
  };
}

export function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
    getJob: vi.fn().mockResolvedValue(null),
    getJobs: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
    obliterate: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockWorker() {
  return {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    isRunning: vi.fn().mockReturnValue(true),
  };
}

export function createMockJob(data: Record<string, unknown> = {}) {
  return {
    id: "test-job-id",
    data: {
      taskId: "test-task-id",
      slackThreadTs: "1234567890.123456",
      slackChannelId: "C1234567890",
      description: "test task description",
      repository: "test-repo",
      ...data,
    },
    progress: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
    updateProgress: vi.fn().mockResolvedValue(undefined),
  };
}
