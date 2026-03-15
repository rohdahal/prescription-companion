import { createSupabaseAdminClient } from "@prescription-companion/supabase";

export type GuidanceDocument = {
  id: string;
  title: string;
  content: string;
  embedding: number[];
};

export async function storeGuidanceEmbedding(doc: GuidanceDocument) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("medication_guidance_embeddings").upsert({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    embedding: doc.embedding
  });

  if (error) {
    throw new Error(`embedding_store_failed:${error.message}`);
  }
}

export async function retrieveGuidanceContext(embedding: number[], topK = 3): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("match_medication_guidance", {
    query_embedding: embedding,
    match_count: topK
  });

  if (error) {
    console.error("Failed to retrieve embeddings context", error);
    return [];
  }

  return (data ?? []).map((item: { content: string }) => item.content);
}

