import "server-only";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getDatabase } from "@/lib/server/database";
import {
  acquireAvailableVidsAccount,
  recordVidsAccountRenderSuccess,
  markVidsAccountQuotaExhausted,
} from "@/lib/server/google-vids-account-pool";
import type { ScriptScenePlan } from "@/features/generation/google-vids/types";

export interface FlowEngineJobRequest {
  title: string;
  topic: string;
  engine?: "flow" | "vids";
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  visualMood: string;
  narrativeMode?: string;
  scenes: ScriptScenePlan[];
  preferredAuthuser?: number;
  preferredAccountId?: string;
}

export interface FlowSceneState {
  sceneIndex: number;
  status: "pending" | "running" | "ready" | "failed";
  prompt: string;
  clipPath?: string;
  clipUrl?: string;
  error?: string;
  durationSeconds: number;
  updatedAt: string;
}

export async function processFlowEngineJob(job: {
  id: string;
  project_id: string;
  prompt: string;
  request_json: string;
}) {
  const db = getDatabase()!;
  let req: Partial<FlowEngineJobRequest> = {};
  try {
    req = JSON.parse(job.request_json || "{}") as Partial<FlowEngineJobRequest>;
  } catch {
    req = {};
  }

  const scenes = req.scenes || [];
  if (!scenes.length) {
    db.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?")
      .run("Senaryoda sahne bulunamadı.", new Date().toISOString(), job.id);
    return;
  }

  // Claim job as running
  const claimed = db.prepare(`
    UPDATE generation_jobs
    SET status = 'running',
        progress_json = ?
    WHERE id = ? AND status = 'queued'
  `).run(
    JSON.stringify({
      phase: "starting",
      percent: 5,
      detail: "Google Flow (Veo/Omni) üretim motoru hazırlanıyor...",
      updatedAt: new Date().toISOString(),
    }),
    job.id
  );

  if (!claimed.changes) return;

  const scenesDir = path.join(process.cwd(), ".data", "flow-scenes", job.id);
  fs.mkdirSync(scenesDir, { recursive: true });
  const stateFile = path.join(scenesDir, "state.json");

  // Load or initialize scene states
  let sceneStates: FlowSceneState[] = [];
  if (fs.existsSync(stateFile)) {
    try {
      sceneStates = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    } catch {}
  }

  if (!sceneStates.length) {
    sceneStates = scenes.map((sc, idx) => ({
      sceneIndex: sc.sceneIndex || idx + 1,
      status: "pending",
      prompt: sc.promptEn || sc.summaryTr || "",
      durationSeconds: sc.durationSeconds || 5,
      updatedAt: new Date().toISOString(),
    }));
    fs.writeFileSync(stateFile, JSON.stringify(sceneStates, null, 2), "utf-8");
  }

  // Acquire Google account
  let authuserIndex = typeof req.preferredAuthuser === "number" ? req.preferredAuthuser : 1;
  let profileDir = "Default";
  try {
    const acc = acquireAvailableVidsAccount(req.preferredAccountId);
    authuserIndex = acc.authuser;
    profileDir = acc.profileDirectory || "Default";
  } catch {}

  const pythonBin = fs.existsSync("/opt/hermes/.venv/bin/python")
    ? "/opt/hermes/.venv/bin/python"
    : "python3";
  const driverScript = "/opt/data/scripts/flow_page_driver.py";

  const totalScenes = scenes.length;

  for (let i = 0; i < totalScenes; i++) {
    // Check if job was cancelled
    const current = db.prepare("SELECT status, error FROM generation_jobs WHERE id=?").get(job.id) as { status: string; error?: string } | undefined;
    if (!current || ["cancelled", "canceled"].includes(current.status) || current.error === "Kullanıcı tarafından iptal edildi.") {
      break;
    }

    const sc = scenes[i];
    const sIndex = sc.sceneIndex || i + 1;
    const existing = sceneStates.find((s) => s.sceneIndex === sIndex);

    // If already generated and valid, continue
    const targetMp4 = path.join(scenesDir, `scene-${sIndex}.mp4`);
    if (existing && existing.status === "ready" && fs.existsSync(targetMp4) && fs.statSync(targetMp4).size > 1000) {
      continue;
    }

    // Mark current scene running
    const pct = Math.round(10 + (i / totalScenes) * 80);
    const progressText = `Sahne ${i + 1}/${totalScenes} Flow ile üretiliyor...`;
    
    db.prepare("UPDATE generation_jobs SET progress_json = ? WHERE id = ?").run(
      JSON.stringify({
        phase: "rendering",
        percent: pct,
        detail: progressText,
        currentScene: i + 1,
        totalScenes,
        updatedAt: new Date().toISOString(),
      }),
      job.id
    );

    if (existing) {
      existing.status = "running";
      existing.updatedAt = new Date().toISOString();
      fs.writeFileSync(stateFile, JSON.stringify(sceneStates, null, 2), "utf-8");
    }

    const scenePrompt = sc.promptEn || sc.summaryTr;
    const aspectRatio = req.aspectRatio || "9:16";

    try {
      let sceneSuccess = false;
      const callbackBaseUrl = (process.env.CANVA_CALLBACK_BASE_URL || "http://10.0.1.1:3100").trim().replace(/\/+$/, "");
      const callbackUrl = `${callbackBaseUrl}/api/internal/flow/jobs/${job.id}/complete`;

      // 1. Try Host Runner Bridge on :8085 (works from inside Coolify container)
      const hostBridgeUrls = [
        "http://10.0.1.7:8085/run",
        "http://10.0.1.1:8085/run",
        "http://127.0.0.1:8085/run",
      ];
      for (const bridgeUrl of hostBridgeUrls) {
        try {
          console.log(`[FlowEngine] Calling runner bridge at ${bridgeUrl} for scene ${sIndex}...`);
          const resp = await fetch(bridgeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: job.id,
              scene_index: sIndex,
              prompt: scenePrompt,
              aspect_ratio: aspectRatio,
              model: "Omni 1.1 Flash",
              callback_url: callbackUrl,
            }),
            signal: AbortSignal.timeout(400_000),
          });
          if (resp.ok) {
            const data = await resp.json();
            console.log(`[FlowEngine] Bridge responded ${resp.status}:`, data);
            if (data.ok) {
              sceneSuccess = true;
              break;
            }
          } else {
            const errTxt = await resp.text().catch(() => "");
            console.error(`[FlowEngine] Bridge returned HTTP ${resp.status}:`, errTxt);
          }
        } catch (bridgeErr) {
          console.error(`[FlowEngine] Bridge fetch failed (${bridgeUrl}):`, bridgeErr);
        }
      }

      // 2. Fallback to local process spawn if local python exists
      if (!sceneSuccess && fs.existsSync(pythonBin) && fs.existsSync(driverScript)) {
        await new Promise<void>((resolve, reject) => {
          const args = [
            driverScript,
            "generate",
            "--job-id", job.id,
            "--scene-index", String(sIndex),
            "--prompt", scenePrompt,
            "--aspect-ratio", aspectRatio,
            "--output", targetMp4,
            "--timeout", "360",
          ];

          const proc = spawn(pythonBin, args, {
            env: {
              ...process.env,
              FLOW_CDP_PORT: "9222",
            },
          });

          let stderr = "";
          proc.stderr.on("data", (data) => {
            stderr += data.toString();
          });

          proc.on("close", (code) => {
            if (code === 0 && fs.existsSync(targetMp4) && fs.statSync(targetMp4).size > 1000) {
              sceneSuccess = true;
              resolve();
            } else {
              reject(new Error(stderr || `Sahne ${sIndex} üretimi başarısız (kod ${code})`));
            }
          });

          proc.on("error", reject);
        });
      }

      // Check if target file arrived via callback or local run
      if (!sceneSuccess && (!fs.existsSync(targetMp4) || fs.statSync(targetMp4).size < 1000)) {
        throw new Error(`Sahne ${sIndex} MP4 dosyası üretilemedi veya teslim edilemedi.`);
      }

      // Scene success
      if (existing) {
        existing.status = "ready";
        existing.clipPath = targetMp4;
        existing.clipUrl = `/api/projects/${job.project_id}/flow-engine/scenes/${job.id}/${sIndex}`;
        existing.updatedAt = new Date().toISOString();
        fs.writeFileSync(stateFile, JSON.stringify(sceneStates, null, 2), "utf-8");
      }

      recordVidsAccountRenderSuccess(authuserIndex, profileDir);

    } catch (sceneErr: unknown) {
      const errMsg = sceneErr instanceof Error ? sceneErr.message : String(sceneErr);
      if (existing) {
        existing.status = "failed";
        existing.error = errMsg;
        existing.updatedAt = new Date().toISOString();
        fs.writeFileSync(stateFile, JSON.stringify(sceneStates, null, 2), "utf-8");
      }

      // Check if quota error
      if (errMsg.toLowerCase().includes("kredi") || errMsg.toLowerCase().includes("quota")) {
        markVidsAccountQuotaExhausted(authuserIndex, 3, profileDir);
      }
    }
  }

  // Check how many scenes are ready
  const readyCount = sceneStates.filter((s) => s.status === "ready").length;
  const now = new Date().toISOString();

  if (readyCount === totalScenes) {
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'complete',
          progress_json = ?,
          response_json = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify({
        phase: "complete",
        percent: 100,
        detail: `Tüm sahneler (${readyCount}/${totalScenes}) Google Flow ile başarıyla üretildi.`,
        updatedAt: now,
      }),
      JSON.stringify({
        engine: "flow",
        scenesDir,
        readyScenes: readyCount,
        totalScenes,
        sceneStates,
      }),
      now,
      job.id
    );
  } else if (readyCount > 0) {
    // Partial completion
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'complete',
          progress_json = ?,
          response_json = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify({
        phase: "partial_complete",
        percent: Math.round((readyCount / totalScenes) * 100),
        detail: `${readyCount}/${totalScenes} sahne hazır, bazı sahnelerde hata oluştu.`,
        updatedAt: now,
      }),
      JSON.stringify({
        engine: "flow",
        scenesDir,
        readyScenes: readyCount,
        totalScenes,
        sceneStates,
      }),
      now,
      job.id
    );
  } else {
    // All failed
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'failed',
          error = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      "Flow ile sahne üretimleri tamamlanamadı.",
      now,
      job.id
    );
  }
}
