import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    if (!jobId) {
      return Response.json({ ok: false, message: "Geçersiz iş kimliği" }, { status: 400 });
    }

    const formData = await request.formData();
    const sceneIndex = parseInt(String(formData.get("sceneIndex") || "1"), 10);
    const videoFile = formData.get("video") as Blob | null;

    if (!videoFile) {
      return Response.json({ ok: false, message: "Video dosyası eksik" }, { status: 400 });
    }

    const targetDir = path.join(process.cwd(), ".data", "flow-scenes", jobId);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetFile = path.join(targetDir, `scene-${sceneIndex}.mp4`);
    const buffer = Buffer.from(await videoFile.arrayBuffer());
    fs.writeFileSync(targetFile, buffer);

    // Update state.json inside scene directory
    const stateFile = path.join(targetDir, "state.json");
    let stateList: Array<{ sceneIndex: number; status: string; clipPath?: string; clipUrl?: string; updatedAt: string }> = [];
    if (fs.existsSync(stateFile)) {
      try {
        stateList = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      } catch {}
    }

    const existing = stateList.find((s) => s.sceneIndex === sceneIndex);
    const now = new Date().toISOString();
    if (existing) {
      existing.status = "ready";
      existing.clipPath = targetFile;
      existing.clipUrl = `/api/projects/atolye-hanem/flow-engine/scenes/${jobId}/${sceneIndex}`;
      existing.updatedAt = now;
    } else {
      stateList.push({
        sceneIndex,
        status: "ready",
        clipPath: targetFile,
        clipUrl: `/api/projects/atolye-hanem/flow-engine/scenes/${jobId}/${sceneIndex}`,
        updatedAt: now,
      });
    }
    fs.writeFileSync(stateFile, JSON.stringify(stateList, null, 2), "utf-8");

    return Response.json({
      ok: true,
      sceneIndex,
      bytesWritten: buffer.length,
      clipPath: targetFile,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sahne kaydedilemedi";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
