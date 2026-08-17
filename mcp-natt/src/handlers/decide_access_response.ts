import {
  decideAccessResponse,
  type AccessResponseSignal,
  type AccessResiliencePolicy,
} from "../web-acquisition-policy.js";

interface DecideAccessResponseArgs {
  signal?: AccessResponseSignal;
  attempt?: number;
  consecutiveFailures?: number;
  policy?: AccessResiliencePolicy;
}

export async function handle(args: DecideAccessResponseArgs | undefined) {
  if (!args?.signal || !args.policy) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              decision: "stop",
              reason: "Both signal and policy are required.",
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  const result = decideAccessResponse(
    args.signal,
    Math.max(0, args.attempt ?? 0),
    Math.max(0, args.consecutiveFailures ?? 0),
    args.policy,
  );

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: result.decision === "stop" || result.decision === "manual-review",
  };
}
