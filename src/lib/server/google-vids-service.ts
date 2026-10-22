import "server-only";

import path from "node:path";
import { googleVidsRunnerDecision } from "./google-vids-runner-policy";
import { validateGoogleVidsNativeArtifact } from "./google-vids-native-artifact";
import fs from "node:fs";
import { getDatabase } from "@/lib/server/database";
import { getCanvaConfig, createJobCallbackToken } from "@/lib/server/canva-config";
import {
  acquireAvailableVidsAccount,
  markVidsAccountQuotaExhausted,
  recordVidsAccountRenderSuccess,
} from "./google-vids-account-pool";
import type { ScriptScenePlan } from "./cinematic-prompt-director";

export interface GoogleVidsJobRequest {
  title: string;
  topic: string;
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  visualMood: string;
  narrativeMode?: string;
  characterAnchor?: {
    name?: string;
    archetypeTr?: string;
    masterVisualPromptEn?: string;
    fixedTraitsEn?: string;
    referenceImageUrl?: string;
  };
  musicSpec?: Record<string, unknown>;
  preferredAuthuser?: number;
  preferredAccountId?: string;
  scenes: ScriptScenePlan[];
}

export async function processGoogleVidsJob(job: {
  id: string;
  project_id: string;
  prompt: string;
  request_json: string;
}) {
  const db = getDatabase()!;
  let req: Partial<GoogleVidsJobRequest> = {};
  try {
    req = JSON.parse(job.request_json || "{}") as Partial<GoogleVidsJobRequest>;
  } catch {
    req = {};
  }

  const title = req.title || job.prompt || "Google Vids Video";
  const aspectRatio = req.aspectRatio || "9:16";
  const narrativeMode = req.narrativeMode || "hybrid";
  const musicPrompt = (req.musicSpec as { musicPromptEn?: string })?.musicPromptEn || "";
  const scenes = req.scenes || [];

  // Acquire best available account from multi-account pool (by account id or authuser)
  const accountInfo = acquireAvailableVidsAccount(req.preferredAccountId || req.preferredAuthuser);
  const authuserIndex = accountInfo.authuser;
  const profileDir = accountInfo.profileDirectory || "Default";

  if (!scenes.length) {
    db.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?").run(
      "İşte yürütülecek sahne listesi bulunamadı.",
      new Date().toISOString(),
      job.id
    );
    return;
  }

  const claimed = db.prepare(`
    UPDATE generation_jobs
    SET status = 'rendering',
        progress_json = ?
    WHERE id = ? AND status = 'queued'
  `).run(
    JSON.stringify({
      phase: "starting",
      percent: 5,
      detail: "Google Vids Omni video render motoru başlatılıyor...",
      updatedAt: new Date().toISOString(),
    }),
    job.id
  );

  if (!claimed.changes) return;

  const outputDir = path.join(process.cwd(), ".data", "video-renders");
  fs.mkdirSync(outputDir, { recursive: true });
  const finalMp4Path = path.join(outputDir, `${job.id}.mp4`);

  // Sahneleri geçici JSON dosyasına yaz (Host ortamında erişilebilir /tmp dizini)
  const scenesTempFile = path.join("/tmp", `vids_scenes_${job.id}.json`);
  fs.writeFileSync(scenesTempFile, JSON.stringify(scenes, null, 2), "utf-8");

  // Referans görsel yolu (varsa)
  let referenceImageLocalPath = "";
  if (req.characterAnchor?.referenceImageUrl) {
    const refUrl = req.characterAnchor.referenceImageUrl;
    const assetMatch = refUrl.match(/\/api\/assets\/([a-f0-9-]+)/i);
    if (assetMatch) {
      const assetId = assetMatch[1];
      const possiblePath = path.join(process.cwd(), ".data", "assets", `${assetId}.png`);
      if (fs.existsSync(possiblePath)) {
        referenceImageLocalPath = possiblePath;
      }
    }
  }

  const canvaConfig = getCanvaConfig();
  const baseUrl = canvaConfig.baseUrl.replace(/\/+$/, "");
  const apiKey = canvaConfig.apiKey;

  const callbackBaseUrl = (process.env.CANVA_CALLBACK_BASE_URL || "http://10.0.1.1:3100").trim().replace(/\/+$/, "");
  const callbackUrl = `${callbackBaseUrl}/api/internal/google-vids/jobs/${job.id}/complete`;
  const callbackToken = createJobCallbackToken(canvaConfig.callbackToken, job.id);

  // Directly spawn the script on server or dispatch via Hermes
  let automationSucceeded = false;
  try {
    if (!fs.existsSync("/opt/hermes/.venv/bin/python") || !fs.existsSync("/opt/data/scripts/google_vids_automation.py")) {
      throw Object.assign(new Error("Host native runner bridge required"), { code: "ENOENT" });
    }
    const { spawn } = await import("node:child_process");
    const { createInterface } = await import("node:readline");

    await new Promise<void>((resolve, reject) => {
      const args = [
        "/opt/data/scripts/google_vids_automation.py",
        "--job-id", job.id,
        "--title", title,
        "--aspect-ratio", aspectRatio,
        "--music-prompt", musicPrompt,
        "--narrative-mode", narrativeMode,
        "--authuser", String(authuserIndex),
        "--profile-dir", profileDir,
        "--scenes-json", scenesTempFile,
        "--output-mp4", finalMp4Path,
      ];
      if (referenceImageLocalPath) {
        args.push("--reference-image", referenceImageLocalPath);
      }

      const proc = spawn("/opt/hermes/.venv/bin/python", args, {
        env: {
          ...process.env,
          DISPLAY: ":97",
          LD_LIBRARY_PATH: `/opt/data/lib:${process.env.LD_LIBRARY_PATH || ""}`,
        },
      });

      const localDeadline = setTimeout(() => proc.kill("SIGTERM"), Math.min(3_600_000, Math.max(1_800_000, scenes.length * 360_000 + 900_000)));
      const cancellationWatch = setInterval(() => {
        const row = db.prepare("SELECT status FROM generation_jobs WHERE id=?").get(job.id) as {status:string} | undefined;
        if (!row || !["rendering","running"].includes(row.status)) proc.kill("SIGTERM");
      }, 5000);
      const cleanup = () => { clearTimeout(localDeadline); clearInterval(cancellationWatch); };
      proc.once("error", cleanup); proc.once("close", cleanup);
      const rl = createInterface({ input: proc.stdout });
      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("__PROGRESS__")) {
          try {
            const progressData = JSON.parse(trimmed.slice("__PROGRESS__".length));
            db.prepare("UPDATE generation_jobs SET progress_json = ? WHERE id = ? AND status IN ('rendering','running')").run(
              JSON.stringify({
                phase: progressData.phase,
                percent: progressData.percent,
                detail: progressData.detail,
                googleVidsUrl: progressData.googleVidsUrl,
                updatedAt: new Date().toISOString(),
              }),
              job.id
            );
          } catch {}
        }
      });

      let errBuf = "";
      proc.stderr.on("data", (c) => { errBuf += c.toString(); });
      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
        // Render bittiğinde arka planda askıda kalan sekmeleri temizle ve RAM'i iade et
        try {
          fetch("http://10.0.1.1:8080/api/internal/system/cleanup", { method: "POST", signal: AbortSignal.timeout(3000) }).catch(() => {});
        } catch {}

        if (code === 0 && fs.existsSync(finalMp4Path) && fs.statSync(finalMp4Path).size > 1000) {
          try { validateGoogleVidsNativeArtifact(finalMp4Path, JSON.parse(fs.readFileSync(finalMp4Path+'.native.json','utf8')), job.id, req); }
          catch (error) { reject(error); return; }
          automationSucceeded = true;
          resolve();
        } else {
          reject(new Error(errBuf || `Python script exit code ${code}`));
        }
      });
    });
  } catch (localErr) {
    // If local execution fails (e.g. running inside container without host access), fallback to Hermes run dispatch
    if ((localErr as NodeJS.ErrnoException).code !== "ENOENT") {
      db.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=? AND status='rendering'").run(String(localErr).slice(0,1000), new Date().toISOString(), job.id);
      return;
    }
    console.info("[Google Vids] Host/Hermes native runner bridge required (container ENOENT)");
  }

  if (automationSucceeded) {
    recordVidsAccountRenderSuccess(authuserIndex, profileDir);
    const videoUrl = `/api/videos/${job.id}`;
    let googleVidsUrl: string | undefined;
    try {
      const jobRow = db.prepare("SELECT progress_json FROM generation_jobs WHERE id=?").get(job.id) as { progress_json?: string } | undefined;
      const p = JSON.parse(jobRow?.progress_json || "{}");
      if (p.googleVidsUrl) googleVidsUrl = p.googleVidsUrl;
    } catch {}

    const responsePayload = {
      id: job.id,
      url: videoUrl,
      videoUrl: videoUrl,
      title: title,
      durationSeconds: req.durationSeconds || 30,
      aspectRatio: aspectRatio,
      isGoogleVids: true,
      googleVidsUrl,
      completedAt: new Date().toISOString(),
    };

    db.prepare(`
      UPDATE generation_jobs
      SET status = 'complete',
          error = NULL,
          response_json = ?,
          progress_json = ?,
          completed_at = ?
      WHERE id = ? AND status IN ('running','rendering')
    `).run(
      JSON.stringify(responsePayload),
      JSON.stringify({ phase: "complete", percent: 100, detail: "Tamamlandı" }),
      new Date().toISOString(),
      job.id
    );
    return;
  }

  // Referans görsel URL (varsa)
  const referenceImagePublicUrl = req.characterAnchor?.referenceImageUrl
    ? req.characterAnchor.referenceImageUrl.startsWith("http")
      ? req.characterAnchor.referenceImageUrl
      : `${callbackBaseUrl}${req.characterAnchor.referenceImageUrl}`
    : "";

  const downloadRefImageCmd = referenceImagePublicUrl
    ? `curl -sL "${referenceImagePublicUrl}" -o "/tmp/vids_ref_${job.id}.png"\n`
    : "";
  const refImageFlag = referenceImagePublicUrl
    ? ` --reference-image "/tmp/vids_ref_${job.id}.png"`
    : "";

  try {
    // 1. Try Direct Host Runner Bridge on :8080 (0.05s instant launch, no LLM overhead)
    const HOST_BRIDGE_URLS = [
      "http://10.0.1.1:8080/api/internal/google-vids/run",
      "http://10.0.7.1:8080/api/internal/google-vids/run",
      "http://127.0.0.1:8080/api/internal/google-vids/run",
    ];

  let bridgeStarted = false;
  for (const bridgeUrl of HOST_BRIDGE_URLS) {
    try {
      const res = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          title,
          aspect_ratio: aspectRatio,
          music_prompt: musicPrompt,
          narrative_mode: narrativeMode,
          authuser: authuserIndex,
          profile_dir: profileDir,
          scenes,
          reference_image_url: referenceImagePublicUrl,
          callback_url: callbackUrl,
          callback_token: callbackToken,
          remove_watermark: true,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          bridgeStarted = true;
          break;
        }
      }
    } catch {}
  }

  let runId: string | undefined = undefined;

  if (bridgeStarted) {
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'running',
          progress_json = ?
      WHERE id = ? AND status IN ('running','rendering')
    `).run(
      JSON.stringify({
        phase: "running",
        percent: 10,
        detail: "Google Vids doğrudan host köprüsünde başlatıldı...",
        runId: "host_bridge",
        updatedAt: new Date().toISOString(),
      }),
      job.id
    );
  } else {
    // Fallback to Hermes /v1/runs if bridge is unavailable
    const taskPrompt = `Create the Google Vids video for job_id='${job.id}' by executing this exact python command:
cat << 'EOF' > "${scenesTempFile}"
${JSON.stringify(scenes, null, 2)}
EOF
${downloadRefImageCmd}/opt/hermes/.venv/bin/python /opt/data/scripts/google_vids_automation.py --job-id "${job.id}" --title ${JSON.stringify(title)} --aspect-ratio "${aspectRatio}" --music-prompt ${JSON.stringify(musicPrompt)} --narrative-mode "${narrativeMode}" --authuser ${authuserIndex} --profile-dir "${profileDir}" --scenes-json "${scenesTempFile}" --output-mp4 "/tmp/vids_out_${job.id}.mp4"${refImageFlag}

Once "/tmp/vids_out_${job.id}.mp4" is generated:
Parse the stdout log of the python script for '__PROGRESS__' line containing 'googleVidsUrl' to get the URL if available.
Upload the video file via multipart form-data to the callback endpoint:
curl --fail-with-body -s -X POST ${callbackToken ? `-H "Authorization: Bearer ${callbackToken}" ` : ""}-F "video=@/tmp/vids_out_${job.id}.mp4" -F "nativeMetadata=</tmp/vids_out_${job.id}.mp4.native.json" -F "googleVidsUrl=$(python3 -c 'import json; print(json.load(open("/tmp/vids_out_${job.id}.mp4.native.json"))["googleVidsUrl"])')" "${callbackUrl}"
rm -f "/tmp/vids_out_${job.id}.mp4" "${scenesTempFile}" "/tmp/vids_job_${job.id}.log" "/tmp/vids_ref_${job.id}.png"

Return the completion output.`;

    try {
      const runResponse = await fetch(`${baseUrl}/v1/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: "hermes-agent",
          input: taskPrompt,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!runResponse.ok && runResponse.status !== 202) {
        throw new Error(`Hermes Vids görevi başlatılamadı (HTTP ${runResponse.status})`);
      }

      const runData = (await runResponse.json().catch(() => ({}))) as { run_id?: string; id?: string };
      runId = runData.run_id || runData.id;

      db.prepare(`
        UPDATE generation_jobs
        SET status = 'running',
            progress_json = ?
        WHERE id = ? AND status IN ('running','rendering')
      `).run(
        JSON.stringify({
          phase: "running",
          percent: 15,
          detail: "Hermes Agent Google Vids otomasyonunu başlattı",
          runId: runId || null,
          updatedAt: new Date().toISOString(),
        }),
        job.id
      );
    } catch (hermesErr) {
      db.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=? AND status='rendering'").run(
        String(hermesErr).slice(0, 1000),
        new Date().toISOString(),
        job.id
      );
      return;
    }
  }

    // Native multi-scene generation + three layer phases + native export.
    const started = Date.now();
    const maximumRuntimeMs = Math.min(3_600_000, Math.max(1_800_000, scenes.length * 360_000 + 900_000));
    const deadline = started + maximumRuntimeMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));

      const current = db.prepare("SELECT status FROM generation_jobs WHERE id=?").get(job.id) as {status:string} | undefined;
      const decision = googleVidsRunnerDecision("running", current?.status, Date.now()-started, maximumRuntimeMs);
      if (decision === "complete") return;
      if (decision === "cancel") {
        if (runId) await fetch(`${baseUrl}/v1/runs/${runId}/cancel`, { method:"POST", headers:{"Content-Type":"application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})}, body:JSON.stringify({reason:"job_cancelled_or_deadline"}),signal:AbortSignal.timeout(8000)}).catch(()=>null);
        return;
      }

      if (runId) {
        const statusRes = await fetch(`${baseUrl}/v1/runs/${runId}`, {
          headers: {
            Accept: "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);

        if (statusRes && statusRes.ok) {
          const runStatus = (await statusRes.json().catch(() => ({}))) as {
            status?: string;
            output?: string;
            error?: string;
          };

          if (["failed", "cancelled", "canceled"].includes(runStatus.status || "")) {
            throw new Error(runStatus.error || "Hermes Vids üretimi başarısız oldu.");
          }
          if (runStatus.status === "completed") {
            // Check if run completed with quota exhaustion message
            const runOut = runStatus.output || "";
            if (runOut.includes("sınırına ulaştınız") || runOut.includes("quota")) {
              markVidsAccountQuotaExhausted(authuserIndex, 3, profileDir);
              throw new Error("Google Vids günlük/saatlik video oluşturma sınırına ulaşıldı. Google hesabı kotasını sıfırlayana kadar lütfen bekleyin.");
            }
            // Run completion is not artifact completion; await verified callback.
            continue;
          }
        }
      }
    }

    if (runId) await fetch(`${baseUrl}/v1/runs/${runId}/cancel`, {method:"POST",headers:{"Content-Type":"application/json",...(apiKey ? {Authorization: `Bearer ${apiKey}`} : {})},body:JSON.stringify({reason:"native_deadline"}),signal:AbortSignal.timeout(8000)}).catch(()=>null);
    throw new Error("Google Vids native completion callback deadline exceeded; existing file is not completion evidence.");

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'failed',
          error = ?,
          completed_at = ?
      WHERE id = ? AND status IN ('running','rendering')
    `).run(
      errMsg.slice(0, 1000),
      new Date().toISOString(),
      job.id
    );
  } finally {
    try {
      if (fs.existsSync(scenesTempFile)) fs.unlinkSync(scenesTempFile);
    } catch {}
  }
}
