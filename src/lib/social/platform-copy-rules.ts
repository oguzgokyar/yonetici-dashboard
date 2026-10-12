import type { SocialPlatform } from "./hashtag-policy.ts";

export type ContentFormatKind = "reel" | "story" | "carousel" | "post";

export const PLATFORM_COPY_RULES: Record<SocialPlatform, string> = {
  instagram: `Instagram: Agency Agents (Instagram Curator & Carousel Growth Engine) kuralları geçerlidir:
- İlk satır parmak durduran (scroll-stopper) kanca olmalıdır ('... devamını oku' tıklaması tetiklemeli).
- Gövdede 3-4 maddelik hızlı tüketilen değer özeti sunulmalıdır.
- Gönderi sonunda mutlaka Kaydetme veya Paylaşma mıknatısı olmalıdır: 'Daha sonra denemek için bu gönderiyi kaydet 📌' veya 'Bunu deneyecek arkadaşına gönder 🚀'.
- Asla yapay jenerik reklam dili kullanma; 5-8 adet içerikle doğrudan ilgili Türkçe hashtag üret.`,

  youtube: `YouTube Shorts: Agency Agents Video Algoritması kuralları geçerlidir:
- Başlık: 70-90 karakter arasında, hem yüksek tıklama oranlı (CTR merak kancası) hem de arama motoru (SEO) uyumlu olmalıdır. Başlıkta en fazla 1 emoji ve sonuna '#Shorts' eklenmelidir.
- Açıklama: 2-3 cümlelik öz anlatım ve kanala abone olmaya davet eden net CTA.
- Görünür Hashtag: Açıklama sonunda en fazla 3 görünür hashtag (#Shorts dahil, asla #instagram veya #tiktok kullanma).
- Arka Plan Arama Etiketleri (tags): YouTube algoritmasının videoyu doğru aramalarda önermesi için 10-15 adet temiz arama anahtar kelimesi (arama terimi) üret.`,

  tiktok: `TikTok: Agency Agents (TikTok Strategist) viral kuralları geçerlidir:
- 3-Saniye Kuralı: Aşırı kurumsal, süslü ve uzun açıklama KESİNLİKLE YASAKTIR.
- Uzunluk: En fazla 2 kısa ve vurucu cümle + izleyiciyi ikiye bölen veya yorum yapmaya kışkırtan 1 açık soru (Comment Bait). Örn: 'Sence 10 üzerinden kaç puan? Sen olsan ne eklerdin? Yorumlarda buluşalım 👇'.
- Hashtag: #fyp, #kesfet, #viral gibi spam etiketler YASAKTIR. Yalnızca 3-5 adet mikro-niş Türkçe etiket üret.`,

  facebook: "Facebook: Güven, fayda ve aile/topluluk odaklı samimi anlatı kur. Açıklayıcı paragraf ve net eylem çağrısı ekle. En fazla 3 ilgili hashtag üret.",
  twitter: "X/Twitter: 280 karaktere uygun, vurucu, tartışma veya etkileşim başlatan öz metin yaz. En fazla 2 hashtag üret.",
};

export function getPlatformFormatRule(
  platform: SocialPlatform,
  format: ContentFormatKind,
  itemCount?: number
): string {
  if (platform === "youtube") {
    return "FORMAT HEDEFİ: YouTube Shorts (Dikey Video). Başlık: [Merak Kancası] + [Arama Anahtar Kelimesi] + #Shorts şeklinde yüksek tıklamalı olmalı. Açıklama 2 cümleyi geçmemeli ve abone olmaya yönlendirmeli.";
  }

  if (platform === "tiktok") {
    return "FORMAT HEDEFİ: TikTok Dikey Video. Metin maksimum 140-160 karakter olmalı! 1 kısa kanca cümle + 1 tartışmalı soru (yorum tetikleyici). Asla uzun paragraf yazma.";
  }

  if (platform === "instagram") {
    if (format === "carousel") {
      const slideText = itemCount && itemCount > 1 ? `${itemCount} sayfalık ` : "";
      return `FORMAT HEDEFİ: Instagram Kaydırmalı Carousel (${slideText}Rehber). 6-Aşamalı Anlatı Yayı (Hook → Problem → Agitation → Solution → Feature → CTA): İlk satırda güçlü bir vaat ver, 'Detaylar için sola kaydırın 👉' yönlendirmesi yap. Slaytların sunduğu hap adımları özetle. Kapanışta 'Bu rehberi kaydet 📌' de.`;
    }
    if (format === "story") {
      return "FORMAT HEDEFİ: Instagram Hikâye (Story). Çok kısa, tek bakışta okunan, samimi ve doğrudan DM'ye veya bağlantıya tıklamaya davet eden 1-2 cümlelik vurucu metin.";
    }
    if (format === "reel") {
      return "FORMAT HEDEFİ: Instagram Reels (Viral Dikey Video). İlk satır 'devamını oku' butonuna bastıracak güçlü bir merak kancası olmalı. Gövde 3 satırlık ritmik değer sunmalı, sonunda 'Kaydet 📌 / Arkadaşına gönder' çağrısı yer almalı.";
    }
    return "FORMAT HEDEFİ: Instagram Akış Gönderisi (Feed Post). Estetik ve samimi paragraf yapısı, net değer önerisi ve profil bağlantısına yönlendiren CTA.";
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
