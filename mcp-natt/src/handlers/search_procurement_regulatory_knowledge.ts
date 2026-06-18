import { buildProcurementRegulatoryMemory, fetchOfficialFarText } from "../procurement-regulatory.js";

export async function handle(args: any) {
  const query = typeof args?.query === "string" ? args.query : "";
  const naicsCode = typeof args?.naics_code === "string" ? args.naics_code : undefined;
  const farCitation = typeof args?.far_citation === "string" ? args.far_citation : undefined;
  const includeFarText = args?.include_far_text === true;
  const limit = typeof args?.limit === "number" ? args.limit : 20;

  if (!query && !naicsCode && !farCitation) {
    return {
      content: [
        {
          type: "text",
          text: "Provide a query, naics_code, or far_citation. Example: find suppliers that manufacture OEM NAIC=236823 and all FAR import/export regulations",
        },
      ],
      isError: true,
    };
  }

  const memory = await buildProcurementRegulatoryMemory({
    query,
    naicsCode,
    farCitation,
    limit,
  });

  const farText = includeFarText && farCitation ? await fetchOfficialFarText(farCitation) : undefined;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ...memory,
            farText,
          },
          null,
          2,
        ),
      },
    ],
  };
}
