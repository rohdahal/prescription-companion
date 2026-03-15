import { askMedicationAssistant, extractPrescription } from "@prescription-companion/ai";
import { logAuditEvent, maskPhi } from "@prescription-companion/security";
import { createSupabaseAdminClient } from "@prescription-companion/supabase";
import { seedDemoDataForUser } from "./demoSeed";
import { loadSeedSession, saveSeedSession } from "./devSessionStore";
import { getCurrentSupabaseUser } from "./currentUser";
import { uploadPrescriptionFile } from "./storage";
import { extractTextFromUpload } from "./textExtraction";

export type AppServices = {
  askMedicationAssistant: typeof askMedicationAssistant;
  createSupabaseAdminClient: typeof createSupabaseAdminClient;
  extractPrescription: typeof extractPrescription;
  extractTextFromUpload: typeof extractTextFromUpload;
  getCurrentSupabaseUser: typeof getCurrentSupabaseUser;
  loadSeedSession: typeof loadSeedSession;
  logAuditEvent: typeof logAuditEvent;
  maskPhi: typeof maskPhi;
  saveSeedSession: typeof saveSeedSession;
  seedDemoDataForUser: typeof seedDemoDataForUser;
  uploadPrescriptionFile: typeof uploadPrescriptionFile;
};

export const defaultAppServices: AppServices = {
  askMedicationAssistant,
  createSupabaseAdminClient,
  extractPrescription,
  extractTextFromUpload,
  getCurrentSupabaseUser,
  loadSeedSession,
  logAuditEvent,
  maskPhi,
  saveSeedSession,
  seedDemoDataForUser,
  uploadPrescriptionFile
};
