import "dotenv/config";
import cron from "node-cron";
import { createSupabaseAdminClient } from "@prescription-companion/supabase";

async function createReminderEvents(reminderType: "dose" | "follow_up" | "refill") {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("reminder_events").insert({
    reminder_type: reminderType,
    status: "pending",
    scheduled_for: new Date().toISOString(),
    meta: {
      scheduler: "node-cron",
      runtime_target: "aws-lambda-eventbridge-compatible"
    }
  });

  if (error) {
    console.error(`Failed to create ${reminderType} reminders`, error);
  }
}

export function startScheduler() {
  cron.schedule("*/15 * * * *", async () => {
    await createReminderEvents("dose");
  });

  cron.schedule("0 9 * * *", async () => {
    await createReminderEvents("follow_up");
  });

  cron.schedule("0 10 * * 1", async () => {
    await createReminderEvents("refill");
  });

  console.log("Prescription Companion scheduler started");
}

startScheduler();

