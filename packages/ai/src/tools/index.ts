import { createSupabaseAdminClient } from "@prescription-companion/supabase";

type PrescriptionDetails = {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions: string;
  followUpRecommendation: string;
};

const mockInteractionMap: Record<string, string> = {
  "amoxicillin|ibuprofen": "No major interaction expected for most patients.",
  "warfarin|ibuprofen": "Potential increased bleeding risk. Consult your clinician."
};

export async function getPrescriptionDetails(prescriptionId: string): Promise<PrescriptionDetails | { error: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("prescriptions")
    .select("id, medication_name, dosage, frequency, instructions, follow_up_recommendation")
    .eq("id", prescriptionId)
    .maybeSingle();

  if (error) {
    return { error: "supabase_error" };
  }

  if (!data) {
    return { error: "prescription_not_found" };
  }

  return {
    id: data.id,
    medicationName: data.medication_name,
    dosage: data.dosage,
    frequency: data.frequency,
    instructions: data.instructions,
    followUpRecommendation: data.follow_up_recommendation
  };
}

export async function getMedicationSchedule(prescriptionId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("medication_schedules")
    .select("id, dose_times")
    .eq("prescription_id", prescriptionId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error) {
    return { prescriptionId, doses: [], error: "supabase_error" };
  }

  const times = Array.isArray(data?.dose_times) ? data.dose_times : [];
  const doses = times
    .filter((time): time is string => typeof time === "string")
    .map((time) => ({ time, status: "pending" as const }));

  return {
    prescriptionId,
    scheduleId: data?.id ?? null,
    doses
  };
}

export function checkDrugInteraction(params: { medicationA: string; medicationB: string }) {
  const key = `${params.medicationA.toLowerCase()}|${params.medicationB.toLowerCase()}`;
  const reverseKey = `${params.medicationB.toLowerCase()}|${params.medicationA.toLowerCase()}`;
  return {
    interaction: mockInteractionMap[key] ?? mockInteractionMap[reverseKey] ?? "No interaction found in local dataset.",
    source: "mock-local-dataset"
  };
}

export const localTools = {
  getPrescriptionDetails,
  getMedicationSchedule,
  checkDrugInteraction
};
