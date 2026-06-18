import { fetchOfficialFarText, searchFarIndex } from "../procurement-regulatory.js";

export async function handle(args: any) {
  const citation = typeof args?.citation === "string" ? args.citation : undefined;
  const query = typeof args?.query === "string" ? args.query : undefined;
  const includeText = args?.include_text === true;
  const limit = typeof args?.limit === "number" ? args.limit : 20;

  if (!citation && !query) {
    return {
      content: [
        {
          type: "text",
          text: "Provide citation or query. Examples: citation=25, citation=25.400, query=import export customs duties.",
        },
      ],
      isError: true,
    };
  }

  const search = await searchFarIndex({ query, farCitation: citation, limit });
  const officialText = includeText && citation ? await fetchOfficialFarText(citation) : undefined;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            search,
            officialText,
          },
          null,
          2,
        ),
      },
    ],
  };
}
