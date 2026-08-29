import type { IncomingMessage, ServerResponse } from "node:http";
import { bearerFromNodeAuthorization, EnterpriseWorkloadAuthError, verifyDevBotWorkloadToken } from "../security/enterprise-workload-auth";

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

export async function handleEnterpriseAccessProbe(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const requiredScope = path === "/internal/access/probe"
    ? "tolani.service.discover"
    : path === "/internal/api/probe"
      ? "devbot.api.invoke"
      : path === "/internal/mcp/probe"
        ? "devbot.mcp.invoke"
        : null;
  if (!requiredScope) return false;

  if (process.env.TOLANI_INTERNAL_ACCESS_ENABLED !== "true") {
    json(res, 503, { error: "internal_access_disabled" });
    return true;
  }
  const pemPublicKey = process.env.TOLANI_CLERK_JWT_KEY;
  const expectedIssuer = process.env.TOLANI_CLERK_ISSUER;
  const expectedEnvironment = process.env.TOLANI_RUNTIME_ENV;
  if (!pemPublicKey || !expectedIssuer || !expectedEnvironment) {
    json(res, 503, { error: "internal_identity_not_configured" });
    return true;
  }

  try {
    const token = bearerFromNodeAuthorization(req.headers.authorization);
    const principal = await verifyDevBotWorkloadToken(token, {
      pemPublicKey,
      expectedIssuer,
      expectedAudience: `tolani:devbot:${expectedEnvironment}`,
      expectedEnvironment,
      requiredScope,
    });
    json(res, 200, {
      service: "devbot",
      interface: requiredScope === "tolani.service.discover" ? "discovery" : requiredScope.includes("mcp") ? "mcp" : "api",
      callerServiceId: principal.serviceId,
      accessClass: "tolani-internal",
      billingExempt: true,
      authorized: true,
    });
  } catch (error) {
    const authError = error instanceof EnterpriseWorkloadAuthError
      ? error
      : new EnterpriseWorkloadAuthError("workload_verification_failed", 500);
    json(res, authError.status === 500 ? 503 : authError.status, { error: authError.code });
  }
  return true;
}
