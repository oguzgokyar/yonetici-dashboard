import type { MusicProvider } from "./music-discovery";

export type MusicProviderSecretField = "apiKey" | "accessToken" | "refreshToken" | "clientSecret";
export type MusicProviderAccountChoice = { userId: string; accountName: string; pageId?: string };
export type MusicProviderConfigInput = {
  enabled?: boolean;
  apiKey?: string; accessToken?: string; refreshToken?: string; clientSecret?: string;
  clientId?: string; userId?: string; regionCode?: string; accountName?: string; expiresAt?: string;
  accountChoices?: MusicProviderAccountChoice[]; permissions?: string[];
  clearFields?: MusicProviderSecretField[];
};
export type MusicProviderPublicConfig = {
  redirectUri?: string;
  provider: MusicProvider; enabled: boolean; source: "database" | "environment" | "none";
  status: "disabled" | "not-configured" | "configured" | "expired";
  hasApiKey: boolean; maskedKey: string; hasAccessToken: boolean; maskedAccessToken: string;
  hasRefreshToken: boolean; hasClientSecret: boolean;
  clientId: string; userId: string; regionCode: string; accountName: string; expiresAt: string;
  accountChoices: MusicProviderAccountChoice[]; permissions: string[];
};
export type MusicProviderTestResult = {
  ok: boolean; code: "ok" | "disabled" | "not-configured" | "expired" | "quota" | "permission" | "invalid-key" | "unavailable";
  message: string;
};
