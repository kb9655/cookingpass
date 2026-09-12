import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { errorResponse, getSupabaseForUser, json, requireUser } from "./_shared/auth";
import { env } from "./_shared/env";

async function signedR2Url(storagePath: string): Promise<string | null> {
  const publicBase = env("R2_PUBLIC_BASE_URL");
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${storagePath.replace(/^\//, "")}`;
  }

  const accountId = env("R2_ACCOUNT_ID");
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const bucket = env("R2_BUCKET_NAME");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: storagePath }),
    { expiresIn: 60 * 10 },
  );
}

export async function POST(req: Request) {
  if (req.method !== "POST") {
    return errorResponse("POST만 허용됩니다.", 405);
  }

  let body: { media_id?: string; storage_path?: string } = {};
  try {
    body = (await req.json()) as { media_id?: string; storage_path?: string };
  } catch {
    return errorResponse("요청 본문이 JSON이 아닙니다.", 400);
  }

  let storagePath = body.storage_path ?? null;
  let sourceUrl: string | null = null;

  if (body.media_id) {
    const supabase = getSupabaseForUser(req);
    if (!supabase) {
      return errorResponse("Supabase가 설정되지 않았습니다.", 500);
    }
    const { data, error } = await supabase
      .from("media")
      .select("storage_path, source_url")
      .eq("id", body.media_id)
      .maybeSingle();
    if (error) return errorResponse("미디어를 찾지 못했습니다.", 500);
    storagePath = storagePath ?? data?.storage_path ?? null;
    sourceUrl = data?.source_url ?? null;
  }

  if (sourceUrl) {
    return json({ url: sourceUrl });
  }

  if (!storagePath) {
    return json({ url: null });
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const url = await signedR2Url(storagePath);
    return json({ url });
  } catch (error) {
    console.error("media-url error:", error);
    return errorResponse("미디어 URL을 만들지 못했습니다.", 502);
  }
}

export default POST;
