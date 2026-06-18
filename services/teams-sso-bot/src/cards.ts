import { CardFactory, MessageFactory } from "@microsoft/agents-hosting";
import { Activity } from "@microsoft/agents-activity";

import type { DevBotHealth, DevBotTaskResponse } from "./devbotClient.js";
import type { GraphProfile } from "./graph.js";

type AdaptiveCardBody = Array<Record<string, unknown>>;

function adaptiveCard(title: string, body: AdaptiveCardBody) {
  return Activity.fromObject({
    type: "message",
    attachments: [
      CardFactory.adaptiveCard({
        type: "AdaptiveCard",
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        version: "1.4",
        body: [
          {
            type: "TextBlock",
            text: title,
            weight: "Bolder",
            size: "Medium",
            wrap: true,
          },
          ...body,
        ],
      }),
    ],
  });
}

export function helpActivity() {
  return adaptiveCard("DevBot for Teams", [
    {
      type: "TextBlock",
      text: "Use DevBot from Teams with Microsoft SSO.",
      wrap: true,
    },
    {
      type: "FactSet",
      facts: [
        { title: "show", value: "Show your Microsoft Graph profile." },
        { title: "status", value: "Check the DevBot runtime health endpoint." },
        { title: "task <request>", value: "Create a governed DevBot task." },
        { title: "task <request> repo:<name>", value: "Create a task for a specific repository." },
        { title: "logout", value: "Clear the Teams SSO session." },
      ],
    },
  ]);
}

export function profileActivity(profile: GraphProfile) {
  return adaptiveCard("Microsoft Graph Profile", [
    {
      type: "FactSet",
      facts: [
        { title: "Name", value: profile.displayName || "Unknown" },
        {
          title: "User",
          value: profile.userPrincipalName || profile.mail || "Unknown",
        },
        { title: "Title", value: profile.jobTitle || "Not provided" },
      ],
    },
  ]);
}

export function statusActivity(status: DevBotHealth) {
  return adaptiveCard("DevBot Runtime Status", [
    {
      type: "FactSet",
      facts: [
        { title: "Status", value: status.status },
        { title: "API", value: status.apiBaseUrl },
        { title: "Checked", value: status.timestamp },
      ],
    },
    {
      type: "TextBlock",
      text: status.detail,
      wrap: true,
    },
  ]);
}

export function taskCreatedActivity(task: DevBotTaskResponse) {
  const taskId = task.taskId ?? task.id ?? "unknown";
  return adaptiveCard("DevBot Task Created", [
    {
      type: "FactSet",
      facts: [
        { title: "Task", value: String(taskId) },
        { title: "Status", value: String(task.status ?? "queued") },
        { title: "Repository", value: String(task.repository ?? "default") },
      ],
    },
    {
      type: "TextBlock",
      text: "The request is now inside DevBot's governed execution path.",
      wrap: true,
    },
  ]);
}

export function textActivity(text: string) {
  return MessageFactory.text(text);
}
