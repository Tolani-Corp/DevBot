import { getNaicsCode, searchNaicsCodes } from "../procurement-regulatory.js";

export async function handle(args: any) {
  const code = typeof args?.code === "string" ? args.code : "";
  const query = typeof args?.query === "string" ? args.query : "";
  const limit = typeof args?.limit === "number" ? args.limit : 20;

  if (!code && !query) {
    return {
      content: [
        {
          type: "text",
          text: "Provide code or query. Examples: code=236220, query=commercial building construction.",
        },
      ],
      isError: true,
    };
  }

  const result = code ? await getNaicsCode(code) : undefined;
  const searchResults = query ? await searchNaicsCodes(query, limit) : [];

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            result,
            searchResults,
          },
          null,
          2,
        ),
      },
    ],
  };
}
