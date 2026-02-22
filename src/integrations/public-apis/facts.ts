/**
 * Fun Facts Integration for DevBot
 * Uses free APIs for trivia and fun facts in bot responses.
 * - uselessfacts.jsph.pl — no auth, HTTPS
 * - numbersapi.com — no auth, HTTPS (text-only)
 */

// ─── Types ────────────────────────────────────────────────────

export interface FunFact {
    text: string;
    source: "uselessfacts" | "numbersapi" | "github";
}

// ─── Useless Facts ────────────────────────────────────────────

interface UselessFactResponse {
    id: string;
    text: string;
    source: string;
    source_url: string;
    language: string;
}

/**
 * Get a random useless fact.
 */
export async function getRandomUselessFact(): Promise<FunFact> {
    const res = await fetch(
        "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en",
        {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8_000),
        },
    );
    if (!res.ok) throw new Error(`UselessFacts ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as UselessFactResponse;

    return {
        text: data.text,
        source: "uselessfacts",
    };
}

// ─── Numbers API ──────────────────────────────────────────────

/**
 * Get a random number trivia fact.
 */
export async function getNumberFact(number?: number): Promise<FunFact> {
    const n = number ?? "random";
    const res = await fetch(`http://numbersapi.com/${n}/trivia`, {
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`NumbersAPI ${res.status}: ${res.statusText}`);
    const text = await res.text();

    return { text, source: "numbersapi" };
}

/**
 * Get a fact about today's date.
 */
export async function getTodayFact(): Promise<FunFact> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const res = await fetch(`http://numbersapi.com/${month}/${day}/date`, {
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`NumbersAPI ${res.status}: ${res.statusText}`);
    const text = await res.text();

    return { text, source: "numbersapi" };
}

// ─── GitHub Random (Dev Facts) ────────────────────────────────

/** Curated dev/programming fun facts as fallback */
const DEV_FACTS: string[] = [
    "The first computer bug was an actual moth found in a Harvard Mark II in 1947.",
    "Git was created by Linus Torvalds in just 10 days.",
    "The first computer programmer was Ada Lovelace, who wrote algorithms for Charles Babbage's Analytical Engine in 1843.",
    "JavaScript was created in 10 days by Brendan Eich in 1995.",
    "The term 'debugging' was popularized by Grace Hopper.",
    "The average developer writes about 10-50 lines of production code per day.",
    "There are approximately 700 programming languages in existence.",
    "The first website ever created is still online: http://info.cern.ch",
    "Python was named after Monty Python, not the snake.",
    "The first computer virus was created in 1986 and was called Brain.",
    "NASA's Apollo 11 computer had 74KB of memory — less than a modern calculator.",
    "TypeScript was publicly released in October 2012 by Microsoft.",
    "The first 1GB hard drive, introduced in 1980, weighed about 550 pounds.",
    "Stack Overflow was launched on September 15, 2008.",
    "The term 'open source' was coined in 1998.",
];

/**
 * Get a random dev/programming fun fact (offline fallback).
 */
export function getDevFact(): FunFact {
    const text = DEV_FACTS[Math.floor(Math.random() * DEV_FACTS.length)]!;
    return { text, source: "github" };
}

// ─── Unified Random Fact ──────────────────────────────────────

/**
 * Get a random fun fact from any available source.
 * Falls back to curated dev facts if APIs are unavailable.
 */
export async function getRandomFact(): Promise<FunFact> {
    try {
        // 50/50 between useless facts and number facts
        if (Math.random() > 0.5) {
            return await getRandomUselessFact();
        }
        return await getNumberFact();
    } catch {
        return getDevFact();
    }
}

/**
 * Format a fact for display in chat.
 */
export function formatFact(fact: FunFact): string {
    return `💡 ${fact.text}`;
}
