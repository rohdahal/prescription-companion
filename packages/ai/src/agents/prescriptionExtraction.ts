import { complete, getModel, getOAuthApiKey } from "../auth";
import { logAiEvent } from "@prescription-companion/observability";

export type ExtractedPrescription = {
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions: string;
  followUpRecommendation: string;
};

function validateExtraction(payload: unknown): payload is ExtractedPrescription {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return (
    typeof record.medicationName === "string" &&
    typeof record.dosage === "string" &&
    typeof record.frequency === "string" &&
    typeof record.instructions === "string" &&
    typeof record.followUpRecommendation === "string"
  );
}

export async function extractPrescription(rawText: string): Promise<ExtractedPrescription> {
  const apiKey = await getOAuthApiKey();
  const model = await getModel();
  const prompt = [
    "Extract a structured prescription JSON object from this text.",
    "Return ONLY valid JSON with keys:",
    "medicationName, dosage, frequency, instructions, followUpRecommendation.",
    rawText
  ].join("\n");

  const started = Date.now();
  const result = (await complete({
    apiKey,
    model,
    context: {
      messages: [{ role: "user", content: prompt, timestamp: Date.now() }]
    }
  })) as { content?: Array<{ type: string; text?: string }> } | null;
  const responseText = (result?.content ?? [])
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
  const parsed = JSON.parse(responseText || "{}");

  await logAiEvent({
    prompt,
    response: responseText,
    model: model.id,
    latencyMs: Date.now() - started,
    toolCalls: []
  });

  if (!validateExtraction(parsed)) {
    throw new Error("invalid_extraction_output");
  }

  return parsed;
}
