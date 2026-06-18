import { describe, expect, it } from "vitest";
import {
  buildProcurementRegulatoryMemory,
  getNaicsCode,
  loadFarIndex,
  loadNaicsDataset,
  searchFarIndex,
} from "../../mcp-natt/src/procurement-regulatory";

describe("procurement regulatory MCP knowledge", () => {
  it("loads the complete generated NAICS and FAR indexes", async () => {
    const naics = await loadNaicsDataset();
    const far = await loadFarIndex();

    expect(naics.schema).toBe("devbot.naics.2022.v1");
    expect(naics.count).toBeGreaterThan(2000);
    expect(naics.codes.some((entry) => entry.code === "236220")).toBe(true);

    expect(far.schema).toBe("devbot.far.title48.chapter1.index.v1");
    expect(far.counts.parts).toBeGreaterThanOrEqual(53);
    expect(far.counts.sections).toBeGreaterThan(3000);
    expect(far.sections.some((section) => section.citation === "25.000")).toBe(true);
  });

  it("validates NAICS codes and suggests alternatives for invalid codes", async () => {
    const valid = await getNaicsCode("236220");
    const invalid = await getNaicsCode("236823");

    expect(valid.found).toBe(true);
    expect(valid.record?.title).toContain("Commercial and Institutional Building Construction");

    expect(invalid.found).toBe(false);
    expect(invalid.warning).toContain("236823");
    expect(invalid.suggestions.some((entry) => entry.code === "236220")).toBe(true);
  });

  it("returns FAR import/export references from the complete index", async () => {
    const results = await searchFarIndex({
      query: "FAR import export customs duties trade agreements Buy American",
      limit: 20,
    });

    expect(results.parts.some((part) => part.part === "25")).toBe(true);
    expect(results.sections.some((section) => section.citation.startsWith("25."))).toBe(true);
    expect(results.sections.some((section) => section.citation.startsWith("52.225"))).toBe(true);
  });

  it("builds supplier-ready regulatory memory without approving automation", async () => {
    const memory = await buildProcurementRegulatoryMemory({
      query: "find suppliers that manufacture OEM NAIC=236823 and all FAR import/export regulations",
      limit: 10,
    });

    expect(memory.supplierSearch.wantsSuppliers).toBe(true);
    expect(memory.supplierSearch.wantsOem).toBe(true);
    expect(memory.supplierSearch.normalizedFilters.supplierType).toBe("OEM");
    expect(memory.naics.requestedCodes).toContain("236823");
    expect(memory.warnings.some((warning) => warning.includes("236823"))).toBe(true);
    expect(memory.far.parts.some((part) => part.part === "25")).toBe(true);
    expect(memory.blockedAutomation.join(" ")).toContain("No supplier approval");
  });
});
