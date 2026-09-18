import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { analyzeCreative, renderCreative, type MediaInput } from "@/lib/server/cliproxy-creative";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import { parseJsonResponse } from "@/lib/server/cliproxy-text";
import type { AnimatedCreativeProps, LayerBox, LayerEffect, VisualLayer } from "@/remotion/types";

export const runtime = "nodejs";
export const maxDuration = 600;

type ProviderRow = { base_url: string; encrypted_api_key: string; text_model: string; image_model: string; vision_model: string; edit_model: string };
type Asset = { id: string; url: string; mimeType: string };
type ImageJob = { id: string; request_json: string; response_json: string };
type CreativePlan = { headline?: string; supportingText?: string; cta?: string; artDirection?: string };
type Analysis = {
  objects?: { name?: string; description?: string; effect?: LayerEffect; box?: LayerBox }[];
  layout?: Partial<Record<"logo" | "headline" | "body" | "cta" | "brand" | "contact", LayerBox>>;
  textColor?: string;
  textAlign?: "left" | "center" | "right";
};

function cleanBox(value: LayerBox | undefined, fallback: LayerBox) {
  const number = (candidate: unknown, defaultValue: number) => typeof candidate === "number" && Number.isFinite(candidate) ? Math.max(0, Math.min(100, candidate)) : defaultValue;
  return { x: number(value?.x, fallback.x), y: number(value?.y, fallback.y), width: number(value?.width, fallback.width), height: number(value?.height, fallback.height) };
}

async function availableModels(baseUrl: string, apiKey: string) {
  const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) return [];
  const body = await response.json() as { data?: { id?: string }[] };
  return body.data?.map((item) => item.id).filter((id): id is string => Boolean(id)) || [];
}

function assetContext(projectId: string, assetId: string) {
  const rows = getDatabase().prepare("SELECT id, request_json, response_json FROM generation_jobs WHERE project_id=? AND type='image' AND status='complete' ORDER BY created_at DESC").all(projectId) as unknown as ImageJob[];
  for (const row of rows) {
    try {
      const assets = (JSON.parse(row.response_json) as { assets?: Asset[] }).assets || []; const index = assets.findIndex((asset) => asset.id === assetId);
      if (index >= 0) { const requestState = JSON.parse(row.request_json) as { plans?: CreativePlan[]; ratio?: string; selectedFields?: string[] }; return { asset: assets[index], plan: requestState.plans?.[index] || {}, ratio: requestState.ratio || "9:16", selectedFields: requestState.selectedFields || [] }; }
    } catch { /* continue */ }
  }
  return null;
}

function localAsset(asset: Asset): MediaInput {
  const assetDir = path.join(process.cwd(), ".data", "assets"); const meta = JSON.parse(fs.readFileSync(path.join(assetDir, `${asset.id}.json`), "utf8")) as { mimeType?: string; extension?: string };
  return { bytes: fs.readFileSync(path.join(assetDir, `${asset.id}.${meta.extension || "png"}`)), mimeType: meta.mimeType || asset.mimeType || "image/png" };
}

function expandBox(box: LayerBox, amount = 1.5): LayerBox {
  return { x: Math.max(0, box.x - amount), y: Math.max(0, box.y - amount), width: Math.min(100 - Math.max(0, box.x - amount), box.width + amount * 2), height: Math.min(100 - Math.max(0, box.y - amount), box.height + amount * 2) };
}

async function boxMask(width: number, height: number, boxes: LayerBox[], blur = 5) {
  const rectangles = boxes.map((box) => {
    const x = box.x / 100 * width; const y = box.y / 100 * height; const w = box.width / 100 * width; const h = box.height / 100 * height;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * .08}" fill="white"/>`;
  }).join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/>${rectangles}</svg>`);
  return sharp(svg).greyscale().blur(Math.max(.3, blur)).png().toBuffer();
}

async function localizedCleanPlate(source: MediaInput, candidate: MediaInput, boxes: LayerBox[], width: number, height: number) {
  const mask = await boxMask(width, height, boxes.map((box) => expandBox(box, 1.8)), 7);
  const replacement = await sharp(candidate.bytes).resize(width, height, { fit: "fill" }).removeAlpha().joinChannel(mask).png().toBuffer();
  return { bytes: await sharp(source.bytes).resize(width, height, { fit: "fill" }).composite([{ input: replacement, blend: "over" }]).png().toBuffer(), mimeType: "image/png" } satisfies MediaInput;
}

async function differenceLayer(source: MediaInput, cleanPlate: MediaInput, box: LayerBox, width: number, height: number, preservePanel = false) {
  const sourceRaw = await sharp(source.bytes).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const cleanRaw = await sharp(cleanPlate.bytes).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const output = Buffer.alloc(width * height * 4); const region = expandBox(box, 1.1);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const x = pixel % width; const y = Math.floor(pixel / width); const sourceOffset = pixel * 3; const outputOffset = pixel * 4;
    const inside = x >= region.x / 100 * width && x <= (region.x + region.width) / 100 * width && y >= region.y / 100 * height && y <= (region.y + region.height) / 100 * height;
    const delta = Math.max(Math.abs(sourceRaw[sourceOffset] - cleanRaw[sourceOffset]), Math.abs(sourceRaw[sourceOffset + 1] - cleanRaw[sourceOffset + 1]), Math.abs(sourceRaw[sourceOffset + 2] - cleanRaw[sourceOffset + 2]));
    output[outputOffset] = sourceRaw[sourceOffset]; output[outputOffset + 1] = sourceRaw[sourceOffset + 1]; output[outputOffset + 2] = sourceRaw[sourceOffset + 2];
    const threshold = preservePanel ? 7 : 24; const gain = preservePanel ? 12 : 18;
    output[outputOffset + 3] = inside ? Math.max(0, Math.min(255, (delta - threshold) * gain)) : 0;
  }
  return { bytes: await sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer(), mimeType: "image/png" } satisfies MediaInput;
}

async function ambientObjectLayer(source: MediaInput, box: LayerBox, width: number, height: number) {
  const mask = await boxMask(width, height, [expandBox(box, .8)], 18);
  return { bytes: await sharp(source.bytes).resize(width, height, { fit: "fill" }).removeAlpha().joinChannel(mask).png().toBuffer(), mimeType: "image/png" } satisfies MediaInput;
}

function contentGradient(boxes: LayerBox[]) {
  const relevant = boxes.filter((box) => box.width < 95 && box.height < 45);
  const minX = Math.min(...relevant.map((box) => box.x)); const maxX = Math.max(...relevant.map((box) => box.x + box.width));
  const minY = Math.min(...relevant.map((box) => box.y)); const maxY = Math.max(...relevant.map((box) => box.y + box.height));
  const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
  if (centerY >= 55) return "linear-gradient(to top, rgba(5,8,16,.94) 0%, rgba(5,8,16,.72) 34%, rgba(5,8,16,.22) 64%, transparent 84%)";
  if (centerY <= 45) return "linear-gradient(to bottom, rgba(5,8,16,.94) 0%, rgba(5,8,16,.70) 34%, rgba(5,8,16,.18) 64%, transparent 84%)";
  if (centerX <= 50) return "linear-gradient(to right, rgba(5,8,16,.92) 0%, rgba(5,8,16,.66) 38%, transparent 82%)";
  return "linear-gradient(to left, rgba(5,8,16,.92) 0%, rgba(5,8,16,.66) 38%, transparent 82%)";
}

async function saveAsset(media: MediaInput) {
  const id = crypto.randomUUID(); const assetDir = path.join(process.cwd(), ".data", "assets"); fs.mkdirSync(assetDir, { recursive: true });
  const bytes = await sharp(media.bytes).png().toBuffer(); fs.writeFileSync(path.join(assetDir, `${id}.png`), bytes); fs.writeFileSync(path.join(assetDir, `${id}.json`), JSON.stringify({ mimeType: "image/png", extension: "png" }));
  return `/api/assets/${id}`;
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { projectId?: string; assetId?: string } | null;
  if (!input?.projectId || !input.assetId || !/^[a-f0-9-]{36}$/i.test(input.assetId)) return Response.json({ ok: false, message: "Proje ve kreatif gerekli." }, { status: 400 });
  const database = getDatabase();
  const cached = database.prepare("SELECT id, response_json FROM generation_jobs WHERE project_id=? AND type='video-layer' AND status='complete' AND json_extract(request_json, '$.sourceAssetId')=? AND json_extract(request_json, '$.pipelineVersion')=7 ORDER BY created_at DESC LIMIT 1").get(input.projectId, input.assetId) as { id: string; response_json: string } | undefined;
  if (cached) return Response.json({ ok: true, packageId: cached.id, spec: (JSON.parse(cached.response_json) as { spec: AnimatedCreativeProps }).spec, cached: true });

  const context = assetContext(input.projectId, input.assetId);
  const project = database.prepare("SELECT brand_json FROM projects WHERE id=?").get(input.projectId) as { brand_json: string } | undefined;
  const provider = database.prepare("SELECT base_url, encrypted_api_key, text_model, image_model, vision_model, edit_model FROM ai_provider_configs WHERE provider='cliproxy' AND enabled=1").get() as ProviderRow | undefined;
  if (!context || !project) return Response.json({ ok: false, message: "Kreatif veya proje bulunamadı." }, { status: 404 });
  if (!provider?.base_url || !provider.encrypted_api_key) return Response.json({ ok: false, message: "Katman üretimi için CliProxyAPI ayarı gerekli." }, { status: 409 });

  const id = crypto.randomUUID(); const now = new Date().toISOString(); const requestState = { sourceAssetId: input.assetId, operation: "gradient-backed-pixel-faithful-layer-decomposition", pipelineVersion: 7 };
  database.prepare("INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, created_at) VALUES (?, ?, 'video-layer', 'cliproxy', '', 'running', ?, ?, ?)").run(id, input.projectId, "Kreatifi bağımsız video katmanlarına ayır", JSON.stringify(requestState), now);

  try {
    const brand = JSON.parse(project.brand_json) as Record<string, string>; const source = localAsset(context.asset); const apiKey = decryptSecret(provider.encrypted_api_key); const baseUrl = provider.base_url.replace(/\/+$/, ""); const models = await availableModels(baseUrl, apiKey);
    const imageModel = provider.edit_model || provider.image_model || models.find((model) => /gemini-3\.1-flash-image|gemini-3-pro-image|gemini-2\.5-flash-image|gpt-image/i.test(model)) || "";
    const visionModel = provider.vision_model || provider.text_model || models.find((model) => /gemini.*(?:pro|flash)(?!.*image)|gpt-4\.1|gpt-5/i.test(model)) || imageModel;
    if (!imageModel || !visionModel) throw new Error("Katman üretimi için görsel ve vision modeli bulunamadı.");

    const analysisPrompt = `Bu reklam kreatifini katmanlı motion tasarıma dönüştürmek için analiz et. Yalnızca JSON döndür. Yüzde koordinatları 0-100 aralığında ve orijinal tuvale göre olsun. Metin ve logo kutularını tam konumlarıyla ver. Fotoğraftaki bağımsız hareket ettirilebilecek en fazla 3 ana görsel objeyi tanımla ve her biri için sıkı sınırlayıcı kutu ver. Logo, logo paneli, yazı, CTA ve metin zeminini görsel obje listesine dahil etme. JSON: {"objects":[{"name":"kısa ad","description":"görseldeki tam görünüm ve konum","effect":"parallax|float|scale|glow","box":{"x":0,"y":0,"width":0,"height":0}}],"layout":{"logo":{"x":0,"y":0,"width":0,"height":0},"headline":{},"body":{},"cta":{},"brand":{},"contact":{}},"textColor":"#RRGGBB","textAlign":"left|center|right"}.`;
    let analysis: Analysis = {};
    try { analysis = parseJsonResponse<Analysis>(await analyzeCreative({ baseUrl, apiKey, model: visionModel, image: source, prompt: analysisPrompt })); } catch { analysis = {}; }
    const objects = (analysis.objects || []).filter((item) => item.name && item.description && !/logo|marka|panel/i.test(`${item.name} ${item.description}`)).slice(0, 3);
    if (!objects.length) objects.push({ name: "Ana görsel obje", description: context.plan.artDirection || "Reklam kreatifindeki ana ürün veya mimari obje", effect: "parallax" });

    const layout = analysis.layout || {}; const sourceMetadata = await sharp(source.bytes).metadata(); const width = sourceMetadata.width || 1024; const height = sourceMetadata.height || 1536;
    const selected = new Set(context.selectedFields);
    const contentDefinitions = ([
      { id: "logo", name: "Logo", text: selected.has("logo") ? "marka logosu" : "", effect: "fade", delay: 8 },
      { id: "headline", name: "Başlık", text: context.plan.headline || "", effect: "reveal", delay: 22 },
      { id: "body", name: "Destek metni", text: context.plan.supportingText || "", effect: "fade", delay: 38 },
      { id: "cta", name: "CTA", text: context.plan.cta || brand.defaultCta || "", effect: "reveal", delay: 54 },
      { id: "brand", name: "Marka adı", text: selected.has("brandName") ? brand.brandName || "" : "", effect: "fade", delay: 66 },
      { id: "contact", name: "İletişim", text: ["website", "email", "phone", "address"].filter((key) => selected.has(key) && brand[key]).map((key) => brand[key]).join(" · "), effect: "fade", delay: 74 },
    ] satisfies { id: "logo" | "headline" | "body" | "cta" | "brand" | "contact"; name: string; text: string; effect: LayerEffect; delay: number }[]).filter((item) => item.text.trim());
    const contentBoxes = contentDefinitions.flatMap((item) => layout[item.id] ? [{ ...item, box: cleanBox(layout[item.id], layout[item.id]!) }] : []);
    if (!contentBoxes.length) throw new Error("Kreatifteki hareketli içerik alanları güvenilir biçimde tespit edilemedi.");
    const removableList = contentDefinitions.map((item) => `${item.name}: ${item.text}`).join("\n");
    const cleanCandidate = await renderCreative({ baseUrl, apiKey, model: imageModel, ratio: context.ratio, previous: source, prompt: `Ekli bitmiş reklam kreatifinin kamera açısını, mimarisini, fotoğrafını, ürünlerini, insanlarını, renklerini ve ışığını değiştirmeden yalnızca aşağıdaki grafik içerikleri sil. Başka hiçbir bölgeyi yeniden tasarlama veya değiştirme. Silinen küçük alanları hemen çevresindeki gerçek fotoğraf dokusuyla tamamla.\n\nSİLİNECEK GRAFİK İÇERİKLER:\n${removableList}\n\nÖNEMLİ: Pergola, havuz, mobilya, bina, gökyüzü ve bütün fotoğraf objeleri kesinlikle yerinde ve aynı görünümde kalmalı. Yeni yazı, logo, obje veya filigran ekleme.` });
    const background = await localizedCleanPlate(source, cleanCandidate, contentBoxes.map((item) => item.box), width, height);
    const backgroundSrc = await saveAsset(background); const visualLayers: VisualLayer[] = [];

    for (let index = 0; index < objects.length; index++) {
      const object = objects[index]; if (!object.box) continue;
      visualLayers.push({ id: `ambient-${index + 1}`, name: `${object.name} ışık efekti`, src: await saveAsset(await ambientObjectLayer(background, cleanBox(object.box, object.box), width, height)), effect: "ambient", delay: 10 + index * 7 });
    }
    for (const item of contentBoxes) {
      visualLayers.push({ id: item.id, name: item.name, src: await saveAsset(await differenceLayer(source, background, item.box, width, height, item.id === "logo")), effect: item.effect, delay: item.delay });
    }
    const designAspectRatio = width / height;
    const spec: AnimatedCreativeProps = { imageSrc: context.asset.url, backgroundSrc, visualLayers, contentGradient: contentGradient(contentBoxes.filter((item) => item.id !== "logo").map((item) => item.box)), textLayers: [], designAspectRatio, durationSeconds: 8, motionStyle: "premium", accentColor: brand.primaryColor || "#6d5dfc" };
    database.prepare("UPDATE generation_jobs SET model=?, status='complete', response_json=?, completed_at=? WHERE id=?").run(`${imageModel} + ${visionModel}`, JSON.stringify({ spec }), new Date().toISOString(), id);
    return Response.json({ ok: true, packageId: id, spec });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kreatif katmanlara ayrılamadı."; database.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?").run(message.slice(0, 1000), new Date().toISOString(), id);
    return Response.json({ ok: false, message }, { status: 502 });
  }
}
