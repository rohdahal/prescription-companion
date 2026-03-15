import { createSupabaseAdminClient } from "@prescription-companion/supabase";
import path from "node:path";
import { readFile } from "node:fs/promises";

type SeedFixture = {
  guidanceDocuments: Array<{
    id: string;
    title: string;
    content: string;
    embedding: number[];
  }>;
  careVisits: Array<{
    visitType: string;
    providerName: string;
    location: string;
    offsetHours: number;
    summary: string;
    nextSteps: string[];
    prescriptionMedicationNames: string[];
  }>;
  prescriptions: Array<{
    rawText: string;
    medicationName: string;
    dosage: string;
    frequency: string;
    instructions: string;
    followUpRecommendation: string;
    schedule: {
      frequency: string;
      doseTimes: string[];
    };
    adherenceLogs: Array<{
      offsetHours: number;
      taken: boolean;
    }>;
    reminders: Array<{
      type: "dose" | "follow_up" | "refill";
      offsetHours: number;
      status: string;
      meta?: Record<string, unknown>;
    }>;
    chatHistory: Array<{
      role: "user" | "assistant";
      message: string;
      offsetHours: number;
    }>;
  }>;
};

const seedFixturePath = path.resolve(process.cwd(), "../../scripts/seed-data.json");

async function loadSeedFixture(): Promise<SeedFixture> {
  const payload = await readFile(seedFixturePath, "utf8");
  return JSON.parse(payload) as SeedFixture;
}

export async function seedDemoDataForUser(params: { userId: string; email?: string | null }) {
  const supabase = createSupabaseAdminClient();
  const now = Date.now();
  const fixture = await loadSeedFixture();

  if (fixture.guidanceDocuments.length > 0) {
    const { error: guidanceError } = await supabase.from("medication_guidance_embeddings").upsert(fixture.guidanceDocuments);
    if (guidanceError) {
      throw new Error(`demo_seed_guidance_failed:${guidanceError.message}`);
    }
  }

  const insertedPrescriptionIds: string[] = [];
  const prescriptionIdsByMedicationName = new Map<string, string>();
  let careVisitCount = 0;
  let careVisitPrescriptionCount = 0;
  let scheduleCount = 0;
  let adherenceCount = 0;
  let reminderCount = 0;
  let chatHistoryCount = 0;

  for (const item of fixture.prescriptions) {
    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .insert({
        patient_id: params.userId,
        raw_text: `DEMO_SEED: ${item.rawText}`,
        medication_name: item.medicationName,
        dosage: item.dosage,
        frequency: item.frequency,
        instructions: item.instructions,
        follow_up_recommendation: item.followUpRecommendation,
        storage_bucket: null,
        storage_key: null
      })
      .select("*")
      .single();

    if (prescriptionError || !prescription) {
      throw new Error(`demo_seed_prescription_failed:${prescriptionError?.message ?? "unknown"}`);
    }

    insertedPrescriptionIds.push(prescription.id);
    prescriptionIdsByMedicationName.set(item.medicationName, prescription.id);

    const { data: schedule, error: scheduleError } = await supabase
      .from("medication_schedules")
      .insert({
        prescription_id: prescription.id,
        frequency: item.schedule.frequency,
        dose_times: item.schedule.doseTimes
      })
      .select("*")
      .single();

    if (scheduleError) {
      throw new Error(`demo_seed_schedule_failed:${scheduleError.message}`);
    }

    scheduleCount += schedule ? 1 : 0;

    const adherenceEntries = item.adherenceLogs.map((entry) => ({
      prescription_id: prescription.id,
      dose_time: new Date(now + entry.offsetHours * 60 * 60 * 1000).toISOString(),
      taken: entry.taken
    }));

    if (adherenceEntries.length > 0) {
      const { error: adherenceError } = await supabase.from("adherence_logs").insert(adherenceEntries);
      if (adherenceError) {
        throw new Error(`demo_seed_adherence_failed:${adherenceError.message}`);
      }
      adherenceCount += adherenceEntries.length;
    }

    const reminderEntries = item.reminders.map((entry) => ({
      prescription_id: prescription.id,
      reminder_type: entry.type,
      status: entry.status,
      scheduled_for: new Date(now + entry.offsetHours * 60 * 60 * 1000).toISOString(),
      meta: entry.meta ?? { source: "seed-json" }
    }));

    if (reminderEntries.length > 0) {
      const { error: reminderError } = await supabase.from("reminder_events").insert(reminderEntries);
      if (reminderError) {
        throw new Error(`demo_seed_reminders_failed:${reminderError.message}`);
      }
      reminderCount += reminderEntries.length;
    }

    const chatHistoryEntries = item.chatHistory.map((entry) => ({
      role: entry.role,
      message: entry.message,
      created_at: new Date(now + entry.offsetHours * 60 * 60 * 1000).toISOString()
    }));

    for (let index = 0; index < chatHistoryEntries.length; index += 1) {
      const message = chatHistoryEntries[index];
      if (message.role !== "user") {
        continue;
      }

      const nextMessage = chatHistoryEntries[index + 1];
      const threadCreatedAt = message.created_at;
      const threadSubtitle = nextMessage?.role === "assistant" ? nextMessage.message : null;
      const { data: thread, error: threadError } = await supabase
        .from("chat_threads")
        .insert({
          patient_id: params.userId,
          prescription_id: prescription.id,
          title: message.message,
          subtitle: threadSubtitle,
          created_at: threadCreatedAt,
          updated_at: nextMessage?.created_at ?? threadCreatedAt
        })
        .select("id")
        .single();

      if (threadError || !thread) {
        throw new Error(`demo_seed_chat_thread_failed:${threadError?.message ?? "unknown"}`);
      }

      const threadMessages: Array<{
        thread_id: string;
        patient_id: string;
        prescription_id: string;
        role: "user" | "assistant";
        message: string;
        created_at: string;
      }> = [
        {
          thread_id: thread.id,
          patient_id: params.userId,
          prescription_id: prescription.id,
          role: message.role,
          message: message.message,
          created_at: message.created_at
        }
      ];

      if (nextMessage?.role === "assistant") {
        threadMessages.push({
          thread_id: thread.id,
          patient_id: params.userId,
          prescription_id: prescription.id,
          role: nextMessage.role,
          message: nextMessage.message,
          created_at: nextMessage.created_at
        });
        index += 1;
      }

      const { error: chatHistoryError } = await supabase.from("chat_history_messages").insert(threadMessages);
      if (chatHistoryError) {
        throw new Error(`demo_seed_chat_history_failed:${chatHistoryError.message}`);
      }

      chatHistoryCount += threadMessages.length;
    }
  }

  for (const visit of fixture.careVisits) {
    const { data: insertedVisit, error: careVisitError } = await supabase
      .from("care_visits")
      .insert({
        patient_id: params.userId,
        visit_type: visit.visitType,
        provider_name: visit.providerName,
        location: visit.location,
        visit_date: new Date(now + visit.offsetHours * 60 * 60 * 1000).toISOString(),
        summary: visit.summary,
        next_steps: visit.nextSteps
      })
      .select("id")
      .single();

    if (careVisitError || !insertedVisit) {
      throw new Error(`demo_seed_care_visits_failed:${careVisitError?.message ?? "unknown"}`);
    }

    careVisitCount += 1;

    const careVisitPrescriptionEntries = visit.prescriptionMedicationNames
      .map((medicationName) => prescriptionIdsByMedicationName.get(medicationName))
      .filter((prescriptionId): prescriptionId is string => Boolean(prescriptionId))
      .map((prescriptionId) => ({
        visit_id: insertedVisit.id,
        prescription_id: prescriptionId
      }));

    if (careVisitPrescriptionEntries.length > 0) {
      const { error: careVisitPrescriptionError } = await supabase
        .from("care_visit_prescriptions")
        .insert(careVisitPrescriptionEntries);

      if (careVisitPrescriptionError) {
        throw new Error(`demo_seed_care_visit_prescriptions_failed:${careVisitPrescriptionError.message}`);
      }

      careVisitPrescriptionCount += careVisitPrescriptionEntries.length;
    }
  }

  return {
    userId: params.userId,
    email: params.email ?? null,
    prescriptionId: insertedPrescriptionIds[0] ?? null,
    scheduleId: null,
    counts: {
      prescriptions: insertedPrescriptionIds.length,
      careVisits: careVisitCount,
      careVisitPrescriptions: careVisitPrescriptionCount,
      schedules: scheduleCount,
      adherenceLogs: adherenceCount,
      reminderEvents: reminderCount,
      chatHistoryMessages: chatHistoryCount,
      guidanceDocuments: fixture.guidanceDocuments.length
    }
  };
}
