import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { extractPrescription } from "@prescription-companion/ai";
import { logAuditEvent, maskPhi } from "@prescription-companion/security";
import { createSupabaseAdminClient } from "@prescription-companion/supabase";
import { uploadPrescriptionFile } from "../lib/storage";
import { getCurrentSupabaseUser } from "../lib/currentUser";
import { extractTextFromUpload } from "../lib/textExtraction";

type IngestBody = {
  patientId: string;
  text?: string;
  fileName?: string;
  fileBase64?: string;
  actorId?: string;
};

export async function prescriptionsRoutes(app: FastifyInstance) {
  app.get("/prescriptions", async (request, reply) => {
    try {
      const user = await getCurrentSupabaseUser(request.headers.authorization);
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("prescriptions")
        .select("id, medication_name, dosage, frequency, instructions, created_at")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      return data ?? [];
    } catch (error) {
      console.error("Failed to load prescriptions list", error);
      reply.code(401);
      return { error: "unauthorized" };
    }
  });

  app.get("/prescriptions/latest", async (request, reply) => {
    try {
      const user = await getCurrentSupabaseUser(request.headers.authorization);
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      if (!data) {
        reply.code(404);
        return { error: "not_found" };
      }

      await logAuditEvent({
        actorId: user.id,
        actorType: "patient",
        action: "view_prescription",
        entityType: "prescription",
        entityId: data.id
      });

      return data;
    } catch (error) {
      console.error("Failed to load latest prescription", error);
      reply.code(401);
      return { error: "unauthorized" };
    }
  });

  app.post<{ Body: IngestBody }>("/prescriptions/ingest", async (request, reply) => {
    try {
      const body = request.body;
      const supabase = createSupabaseAdminClient();
      const fileBuffer = body.fileBase64 ? Buffer.from(body.fileBase64, "base64") : undefined;
      const text = await extractTextFromUpload({
        providedText: body.text,
        fileBuffer
      });

      let storageRef: { bucket: string; key: string } | null = null;
      if (fileBuffer && body.fileName) {
        storageRef = await uploadPrescriptionFile({
          key: `prescriptions/${randomUUID()}-${body.fileName}`,
          body: fileBuffer,
          contentType: "application/octet-stream"
        });
      }

      const extracted = await extractPrescription(text);
      const { data, error } = await supabase
        .from("prescriptions")
        .insert({
          patient_id: body.patientId,
          raw_text: maskPhi(text),
          medication_name: extracted.medicationName,
          dosage: extracted.dosage,
          frequency: extracted.frequency,
          instructions: extracted.instructions,
          follow_up_recommendation: extracted.followUpRecommendation,
          storage_bucket: storageRef?.bucket ?? null,
          storage_key: storageRef?.key ?? null
        })
        .select("*")
        .single();

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      await logAuditEvent({
        actorId: body.actorId ?? body.patientId,
        actorType: "patient",
        action: "upload_prescription",
        entityType: "prescription",
        entityId: data.id,
        details: { hasUpload: Boolean(fileBuffer) }
      });

      return data;
    } catch (error) {
      console.error("Prescription ingestion failed", error);
      reply.code(400);
      return { error: "ingestion_failed" };
    }
  });

  app.get<{ Params: { id: string }; Querystring: { actorId?: string } }>(
    "/prescriptions/:id",
    async (request, reply) => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("id", request.params.id)
        .maybeSingle();

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      if (!data) {
        reply.code(404);
        return { error: "not_found" };
      }

      await logAuditEvent({
        actorId: request.query.actorId ?? "anonymous",
        actorType: "patient",
        action: "view_prescription",
        entityType: "prescription",
        entityId: data.id
      });

      return data;
    }
  );
}
