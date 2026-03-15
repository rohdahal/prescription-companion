import type { FastifyInstance } from "fastify";
import { createSupabaseAdminClient } from "@prescription-companion/supabase";
import { getCurrentSupabaseUser } from "../lib/currentUser";

export async function careRoutes(app: FastifyInstance) {
  app.get("/care", async (request, reply) => {
    try {
      const user = await getCurrentSupabaseUser(request.headers.authorization);
      const supabase = createSupabaseAdminClient();

      const [{ data: visits, error: visitsError }, { data: prescriptions, error: prescriptionsError }] = await Promise.all([
        supabase
          .from("care_visits")
          .select("id, visit_type, provider_name, location, visit_date, summary, next_steps")
          .eq("patient_id", user.id)
          .order("visit_date", { ascending: false }),
        supabase
          .from("prescriptions")
          .select("id, medication_name, dosage, frequency, instructions, follow_up_recommendation, created_at")
          .eq("patient_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      if (visitsError || prescriptionsError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      return {
        visits: visits ?? [],
        prescriptions: prescriptions ?? []
      };
    } catch (error) {
      console.error("Failed to load care data", error);
      reply.code(401);
      return { error: "unauthorized" };
    }
  });
}
