import { testPostizConnection } from "@/lib/server/postiz-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      baseUrl?: string;
      apiKey?: string;
    };

    const result = await testPostizConnection(body.baseUrl, body.apiKey);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
