import { NextRequest, NextResponse } from "next/server";
import { updateAdminPassword } from "@/lib/server/auth";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-token";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const valid = await verifySessionToken(token);
  if (!valid) {
    return NextResponse.json({ ok: false, message: "Yetkisiz işlem." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const currentPassword = (body.currentPassword || "").toString();
    const newPassword = (body.newPassword || "").toString();

    const res = updateAdminPassword(currentPassword, newPassword);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error.message || "Hata oluştu." }, { status: 500 });
  }
}
