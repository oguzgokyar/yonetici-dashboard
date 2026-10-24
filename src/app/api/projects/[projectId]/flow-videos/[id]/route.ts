import { deleteFlowVideo, syncFlowJobStatus } from "@/lib/server/flow-video-service";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string; id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!id) {
      return Response.json({ ok: false, message: "İş kimliği gereklidir." }, { status: 400 });
    }

    const job = await syncFlowJobStatus(id);
    if (!job) {
      return Response.json({ ok: false, message: "Video görevi bulunamadı." }, { status: 404 });
    }

    return Response.json({ ok: true, job });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Durum sorgulanamadı.";
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { projectId, id } = await context.params;
    if (!id || !projectId) {
      return Response.json({ ok: false, message: "Geçersiz kimlik." }, { status: 400 });
    }

    const success = deleteFlowVideo(id, projectId);
    if (!success) {
      return Response.json({ ok: false, message: "Kayıt bulunamadı veya silinemedi." }, { status: 404 });
    }

    return Response.json({ ok: true, message: "Flow video başarıyla silindi." });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Silme işlemi başarısız.";
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}
