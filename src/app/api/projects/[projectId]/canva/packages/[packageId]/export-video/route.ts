import { isCanvaStudioEnabled } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";
import { exportPackageVideoHelper } from "@/lib/server/canva-video-service";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string; packageId: string }> };

interface ExportVideoBody {
  durationPerSlide?: number; // e.g. 2, 3.5, 5
  animationType?: "canva" | "crossfade";
  useMagicAnimate?: boolean;
}

export async function POST(request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId, packageId } = await context.params;
  const database = getDatabase();

  const project = database.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
  if (!project) {
    return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as ExportVideoBody;

  try {
    const result = await exportPackageVideoHelper({
      database,
      packageId,
      projectId,
      durationPerSlide: body.durationPerSlide,
      useMagicAnimate: body.useMagicAnimate ?? true,
    });

    return Response.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: errorMsg }, { status: 500 });
  }
}
