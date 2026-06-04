import type { IncomingMessage, ServerResponse } from "node:http";

import { computeAgentROI } from "@/services/agent-roi";
import { grantWatchAgent, runGrantWatchCycle, type GrantWatchRunInput } from "@/agents/grant-watch";
import { approveTask, rejectTask, teachTask } from "@/services/approval";
import {
  deployConvoy,
  dispatchTask,
  forgetMemory,
  getJourney,
  getPendingApprovalsDetailed,
  getOperatorTrust,
  getTask,
  getWorkspacePolicySnapshot,
  listJourneys,
  queryMemory,
  runJourneyMaintenance,
  runReflectionGeneration,
  startJourney,
  updateWorkspacePolicy,
} from "@/services/journey-memory";

async function readBody(req: IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function notFound(res: ServerResponse) {
  sendJson(res, 404, { error: "not_found" });
}

function badRequest(res: ServerResponse, message: string) {
  sendJson(res, 400, { error: message });
}

function approvalModeToApi(mode: "strict" | "balanced" | "auto_low_risk") {
  if (mode === "strict") {
    return "strict";
  }
  if (mode === "auto_low_risk") {
    return "auto-low-risk";
  }
  return "review";
}

function formatPolicyResponse(snapshot: Awaited<ReturnType<typeof getWorkspacePolicySnapshot>>) {
  return {
    workspaceId: snapshot.workspaceId,
    approvalMode: approvalModeToApi(snapshot.approvalPolicy.mode),
    memoryRetentionDays: snapshot.memoryPolicy.retentionDays ?? 30,
    trustMode: snapshot.trustMode,
    requireHumanApprovalForUnchained: snapshot.requireHumanApprovalForUnchained,
    offensiveOperations: snapshot.offensiveOperations,
    overageHandling: snapshot.overageHandling,
    updatedAt: new Date(),
  };
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const rawPath = url.pathname;
  const path = rawPath
    .replace(/^\/api\/control-plane\//, "/api/")
    .replace(/^\/api\/ops\//, "/api/");
  const method = req.method ?? "GET";

  if (!rawPath.startsWith("/api/")) {
    return false;
  }

  try {
    if (method === "POST" && path === "/api/tasks") {
      const body = await readJson<{ description?: string; repository?: string }>(req);
      if (!body.description?.trim()) {
        badRequest(res, "description is required");
        return true;
      }
      sendJson(res, 200, await dispatchTask(body.description, body.repository));
      return true;
    }

    if (method === "GET" && path.startsWith("/api/tasks/")) {
      const taskId = path.replace("/api/tasks/", "");
      const task = await getTask(taskId);
      if (!task) {
        notFound(res);
        return true;
      }
      sendJson(res, 200, {
        taskId: task.id,
        status: task.status,
        progress: task.progress,
        result: task.aiResponse ?? task.error ?? null,
        filesChanged: task.filesChanged ?? [],
        repository: task.repository ?? null,
      });
      return true;
    }

    if (method === "POST" && path === "/api/convoy") {
      const body = await readJson<{ description?: string }>(req);
      if (!body.description?.trim()) {
        badRequest(res, "description is required");
        return true;
      }
      sendJson(res, 200, await deployConvoy(body.description));
      return true;
    }

    if (method === "GET" && path === "/api/roi") {
      const days = Number(url.searchParams.get("days") ?? "30");
      const report = await computeAgentROI(Number.isFinite(days) ? days : 30);
      sendJson(res, 200, {
        totalTasks: report.totalTasks,
        completedTasks: report.completedTasks,
        completionRate: report.completionRate,
        timeSavedHours: report.estimatedTimeSavedHours,
        valueDeliveredUSD: report.estimatedValueDeliveredUSD,
        apiCostUSD: report.estimatedApiCostUSD,
        roiMultiplier: report.roiMultiplier,
        netValueUSD: report.netValueUSD,
        nattFindingsCount: report.nattFindingsCount,
        breachCostPreventedUSD: report.estimatedBreachCostPreventedUSD,
        agentScores: report.agentScores.map((score) => ({
          role: score.role,
          successRate: score.estimatedSuccessRate,
          total: score.totalAttempts,
        })),
      });
      return true;
    }

    if (method === "POST" && path === "/api/health-scan") {
      const body = await readJson<{ repository?: string }>(req);
      const repository = body.repository?.trim();
      if (!repository) {
        badRequest(res, "repository is required");
        return true;
      }

      try {
        const { scanRepository } = await import("./health-scanner.js");
        const report = await scanRepository({ repository, maxFiles: 20 });
        const flattened = report.categories.flatMap((category) =>
          category.issues.map((issue) => ({
            severity: issue.severity,
            description: `${issue.title}: ${issue.description}`,
            file: issue.file,
          })),
        );
        sendJson(res, 200, {
          score: report.overallScore,
          critical: report.criticalIssues.filter((issue) => issue.severity === "critical").length,
          high: flattened.filter((issue) => issue.severity === "high").length,
          medium: flattened.filter((issue) => issue.severity === "medium").length,
          low: flattened.filter((issue) => issue.severity === "low").length,
          issues: flattened.slice(0, 12),
        });
      } catch (error) {
        sendJson(res, 200, {
          score: 70,
          critical: 0,
          high: 0,
          medium: 1,
          low: 0,
          issues: [{
            severity: "medium",
            description: `Fallback health scan for ${repository}: ${error instanceof Error ? error.message : "scanner unavailable"}`,
          }],
        });
      }
      return true;
    }

    if (method === "GET" && path === "/api/funding/grant-watch") {
      sendJson(res, 200, {
        agent: grantWatchAgent,
      });
      return true;
    }

    if (method === "POST" && path === "/api/funding/grant-watch") {
      const body = await readJson<GrantWatchRunInput>(req);
      sendJson(res, 200, runGrantWatchCycle(body));
      return true;
    }

    if (method === "POST" && path === "/api/journeys/start") {
      const body = await readJson<{
        workspaceId?: string;
        userId?: string;
        platformType?: string;
        channelId?: string;
        threadId?: string;
        repository?: string;
        taskId?: string;
        goal?: string;
        currentStage?: "intake" | "planning" | "execution" | "review" | "reflection" | "handoff";
        preferredWorkflow?: string;
        activeRisks?: string[];
        nextRecommendedAction?: string;
        metadata?: Record<string, unknown>;
      }>(req);

      if (!body.goal?.trim()) {
        badRequest(res, "goal is required");
        return true;
      }

      sendJson(res, 200, await startJourney({
        workspaceId: body.workspaceId,
        userId: body.userId,
        platformType: body.platformType,
        channelId: body.channelId,
        threadId: body.threadId,
        repository: body.repository,
        taskId: body.taskId,
        goal: body.goal,
        currentStage: body.currentStage,
        preferredWorkflow: body.preferredWorkflow,
        activeRisks: body.activeRisks,
        nextRecommendedAction: body.nextRecommendedAction,
        metadata: body.metadata,
      }));
      return true;
    }

    if (method === "GET" && path === "/api/journeys") {
      const journeys = (await listJourneys(url.searchParams.get("workspaceId") ?? undefined)).map((journey) => ({
        id: journey.id,
        name: journey.goal,
        title: journey.goal,
        summary: journey.memorySummary ?? journey.goal,
        status: journey.status === "active" ? "running" : journey.status,
        lane: journey.platformType === "operator" ? "delivery" : "memory",
        risk: journey.activeRisks.length > 1 ? "high" : journey.activeRisks.length === 1 ? "medium" : "low",
        progress: journey.status === "completed" ? 100 : journey.currentStage === "review" ? 80 : journey.currentStage === "execution" ? 55 : 20,
        owner: journey.userId ?? "operator",
        currentStage: journey.currentStage,
        createdAt: journey.createdAt,
        updatedAt: journey.updatedAt,
        tags: [journey.platformType, ...(journey.activeRisks ?? [])],
        steps: [],
      }));
      sendJson(res, 200, { journeys });
      return true;
    }

    const journeyReflectMatch = method === "POST" ? path.match(/^\/api\/journeys\/([^/]+)\/reflect$/) : null;
    if (journeyReflectMatch) {
      sendJson(res, 200, await runReflectionGeneration(journeyReflectMatch[1]!));
      return true;
    }

    const journeyMatch = method === "GET" ? path.match(/^\/api\/journeys\/([^/]+)$/) : null;
    if (journeyMatch) {
      const journey = await getJourney(journeyMatch[1]!);
      if (!journey) {
        notFound(res);
        return true;
      }
      sendJson(res, 200, {
        id: journey.id,
        name: journey.goal,
        title: journey.goal,
        summary: journey.memorySummary ?? journey.goal,
        status: journey.status === "active" ? "running" : journey.status,
        lane: journey.platformType === "operator" ? "delivery" : "memory",
        risk: journey.activeRisks.length > 1 ? "high" : journey.activeRisks.length === 1 ? "medium" : "low",
        progress: journey.status === "completed" ? 100 : journey.currentStage === "review" ? 80 : journey.currentStage === "execution" ? 55 : 20,
        owner: journey.userId ?? "operator",
        currentStage: journey.currentStage,
        createdAt: journey.createdAt,
        updatedAt: journey.updatedAt,
        tags: [journey.platformType, ...(journey.activeRisks ?? [])],
        steps: [],
      });
      return true;
    }

    if (
      (method === "POST" && (path === "/api/memory/query" || path === "/api/memory/search"))
      || (method === "GET" && path === "/api/memory/search")
    ) {
      const body = method === "GET"
        ? {
            workspaceId: url.searchParams.get("workspaceId") ?? undefined,
            queryText: url.searchParams.get("q") ?? undefined,
            limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
          }
        : await readJson<{ workspaceId?: string; queryText?: string; query?: string; limit?: number }>(req);
      const queryText = body.queryText ?? body.query;
      if (!queryText?.trim()) {
        badRequest(res, "queryText is required");
        return true;
      }
      sendJson(res, 200, {
        results: (await queryMemory({
          workspaceId: body.workspaceId,
          queryText,
          limit: body.limit,
        })).map((result) => ({
          ...result,
          score: result.confidence,
          source: result.type,
          scope: result.type === "journey" ? "session" : result.type === "pattern" ? "org" : "repo",
        })),
      });
      return true;
    }

    if (method === "POST" && path === "/api/memory/forget") {
      const body = await readJson<{ workspaceId?: string; journeyId?: string; target?: string; reason?: string }>(req);
      const result = await forgetMemory({
        workspaceId: body.workspaceId ?? (body.target?.startsWith("workspace:") ? body.target.slice("workspace:".length) : undefined),
        journeyId: body.journeyId ?? (body.target?.startsWith("journey:") ? body.target.slice("journey:".length) : undefined),
        reason: body.reason,
      });
      sendJson(res, 200, {
        target: body.target ?? body.journeyId ?? body.workspaceId ?? "memory",
        forgotten: result.deletedEvents,
        message: result.updatedJourneys > 0 ? "Journey summaries cleared." : "Memory events removed.",
      });
      return true;
    }

    const deleteMemoryMatch = method === "DELETE" ? path.match(/^\/api\/memory\/([^/]+)$/) : null;
    if (deleteMemoryMatch) {
      const target = decodeURIComponent(deleteMemoryMatch[1]!);
      const result = await forgetMemory({
        workspaceId: target.startsWith("workspace:") ? target.slice("workspace:".length) : undefined,
        journeyId: target.startsWith("journey:") ? target.slice("journey:".length) : undefined,
      });
      sendJson(res, 200, {
        target,
        forgotten: result.deletedEvents,
        message: result.updatedJourneys > 0 ? "Journey summaries cleared." : "Memory events removed.",
      });
      return true;
    }

    if (
      (method === "POST" && path === "/api/policy/update")
      || (method === "PATCH" && path === "/api/policy")
      || (method === "POST" && path === "/api/policy")
    ) {
      const body = await readJson<{
        workspaceId?: string;
        memoryPolicy?: Record<string, unknown>;
        approvalPolicy?: Record<string, unknown>;
        consentVersion?: string;
        consentCapturedAt?: string;
        toneProfile?: Record<string, unknown>;
        autoApproveDocs?: boolean;
        autoApproveTests?: boolean;
        approvalMode?: "strict" | "review" | "auto-low-risk";
        memoryRetentionDays?: number;
        trustMode?: "guarded" | "balanced" | "delegated";
        requireHumanApprovalForUnchained?: boolean;
        offensiveOperations?: "disabled" | "reviewed" | "enabled";
        overageHandling?: "manual" | "preapproved";
      }>(req);
      const updatedWorkspace = await updateWorkspacePolicy({
        workspaceId: body.workspaceId,
        memoryPolicy: {
          ...(body.memoryPolicy as Record<string, unknown> | undefined),
          retentionDays: body.memoryRetentionDays ?? (body.memoryPolicy as { retentionDays?: number } | undefined)?.retentionDays,
        } as never,
        approvalPolicy: {
          ...(body.approvalPolicy as Record<string, unknown> | undefined),
          mode:
            body.approvalMode === "strict"
              ? "strict"
              : body.approvalMode === "auto-low-risk"
                ? "auto_low_risk"
                : body.approvalMode === "review"
                  ? "balanced"
                  : (body.approvalPolicy as { mode?: "strict" | "balanced" | "auto_low_risk" } | undefined)?.mode,
        } as never,
        consentVersion: body.consentVersion,
        consentCapturedAt: body.consentCapturedAt,
        toneProfile: body.toneProfile as never,
        autoApproveDocs: body.autoApproveDocs,
        autoApproveTests: body.autoApproveTests,
        trustMode: body.trustMode,
        requireHumanApprovalForUnchained: body.requireHumanApprovalForUnchained,
        offensiveOperations: body.offensiveOperations,
        overageHandling: body.overageHandling,
      });
      sendJson(res, 200, formatPolicyResponse(await getWorkspacePolicySnapshot(updatedWorkspace.id)));
      return true;
    }

    if (method === "GET" && (path === "/api/operator/trust" || path === "/api/trust")) {
      const trust = await getOperatorTrust(url.searchParams.get("workspaceId") ?? undefined);
      sendJson(res, 200, {
        score: Math.max(0, Math.min(100, 100 - trust.pendingApprovals * 5 - trust.lowConfidenceMemories)),
        posture: trust.autoApprovalRate > 0.35 ? "balanced" : "guarded",
        approvalsOpen: trust.pendingApprovals,
        memoryCoverage: Math.max(0, Math.min(100, trust.memoryWrites * 10)),
        lastReviewAt: new Date(),
        notes: [
          "Human review remains the default for high-risk and offensive work.",
          `Governed workspaces: ${trust.governedWorkspaces}. DEBO Unchained readiness: ${trust.unchainedReady ? "ready" : "reviewed only"}.`,
        ],
        lanes: [
          {
            key: "debo_core",
            name: "DEBO Core",
            audience: "delivery and engineering operators",
            positioning: "control plane for journeys, approvals, and persistent operator memory",
            status: "active",
            summary: "Primary operator lane for governed engineering execution.",
          },
          {
            key: "debo_unchained",
            name: "DEBO Unchained",
            audience: "enterprise security and offensive teams",
            positioning: "offensive hack-team package for authorized engagements",
            status: trust.unchainedReady ? "active" : "pilot",
            summary: "Reserved lane for NATT-led offensive operations with human review.",
          },
        ],
      });
      return true;
    }

    if (method === "GET" && path === "/api/approvals") {
      sendJson(res, 200, {
        approvals: await getPendingApprovalsDetailed(),
      });
      return true;
    }

    const approveMatch = method === "POST" ? path.match(/^\/api\/approvals\/([^/]+)\/approve$/) : null;
    if (approveMatch) {
      const body = await readJson<{ approvedBy?: string; reason?: string; note?: string }>(req);
      sendJson(res, 200, await approveTask(
        approveMatch[1]!,
        body.approvedBy ?? "debo-operator",
        body.reason ?? body.note,
      ));
      return true;
    }

    const rejectMatch = method === "POST" ? path.match(/^\/api\/approvals\/([^/]+)\/reject$/) : null;
    if (rejectMatch) {
      const body = await readJson<{ rejectedBy?: string; reason?: string; note?: string }>(req);
      const reason = body.reason ?? body.note;
      if (!reason?.trim()) {
        badRequest(res, "reason is required");
        return true;
      }
      sendJson(res, 200, await rejectTask(
        rejectMatch[1]!,
        body.rejectedBy ?? "debo-operator",
        reason,
      ));
      return true;
    }

    const teachMatch = method === "POST" ? path.match(/^\/api\/approvals\/([^/]+)\/teach$/) : null;
    if (teachMatch) {
      const body = await readJson<{ taughtBy?: string; lesson?: string; note?: string; reason?: string }>(req);
      const lesson = body.lesson ?? body.note ?? body.reason;
      if (!lesson?.trim()) {
        badRequest(res, "lesson is required");
        return true;
      }
      sendJson(res, 200, await teachTask(
        teachMatch[1]!,
        body.taughtBy ?? "debo-operator",
        lesson,
      ));
      return true;
    }

    if (method === "GET" && (path === "/api/policy/show" || path === "/api/policy")) {
      const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
      const snapshot = await getWorkspacePolicySnapshot(workspaceId);
      sendJson(res, 200, formatPolicyResponse(snapshot));
      return true;
    }

    if (method === "POST" && path === "/api/journeys/maintenance") {
      sendJson(res, 200, await runJourneyMaintenance());
      return true;
    }

    notFound(res);
    return true;
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "internal_server_error",
    });
    return true;
  }
}
