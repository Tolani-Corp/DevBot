import { app } from "./bot";

export async function updateSlackThread(
  channelId: string,
  threadTs: string,
  message: string
): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: message,
    });
  } catch (error) {
    console.error("Failed to update Slack thread:", error);
  }
}

export async function sendAlert(message: string): Promise<void> {
  const alertChannel = process.env.SLACK_ALERT_CHANNEL;
  
  if (!alertChannel) {
    console.warn("SLACK_ALERT_CHANNEL not configured, skipping alert");
    return;
  }

  try {
    await app.client.chat.postMessage({
      channel: alertChannel,
      text: `🚨 *DevBot Alert*\n${message}`,
    });
  } catch (error) {
    console.error("Failed to send alert:", error);
  }
}
