import type { FastifyInstance } from "fastify";
import type { AppServices } from "../lib/services";

type ScheduleBody = {
  prescriptionId: string;
  frequency: string;
};

function buildSchedule(frequency: string) {
  if (frequency.toLowerCase().includes("twice")) {
    return ["08:00", "20:00"];
  }
  return ["09:00"];
}

export async function scheduleRoutes(app: FastifyInstance) {
  app.get("/schedule", async (request, reply) => {
    try {
      const user = await app.services.getCurrentSupabaseUser(request.headers.authorization);
      const supabase = app.services.createSupabaseAdminClient();

      const { data: prescriptions, error: prescriptionError } = await supabase
        .from("prescriptions")
        .select("id, medication_name, dosage, frequency, created_at")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false });

      if (prescriptionError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      const items =
        prescriptions?.map(async (prescription) => {
          const [{ data: schedule }, adherenceSummary, { data: reminders }] = await Promise.all([
            supabase
              .from("medication_schedules")
              .select("dose_times")
              .eq("prescription_id", prescription.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            getAdherenceSummary(supabase, prescription.id),
            supabase
              .from("reminder_events")
              .select("id, reminder_type, scheduled_for, status")
              .eq("prescription_id", prescription.id)
              .order("scheduled_for", { ascending: true })
          ]);

          const doseTimes = Array.isArray(schedule?.dose_times)
            ? schedule.dose_times.filter((time) => typeof time === "string")
            : [];

          return {
            id: prescription.id,
            medicationName: prescription.medication_name,
            dosage: prescription.dosage,
            frequency: prescription.frequency,
            doseTimes,
            adherenceScore: "adherenceScore" in adherenceSummary ? adherenceSummary.adherenceScore : 0,
            flagForAttention: "flagForAttention" in adherenceSummary ? adherenceSummary.flagForAttention : true,
            reminders: reminders ?? []
          };
        }) ?? [];

      return {
        items: await Promise.all(items)
      };
    } catch (error) {
      console.error("Failed to load schedule", error);
      reply.code(401);
      return { error: "unauthorized" };
    }
  });

  app.get("/dashboard", async (request, reply) => {
    try {
      const user = await app.services.getCurrentSupabaseUser(request.headers.authorization);
      const supabase = app.services.createSupabaseAdminClient();

      const { data: prescriptions, error: prescriptionError } = await supabase
        .from("prescriptions")
        .select("id, created_at")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false });

      if (prescriptionError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      const activePrescriptions = prescriptions?.length ?? 0;
      const latestPrescriptionId = prescriptions?.[0]?.id ?? null;

      if (!latestPrescriptionId) {
        return {
          activePrescriptions: 0,
          nextMedicationDose: null,
          followUpReminders: 0,
          adherenceScore: 0,
          flagForAttention: true,
          latestPrescriptionId: null
        };
      }

      const [{ data: schedule }, adherenceSummary, { count: followUpReminders }] = await Promise.all([
        supabase
          .from("medication_schedules")
          .select("dose_times")
          .eq("prescription_id", latestPrescriptionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        getAdherenceSummary(supabase, latestPrescriptionId),
        supabase
          .from("reminder_events")
          .select("*", { count: "exact", head: true })
          .eq("prescription_id", latestPrescriptionId)
          .eq("status", "pending")
      ]);

      const doseTimes = Array.isArray(schedule?.dose_times) ? schedule.dose_times.filter((time) => typeof time === "string") : [];

      return {
        activePrescriptions,
        nextMedicationDose: doseTimes[0] ?? null,
        followUpReminders: followUpReminders ?? 0,
        adherenceScore: "adherenceScore" in adherenceSummary ? adherenceSummary.adherenceScore : 0,
        flagForAttention: "flagForAttention" in adherenceSummary ? adherenceSummary.flagForAttention : true,
        latestPrescriptionId
      };
    } catch (error) {
      console.error("Failed to load dashboard", error);
      reply.code(401);
      return { error: "unauthorized" };
    }
  });

  app.post<{ Body: ScheduleBody }>("/schedules/generate", async (request, reply) => {
    const supabase = app.services.createSupabaseAdminClient();
    const times = buildSchedule(request.body.frequency);
    const { data, error } = await supabase
      .from("medication_schedules")
      .insert({
        prescription_id: request.body.prescriptionId,
        frequency: request.body.frequency,
        dose_times: times
      })
      .select("*")
      .single();

    if (error) {
      reply.code(500);
      return { error: "supabase_error" };
    }

    return data;
  });

  app.post<{ Body: { prescriptionId: string; doseTime: string; taken: boolean } }>(
    "/schedules/adherence",
    async (request, reply) => {
      const supabase = app.services.createSupabaseAdminClient();
      const { error } = await supabase.from("adherence_logs").insert({
        prescription_id: request.body.prescriptionId,
        dose_time: request.body.doseTime,
        taken: request.body.taken
      });

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      return getAdherenceSummary(supabase, request.body.prescriptionId);
    }
  );

  app.get<{ Params: { prescriptionId: string } }>(
    "/schedules/adherence/:prescriptionId",
    async (request, reply) => {
      const supabase = app.services.createSupabaseAdminClient();
      const result = await getAdherenceSummary(supabase, request.params.prescriptionId);

      if ("error" in result) {
        reply.code(500);
      }

      return result;
    }
  );
}

async function getAdherenceSummary(
  supabase: ReturnType<AppServices["createSupabaseAdminClient"]>,
  prescriptionId: string
) {
  const { data, error } = await supabase
    .from("adherence_logs")
    .select("taken")
    .eq("prescription_id", prescriptionId);

  if (error) {
    return { error: "supabase_error" as const };
  }

  const total = data.length;
  const takenCount = data.filter((row) => row.taken).length;
  const adherenceScore = total === 0 ? 0 : Math.round((takenCount / total) * 100);

  return {
    prescriptionId,
    adherenceScore,
    flagForAttention: adherenceScore < 70
  };
}
