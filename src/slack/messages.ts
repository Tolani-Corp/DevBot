import { app } from "./bot";
import { sendDiscordAlert } from "../services/discord-webhook";

export async function updateSlackThread(
  channelId: string,
  threadTs: string,
  message: string,
  blocks?: any[]
): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: message,
      ...(blocks ? { blocks } : {}),
    });
  } catch (error) {
    console.error("Failed to update Slack thread:", error);
  }
}

export async function sendAlert(message: string): Promise<void> {
  const alertChannel = process.env.SLACK_ALERT_CHANNEL;

  if (!alertChannel) {
    console.warn("SLACK_ALERT_CHANNEL not configured, skipping Slack alert");
  } else {
    try {
      await app.client.chat.postMessage({
        channel: alertChannel,
        text: `🚨 *FunBot Alert*\n${message}`,
      });
    } catch (error) {
      console.error("Failed to send Slack alert:", error);
    }
  }

  // Also send to Discord if webhook is configured
  try {
    await sendDiscordAlert(message);
  } catch (error) {
    console.error("Failed to send Discord alert:", error);
  }
}
