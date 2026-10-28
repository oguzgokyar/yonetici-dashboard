import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-token";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const isHttps = request.nextUrl.protocol === "https:";
  const response = NextResponse.json({ ok: true, message: "Çıkış yapıldı." });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
