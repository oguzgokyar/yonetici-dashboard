import { NextResponse } from "next/server";
import {
  listCanvaAccounts,
  addCanvaAccount,
  updateCanvaAccount,
  deleteCanvaAccount,
  getCanvaPoolSummary,
} from "@/lib/server/canva-account-pool";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accounts = listCanvaAccounts();
    const summary = getCanvaPoolSummary();
    return NextResponse.json({ ok: true, accounts, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap havuzu okunamadı.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      displayName?: string;
      email?: string;
      tokenJson?: string;
    };

    if (!body.displayName?.trim()) {
      return NextResponse.json({ ok: false, message: "Hesap adı (display_name) zorunludur." }, { status: 400 });
    }

    if (!body.tokenJson?.trim()) {
      return NextResponse.json(
        { ok: false, message: "Canva OAuth belirteç verisi (token_json) zorunludur." },
        { status: 400 }
      );
    }

    // Validate JSON structure
    try {
      const parsed = JSON.parse(body.tokenJson);
      if (!parsed.access_token && !parsed.refresh_token) {
        return NextResponse.json(
          { ok: false, message: "token_json geçerli bir access_token veya refresh_token içermelidir." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ ok: false, message: "token_json geçerli bir JSON formatında olmalıdır." }, { status: 400 });
    }

    const created = addCanvaAccount({
      displayName: body.displayName,
      email: body.email,
      tokenJson: body.tokenJson,
    });

    return NextResponse.json({ ok: true, account: created, message: "Canva hesabı başarıyla havuza eklendi." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap eklenemedi.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      displayName?: string;
      email?: string;
      isActive?: boolean;
      quotaStatus?: "available" | "exhausted" | "cooldown";
      tokenJson?: string;
    };

    if (!body.id) {
      return NextResponse.json({ ok: false, message: "Hesap ID zorunludur." }, { status: 400 });
    }

    if (body.tokenJson) {
      try {
        JSON.parse(body.tokenJson);
      } catch {
        return NextResponse.json({ ok: false, message: "token_json geçerli bir JSON olmalıdır." }, { status: 400 });
      }
    }

    const success = updateCanvaAccount(body.id, {
      displayName: body.displayName,
      email: body.email,
      isActive: body.isActive,
      quotaStatus: body.quotaStatus,
      tokenJson: body.tokenJson,
    });

    if (!success) {
      return NextResponse.json({ ok: false, message: "Hesap bulunamadı veya güncellenemedi." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Canva hesabı başarıyla güncellendi." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap güncellenemedi.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, message: "Silinecek hesap ID'si gereklidir." }, { status: 400 });
    }

    const success = deleteCanvaAccount(id);
    if (!success) {
      return NextResponse.json({ ok: false, message: "Hesap bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Hesap havuzdan başarıyla kaldırıldı." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap silinemedi.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
