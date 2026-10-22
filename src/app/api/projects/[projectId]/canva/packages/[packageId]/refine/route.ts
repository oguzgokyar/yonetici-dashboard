import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { isCanvaStudioEnabled, getCanvaConfig } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";
import { saveSinglePackageAsset } from "@/lib/server/canva-package-service";

import {
  getNextAvailableCanvaAccount,
  markCanvaAccountExhausted,
  recordCanvaAccountSuccess,
} from "@/lib/server/canva-account-pool";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string; packageId: string }> };

/**
 * Direct fast export via host bridge (1-2 seconds) with Multi-Account Pool failover
 */
async function exportCanvaDesignPages(designId: string, baseUrl: string, apiKey: string): Promise<string[]> {
  const bridgeEndpoints = [
    { host: "10.0.1.1", port: 8080 },
    { host: "10.0.7.1", port: 8080 },
    { host: "127.0.0.1", port: 8080 },
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    const activeAcc = getNextAvailableCanvaAccount();
    const payload = JSON.stringify({
      design_id: designId,
      format: { type: "png" },
      account_id: activeAcc?.id,
      token_json: activeAcc?.tokenJson,
    });

    let tryNextAccount = false;

    for (const ep of bridgeEndpoints) {
      try {
        const data = await new Promise<{
          ok?: boolean;
          urls?: string[];
          is_quota_fallback?: boolean;
          fallback?: string;
          error?: string;
        } | null>((resolve) => {
          const req = http.request(
            {
              hostname: ep.host,
              port: ep.port,
              path: "/api/internal/canva/export",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
                Connection: "close",
              },
              timeout: 60000,
            },
            (res) => {
              let body = "";
              res.setEncoding("utf8");
              res.on("data", (chunk) => { body += chunk; });
              res.on("end", () => {
                try { resolve(JSON.parse(body)); } catch { resolve(null); }
              });
            }
          );
          req.on("error", () => resolve(null));
          req.on("timeout", () => { req.destroy(); resolve(null); });
          req.write(payload);
          req.end();
        });

        if (data && data.ok && Array.isArray(data.urls) && data.urls.length > 0) {
          if (activeAcc) recordCanvaAccountSuccess(activeAcc.id);
          return data.urls;
        }

        if (data && ((data as { code?: string }).code === "quota_exceeded" || (data.error && data.error.includes("Too many daily export requests")))) {
          if (activeAcc) {
            markCanvaAccountExhausted(activeAcc.id, "Too many daily export requests for user");
          }
          const nextAcc = getNextAvailableCanvaAccount();
          if (nextAcc && nextAcc.id !== activeAcc?.id) {
            tryNextAccount = true;
            break;
          }
        }
      } catch {
        // Continue to next bridge or fallback
      }
    }

    if (!tryNextAccount) break;
  }

  // 2. Fallback: Dispatch to Hermes Agent via /v1/runs with export-design prompt
  const exportPrompt = `Call mcp__canva__export_design on design_id='${designId}' with format={'type':'png'}. Return the JSON object containing urls.`;
  const fallbackRes = await fetch(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: "hermes-agent",
      input: exportPrompt,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!fallbackRes.ok && fallbackRes.status !== 202) return [];

  const fallbackData = (await fallbackRes.json().catch(() => ({}))) as { run_id?: string; id?: string };
  const fbRunId = fallbackData.run_id || fallbackData.id;
  if (!fbRunId) return [];

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const fbRes = await fetch(`${baseUrl}/v1/runs/${fbRunId}`, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    if (!fbRes || !fbRes.ok) continue;
    const data = await fbRes.json();
    if (data.status === "completed" || data.status === "success") {
      const outText = JSON.stringify(data.output || data.result || "");
      const matches = Array.from(
        outText.matchAll(/https:\/\/export-download\.canva\.com\/[^\s"',\]}]+/g)
      ).map((m) => m[0]);
      if (matches.length > 0) return matches;
    } else if (data.status === "failed") {
      break;
    }
  }

  return [];
}

/**
 * Background worker executing the Hermes Agent Canva refinement task,
 * updating progress in generation_jobs, downloading fresh PNG assets,
 * and resetting package video_status to 'idle'.
 */
async function runBackgroundRefineExecution(params: {
  jobId: string;
  projectId: string;
  packageId: string;
  designId: string;
  runId: string;
  baseUrl: string;
  apiKey: string;
  assetsDir: string;
}) {
  const { jobId, packageId, designId, runId, baseUrl, apiKey, assetsDir } = params;
  const db = getDatabase();

  const updateJobProgress = (percent: number, detail: string, phase = "editing") => {
    try {
      db.prepare(
        "UPDATE generation_jobs SET progress_json=? WHERE id=? AND status='running'"
      ).run(
        JSON.stringify({ phase, percent, detail, updatedAt: new Date().toISOString() }),
        jobId
      );
    } catch {}
  };

  try {
    const pollDeadline = Date.now() + 25 * 60 * 1000; // 25 dakika maksimum süre
    let pollCount = 0;
    let agentFinished = false;

    while (Date.now() < pollDeadline) {
      await new Promise((r) => setTimeout(r, 4000));
      pollCount++;

      const checkRes = await fetch(`${baseUrl}/v1/runs/${runId}`, {
        headers: {
          Accept: "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);

      if (!checkRes || !checkRes.ok) continue;

      const checkData = (await checkRes.json().catch(() => ({}))) as {
        status?: string;
        output?: string;
        result?: string;
        error?: string;
      };

      const status = checkData.status;

      if (status === "running" || status === "started") {
        const calculatedPercent = Math.min(80, 25 + Math.floor(pollCount * 1.5));
        updateJobProgress(
          calculatedPercent,
          pollCount % 2 === 0
            ? "Canva MCP ile nesneler cerrahi olarak düzenleniyor..."
            : "Sayfa marjinleri ve sayaç güvenli alanı ferahlatılıyor..."
        );
      } else if (status === "completed" || status === "success") {
        agentFinished = true;
        break;
      } else if (status === "failed" || status === "cancelled") {
        throw new Error(checkData.error || "Hermes düzenleme görevi iptal edildi veya başarısız oldu.");
      }
    }

    if (!agentFinished) {
      throw new Error("Hermes düzenleme görevi zaman aşımına uğradı.");
    }

    // Doğrudan hızlı yerel köprüden güncel yüksek çözünürlüklü PNG sayfalarını al (1-2 sn)
    updateJobProgress(85, "Canva'dan güncel sayfalar dışa aktarılıyor...", "exporting");
    const exportUrls = await exportCanvaDesignPages(designId, baseUrl, apiKey);

    if (exportUrls.length === 0) {
      throw new Error("Canva güncel sayfaları dışa aktarılamadı.");
    }

    updateJobProgress(90, "Yeni sayfalar indirilip galeriye işleniyor...", "downloading");

    // İndir ve mevcut asset'leri güncelle
    const savedAssets: Array<{
      assetId: string;
      position: number;
      width: number;
      height: number;
      extension: string;
    }> = [];

    for (let i = 0; i < exportUrls.length; i++) {
      const pageUrl = exportUrls[i];
      const pageNum = i + 1;
      const dlRes = await fetch(pageUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(45000),
      });
      if (!dlRes.ok) continue;

      const fileBuffer = Buffer.from(await dlRes.arrayBuffer());
      const saved = await saveSinglePackageAsset({
        buffer: fileBuffer,
        position: pageNum,
        assetsDir,
      });
      savedAssets.push(saved);
    }

    if (savedAssets.length === 0) {
      throw new Error("Sayfa görselleri indirilemedi.");
    }

    // Veritabanını güncelle
    const nowIso = new Date().toISOString();
    const pkg = db.prepare("SELECT cover_asset_id FROM media_packages WHERE id=?").get(packageId) as { cover_asset_id?: string } | undefined;
    const coverAssetId = savedAssets[0]?.assetId || pkg?.cover_asset_id;

    const oldItems = db
      .prepare("SELECT asset_id FROM media_package_items WHERE package_id=?")
      .all(packageId) as { asset_id: string }[];

    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM media_package_items WHERE package_id=?").run(packageId);

      for (const a of savedAssets) {
        db.prepare(
          `INSERT INTO media_package_items (id, package_id, position, asset_id, mime_type, width, height, created_at)
           VALUES (?, ?, ?, ?, 'image/png', ?, ?, ?)`
        ).run(
          crypto.randomUUID(),
          packageId,
          a.position,
          a.assetId,
          a.width,
          a.height,
          nowIso
        );
      }

      db.prepare(
        "UPDATE media_packages SET cover_asset_id=?, item_count=?, video_status='idle', updated_at=? WHERE id=?"
      ).run(coverAssetId || null, savedAssets.length, nowIso, packageId);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }

    // Eski geçersiz asset dosyalarını temizle
    for (const old of oldItems) {
      if (!savedAssets.some((sa) => sa.assetId === old.asset_id)) {
        for (const suffix of [".png", ".json", "_thumb.webp", "_preview.webp"]) {
          try {
            fs.unlinkSync(path.join(assetsDir, `${old.asset_id}${suffix}`));
          } catch {}
        }
      }
    }

    // Üretim Listesindeki iş kaydını tamamlandıya geçir
    db.prepare(
      "UPDATE generation_jobs SET status='complete', progress_json=?, completed_at=? WHERE id=?"
    ).run(
      JSON.stringify({ phase: "complete", percent: 100, detail: `Tasarım yerleşimi başarıyla onarıldı (${savedAssets.length} sayfa güncellendi)` }),
      nowIso,
      jobId
    );
  } catch (err: unknown) {
    console.error("[Refine Background Error]:", err);
    const errNow = new Date().toISOString();
    const errMsg = err instanceof Error ? err.message : String(err);

    db.prepare("UPDATE media_packages SET video_status='idle', updated_at=? WHERE id=?").run(
      errNow,
      packageId
    );
    db.prepare(
      "UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?").run(errMsg.slice(0, 500), errNow, jobId);
  }
}

export async function POST(request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId, packageId } = await context.params;
  const database = getDatabase();

  const pkg = database
    .prepare("SELECT * FROM media_packages WHERE id=? AND project_id=?")
    .get(packageId, projectId) as {
      id: string;
      project_id: string;
      generation_job_id: string;
      package_type: string;
      title: string;
      cover_asset_id: string;
      item_count: number;
      canva_design_id: string;
    } | undefined;

  if (!pkg) {
    return Response.json({ ok: false, message: "Paket bulunamadı." }, { status: 404 });
  }

  const designId = pkg.canva_design_id;
  if (!designId) {
    return Response.json(
      { ok: false, message: "Bu pakete ait Canva tasarım kimliği bulunamadı." },
      { status: 400 }
    );
  }

  // Orijinal içerik konusunu/başlığını tespit et
  let meaningfulTitle = pkg.title || "Canva Tasarımı";
  if (pkg.generation_job_id) {
    const origJob = database
      .prepare("SELECT prompt FROM generation_jobs WHERE id=?")
      .get(pkg.generation_job_id) as { prompt?: string } | undefined;
    if (origJob?.prompt) {
      const clean = origJob.prompt.trim();
      const match = clean.match(/^(?:BAŞLIK|Başlık|Konu|TITLE|Title)\s*:\s*([^\n\r]+)/i);
      if (match && match[1]) {
        meaningfulTitle = match[1].trim().slice(0, 65);
      } else {
        const firstLine = clean.split(/[\r\n]+/)[0]?.trim();
        if (firstLine && firstLine.length > 5) {
          meaningfulTitle = firstLine.slice(0, 65);
        }
      }
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    slideIndex?: number;
    notes?: string;
  };

  const canvaConfig = getCanvaConfig();
  const apiKey = canvaConfig.apiKey;
  const baseUrl = canvaConfig.baseUrl.replace(/\/+$/, "");
  const assetsDir = path.join(process.cwd(), ".data", "assets");

  // Üretim Listesinde (Production Queue) canlı takip edilebilmesi için iş kaydı oluştur
  const jobId = crypto.randomUUID();
  const slideLabel = typeof body.slideIndex === "number" ? ` (Slayt ${body.slideIndex + 1})` : "";
  const jobTitle = `${meaningfulTitle} — 🪄 AI Düzen Onarımı${slideLabel}`;

  try {
    // İşaretle: video_status = 'refining' (UI kartında mor ışıma ve animasyon için)
    const now = new Date().toISOString();
    database
      .prepare("UPDATE media_packages SET video_status='refining', updated_at=? WHERE id=?")
      .run(now, packageId);

    database.prepare(`
      INSERT INTO generation_jobs (
        id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at
      ) VALUES (?, ?, 'canva', 'canva-mcp', 'canva-mcp-refine', 'running', ?, ?, ?, ?)
    `).run(
      jobId,
      projectId,
      jobTitle,
      JSON.stringify({ packageId, designId, slideIndex: body.slideIndex, notes: body.notes, mode: "canva_mcp_refine" }),
      JSON.stringify({ phase: "starting", percent: 15, detail: "AI cerrahi düzenleme görevini devraldı..." }),
      now
    );

    // 1. Cerrahi düzenleme promptunu oluştur
    const isSingleSlide = typeof body.slideIndex === "number";
    const targetSlidePrompt = isSingleSlide
      ? `HEDEF: Yalnızca ${body.slideIndex! + 1}. SAYFAYI cerrahi olarak onar. DİĞER SAYFALARA KESİNLİKLE DOKUNMA.`
      : "HEDEF: Tüm sayfalardaki nesne yerleşimlerini, sayaç marjinlerini ve metin punto dengelerini kontrol et.";

    const refineTaskPrompt = `[CANVA_LAYOUT_REFINE_TASK]
Tasarım Konusu: '${meaningfulTitle}'
Tasarım ID: '${designId}'
${targetSlidePrompt}
${body.notes ? `Kullanıcı Notu: ${body.notes}` : ""}

CERRAHİ KURALLAR:
1. mcp__canva__get_design_content çağırarak '${designId}' tasarımının sayfalarını ve elemanlarını al.
2. mcp__canva__start_editing_transaction çağırarak düzenleme oturumu başlat.
3. ${isSingleSlide ? `Yalnızca ${body.slideIndex! + 1}. sayfadaki` : "Sayfalardaki"} şu yerleşim kusurlarını gider:
   - SAYAÇ VE MARJİN GÜVENLİK ALANI: Sağ alt köşedeki (sağ 140px, alt 120px) sayfa sayacı bölgesine ("5/6", "4/6" vb.) binen veya yaklaşan KABLO, DEVRE, ÇİZGİ veya ŞEKİLLERİ temizle veya geri çek. Sayacın üstü tamamen açık ve ferah olmalıdır.
   - TİPOGRAFİ HİYERARŞİSİ: Liste veya açıklama metinleri başlığa göre küçük kalmışsa, puntoyu en az 24-28px seviyesine büyüt ve satır aralıklarını ferahlat.
   - ÇAKIŞAN ŞEMALAR: Donanım ve masayı boğan aşırı koyu blueprint/şema katmanlarını kaldır veya opasitesini düşür.
4. mcp__canva__commit_editing_transaction ile değişiklikleri onayla.
5. İşlem bitince kısa bir özet rapor yaz.`;

    // 2. Hermes Agent'a görevi asenkron olarak ilet
    const runResponse = await fetch(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: "hermes-agent",
        input: refineTaskPrompt,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!runResponse.ok && runResponse.status !== 202) {
      throw new Error(`Hermes görevi kabul etmedi (HTTP ${runResponse.status})`);
    }

    const runData = (await runResponse.json().catch(() => ({}))) as { run_id?: string; id?: string };
    const runId = runData.run_id || runData.id;

    if (!runId) {
      throw new Error("Hermes bir çalıştırma kimliği (run_id) döndürmedi.");
    }

    // request_json'a runId kaydet
    database
      .prepare("UPDATE generation_jobs SET request_json=? WHERE id=?")
      .run(
        JSON.stringify({ packageId, designId, slideIndex: body.slideIndex, runId, mode: "canva_mcp_refine" }),
        jobId
      );

    // 3. Arka plan izleme ve indirme sürecini başlat (Senkron bekleme YOK!)
    void runBackgroundRefineExecution({
      jobId,
      projectId,
      packageId,
      designId,
      runId,
      baseUrl,
      apiKey,
      assetsDir,
    });

    // 4. İstemciye 1 saniye altında anında yanıt dön
    return Response.json({
      ok: true,
      jobId,
      runId,
      message: isSingleSlide
        ? `🪄 ${meaningfulTitle} — ${body.slideIndex! + 1}. slaytın düzen onarımı başlatıldı! Üretim listesinden takip edebilirsiniz.`
        : `🪄 ${meaningfulTitle} — Düzen onarımı başlatıldı! Üretim listesinden takip edebilirsiniz.`,
    });
  } catch (err: unknown) {
    const errNow = new Date().toISOString();
    database
      .prepare("UPDATE media_packages SET video_status='idle', updated_at=? WHERE id=?")
      .run(errNow, packageId);
    const msg = err instanceof Error ? err.message : String(err);
    database
      .prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?")
      .run(msg.slice(0, 500), errNow, jobId);
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}
