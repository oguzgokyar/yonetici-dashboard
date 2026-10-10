import { listGoogleVidsAccounts } from "@/lib/server/google-vids-account-pool";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accounts = listGoogleVidsAccounts();
    const availableCount = accounts.filter((a) => a.quota_status === "available").length;

    return Response.json({
      ok: true,
      accounts,
      availableCount,
      totalCount: accounts.length,
      estimatedVideoCapacity: availableCount * 8, // ortalama 7-8 video/hesap
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap havuzu okunamadı.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
