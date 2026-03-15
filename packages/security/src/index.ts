import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@prescription-companion/supabase";

export function maskPhi(input: string): string {
  if (!input) {
    return input;
  }
  return input.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");
}

export function hashSensitiveId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export type AuditAction = "view_prescription" | "upload_prescription" | "ai_query";

export async function logAuditEvent(params: {
  actorId: string;
  actorType: "patient" | "clinician" | "system";
  action: AuditAction;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: params.actorId,
    actor_type: params.actorType,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    details: params.details ?? null
  });

  if (error) {
    console.error("Failed to log audit event", error);
  }
}

