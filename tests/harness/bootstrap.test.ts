import { describe, expect, it } from "vitest";
import {
  TOLANI_HARNESS_BOOTSTRAP,
  validateHarnessBootstrap,
  validateHarnessCostEnvelope,
} from "../../src/harness/index";

describe("Tolani Harness bootstrap", () => {
  it("defines clean repository boundaries and three pilots", () => {
    expect(validateHarnessBootstrap()).toEqual([]);
    expect(TOLANI_HARNESS_BOOTSTRAP.initialPilots).toHaveLength(3);
    expect(
      TOLANI_HARNESS_BOOTSTRAP.repositories.find(
        (repository) => repository.name === "tolani-harness-hub",
      )?.status,
    ).toBe("planned");
  });

  it("requires cost and execution limits", () => {
    expect(validateHarnessCostEnvelope(TOLANI_HARNESS_BOOTSTRAP.defaultBudget)).toEqual([]);
  });

  it("keeps irreversible product actions outside autonomous execution", () => {
    const irreversibleActions = TOLANI_HARNESS_BOOTSTRAP.initialPilots.flatMap(
      (pilot) => pilot.irreversibleActions,
    );

    expect(irreversibleActions).toContain("Approve supplier");
    expect(irreversibleActions).toContain("Publish exam content");
    expect(irreversibleActions).toContain("Execute contracts");
  });

  it("requires commercialization evidence before external sale", () => {
    expect(TOLANI_HARNESS_BOOTSTRAP.commercializationGates).toContain(
      "Ninety days of reconciled cost telemetry",
    );
    expect(TOLANI_HARNESS_BOOTSTRAP.commercializationGates).toContain(
      "Tenant isolation tests passing",
    );
  });
});
