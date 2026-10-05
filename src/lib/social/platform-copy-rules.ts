import type { SocialPlatform } from "./hashtag-policy.ts";

export const PLATFORM_COPY_RULES: Record<SocialPlatform, string> = {
  instagram: "Instagram: İlk satır güçlü kanca olsun. Değer + kısa anlatı + net CTA kullan. 5-8 ilgili Türkçe hashtag üret.",
  youtube: "YouTube Shorts: 100 karakteri aşmayan arama niyetli başlık, 2-4 cümle açıklama ve en fazla 3 görünür hashtag üret. #instagram/#tiktok kullanma. YouTube araması için ayrıca 5-15 kısa tag üret.",
  tiktok: "TikTok: Doğal ve hızlı tüketilen kısa metin, soru veya merak kancası, 3-5 niş hashtag üret. Alakasız #fyp spam'i kullanma.",
  facebook: "Facebook: Veli odaklı açıklayıcı anlatı, güven ve fayda vurgusu, en fazla 3 ilgili hashtag üret.",
  twitter: "X/Twitter: 280 karaktere uygun kısa ve konuşma başlatan metin, en fazla 2 hashtag üret.",
};

export function uniquePlatforms(values: string[]) {
  const supported = new Set(Object.keys(PLATFORM_COPY_RULES));
  return [...new Set(values.filter((value) => supported.has(value)))] as SocialPlatform[];
}
