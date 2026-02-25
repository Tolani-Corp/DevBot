import { storePassword, recordPasswordSuccess } from "../memory/password-vault.js";

export async function handle(args: any) {
  const password = String(args?.["password"] || "");
  const context = String(args?.["context"] || "general");
  const entropy = Number(args?.["entropy"] || 0);
  const tags = Array.isArray(args?.["tags"]) ? args["tags"] : [];
  const labels = args?.["labels"] || {};
  const isSuccess = Boolean(args?.["isSuccess"] || false);

  if (!password) {
    throw new Error("Missing 'password' argument");
  }

  if (isSuccess) {
    const found = await recordPasswordSuccess(password, context);
    if (!found) {
      await storePassword({ password, entropy, context, tags, labels });
      await recordPasswordSuccess(password, context);
    }
    return {
      content: [{ type: "text", text: `Recorded success for password in context '${context}'.` }],
    };
  } else {
    await storePassword({ password, entropy, context, tags, labels });
    return {
      content: [{ type: "text", text: `Stored password in vault under context '${context}'.` }],
    };
  }
}
