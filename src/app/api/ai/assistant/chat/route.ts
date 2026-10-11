import { completeText } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";
import { brandConceptInstruction, type BrandConcept } from "@/lib/brand-concept";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      projectId?: string;
      messages?: ChatMessage[];
      message?: string;
      pageContext?: Record<string, unknown>;
    };

    const messages = Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
      : body.message
      ? [{ role: "user" as const, content: body.message }]
      : [];

    if (messages.length === 0) {
      return Response.json({ ok: false, message: "Mesaj gönderilmedi." }, { status: 400 });
    }

    let brandContext = "";
    if (body.projectId) {
      try {
        const db = getDatabase();
        const project = db
          .prepare("SELECT name, brand_json, brand_concept_json FROM projects WHERE id = ?")
          .get(body.projectId) as { name: string; brand_json: string; brand_concept_json: string } | undefined;

        if (project) {
          const brand = JSON.parse(project.brand_json || "{}") as Record<string, string>;
          const concept = JSON.parse(project.brand_concept_json || "{}") as Partial<BrandConcept>;

          const accounts = db
            .prepare("SELECT identifier, name, profile FROM project_social_accounts WHERE project_id = ? AND disabled = 0")
            .all(body.projectId) as Array<{ identifier: string; name: string; profile: string }>;

          const accountList = accounts.length > 0
            ? accounts.map((a) => `${a.identifier} (@${a.profile || a.name})`).join(", ")
            : "Bağlı aktif hesap bulunmuyor";

          brandContext = `
[AKTİF PROJE BAĞLAMI]:
Proje Adı: ${project.name}
Marka Adı: ${brand.brandName || project.name}
Sektör: ${brand.industry || "Belirtilmedi"}
Hedef Kitle: ${brand.audience || "Genel"}
İletişim Tonu: ${brand.tone || "Samimi, profesyonel"}
Varsayılan CTA: ${brand.defaultCta || "Detaylı bilgi için profil bağlantısını inceleyin"}
Bağlı Sosyal Kanallar: ${accountList}
${brandConceptInstruction(concept)}
`;
        }
      } catch {
        // DB okuma hatası olursa sohbet yine de çalışsın
      }
    }

    let pageContextInfo = "";
    if (body.pageContext && typeof body.pageContext === "object") {
      try {
        pageContextInfo = `
[MEVCUT PAYLAŞIM PLANLAMA SAYFASI VERİLERİ]:
${JSON.stringify(body.pageContext, null, 2)}
`;
      } catch {}
    }

    const systemPrompt = `Sen "Yönetici Dashboard" sisteminin kıdemli AI Sistem Asistanı ve Sosyal Medya Stratejistisin.
Adın: Hermes Asistan.
Görevin: Kullanıcıya sosyal medya stratejisi, video/kreatif kurguları, kanca (hook) cümleleri, YouTube Shorts/Instagram Reels içerik fikirleri hakkında rehberlik sunmak ve İSTENDİĞİNDE Paylaşım Planlama sayfasındaki hazırlanan içerikleri (toplu yayın revizeleri veya tekil composer metinleri) doğrudan güncellemektir.

KURALLAR:
1. Cevapların net, okunabilir, madde imli ve doğrudan uygulanabilir olsun.
2. Marka bağlamı verilmişse yanıtlarını markanın sektörüne, hedef kitlesine ve ses tonuna göre kişiselleştir.
3. ÖNEMLİ — SAYFA İÇERİĞİNİ GÜNCELLEME YETKİSİ:
   Eğer kullanıcı "Toplu yayın önizlemesindeki içerikleri güncelle / başlıkları kısalt / açıklamaların sonuna CTA ekle / 2. içeriği değiştir" gibi bir revize talep ederse:
   - Önce kullanıcıya yaptığın değişikliği kısaca açıkla.
   - Ardından yanıtının EN SONUNA mutlaka aşağıdaki JSON kod bloğunu ekle (sistem bu bloğu okuyup sayfadaki kartları otomatik güncelleyecektir):
\`\`\`json
{
  "action": "update_bulk_items",
  "updates": [
    {
      "index": 0,
      "platform": "instagram",
      "title": "Yeni Başlık",
      "caption": "Yeni Açıklama Metni",
      "hashtags": "#YeniEtiket1 #YeniEtiket2"
    }
  ]
}
\`\`\`
   Eğer tekil "İçerik Yayınla" (composer) sekmesindeki metni güncellemesi istenirse:
\`\`\`json
{
  "action": "update_composer",
  "single": {
    "title": "Yeni Başlık",
    "caption": "Yeni Açıklama",
    "hashtags": "#Etiket1 #Etiket2"
  }
}
\`\`\`
${brandContext}
${pageContextInfo}`;

    // Son 8 mesajı alarak prompt oluştur
    const conversationHistory = messages.slice(-8);
    const lastUserMessage = conversationHistory[conversationHistory.length - 1]?.content || "";
    const historyText = conversationHistory.slice(0, -1).map((m) => `${m.role === "user" ? "Kullanıcı" : "Asistan"}: ${m.content}`).join("\n\n");

    const fullPrompt = historyText
      ? `GEÇMİŞ KONUŞMA:\n${historyText}\n\nKULLANICI: ${lastUserMessage}`
      : lastUserMessage;

    const { content } = await completeText(systemPrompt, fullPrompt, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    // Yanıt içindeki JSON aksiyon bloğunu ayıkla
    let extractedAction: Record<string, unknown> | null = null;
    let cleanContent = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/i);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (parsed && (parsed.action === "update_bulk_items" || parsed.action === "update_composer")) {
          extractedAction = parsed;
          cleanContent = content.replace(jsonMatch[0], "").trim();
        }
      } catch {}
    }

    return Response.json({
      ok: true,
      message: {
        role: "assistant",
        content: cleanContent || "İstediğiniz revizeler hazırlandı ve sayfaya uygulandı.",
      },
      action: extractedAction,
    });
  } catch (err) {
    return Response.json(
      { ok: false, message: err instanceof Error ? err.message : "Asistan yanıt üretemedi." },
      { status: 500 }
    );
  }
}
