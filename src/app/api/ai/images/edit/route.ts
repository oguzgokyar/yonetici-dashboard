import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { brandConceptInstruction } from "@/lib/brand-concept";
import { renderCreative } from "@/lib/server/cliproxy-creative";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";
type ProviderRow = { base_url: string; encrypted_api_key: string; image_model: string; edit_model: string };
type ProjectRow = { brand_json: string; brand_concept_json: string };
type Asset = { id: string; url: string; mimeType: string };

function locateAsset(projectId: string, assetId: string) {
  const rows = getDatabase().prepare("SELECT response_json FROM generation_jobs WHERE project_id=? AND type='image' AND status='complete'").all(projectId) as unknown as { response_json: string }[];
  return rows.some((row) => { try { return (JSON.parse(row.response_json) as { assets?: Asset[] }).assets?.some((asset) => asset.id === assetId); } catch { return false; } });
}
function ratio(width = 1, height = 1) {
  const value = width / height;
  if (value > 1.55) return "16:9"; if (value < .61) return "9:16"; if (value < .72) return "2:3"; if (value < .9) return "4:5"; return "1:1";
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { projectId?: string; assetId?: string; instruction?: string } | null;
  if (!input?.projectId || !input.assetId || !/^[a-f0-9-]{36}$/i.test(input.assetId) || !input.instruction?.trim()) return Response.json({ ok: false, message: "Görsel ve düzenleme talimatı gerekli." }, { status: 400 });
  if (!locateAsset(input.projectId, input.assetId)) return Response.json({ ok: false, message: "Görsel bulunamadı." }, { status: 404 });
  const database = getDatabase();
  const provider = database.prepare("SELECT base_url, encrypted_api_key, image_model, edit_model FROM ai_provider_configs WHERE provider='cliproxy' AND enabled=1").get() as ProviderRow | undefined;
  const project = database.prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id=?").get(input.projectId) as ProjectRow | undefined;
  if (!provider?.base_url || !provider.encrypted_api_key || !project) return Response.json({ ok: false, message: "Proje veya CliProxyAPI ayarı bulunamadı." }, { status: 409 });
  const assetDir = path.join(process.cwd(), ".data", "assets");
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(assetDir, `${input.assetId}.json`), "utf8")) as { mimeType?: string; extension?: string };
    const sourceBytes = fs.readFileSync(path.join(assetDir, `${input.assetId}.${metadata.extension || "png"}`));
    const imageMetadata = await sharp(sourceBytes).metadata();
    const brand = JSON.parse(project.brand_json) as Record<string, string>; const concept = JSON.parse(project.brand_concept_json || "{}") as Record<string, string>;
    const model = provider.edit_model || provider.image_model;
    if (!model) return Response.json({ ok: false, message: "Görsel düzeltme modeli ayarlanmamış." }, { status: 409 });
    const prompt = `Ekli reklam kreatifini düzenle. Kullanıcının talimatı: ${input.instruction.trim()}\n\nMevcut tasarımın başarılı kompozisyonunu ve oranını koru; yalnızca talimatın gerektirdiği değişiklikleri yap. Görseldeki doğru Türkçe metinleri, marka adını, iletişim bilgilerini ve logoyu bozma veya yeniden yazma. Yeni yabancı dil, renk kodu, anlamsız metin ya da filigran ekleme. Metin ve logo kontrastını yüksek, tüm yazıları telefonda okunabilir tut. ${brandConceptInstruction(concept)} Marka: ${brand.brandName || ""}. Çıktı yalnızca bitmiş reklam görseli olsun.`;
    const rendered = await renderCreative({ baseUrl: provider.base_url.replace(/\/+$/, ""), apiKey: decryptSecret(provider.encrypted_api_key), model, prompt, ratio: ratio(imageMetadata.width, imageMetadata.height), previous: { bytes: sourceBytes, mimeType: metadata.mimeType || "image/png" } });
    const id = crypto.randomUUID(); const bytes = await sharp(rendered.bytes).png().toBuffer();
    fs.writeFileSync(path.join(assetDir, `${id}.png`), bytes); fs.writeFileSync(path.join(assetDir, `${id}.json`), JSON.stringify({ mimeType: "image/png", extension: "png" }));
    const now = new Date().toISOString(); const jobId = crypto.randomUUID(); const asset = { id, url: `/api/assets/${id}`, mimeType: "image/png" };
    database.prepare("INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, response_json, created_at, completed_at) VALUES (?, ?, 'image', 'cliproxy', ?, 'complete', ?, ?, ?, ?, ?)").run(jobId, input.projectId, model, input.instruction.trim(), JSON.stringify({ sourceAssetId: input.assetId, operation: "edit" }), JSON.stringify({ assets: [asset] }), now, now);
    return Response.json({ ok: true, asset: { ...asset, jobId, model, prompt: input.instruction.trim(), createdAt: now } });
  } catch (error) { return Response.json({ ok: false, message: error instanceof Error ? error.message : "Görsel düzenlenemedi." }, { status: 502 }); }
}
