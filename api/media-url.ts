import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

function env(name: string): string | undefined {
  return process.env[name];
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

function getSupabaseForUser(request: Request): SupabaseClient | null {
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireUser(request: Request): Promise<
  { supabase: SupabaseClient; user: User } | { error: Response }
> {
  const supabase = getSupabaseForUser(request);
  if (!supabase) return { error: errorResponse("Supabase가 설정되지 않았습니다.", 500) };
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: errorResponse("로그인이 필요합니다.", 401) };
  return { supabase, user };
}

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

async function handlePost(req: Request) {
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

async function writeNodeResponse(
  res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string | Buffer) => void },
  response: Response,
) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

export async function POST(
  req: Request,
  res?: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string | Buffer) => void },
) {
  const request =
    req instanceof Request
      ? req
      : new Request("https://vercel.local/api/media-url", {
          method: "POST",
          headers: (req as { headers?: { authorization?: string } }).headers?.authorization
            ? { Authorization: String((req as { headers: { authorization?: string } }).headers.authorization) }
            : undefined,
          body: JSON.stringify((req as { body?: unknown }).body ?? {}),
        });
  const response = await handlePost(request);
  if (res && !(req instanceof Request)) {
    await writeNodeResponse(res, response);
    return;
  }
  return response;
}

export default POST;
