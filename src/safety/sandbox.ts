/**
 * Sandbox
 *
 * Isolated execution environment for untrusted code.
 *
 * Features:
 * - Docker container execution
 * - Resource limits (CPU, memory, timeout)
 * - Network isolation
 * - Filesystem isolation
 * - Automatic cleanup
 */

import { execFileSync, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

export interface SandboxConfig {
  dockerImage?: string;
  cpuPercent?: number;
  memoryMb?: number;
  timeoutSeconds?: number;
  networkIsolation?: boolean;
  mountWorkspace?: boolean;
}

export interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  error?: string;
}

export class Sandbox {
  private config: Required<SandboxConfig>;
  private containerId?: string;

  constructor(config: SandboxConfig = {}) {
    this.config = {
      dockerImage: config.dockerImage ?? "node:22-alpine",
      cpuPercent: config.cpuPercent ?? 50,
      memoryMb: config.memoryMb ?? 512,
      timeoutSeconds: config.timeoutSeconds ?? 60,
      networkIsolation: config.networkIsolation ?? true,
      mountWorkspace: config.mountWorkspace ?? false,
    };
  }

  /**
   * Execute code in an isolated Docker container.
   */
  async execute(
    code: string,
    language: "javascript" | "typescript" | "python" | "shell" = "javascript",
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    const sandboxId = randomUUID();

    try {
      // Check if Docker is available
      if (!this.isDockerAvailable()) {
        console.warn("[sandbox] Docker not available, falling back to local execution");
        return this.executeLocal(code, language);
      }

      // Create temporary directory for code
      const tempDir = path.join(WORKSPACE_ROOT, ".devbot", "sandbox", sandboxId);
      await fs.mkdir(tempDir, { recursive: true });

      // Write code to file
      const codeFile = await this.writeCodeFile(tempDir, code, language);

      // Build docker run command
      const dockerArgs = this.buildDockerArgs(tempDir, codeFile, language);

      // Execute in container
      const result = await this.runContainer(dockerArgs);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        stdout: "",
        stderr: String(error),
        exitCode: -1,
        executionTimeMs: Date.now() - startTime,
        error: String(error),
      };
    }
  }

  /**
   * Execute a test suite in isolation.
   */
  async executeTests(
    repository: string,
    testCommand: string = "npm test",
  ): Promise<SandboxResult> {
    const startTime = Date.now();

    try {
      if (!this.isDockerAvailable()) {
        console.warn("[sandbox] Docker not available for test execution");
        return this.executeLocal(testCommand, "shell");
      }

      const repoPath = path.resolve(WORKSPACE_ROOT, repository);

      const dockerArgs = [
        "run",
        "--rm",
        `--cpus=${this.config.cpuPercent / 100}`,
        `--memory=${this.config.memoryMb}m`,
        ...(this.config.networkIsolation ? ["--network=none"] : []),
        "-v",
        `${repoPath}:/workspace:ro`,
        "-w",
        "/workspace",
        this.config.dockerImage,
        "sh",
        "-c",
        testCommand,
      ];

      const result = await this.runContainer(dockerArgs);

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        stdout: "",
        stderr: String(error),
        exitCode: -1,
        executionTimeMs: Date.now() - startTime,
        error: String(error),
      };
    }
  }

  /**
   * Check if Docker is available.
   */
  private isDockerAvailable(): boolean {
    try {
      execFileSync("docker", ["--version"], {
        stdio: "pipe",
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write code to a file based on language.
   */
  private async writeCodeFile(
    dir: string,
    code: string,
    language: "javascript" | "typescript" | "python" | "shell",
  ): Promise<string> {
    const extensions = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      shell: "sh",
    };

    const fileName = `code.${extensions[language]}`;
    const filePath = path.join(dir, fileName);

    await fs.writeFile(filePath, code, "utf-8");

    return fileName;
  }

  /**
   * Build Docker run arguments.
   */
  private buildDockerArgs(
    tempDir: string,
    codeFile: string,
    language: "javascript" | "typescript" | "python" | "shell",
  ): string[] {
    const commands = {
      javascript: `node ${codeFile}`,
      typescript: `npx tsx ${codeFile}`,
      python: `python ${codeFile}`,
      shell: `sh ${codeFile}`,
    };

    return [
      "run",
      "--rm",
      `--cpus=${this.config.cpuPercent / 100}`,
      `--memory=${this.config.memoryMb}m`,
      ...(this.config.networkIsolation ? ["--network=none"] : []),
      "-v",
      `${tempDir}:/workspace:ro`,
      "-w",
      "/workspace",
      this.config.dockerImage,
      "sh",
      "-c",
      commands[language],
    ];
  }

  /**
   * Run Docker container and capture output.
   */
  private async runContainer(
    args: string[],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", args, {
        timeout: this.config.timeoutSeconds * 1000,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (exitCode) => {
        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? -1,
        });
      });

      child.on("error", (error) => {
        reject(error);
      });

      // Kill after timeout
      setTimeout(() => {
        child.kill("SIGKILL");
      }, this.config.timeoutSeconds * 1000);
    });
  }

  /**
   * Fallback to local execution (not sandboxed - use with caution).
   */
  private async executeLocal(
    code: string,
    language: "javascript" | "typescript" | "python" | "shell",
  ): Promise<SandboxResult> {
    const startTime = Date.now();

    try {
      const commands = {
        javascript: ["node", "-e", code],
        typescript: ["npx", "tsx", "-e", code],
        python: ["python", "-c", code],
        shell: ["sh", "-c", code],
      };

      const [cmd, ...args] = commands[language];

      const output = execFileSync(cmd, args, {
        encoding: "utf-8",
        timeout: this.config.timeoutSeconds * 1000,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      return {
        success: true,
        stdout: output,
        stderr: "",
        exitCode: 0,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        status?: number;
      };

      return {
        success: false,
        stdout: execError.stdout?.toString() ?? "",
        stderr: execError.stderr?.toString() ?? String(error),
        exitCode: execError.status ?? -1,
        executionTimeMs: Date.now() - startTime,
        error: String(error),
      };
    }
  }

  /**
   * Cleanup any running containers.
   */
  async cleanup(): Promise<void> {
    if (this.containerId) {
      try {
        execFileSync("docker", ["stop", this.containerId], {
          timeout: 5000,
        });
        execFileSync("docker", ["rm", this.containerId], {
          timeout: 5000,
        });
      } catch (error) {
        console.warn(`[sandbox] Failed to cleanup container:`, error);
      }

      this.containerId = undefined;
    }
  }
}
