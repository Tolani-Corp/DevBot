import {
  DEFAULT_ACCESS_RESILIENCE_POLICY,
  PROHIBITED_ACCESS_TECHNIQUES,
} from "../web-acquisition-policy.js";

export async function handle() {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            schema: "devbot.natt.web-acquisition-prohibitions.v1",
            prohibitedTechniques: PROHIBITED_ACCESS_TECHNIQUES,
            mandatoryStopConditions: [
              "captcha-detected",
              "authentication-challenge-detected",
              "robots-denial",
              "explicit-access-block",
              "request-budget-exhausted",
              "cost-budget-exhausted",
              "circuit-breaker-open",
            ],
            defaultPolicy: DEFAULT_ACCESS_RESILIENCE_POLICY,
          },
          null,
          2,
        ),
      },
    ],
  };
}
