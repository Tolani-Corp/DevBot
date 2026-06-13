import { submitAAR } from "../memory/aar.js";
import { AAR } from "../testing/e2e-schemas.js";

export async function handle(args: any) {
  const report = args?.["report"] as AAR;
  if (!report) {
    throw new Error("Missing 'report' argument");
  }

  const newWeights = await submitAAR(report);

  return {
    content: [
      {
        type: "text",
        text: `AAR submitted successfully. New algorithm weights:\n` + JSON.stringify(newWeights, null, 2),
      },
    ],
  };
}
