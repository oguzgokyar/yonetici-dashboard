import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const assetDir = path.join(process.cwd(), ".data", "assets");
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(assetDir, `${id}.json`), "utf8")) as { mimeType: string; extension: string };
    const bytes = fs.readFileSync(path.join(assetDir, `${id}.${metadata.extension}`));
    return new Response(bytes, { headers: { "Content-Type": metadata.mimeType, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
