import { describe, expect, it } from "vitest";
import {
  summarizeWebAcquisitionCosts,
  type WebAcquisitionCostEvent,
} from "../../mcp-natt/src/web-acquisition-events";

function costEvent(
  overrides: Partial<WebAcquisitionCostEvent> = {},
): WebAcquisitionCostEvent {
  return {
    schema: "devbot.natt.web-acquisition-cost.v1",
    eventId: "cost-001",
    missionId: "mission-001",
    tenantId: "tolani-labs",
    provider: "firecrawl",
    category: "scrape",
    quantity: 1,
    unit: "provider-credit",
    estimatedCostUsd: 0.01,
    actualCostUsd: 0.008,
    customerBillable: false,
    occurredAt: new Date(0).toISOString(),
    correlationId: "corr-001",
    ...overrides,
  };
}

describe("web acquisition event contracts", () => {
  it("summarizes complete estimated and actual costs", () => {
    const result = summarizeWebAcquisitionCosts([
      costEvent(),
      costEvent({
        eventId: "cost-002",
        estimatedCostUsd: 0.02,
        actualCostUsd: 0.018,
      }),
    ]);

    expect(result.totalEstimatedCostUsd).toBeCloseTo(0.03);
    expect(result.totalActualCostUsd).toBeCloseTo(0.026);
  });

  it("does not report a complete actual total when any event is unpriced", () => {
    const result = summarizeWebAcquisitionCosts([
      costEvent(),
      costEvent({ eventId: "cost-002", actualCostUsd: undefined }),
    ]);

    expect(result.totalEstimatedCostUsd).toBeCloseTo(0.02);
    expect(result.totalActualCostUsd).toBeUndefined();
  });
});
