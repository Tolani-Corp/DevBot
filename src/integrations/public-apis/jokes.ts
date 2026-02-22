/**
 * JokeAPI Integration for DevBot
 * https://jokeapi.dev/ — Free, no auth, HTTPS, CORS
 * Programming jokes to inject personality into bot responses.
 */

const JOKEAPI_BASE = "https://v2.jokeapi.dev";

// ─── Types ────────────────────────────────────────────────────

export interface Joke {
    type: "single" | "twopart";
    joke?: string;        // single-type
    setup?: string;       // twopart
    delivery?: string;    // twopart
    category: string;
    lang: string;
    id: number;
}

export type JokeCategory =
    | "Programming"
    | "Misc"
    | "Dark"
    | "Pun"
    | "Spooky"
    | "Christmas";

// ─── Core ─────────────────────────────────────────────────────

/**
 * Get a random joke.
 * @param categories - Joke categories to include (default: Programming, Pun)
 * @param blacklistFlags - Content to exclude (e.g. "nsfw", "racist", "sexist")
 */
export async function getRandomJoke(
    categories: JokeCategory[] = ["Programming", "Pun"],
    blacklistFlags: string[] = ["nsfw", "racist", "sexist", "explicit"],
): Promise<Joke> {
    const cats = categories.join(",");
    const flags = blacklistFlags.join(",");
    const url = `${JOKEAPI_BASE}/joke/${cats}?blacklistFlags=${flags}&type=single,twopart`;

    const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`JokeAPI ${res.status}: ${res.statusText}`);
    return res.json() as Promise<Joke>;
}

/**
 * Get a programming-specific joke.
 */
export async function getProgrammingJoke(): Promise<Joke> {
    return getRandomJoke(["Programming"]);
}

/**
 * Format a joke for display in chat.
 */
export function formatJoke(joke: Joke): string {
    if (joke.type === "single") {
        return joke.joke ?? "";
    }
    return `${joke.setup}\n\n${joke.delivery}`;
}
