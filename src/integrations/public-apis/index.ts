/**
 * Public APIs — Barrel Export for DevBot
 * Free public API integrations for bot personality enrichment.
 * Source: https://github.com/public-apis/public-apis
 */

// Jokes (JokeAPI)
export {
    getRandomJoke,
    getProgrammingJoke,
    formatJoke,
} from "./jokes.js";
export type { Joke, JokeCategory } from "./jokes.js";

// Quotes (Quotable + Advice Slip)
export {
    getQuotableQuote,
    getAdvice,
    getRandomQuote,
    getTechQuote,
    formatQuote,
} from "./quotes.js";
export type { Quote } from "./quotes.js";

// Fun Facts (Useless Facts + Numbers API)
export {
    getRandomUselessFact,
    getNumberFact,
    getTodayFact,
    getDevFact,
    getRandomFact,
    formatFact,
} from "./facts.js";
export type { FunFact } from "./facts.js";
