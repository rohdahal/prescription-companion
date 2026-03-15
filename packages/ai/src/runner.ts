import { logAiEvent } from "@prescription-companion/observability";
import { complete, getModel, getOAuthApiKey } from "./auth";

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type ToolSpec = ToolDefinition & {
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

type AssistantContent =
  | { type: "text"; text: string }
  | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> };

type AssistantMessage = {
  content: AssistantContent[];
};

export async function runWithTools(params: {
  userInstruction: string;
  systemPrompt?: string;
  tools: ToolSpec[];
}) {
  const apiKey = await getOAuthApiKey();
  const model = await getModel();

  const context: {
    systemPrompt: string;
    messages: Array<Record<string, unknown>>;
    tools: ToolDefinition[];
  } = {
    systemPrompt: params.systemPrompt ?? process.env.SYSTEM_PROMPT ?? "You are a concise helpful assistant.",
    messages: [{ role: "user", content: params.userInstruction, timestamp: Date.now() }],
    tools: params.tools.map(({ handler: _handler, ...tool }) => tool)
  };

  const toolCalls: Array<{ name: string; args: unknown }> = [];
  const started = Date.now();
  let responseText = "";

  for (let index = 0; index < 6; index += 1) {
    const response = (await complete({
      apiKey,
      model,
      context
    })) as AssistantMessage | null;

    if (!response) {
      break;
    }

    context.messages.push({ ...response, role: "assistant", timestamp: Date.now() });

    const content = response.content ?? [];
    responseText = content
      .filter((block): block is Extract<AssistantContent, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const pendingToolCalls = content.filter(
      (block): block is Extract<AssistantContent, { type: "toolCall" }> => block.type === "toolCall"
    );

    if (pendingToolCalls.length === 0) {
      break;
    }

    for (const call of pendingToolCalls) {
      const tool = params.tools.find(({ name }) => name === call.name);
      if (!tool) {
        continue;
      }

      const result = await tool.handler(call.arguments);
      const serializedResult = typeof result === "string" ? result : JSON.stringify(result);

      toolCalls.push({ name: call.name, args: call.arguments });
      context.messages.push({
        role: "toolResult",
        toolCallId: call.id,
        toolName: call.name,
        content: [{ type: "text", text: serializedResult }],
        isError: false,
        timestamp: Date.now()
      });
    }
  }

  await logAiEvent({
    prompt: params.userInstruction,
    response: responseText,
    model: model.id,
    latencyMs: Date.now() - started,
    toolCalls
  });

  return {
    response: responseText,
    model: model.id,
    toolCalls
  };
}
