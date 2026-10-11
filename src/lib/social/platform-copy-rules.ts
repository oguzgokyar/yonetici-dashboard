import type { SocialPlatform } from "./hashtag-policy.ts";

export type ContentFormatKind = "reel" | "story" | "carousel" | "post";

export const PLATFORM_COPY_RULES: Record<SocialPlatform, string> = {
  instagram: "Instagram: İlk satır güçlü, kaydırmayı durduran (scroll-stopper) bir kanca olsun. Değer + kısa, okunabilir madde imli anlatı + kaydetmeye/yorum yapmaya yönlendiren net CTA kullan. 5-8 ilgili Türkçe hashtag üret.",
  youtube: "YouTube Shorts: 75-95 karakter arasında yüksek tıklama oranlı (CTR) ve arama niyetli (SEO) çarpıcı başlık üret. Açıklama 2-3 cümle öz olsun ve #Shorts içersin. En fazla 3 görünür hashtag üret (#instagram/#tiktok kullanma). Ayrıca YouTube algoritması için 8-15 adet arka plan arama etiketi (tags) üret.",
  tiktok: "TikTok: Aşırı kurumsal dilden kaçın; samimi, konuşma dilinde, merak uyandıran 1-2 cümlelik soru veya kanca yaz. İzleyiciyi yorum yapmaya teşvik et. 3-5 adet mikro-niş Türkçe hashtag üret (#fyp gibi jenerik spam etiketler kullanma).",
  facebook: "Facebook: Güven, fayda ve topluluk/aile odaklı samimi anlatı kur. Açıklayıcı paragraf ve net eylem çağrısı ekle. En fazla 3 ilgili hashtag üret.",
  twitter: "X/Twitter: 280 karaktere uygun, vurucu, tartışma veya etkileşim başlatan öz metin yaz. En fazla 2 hashtag üret.",
};

export function getPlatformFormatRule(
  platform: SocialPlatform,
  format: ContentFormatKind,
  itemCount?: number
): string {
  if (platform === "youtube") {
    return "FORMAT HEDEFİ: YouTube Shorts (Dikey Kısa Video). Başlık hem arama motoruna (SEO) hem de Shorts akışında merak uyandırmaya uygun olmalı. Açıklama kısa tutulmalı, izleyiciyi kanala abone olmaya veya yorum bırakmaya davet etmeli.";
  }

  if (platform === "tiktok") {
    return "FORMAT HEDEFİ: TikTok Dikey Video. İlk cümle videonun ilk 3 saniyesini destekleyen samimi bir merak kancası olmalı. Kurumsal reklam dili yerine doğal içerik üreticisi (creator) dili kullanılmalı.";
  }

  if (platform === "instagram") {
    if (format === "carousel") {
      const slideText = itemCount && itemCount > 1 ? `${itemCount} sayfalık ` : "";
      return `FORMAT HEDEFİ: Instagram Kaydırmalı Carousel (${slideText}Rehber / Katalog Gönderisi). İlk satırda güçlü bir vaat ver ve 'Detaylar için sola kaydırın 👉' yönlendirmesi yap. Gövdede slaytların sunduğu değeri madde madde özetle. Sonunda 'Bu gönderiyi kaydedin 📌' CTA'sı ekle.`;
    }
    if (format === "story") {
      return "FORMAT HEDEFİ: Instagram Hikâye (Story). Çok kısa, tek bakışta okunan, samimi ve doğrudan DM'ye veya bağlantıya tıklamaya davet eden 1-2 cümlelik vurucu metin.";
    }
    if (format === "reel") {
      return "FORMAT HEDEFİ: Instagram Reels (Viral Dikey Video). İlk satır kaydırmayı anında durduran (scroll-stopper) çarpıcı bir kanca olmalı. Gövde kısa, ritmik ve merak uyandırıcı olmalı; sonunda yorum veya kaydetme odaklı etkileşim çağrısı yer almalı.";
    }
    return "FORMAT HEDEFİ: Instagram Akış Gönderisi (Feed Post). Estetik, dengeli paragraf yapısı, net değer önerisi ve profil bağlantısına/DM'ye yönlendiren CTA.";
  }

  if (platform === "facebook") {
    if (format === "reel") {
      return "FORMAT HEDEFİ: Facebook Reels (Kısa Video). Samimi, anlaşılır kanca ve güven veren kısa açıklama.";
    }
    if (format === "carousel") {
      return "FORMAT HEDEFİ: Facebook Çoklu Görsel / Albüm Gönderisi. Görsellerdeki bilgileri özetleyen bilgilendirici ve güven odaklı anlatı.";
    }
    return "FORMAT HEDEFİ: Facebook Akış Gönderisi. Hikâye anlatımı veya somut fayda odaklı, samimi topluluk paylaşımı.";
  }

  return "FORMAT HEDEFİ: Kısa, vurucu ve etkileşim odaklı sosyal medya paylaşımı.";
}

export function uniquePlatforms(values: string[]) {
  const supported = new Set(Object.keys(PLATFORM_COPY_RULES));
  return [...new Set(values.filter((value) => supported.has(value)))] as SocialPlatform[];
}
