import { NextRequest, NextResponse } from "next/server";
import { validateAdminPassword } from "@/lib/server/auth";
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionToken } from "@/lib/auth-token";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = (body.password || "").toString().trim();

    if (!password) {
      return NextResponse.json({ ok: false, error: "Lütfen şifrenizi girin." }, { status: 400 });
    }

    if (!validateAdminPassword(password)) {
      return NextResponse.json({ ok: false, error: "Hatalı şifre girdiniz." }, { status: 401 });
    }

    const token = await createSessionToken();
    const isHttps = request.nextUrl.protocol === "https:";

    const response = NextResponse.json({ ok: true, message: "Giriş başarılı." });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: any) {
    console.error("[Login API Error]", error);
    return NextResponse.json({ ok: false, error: "Giriş işlemi sırasında hata oluştu." }, { status: 500 });
  }
}
