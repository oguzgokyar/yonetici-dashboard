import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";
import { brandConceptInstruction } from "@/lib/brand-concept";

export const runtime = "nodejs";

type CopyStyle = "sales" | "story" | "educational" | "punchy";

const styleDescriptions: Record<CopyStyle, string> = {
  sales: "Dönüşüm / Satış & Kampanya (Güçlü CTA, teklif ve müşteri faydası vurgusu)",
  story: "Hikâye Anlatımı / Samimi (Samimi, insan odaklı ve merak uyandıran dil)",
  educational: "Eğitici & Bilgilendirici (Takipçiye değer katan ipuçları, rehber veya nasıl yapılır formatı)",
  punchy: "Kısa & Çarpıcı (Hızlı tüketilen, vurucu, Reels veya Story formatına özel)",
};

export async function POST(request: Request) {
  try {
    const input = (await request.json().catch(() => ({}))) as {
      projectId?: string;
      postType?: "post" | "reel" | "story";
      style?: CopyStyle;
      idea?: {
        title?: string;
        concept?: string;
      };
      sourceTopic?: string;
    };

    if (!input.projectId) {
      return Response.json({ ok: false, message: "Proje kimliği zorunludur." }, { status: 400 });
    }

    const database = getDatabase();
    const project = database
      .prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id = ?")
      .get(input.projectId) as { brand_json: string; brand_concept_json: string } | undefined;

    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    const brand = JSON.parse(project.brand_json || "{}") as Record<string, string>;
    const brandConcept = JSON.parse(project.brand_concept_json || "{}");

    const postType = input.postType || "post";
    const styleKey: CopyStyle = input.style || "sales";
    const styleLabel = styleDescriptions[styleKey] || styleDescriptions.sales;

    const topicContext = input.idea?.title
      ? `Seçilen İçerik Fikri: "${input.idea.title}"\nFikir Konsepti / Açıklaması: "${input.idea.concept || ""}"`
      : `Paylaşımın Ana Konusu: "${input.sourceTopic || "Marka ve ürün tanıtımı"}"`;

    const platformFormat =
      postType === "reel"
        ? "Instagram Reels (Video açıklaması, merak uyandırıcı ve dinamik)"
        : postType === "story"
        ? "Instagram Hikâye (Kısa, etkileşime veya DM'ye davet eden metin)"
        : "Instagram Gönderi (Feed akışı için dengeli ve bilgilendirici)";

    const prompt = `MARKA BİLGİLERİ:
Marka Adı: ${brand.brandName || "Belirtilmedi"}
Sektör: ${brand.industry || "Belirtilmedi"}
Hedef Kitle: ${brand.audience || "Genel kitle"}
İletişim Tonu: ${brand.tone || "Profesyonel, samimi"}
Varsayılan Eylem Çağrısı (CTA): ${brand.defaultCta || "Detaylı bilgi için profilimizdeki linke tıklayın"}
${brandConceptInstruction(brandConcept)}

PAYLAŞIM BAĞLAMI:
Hedef Format: ${platformFormat}
İçerik Stili: ${styleLabel}
${topicContext}

GÖREV:
Bu içerik için takipçilerin doğrudan okuyacağı, etkileşime gireceği ve markanın ses tonuyla birebir örtüşen Türkçe sosyal medya paylaşım metnini hazırla.
KURALLAR:
1. Asla görsel üretim talimatı (prompt), sahne tarifi, kamera açısı veya İngilizce parametre YAZMA.
2. İlk satır mutlaka kaydırmayı durduran, merak uyandıran bir kanca (hook) cümlesi olsun.
3. Metin içinde paragraflar rahat okunsun, emoji kullanımı abartısız ve yerinde olsun.
4. Metnin sonunda uygun bir eylem çağrısı (CTA) yer alsın.
5. Hashtag'ler Türkiye'deki hedef kitleye ve sektöre özel 5 ila 7 adet etiket olsun.
6. Yanıtın YALNIZCA geçerli bir JSON nesnesi olmalıdır:
{
  "title": "İçerik için kısa ve öz başlık (maks 50 karakter)",
  "caption": "Takipçilerin göreceği tam Instagram açıklama metni",
  "hashtags": "#etiket1 #etiket2 #etiket3 #etiket4 #etiket5"
}`;

    const { content } = await completeText(
      "Sen Türkiye'nin en başarılı markaları için sosyal medya metinleri ve reklam kopyaları üreten kıdemli bir kreatif metin yazarı ve sosyal medya direktörüsün. Yanıtın yalnızca geçerli JSON olmalıdır.",
      prompt,
      { temperature: 0.75, maxTokens: 1800 }
    );

    const parsed = parseJsonResponse<{ title?: string; caption?: string; hashtags?: string }>(content);

    return Response.json({
      ok: true,
      copy: {
        title: parsed.title || input.idea?.title || input.sourceTopic || "Sosyal Medya Gönderisi",
        caption: parsed.caption || input.idea?.concept || input.sourceTopic || "",
        hashtags: parsed.hashtags || "",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, message: `Metin üretilemedi: ${msg}` }, { status: 500 });
  }
}
