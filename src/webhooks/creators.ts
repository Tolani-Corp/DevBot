import type { IncomingMessage, ServerResponse } from "http";
import { app } from "../slack/bot.js";
import { createHmac, timingSafeEqual } from "crypto";
import { sendDiscordAlert } from "../services/discord-webhook.js";

// ─── HMAC Signature Verification ─────────────────────────────────────────────

/**
 * Verifies the Convex webhook signature
 */
function verifySignature(rawBody: string, headerSig: string | undefined): boolean {
  const secret = process.env.CONVEX_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[creators-webhook] CONVEX_WEBHOOK_SECRET is not set");
    return false;
  }
  if (!headerSig) return false;

  try {
    const expected = Buffer.from(
      createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
    );
    const received = Buffer.from(headerSig);

    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch (err) {
    return false;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function handleCreatorsWebhook(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // Collect body
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const rawBody = Buffer.concat(chunks).toString("utf-8");

  // Verify Signature
  const sigHeader = req.headers["x-convex-signature"] as string | undefined;
  if (!verifySignature(rawBody, sigHeader)) {
    console.warn("[creators-webhook] Rejected request — invalid or missing signature");
    res.writeHead(401, { "Content-Type": "text/plain" }).end("Unauthorized");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.error("[creators-webhook] Failed to parse payload:", e);
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Bad Request");
    return;
  }

  const { type, data } = payload;
  
  if (type === "creator_application_submitted") {
    console.log(`[creators-webhook] Received new application from ${data.name}`);
    
    const messageText = `*New Creator Application: ${data.name}*\n` +
      `• *Email:* ${data.email}\n` +
      `• *Age Verified:* ${data.isOver18 ? "Yes" : "No"}\n` +
      `• *Content Type:* ${data.contentType}\n` +
      `• *Socials:* ${data.socialLinks?.join(", ") || "None"}\n` +
      `\nReact with 👍 to approve or 👎 to reject.`;

    // Send to default alert channel
    const channelId = process.env.SLACK_CREATORS_CHANNEL || process.env.SLACK_ALERT_CHANNEL;
    
    if (channelId) {
      try {
        await app.client.chat.postMessage({
          channel: channelId,
          text: `🔔 New Creator Application!`,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "✨ New Creator Application",
                emoji: true
              }
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Name:*\n${data.name}` },
                { type: "mrkdwn", text: `*Email:*\n${data.email}` },
                { type: "mrkdwn", text: `*Age Verified:*\n${data.isOver18 ? "✅ Yes" : "❌ No"}` },
                { type: "mrkdwn", text: `*Content:* ${data.contentType || "N/A"}` }
              ]
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Social Links:*\n${data.socialLinks?.join("\n") || "None provided"}`
              }
            },
            {
              type: "divider"
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Approve 🚀", emoji: true },
                  style: "primary",
                  value: `approve_${data.applicationId}`,
                  action_id: "approve_creator_app"
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "Reject 🛑", emoji: true },
                  style: "danger",
                  value: `reject_${data.applicationId}`,
                  action_id: "reject_creator_app"
                }
              ]
            }
          ]
        });
      } catch (err) {
        console.error("Slack alert failed:", err);
      }
    }

    // Try discord
    try {
      await sendDiscordAlert(messageText);
    } catch (err) {
      console.error("Discord alert failed:", err);
    }
  }

  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ received: true }));
}
