import { createSupabaseAdminClient } from "@prescription-companion/supabase";

export async function uploadPrescriptionFile(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const supabase = createSupabaseAdminClient();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "prescriptions";
  const { error } = await supabase.storage.from(bucket).upload(params.key, params.body, {
    contentType: params.contentType,
    upsert: false
  });

  if (error) {
    throw new Error(`storage_upload_failed:${error.message}`);
  }

  return { bucket, key: params.key };
}
