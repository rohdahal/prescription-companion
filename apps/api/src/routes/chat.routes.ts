import type { FastifyInstance } from "fastify";
import { askMedicationAssistant } from "@prescription-companion/ai";
import { logAuditEvent } from "@prescription-companion/security";
import { createSupabaseAdminClient } from "@prescription-companion/supabase";
import { getCurrentSupabaseUser } from "../lib/currentUser";

type ChatBody = {
  question: string;
  prescriptionId: string;
  threadId?: string | null;
  actorId?: string;
};

export async function chatRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { prescriptionId: string } }>("/chat/history", async (request, reply) => {
    try {
      const user = await getCurrentSupabaseUser(request.headers.authorization);
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, subtitle, created_at, updated_at, messages:chat_history_messages(id, role, message, created_at)")
        .eq("patient_id", user.id)
        .eq("prescription_id", request.query.prescriptionId)
        .order("updated_at", { ascending: false });

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      return (data ?? []).map((thread) => ({
        ...thread,
        messages: [...(thread.messages ?? [])].sort((left, right) => left.created_at.localeCompare(right.created_at))
      }));
    } catch (error) {
      console.error("Failed to load chat history", error);
      reply.code(401);
      return { error: "unauthorized" };
    }
  });

  app.post<{ Body: ChatBody }>("/chat", async (request, reply) => {
    try {
      const user = await getCurrentSupabaseUser(request.headers.authorization);
      const supabase = createSupabaseAdminClient();
      const result = await askMedicationAssistant({
        question: request.body.question,
        prescriptionId: request.body.prescriptionId
      });

      const responseText = result.response?.trim() || "Sorry, I couldn't generate a response just now.";
      let threadId = request.body.threadId ?? null;
      if (threadId) {
        const { data: existingThread, error: existingThreadError } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("id", threadId)
          .eq("patient_id", user.id)
          .eq("prescription_id", request.body.prescriptionId)
          .maybeSingle();

        if (existingThreadError || !existingThread) {
          threadId = null;
        }
      }

      if (!threadId) {
        const { data: thread, error: threadError } = await supabase
          .from("chat_threads")
          .insert({
            patient_id: user.id,
            prescription_id: request.body.prescriptionId,
            title: request.body.question,
            subtitle: responseText
          })
          .select("id")
          .single();

        if (threadError || !thread) {
          console.error("Failed to create chat thread", threadError);
        } else {
          threadId = thread.id;
        }
      } else {
        const { error: threadUpdateError } = await supabase
          .from("chat_threads")
          .update({
            subtitle: responseText,
            updated_at: new Date().toISOString()
          })
          .eq("id", threadId)
          .eq("patient_id", user.id);

        if (threadUpdateError) {
          console.error("Failed to update chat thread", threadUpdateError);
        }
      }

      const { error: chatHistoryError } = await supabase.from("chat_history_messages").insert([
        {
          thread_id: threadId,
          patient_id: user.id,
          prescription_id: request.body.prescriptionId,
          role: "user",
          message: request.body.question
        },
        {
          thread_id: threadId,
          patient_id: user.id,
          prescription_id: request.body.prescriptionId,
          role: "assistant",
          message: responseText
        }
      ]);

      if (chatHistoryError) {
        console.error("Failed to persist chat history", chatHistoryError);
      }

      await logAuditEvent({
        actorId: request.body.actorId ?? user.id,
        actorType: "patient",
        action: "ai_query",
        entityType: "prescription",
        entityId: request.body.prescriptionId,
        details: { question: request.body.question }
      });

      return {
        ...result,
        response: responseText,
        threadId
      };
    } catch (error) {
      console.error("AI chat failed", error);
      reply.code(500);
      return { error: "chat_failed" };
    }
  });
}
