import { getAlgorithmWeights } from "../memory/aar.js";

export async function handle(args: any) {
  const weights = await getAlgorithmWeights();

  return {
    content: [
      {
        type: "text",
        text: `Current Algorithm Weights:\n` + JSON.stringify(weights, null, 2),
      },
    ],
  };
}
