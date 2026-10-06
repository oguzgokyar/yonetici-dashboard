export type MusicProviderForm = {
  enabled: boolean;
  regionCode: string;
  clientId: string;
  apiKey: string;
  clientSecret: string;
  accessToken: string;
  userId: string;
};

export async function connectMusicProvider(provider: "youtube" | "instagram", form: MusicProviderForm, send: (url: string, method: string, body?: unknown) => Promise<unknown>) {
  const endpoint = `/api/settings/music/${provider}`;
  await send(endpoint, "PUT", musicFormPayload(provider, form));
  const result = await send(`${endpoint}/oauth/start`, "POST") as { authorizationUrl: string };
  const url = new URL(result.authorizationUrl);
  const host = provider === "youtube" ? "accounts.google.com" : "www.facebook.com";
  if (url.protocol !== "https:" || url.hostname !== host) throw new Error("Güvenli bağlantı adresi alınamadı.");
  return url.href;
}

export function musicFormPayload(provider: "youtube" | "instagram", form: MusicProviderForm) {
  return {
    enabled: form.enabled,
    regionCode: form.regionCode.trim().toUpperCase() || "TR",
    clientId: form.clientId.trim(),
    ...(form.clientSecret.trim() ? { clientSecret: form.clientSecret.trim() } : {}),
    ...(provider === "youtube" && form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
    ...(provider === "instagram" ? {
      userId: form.userId.trim(),
      ...(form.accessToken.trim() ? { accessToken: form.accessToken.trim() } : {}),
    } : {}),
  };
}
