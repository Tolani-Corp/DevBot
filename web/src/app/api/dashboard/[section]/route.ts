import { NextResponse, type NextRequest } from "next/server";
import {
  getDashboardData,
  getSection,
  type DashboardData,
} from "@/lib/dashboard-data";

const sections = new Set<keyof DashboardData>([
  "overview",
  "tasks",
  "agents",
  "deployments",
  "evidence",
  "learning",
  "settings",
  "profile",
]);

type RouteContext = {
  params: Promise<{
    section: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { section } = await context.params;

  if (!sections.has(section as keyof DashboardData)) {
    return NextResponse.json({ error: "unknown_section" }, { status: 404 });
  }

  const data = await getDashboardData();
  return NextResponse.json({
    section,
    data: getSection(data, section as keyof DashboardData),
    generatedAt: data.generatedAt,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { section } = await context.params;

  if (section !== "tasks") {
    return NextResponse.json(
      { error: "unsupported_action", allowed: ["POST /api/dashboard/tasks"] },
      { status: 405 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    owner?: string;
    risk?: "low" | "medium" | "high";
  };
  const title = body.title?.trim() || body.description?.trim();

  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  return NextResponse.json(
    {
      accepted: true,
      task: {
        id: `draft-${Date.now()}`,
        title,
        lane: "DEBO Core",
        status: "ready",
        risk: body.risk ?? "medium",
        owner: body.owner?.trim() || "debo-operator",
        progress: 0,
        nextAction:
          "Review scope, approval owner, and evidence requirements before dispatch.",
      },
    },
    { status: 202 },
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { section } = await context.params;

  if (section !== "settings") {
    return NextResponse.json(
      { error: "unsupported_action", allowed: ["PATCH /api/dashboard/settings"] },
      { status: 405 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const allowedKeys = new Set([
    "approvalMode",
    "claimIntegrity",
    "memoryPolicy",
    "unchainedMode",
  ]);
  const accepted = Object.keys(body).filter((key) => allowedKeys.has(key));

  return NextResponse.json({
    accepted: accepted.length > 0,
    acceptedKeys: accepted,
    message:
      accepted.length > 0
        ? "Settings change staged for operator review."
        : "No supported settings keys were supplied.",
  });
}
