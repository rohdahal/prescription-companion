import type { FastifyInstance } from "fastify";
import { createSupabaseAdminClient } from "@prescription-companion/supabase";

type ReminderBody = {
  prescriptionId: string;
  reminderType: "dose" | "follow_up" | "refill";
  scheduledFor: string;
};

export async function remindersRoutes(app: FastifyInstance) {
  app.post<{ Body: ReminderBody }>("/reminders/events", async (request, reply) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("reminder_events")
      .insert({
        prescription_id: request.body.prescriptionId,
        reminder_type: request.body.reminderType,
        scheduled_for: request.body.scheduledFor,
        status: "pending"
      })
      .select("*")
      .single();

    if (error) {
      reply.code(500);
      return { error: "supabase_error" };
    }

    return data;
  });
}

