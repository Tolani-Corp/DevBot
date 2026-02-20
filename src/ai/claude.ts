import Anthropic from "@anthropic-ai/sdk";
import { ragEngine } from "./rag";
import { costTracker } from "@/services/cost-service";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function analyzeTask(
  description: string,
  context?: {
    repository?: string;
    previousMessages?: Message[];
    filesContents: Record<string, string>;
    userId?: string;
    workspaceId?: string;
  }
): Promise<{
  taskType: "bug_fix" | "feature" | "question" | "review" | "refactor";
  repository?: string;
  filesNeeded?: string[];
  plan: string;
  requiresCodeChange: boolean;
}> {
  const systemPrompt = `You are FunBot, an autonomous AI software engineer.
Analyze the user's request and determine:
1. Task type (bug_fix, feature, question, review, refactor)
2. Which repository it relates to (if mentioned or inferable)
3. Which files need to be examined or modified
4. A step-by-step plan to complete the task
5. Whether code changes are required

Available repositories: ${process.env.ALLOWED_REPOS ?? "*"}

Respond in JSON format:
{
  "taskType": "bug_fix" | "feature" | "question" | "review" | "refactor",
  "repository": "repo-name or null",
  "filesNeeded": ["path/to/file1.ts", "path/to/file2.ts"],
  "plan": "Step-by-step plan as markdown",
  "requiresCodeChange": true | false
}`;

  let ragContext = "";
  if (context?.repository) {
    try {
      const results = await ragEngine.search(description, context.repository);
      if (results.length > 0) {
        ragContext = `\n\nExisting code context (from RAG):\n${results
          .map((r) => `File: ${r.filePath}\n\`\`\`\n${r.content}\n\`\`\``)
          .join("\n\n")}`;
      }
    } catch (e) {
      console.warn("RAG search failed", e);
    }
  }

  const userPrompt = `Task description: ${description}${context?.repository ? `\n\nRepository context: ${context.repository}` : ""
}${ragContext}${context?.filesContents
      ? `\n\nFile contents:\n${Object.entries(context.filesContents)
          .map(([path, content]) => `\n### ${path}\n\`\`\`\n${(content as string).slice(0, 2000)}\n\`\`\``)
        .join("\n")}`
      : ""
    }`;

  const messages: Anthropic.MessageParam[] = [
    ...(context?.previousMessages?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? []),
    { role: "user", content: userPrompt },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

export async function generateCodeChanges(
  plan: string,
  fileContents: Record<string, string>,
  userId: string = "system",
  workspaceId: string = "system"
): Promise<{
  changes: Array<{
    file: string;
    oldContent: string;
    newContent: string;
    explanation: string;
  }>;
  commitMessage: string;
  prDescription: string;
}> {
  const systemPrompt = `You are FunBot, an autonomous AI software engineer.
Given a plan and file contents, generate the exact code changes needed.

Respond in JSON format:
{
  "changes": [
    {
      "file": "path/to/file.ts",
      "oldContent": "exact old content to replace",
      "newContent": "exact new content",
      "explanation": "why this change was made"
    }
  ],
  "commitMessage": "feat: descriptive commit message",
  "prDescription": "Markdown description for PR"
}

Follow best practices:
- Use conventional commits format
- Write clear, maintainable code
- Preserve existing code style
- Add comments for complex logic
- Include type safety`;

  const userPrompt = `Plan:\n${plan}\n\nFiles:\n${Object.entries(fileContents)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n")}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  if (response.usage) {
    costTracker.track(userId, workspaceId, {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: MODEL,
    }).catch(console.error);
  }
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

export async function answerQuestion(
  question: string,
  context?: {
    repository?: string;
    fileContents?: Record<string, string>;
    previousMessages?: Message[];
    userId?: string;
    workspaceId?: string;
  }
): Promise<string> {
  const systemPrompt = `You are FunBot, an AI software engineer assistant.
Answer the user's question clearly and concisely.
If code examples would help, include them.
Use markdown formatting.`;

  const userPrompt = `Question: ${question}${context?.fileContents
      ? `\n\nRelevant files:\n${Object.entries(context.fileContents)
        .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 1500)}\n\`\`\``)
        .join("\n")}`
      : ""
    }`;

  const messages: Anthropic.MessageParam[] = [
    ...(context?.previousMessages?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? []),
    { role: "user", content: userPrompt },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  if (response.usage && context?.userId) {
    costTracker.track(context.userId, context.workspaceId ?? "unknown", {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: MODEL,
    }).catch(console.error);
  }

  return response.content[0].type === "text" ? response.content[0].text : "";
}
