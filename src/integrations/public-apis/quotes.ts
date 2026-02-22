/**
 * Quotes Integration for DevBot
 * Uses multiple free APIs for motivational/inspirational quotes.
 * - Quotable: https://github.com/lukePeavey/quotable — no auth, HTTPS
 * - Advice Slip: https://api.adviceslip.com — no auth, HTTPS
 */

// ─── Types ────────────────────────────────────────────────────

export interface Quote {
    text: string;
    author: string;
    source: "quotable" | "adviceslip";
    tags?: string[];
}

// ─── Quotable API ─────────────────────────────────────────────

interface QuotableResponse {
    _id: string;
    content: string;
    author: string;
    tags: string[];
    length: number;
}

/**
 * Get a random quote from Quotable.
 * @param tags - Filter by tags, e.g. "technology", "inspirational"
 */
export async function getQuotableQuote(tags?: string[]): Promise<Quote> {
    const url = new URL("https://api.quotable.io/random");
    if (tags?.length) url.searchParams.set("tags", tags.join(","));

    const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`Quotable ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as QuotableResponse;

    return {
        text: data.content,
        author: data.author,
        source: "quotable",
        tags: data.tags,
    };
}

// ─── Advice Slip API ──────────────────────────────────────────

interface AdviceSlipResponse {
    slip: {
        id: number;
        advice: string;
    };
}

/**
 * Get random advice from Advice Slip API.
 */
export async function getAdvice(): Promise<Quote> {
    const res = await fetch("https://api.adviceslip.com/advice", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`AdviceSlip ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as AdviceSlipResponse;

    return {
        text: data.slip.advice,
        author: "Advice Slip",
        source: "adviceslip",
    };
}

// ─── Unified Random Quote ─────────────────────────────────────

/**
 * Get a random quote from any available source.
 * Falls back to Advice Slip if Quotable is unavailable.
 */
export async function getRandomQuote(): Promise<Quote> {
    try {
        return await getQuotableQuote();
    } catch {
        return await getAdvice();
    }
}

/**
 * Get a tech/programming-themed quote.
 */
export async function getTechQuote(): Promise<Quote> {
    return getQuotableQuote(["technology"]);
}

/**
 * Format a quote for display in chat.
 */
export function formatQuote(quote: Quote): string {
    return `"${quote.text}" — ${quote.author}`;
}
