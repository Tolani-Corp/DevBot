import { getTopPasswords } from "../memory/password-vault.js";

export async function handle(args: any) {
  const context = args?.["context"] ? String(args["context"]) : undefined;
  const tags = Array.isArray(args?.["tags"]) ? args["tags"] : undefined;
  const labels = args?.["labels"] ? args["labels"] : undefined;
  const limit = args?.["limit"] ? Number(args["limit"]) : 10;

  const passwords = await getTopPasswords({ context, tags, labels, limit });

  return {
    content: [
      {
        type: "text",
        text: `Top ${limit} Passwords${context ? ` for context '${context}'` : ""}:\n` + 
              JSON.stringify(passwords, null, 2),
      },
    ],
  };
}
