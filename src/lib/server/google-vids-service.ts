import "server-only";

import path from "node:path";
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
  musicSpec?: Record<string, unknown>;
  preferredAuthuser?: number;
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
  const musicPrompt = (req.musicSpec as { musicPromptEn?: string })?.musicPromptEn || "";
  const scenes = req.scenes || [];

  // Acquire best available account from multi-account pool
  const accountInfo = acquireAvailableVidsAccount(req.preferredAuthuser);
  const authuserIndex = accountInfo.authuser;

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

  const canvaConfig = getCanvaConfig();
  const baseUrl = canvaConfig.baseUrl.replace(/\/+$/, "");
  const apiKey = canvaConfig.apiKey;

  const callbackBaseUrl = (process.env.CANVA_CALLBACK_BASE_URL || "http://10.0.1.1:3100").trim().replace(/\/+$/, "");
  const callbackUrl = `${callbackBaseUrl}/api/internal/google-vids/jobs/${job.id}/complete`;
  const callbackToken = createJobCallbackToken(canvaConfig.callbackToken, job.id);

  // Directly spawn the script on server or dispatch via Hermes
  let automationSucceeded = false;
  try {
    const { spawn } = await import("node:child_process");
    const { createInterface } = await import("node:readline");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("/opt/hermes/.venv/bin/python", [
        "/opt/data/scripts/google_vids_automation.py",
        "--job-id", job.id,
        "--title", title,
        "--aspect-ratio", aspectRatio,
        "--music-prompt", musicPrompt,
        "--authuser", String(authuserIndex),
        "--scenes-json", scenesTempFile,
        "--output-mp4", finalMp4Path,
      ], {
        env: {
          ...process.env,
          DISPLAY: ":97",
          LD_LIBRARY_PATH: `/opt/data/lib:${process.env.LD_LIBRARY_PATH || ""}`,
        },
      });

      const rl = createInterface({ input: proc.stdout });
      let capturedGoogleVidsUrl: string | undefined;
      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("__PROGRESS__")) {
          try {
            const progressData = JSON.parse(trimmed.slice("__PROGRESS__".length));
            if (progressData.googleVidsUrl) {
              capturedGoogleVidsUrl = progressData.googleVidsUrl;
            }
            db.prepare("UPDATE generation_jobs SET progress_json = ? WHERE id = ?").run(
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
        if (code === 0 && fs.existsSync(finalMp4Path) && fs.statSync(finalMp4Path).size > 1000) {
          automationSucceeded = true;
          resolve();
        } else {
          reject(new Error(errBuf || `Python script exit code ${code}`));
        }
      });
    });
  } catch (localErr) {
    // If local execution fails (e.g. running inside container without host access), fallback to Hermes run dispatch
    console.warn("[Google Vids] Local execution fallback to Hermes Agent:", localErr);
  }

  if (automationSucceeded) {
    recordVidsAccountRenderSuccess(authuserIndex);
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
          response_json = ?,
          progress_json = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(responsePayload),
      JSON.stringify({ phase: "complete", percent: 100, detail: "Tamamlandı" }),
      new Date().toISOString(),
      job.id
    );
    return;
  }

  const taskPrompt = `Create the Google Vids video for job_id='${job.id}' by executing this exact python command:
cat << 'EOF' > "${scenesTempFile}"
${JSON.stringify(scenes, null, 2)}
EOF
/opt/hermes/.venv/bin/python /opt/data/scripts/google_vids_automation.py --job-id "${job.id}" --title ${JSON.stringify(title)} --aspect-ratio "${aspectRatio}" --music-prompt ${JSON.stringify(musicPrompt)} --authuser ${authuserIndex} --scenes-json "${scenesTempFile}" --output-mp4 "/tmp/vids_out_${job.id}.mp4"

Once "/tmp/vids_out_${job.id}.mp4" is generated:
Parse the stdout log of the python script for '__PROGRESS__' line containing 'googleVidsUrl' to get the URL if available.
Upload the video file via multipart form-data to the callback endpoint:
curl -s -X POST ${callbackToken ? `-H "Authorization: Bearer ${callbackToken}" ` : ""}-F "video=@/tmp/vids_out_${job.id}.mp4" -F "googleVidsUrl=$(grep -o '"googleVidsUrl": *"[^"]*"' /tmp/vids_job_${job.id}.log 2>/dev/null | cut -d'"' -f4 || echo '')" "${callbackUrl}"
rm -f "/tmp/vids_out_${job.id}.mp4" "${scenesTempFile}" "/tmp/vids_job_${job.id}.log"

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
    const runId = runData.run_id || runData.id;

    db.prepare(`
      UPDATE generation_jobs
      SET status = 'running',
          progress_json = ?
      WHERE id = ?
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

    // Poll run completion up to 240 seconds
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));

      // Kontrol et: callback veya dosya geldi mi?
      if (fs.existsSync(finalMp4Path) && fs.statSync(finalMp4Path).size > 1000) {
        break;
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
              markVidsAccountQuotaExhausted(authuserIndex);
              throw new Error("Google Vids günlük/saatlik video oluşturma sınırına ulaşıldı. Google hesabı kotasını sıfırlayana kadar lütfen bekleyin.");
            }
            recordVidsAccountRenderSuccess(authuserIndex);
            break;
          }
        }
      }
    }

    if (!fs.existsSync(finalMp4Path) || fs.statSync(finalMp4Path).size < 1000) {
      // Check last known error or progress
      let customErr = "Google Vids MP4 dosyası zaman aşımına uğradı veya oluşturulamadı.";
      try {
        const curRow = db.prepare("SELECT progress_json FROM generation_jobs WHERE id = ?").get(job.id) as { progress_json?: string } | undefined;
        if (curRow?.progress_json && curRow.progress_json.includes("sınırına ulaştınız")) {
          markVidsAccountQuotaExhausted(authuserIndex);
          customErr = "Google Vids günlük/saatlik video oluşturma sınırına ulaşıldı. Lütfen kotanın sıfırlanmasını bekleyin.";
        }
      } catch {}
      throw new Error(customErr);
    }

    const videoUrl = `/api/videos/${job.id}`;
    const responsePayload = {
      id: job.id,
      url: videoUrl,
      videoUrl: videoUrl,
      title: title,
      durationSeconds: req.durationSeconds || 30,
      aspectRatio: aspectRatio,
      isGoogleVids: true,
      completedAt: new Date().toISOString(),
    };

    db.prepare(`
      UPDATE generation_jobs
      SET status = 'complete',
          response_json = ?,
          progress_json = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(responsePayload),
      JSON.stringify({ phase: "complete", percent: 100, detail: "Tamamlandı" }),
      new Date().toISOString(),
      job.id
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'failed',
          error = ?,
          completed_at = ?
      WHERE id = ?
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
