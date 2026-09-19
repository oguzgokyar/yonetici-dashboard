import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";
import { renderAnimatedCreative } from "@/lib/server/local-remotion-renderer";
import type { AnimatedCreativeProps, MotionStyle } from "@/remotion/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type ImageAsset = { id: string; url: string; mimeType: string };
type ImageJobRow = { response_json: string };
type VideoJobRow = { id: string; request_json: string; response_json: string; created_at: string; completed_at: string | null };

function parseAssets(value: string) {
  try { return (JSON.parse(value) as { assets?: ImageAsset[] }).assets || []; }
  catch { return []; }
}

function findAsset(projectId: string, assetId: string) {
  const rows = getDatabase().prepare("SELECT response_json FROM generation_jobs WHERE project_id=? AND type='image' AND status='complete'").all(projectId) as unknown as ImageJobRow[];
  return rows.flatMap((row) => parseAssets(row.response_json)).find((asset) => asset.id === assetId);
}

function assetDataUrl(asset: ImageAsset) {
  const assetDir = path.join(process.cwd(), ".data", "assets");
  const metadata = JSON.parse(fs.readFileSync(path.join(assetDir, `${asset.id}.json`), "utf8")) as { mimeType?: string; extension?: string };
  const mimeType = metadata.mimeType || asset.mimeType || "image/png";
  const bytes = fs.readFileSync(path.join(assetDir, `${asset.id}.${metadata.extension || "png"}`));
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function localUrlToDataUrl(url: string | undefined) {
  if (!url || url.startsWith("data:")) return url;
  const id = url.match(/^\/api\/assets\/([a-f0-9-]{36})$/i)?.[1];
  if (!id) throw new Error("Katman varlığı geçersiz.");
  return assetDataUrl({ id, url, mimeType: "image/png" });
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!projectId) return Response.json({ ok: false, message: "Proje gerekli." }, { status: 400 });
  const rows = getDatabase().prepare("SELECT id, request_json, response_json, created_at, completed_at FROM generation_jobs WHERE project_id=? AND type='video' AND status='complete' ORDER BY created_at DESC LIMIT 50").all(projectId) as unknown as VideoJobRow[];
  const videos = rows.map((row) => {
    let idea: { id?: string; title?: string; concept?: string } | undefined;
    let sourceTopic: string | undefined;
    let sourceAssetId: string | undefined;
    let durationSeconds: number | undefined;
    let motionStyle: string | undefined;

    try {
      const requestState = JSON.parse(row.request_json || "{}");
      sourceAssetId = requestState.sourceAssetId;
      durationSeconds = requestState.durationSeconds;
      motionStyle = requestState.motionStyle;
      idea = requestState.idea;
      sourceTopic = requestState.sourceTopic;
    } catch { /* ignore */ }

    const responseState = JSON.parse(row.response_json || "{}");
    return {
      id: row.id,
      url: responseState.url || `/api/videos/${row.id}`,
      sourceAssetId,
      durationSeconds,
      motionStyle,
      idea,
      sourceTopic,
      createdAt: row.completed_at || row.created_at,
    };
  });
  return Response.json({ ok: true, videos });
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { projectId?: string; assetId?: string; packageId?: string; durationSeconds?: number; motionStyle?: MotionStyle } | null;
  if (!input?.projectId || !input.assetId || !input.packageId || !/^[a-f0-9-]{36}$/i.test(input.assetId) || !/^[a-f0-9-]{36}$/i.test(input.packageId)) return Response.json({ ok: false, message: "Proje, kreatif ve hazırlanmış katman paketi gerekli." }, { status: 400 });
  const durationSeconds = ([6, 8, 10] as const).find((value) => value === input.durationSeconds) || 8;
  const motionStyle: MotionStyle = ["minimal", "premium", "energetic"].includes(input.motionStyle || "") ? input.motionStyle! : "premium";
  const database = getDatabase();
  const asset = findAsset(input.projectId, input.assetId);
  const project = database.prepare("SELECT brand_json FROM projects WHERE id=?").get(input.projectId) as { brand_json: string } | undefined;
  const layerJob = database.prepare("SELECT response_json FROM generation_jobs WHERE id=? AND project_id=? AND type='video-layer' AND status='complete'").get(input.packageId, input.projectId) as { response_json: string } | undefined;
  if (!asset || !project || !layerJob) return Response.json({ ok: false, message: "Kreatif, proje veya katman paketi bulunamadı." }, { status: 404 });

  const brand = JSON.parse(project.brand_json || "{}") as { primaryColor?: string };
  const id = crypto.randomUUID(); const now = new Date().toISOString();

  // Inherit idea and sourceTopic from the source image generation job
  const imageJob = database.prepare("SELECT request_json FROM generation_jobs WHERE project_id=? AND type='image' AND response_json LIKE ?").get(input.projectId, `%"id":"${asset.id}"%`) as { request_json?: string } | undefined;
  let idea: { id?: string; title?: string; concept?: string } | undefined;
  let sourceTopic: string | undefined;
  if (imageJob?.request_json) {
    try {
      const req = JSON.parse(imageJob.request_json);
      idea = req.idea;
      sourceTopic = req.sourceTopic;
    } catch { /* ignore */ }
  }

  const requestState = { sourceAssetId: asset.id, packageId: input.packageId, durationSeconds, motionStyle, renderer: "local-remotion", composition: "AnimatedCreative", idea, sourceTopic };
  database.prepare("INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, created_at) VALUES (?, ?, 'video', 'local', 'remotion-4.0.484', 'rendering', ?, ?, ?)").run(id, input.projectId, `Kreatifi ${durationSeconds} saniyelik ${motionStyle} motion postere dönüştür`, JSON.stringify(requestState), now);

  try {
    const savedSpec = (JSON.parse(layerJob.response_json) as { spec: AnimatedCreativeProps }).spec;
    const props: AnimatedCreativeProps = { ...savedSpec, imageSrc: assetDataUrl(asset), backgroundSrc: localUrlToDataUrl(savedSpec.backgroundSrc), logoSrc: localUrlToDataUrl(savedSpec.logoSrc), visualLayers: (savedSpec.visualLayers || []).map((layer) => ({ ...layer, src: localUrlToDataUrl(layer.src)! })), durationSeconds, motionStyle, accentColor: brand.primaryColor || savedSpec.accentColor || "#6d5dfc" };
    await renderAnimatedCreative(id, props);
    const url = `/api/videos/${id}`;
    database.prepare("UPDATE generation_jobs SET status='complete', response_json=?, completed_at=? WHERE id=?").run(JSON.stringify({ url }), new Date().toISOString(), id);
    return Response.json({ ok: true, video: { id, url, sourceAssetId: asset.id, durationSeconds, motionStyle, createdAt: new Date().toISOString() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video render edilemedi.";
    database.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?").run(message.slice(0, 1000), new Date().toISOString(), id);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
