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

export async function GET(request: NextRequest) {
  const data = await getDashboardData();
  const section = request.nextUrl.searchParams.get("section");

  if (!section) {
    return NextResponse.json(data);
  }

  if (!sections.has(section as keyof DashboardData)) {
    return NextResponse.json({ error: "unknown_section" }, { status: 404 });
  }

  return NextResponse.json({
    section,
    data: getSection(data, section as keyof DashboardData),
    generatedAt: data.generatedAt,
  });
}
