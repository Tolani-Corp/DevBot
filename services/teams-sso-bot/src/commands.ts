export type TeamsCommand =
  | { type: "help" }
  | { type: "show" }
  | { type: "status" }
  | { type: "logout" }
  | { type: "task"; description: string; repository?: string };

const taskPrefixes = ["task", "new task", "create task", "devbot"];

export function normalizeTeamsText(input: string | undefined): string {
  return (input ?? "")
    .replace(/\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTeamsCommand(input: string | undefined): TeamsCommand {
  const text = normalizeTeamsText(input);
  const lower = text.toLowerCase();

  if (!lower || lower === "help" || lower === "?") {
    return { type: "help" };
  }

  if (lower === "show" || lower === "profile" || lower === "whoami") {
    return { type: "show" };
  }

  if (lower === "status" || lower === "health") {
    return { type: "status" };
  }

  if (lower === "logout" || lower === "sign out" || lower === "signout") {
    return { type: "logout" };
  }

  for (const prefix of taskPrefixes) {
    if (lower === prefix) {
      return { type: "help" };
    }

    if (lower.startsWith(`${prefix} `)) {
      const rawDescription = text.slice(prefix.length).trim();
      const { description, repository } = parseTaskDescription(rawDescription);
      if (!description) {
        return { type: "help" };
      }
      return { type: "task", description, repository };
    }
  }

  return { type: "task", description: text };
}

function parseTaskDescription(rawDescription: string): {
  description: string;
  repository?: string;
} {
  const repoMatch = rawDescription.match(/\s+repo:([A-Za-z0-9_.\/-]+)\s*$/);
  if (!repoMatch) {
    return { description: rawDescription.trim() };
  }

  return {
    description: rawDescription.slice(0, repoMatch.index).trim(),
    repository: repoMatch[1],
  };
}
