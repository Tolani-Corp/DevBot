import type { MentionCommand } from "@/services/mention-parser";

type PickRecord = {
  bot?: string;
  botIcon?: string;
  event?: string;
  sport?: string;
  pick?: string;
  odds?: number;
  confidence?: number;
  detectedAt?: string;
  [key: string]: unknown;
};

function normalizeBaseUrl(raw: string | undefined, fallback: string): string {
  const value = (raw ?? "").trim();
  if (!value) {
    return fallback;
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/$/, "");
  }

  return `https://${value.replace(/\/$/, "")}`;
}

const DEFAULT_GAMECADE_BASE = normalizeBaseUrl(
  process.env.GAMECADE_API_BASE_URL,
  "https://api.gamecade.win",
);
const DEFAULT_LINE_MD_BASE = normalizeBaseUrl(
  process.env.LINE_MD_API_BASE_URL,
  "https://api.linemd.dev",
);
const DEFAULT_BETTORSACE_API = normalizeBaseUrl(
  process.env.BETTORSACE_API_BASE_URL,
  "https://api.bettorsace.win",
);

if (DEFAULT_LINE_MD_BASE === "https://linemd.dev" || DEFAULT_LINE_MD_BASE === "http://linemd.dev") {
  console.warn("[live-mentions] LINE_MD_API_BASE_URL points to linemd.dev (landing page). Use https://api.linemd.dev instead.");
}

if (DEFAULT_GAMECADE_BASE === "https://gamecade.win" || DEFAULT_GAMECADE_BASE === "http://gamecade.win") {
  console.warn("[live-mentions] GAMECADE_API_BASE_URL points to gamecade.win (landing page). Use https://api.gamecade.win instead.");
}

if (DEFAULT_BETTORSACE_API === "https://bettorsace.win" || DEFAULT_BETTORSACE_API === "http://bettorsace.win") {
  console.warn("[live-mentions] BETTORSACE_API_BASE_URL points to bettorsace.win (landing page). Use https://api.bettorsace.win instead.");
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

function normalizePicks(payload: any): PickRecord[] {
  if (Array.isArray(payload)) {
    return payload as PickRecord[];
  }

  if (payload && Array.isArray(payload.picks)) {
    return payload.picks as PickRecord[];
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data as PickRecord[];
  }

  return [];
}

function mapRiskFilter(filter: string | undefined): (pick: PickRecord) => boolean {
  const key = (filter ?? "").toLowerCase();

  if (key === "risky") {
    return (pick) => (pick.confidence ?? 0) < 65;
  }

  if (key === "open") {
    return () => true;
  }

  if (key === "high") {
    return (pick) => (pick.confidence ?? 0) >= 80;
  }

  if (key === "medium") {
    return (pick) => {
      const confidence = pick.confidence ?? 0;
      return confidence >= 60 && confidence < 80;
    };
  }

  if (key === "low") {
    return (pick) => (pick.confidence ?? 0) < 60;
  }

  return () => true;
}

function formatPickLine(pick: PickRecord): string {
  const event = pick.event ?? "Unknown event";
  const side = pick.pick ?? "N/A";
  const odds = typeof pick.odds === "number" ? `${pick.odds > 0 ? "+" : ""}${pick.odds}` : "N/A";
  const confidence = typeof pick.confidence === "number" ? `${pick.confidence}%` : "N/A";
  return `• ${event} | ${side} | odds ${odds} | conf ${confidence}`;
}

async function fetchPicks(limit = 50): Promise<PickRecord[]> {
  const candidates = [
    `${DEFAULT_GAMECADE_BASE}/api/v1/picks?limit=${limit}`,
    `${DEFAULT_LINE_MD_BASE}/api/v1/picks?limit=${limit}`,
    `${DEFAULT_BETTORSACE_API}/api/v1/picks?limit=${limit}`,
  ];

  for (const url of candidates) {
    try {
      const payload = await fetchJson(url);
      const picks = normalizePicks(payload);
      if (picks.length > 0) {
        return picks;
      }
    } catch {
    }
  }

  throw new Error("Could not fetch picks from any configured source");
}

function filterByDate(picks: PickRecord[], dateIso?: string): PickRecord[] {
  if (!dateIso) {
    return picks;
  }

  return picks.filter((pick) => {
    if (!pick.detectedAt) return false;
    return pick.detectedAt.slice(0, 10) === dateIso;
  });
}

async function executeAgentOrRiskPicks(command: MentionCommand): Promise<string> {
  const picks = await fetchPicks(100);
  const agentHandle = command.agentHandle ?? command.botName;
  const byAgent = agentHandle
    ? picks.filter((pick) => (pick.bot ?? "").toLowerCase().includes(agentHandle.toLowerCase()))
    : picks;

  const riskFilter = mapRiskFilter(command.picksFilter ?? command.risk ?? "open");
  const byRisk = byAgent.filter(riskFilter);
  const byDate = filterByDate(byRisk, command.dateIso);

  const final = byDate.slice(0, 8);
  if (final.length === 0) {
    return "No live picks matched your filters right now.";
  }

  const headerParts = ["📊 Live picks"]; 
  if (agentHandle) headerParts.push(`agent=@${agentHandle}`);
  if (command.picksFilter ?? command.risk) headerParts.push(`filter=${command.picksFilter ?? command.risk}`);
  if (command.dateIso) headerParts.push(`date=${command.dateIso}`);

  return `${headerParts.join(" | ")}\n${final.map(formatPickLine).join("\n")}`;
}

async function executeWeatherPick(command: MentionCommand): Promise<string> {
  const pickId = command.pickId;
  if (!pickId) {
    return "Weather request is missing a pick ID.";
  }

  const candidates = [
    `${DEFAULT_BETTORSACE_API}/api/v1/picks/${pickId}/weather`,
    `${DEFAULT_LINE_MD_BASE}/api/v1/picks/${pickId}/weather`,
    `${DEFAULT_GAMECADE_BASE}/api/v1/picks/${pickId}/weather`,
  ];

  for (const url of candidates) {
    try {
      const payload = await fetchJson(url);
      const summary = payload?.summary ?? payload?.weather ?? payload?.data?.summary;
      const alert = payload?.alert ?? payload?.data?.alert;
      const source = payload?.source ?? new URL(url).host;

      if (summary) {
        const alertLine = alert ? `\n🚨 Alert: ${typeof alert === "string" ? alert : JSON.stringify(alert)}` : "";
        return `🌤️ Live weather for pick #${pickId}: ${summary}${alertLine}\nSource: ${source}`;
      }
    } catch {
    }
  }

  return `No live weather data endpoint returned results for pick #${pickId}.`;
}

export async function executeLiveMentionCommand(command: MentionCommand): Promise<string | null> {
  switch (command.kind) {
    case "weather_pick":
      return executeWeatherPick(command);

    case "picks_bot":
    case "agent_picks":
    case "risk_picks_date":
      return executeAgentOrRiskPicks(command);

    default:
      return null;
  }
}
