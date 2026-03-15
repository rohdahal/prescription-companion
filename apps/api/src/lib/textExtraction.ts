export async function extractTextFromUpload(params: {
  providedText?: string;
  fileBuffer?: Buffer;
}): Promise<string> {
  if (params.providedText && params.providedText.trim().length > 0) {
    return params.providedText.trim();
  }

  if (params.fileBuffer) {
    return params.fileBuffer.toString("utf8");
  }

  throw new Error("missing_prescription_content");
}

