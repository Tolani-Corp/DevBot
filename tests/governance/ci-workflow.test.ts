import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("CI workflow readiness gates", () => {
  const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
  const governanceWorkflow = readRepoFile(".github/workflows/devbot-governance.yml");

  it("runs production-readiness gates on push and pull requests", () => {
    expect(ciWorkflow).toContain("push:");
    expect(ciWorkflow).toContain("pull_request:");
    expect(ciWorkflow).toContain("pnpm run check --pretty false");
    expect(ciWorkflow).toContain("pnpm test");
    expect(ciWorkflow).toContain("pnpm run build");
  });

  it("keeps governance evidence typechecking deterministic", () => {
    expect(governanceWorkflow).toContain("pnpm run check --pretty false");
  });

  it("pins the package manager used by DEBO local runs and CI", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      packageManager?: string;
    };

    expect(packageJson.packageManager).toBe("pnpm@9.15.9");
  });
});
