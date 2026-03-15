import { createSupabaseAdminClient } from "@prescription-companion/supabase";

export type AiEventLog = {
  prompt: string;
  response: string;
  model: string;
  latencyMs: number;
  toolCalls: Array<{ name: string; args: unknown }>;
  error?: string;
  traceId?: string;
};

export async function logAiEvent(event: AiEventLog) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("ai_event_logs").insert({
    prompt: event.prompt,
    response: event.response,
    model: event.model,
    latency_ms: event.latencyMs,
    tool_calls: event.toolCalls,
    error: event.error ?? null,
    trace_id: event.traceId ?? null
  });

  if (error) {
    console.error("Failed to log AI event", error);
  }
}

