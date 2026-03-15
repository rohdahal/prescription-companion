import type { FastifyInstance } from "fastify";

type LinkedPrescription = {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  follow_up_recommendation: string;
  created_at: string;
};

export async function careRoutes(app: FastifyInstance) {
  app.get("/care", async (request, reply) => {
    try {
      const user = await app.services.getCurrentSupabaseUser(request.headers.authorization);
      const supabase = app.services.createSupabaseAdminClient();

      const { data: visits, error: visitsError } = await supabase
        .from("care_visits")
        .select("id, visit_type, provider_name, location, visit_date, summary, next_steps")
        .eq("patient_id", user.id)
        .order("visit_date", { ascending: false });

      if (visitsError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      const visitIds = (visits ?? []).map((visit) => visit.id);
      const { data: linkedPrescriptions, error: linkedPrescriptionsError } = visitIds.length
        ? await supabase
            .from("care_visit_prescriptions")
            .select(
              "visit_id, prescription:prescriptions(id, medication_name, dosage, frequency, instructions, follow_up_recommendation, created_at)"
            )
            .in("visit_id", visitIds)
        : { data: [], error: null };

      if (linkedPrescriptionsError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      const prescriptionsByVisitId = new Map<
        string,
        LinkedPrescription[]
      >();

      for (const row of linkedPrescriptions ?? []) {
        const normalizedPrescriptions = Array.isArray(row.prescription) ? row.prescription : row.prescription ? [row.prescription] : [];
        if (normalizedPrescriptions.length === 0) {
          continue;
        }

        const visitPrescriptions = prescriptionsByVisitId.get(row.visit_id) ?? [];
        visitPrescriptions.push(...(normalizedPrescriptions as LinkedPrescription[]));
        prescriptionsByVisitId.set(row.visit_id, visitPrescriptions);
      }

      return {
        visits: (visits ?? []).map((visit) => ({
          ...visit,
          prescriptions: prescriptionsByVisitId.get(visit.id) ?? []
        }))
      };
    } catch (error) {
      console.error("Failed to load care data", error);
      reply.code(401);
      return { error: "unauthorized" };
    }
  });
}
