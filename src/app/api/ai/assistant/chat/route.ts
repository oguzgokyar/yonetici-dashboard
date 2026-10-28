import crypto from "node:crypto";
import { completeText } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";
import { brandConceptInstruction, type BrandConcept } from "@/lib/brand-concept";
import { COLUMN_AGENCY_SPECS, type ColumnType } from "@/lib/server/strategy-generator";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AssistantSpecialistSlug =
  | "viral_growth"
  | "creative_design"
  | "paid_growth"
  | "ops_assistant";

export type AssistantSpecialist = {
  slug: AssistantSpecialistSlug;
  name: string;
  badge: string;
  agencySource: string;
  description: string;
  rolePrompt: string;
};

export const ASSISTANT_SPECIALISTS: Record<AssistantSpecialistSlug, AssistantSpecialist> = {
  viral_growth: {
    slug: "viral_growth",
    name: "Viral Büyüme & Kanca Koçu",
    badge: "⚡ Agency Viral Growth",
    agencySource: "marketing-tiktok-strategist & growth-hacker",
    description: "İlk 3 saniye kancaları, izlenme süresi (retention) ve TikTok/Reels algoritmaları",
    rolePrompt: `Sen The Agency ağının 'Viral Büyüme & Kanca Koçu' (TikTok Strategist & Growth Hacker) uzmanısın.
UZMANLIK ALANIN:
- İlk 3 saniyede parmak durduran kancalar (Scroll-stopper: Uyarı/Negatif merak, Ters köşe, Şok sonuç).
- Dikey video retention (izlenme tamamlama) dinamikleri ve B-roll kesim temposu.
- İzleyicileri ikiye bölen ve yorum yapmaya kışkırtan sorular (Comment Bait).
- Trendleri markanın nişine uyarlama ve viral döngü (viral loop) kurguları.`,
  },
  creative_design: {
    slug: "creative_design",
    name: "Kreatif & Tasarım Direktörü",
    badge: "🎨 Agency Design Studio",
    agencySource: "design-visual-storyteller & design-image-prompt-engineer",
    description: "AI görsel promptları (ışık/lens), görsel kompozisyon ve Canva kurgusu",
    rolePrompt: `Sen The Agency ağının 'Kreatif & Tasarım Direktörü' (Design Visual Storyteller & Image Prompt Engineer) uzmanısın.
UZMANLIK ALANIN:
- Midjourney, Flux, SD ve DALL-E için stüdyo düzeyinde prompt mühendisliği (ışık, kamera lensi, diyafram, negatif promptlar).
- Görsel kompozisyon, tipografi hiyerarşisi, renk paleti ve marka kimliği tutarlılığı (Brand Guardian).
- 6-aşamalı kaydırmalı (Canva Carousel) görsel anlatı mimarisi ve dikkat çekici infografik kurguları.`,
  },
  paid_growth: {
    slug: "paid_growth",
    name: "Dönüşüm & Satış Stratejisti",
    badge: "💼 Agency Paid & Sales",
    agencySource: "paid-media-creative-strategist & sales-offer-lead-gen-strategist",
    description: "Dönüşüm hunisi, satış odaklı teklif mimarisi ve reklam kopyaları",
    rolePrompt: `Sen The Agency ağının 'Dönüşüm & Satış Stratejisti' (Paid Media Creative Strategist & Sales Offer Architect) uzmanısın.
UZMANLIK ALANIN:
- Doğrudan dönüşüm ve satış getiren reklam kreatifleri (Problem-Solution, Us vs Them, Social Proof, Loss Aversion).
- Karşı konulamaz teklif (Offer) mimarisi ve müşteri kazanım hunileri (Funnel).
- Profil bağlantısına veya DM'ye yönlendiren eylem çağrıları (CTA) ve dönüşüm psikolojisi.`,
  },
  ops_assistant: {
    slug: "ops_assistant",
    name: "Hermes Sistem & İş Akışı Asistanı",
    badge: "🤖 Hermes Ops Assistant",
    agencySource: "agency_agents_router",
    description: "Paylaşım planlama, toplu yayın revizeleri ve sistem operasyonları",
    rolePrompt: `Sen Yönetici Dashboard sisteminin kıdemli 'Sistem & İş Akışı Asistanı' (Hermes Ops Assistant) rolündesin.
UZMANLIK ALANIN:
- Paylaşım Planlama sayfasındaki içerikleri, başlıkları, açıklamaları ve etiketleri anında revize etmek.
- Platformlar arası (Instagram, TikTok, YouTube Shorts, X) paylaşım kuralları ve sistem işleyişi.
- Toplu yayın önizleme kartlarını ve tekil composer metinlerini doğrudan güncellemek.`,
  },
};

function detectSpecialist(lastUserMessage: string, explicitSlug?: string): AssistantSpecialist {
  if (explicitSlug && explicitSlug in ASSISTANT_SPECIALISTS) {
    return ASSISTANT_SPECIALISTS[explicitSlug as AssistantSpecialistSlug];
  }

  const text = lastUserMessage.toLowerCase();

  // 1. Ops & Revize anahtar kelimeleri
  if (
    text.includes("toplu") ||
    text.includes("revize") ||
    text.includes("güncelle") ||
    text.includes("composer") ||
    text.includes("paylaşım planı") ||
    text.includes("kartları")
  ) {
    return ASSISTANT_SPECIALISTS.ops_assistant;
  }

  // 2. Tasarım & Görsel anahtar kelimeleri
  if (
    text.includes("görsel") ||
    text.includes("resim") ||
    text.includes("tasarım") ||
    text.includes("prompt") ||
    text.includes("renk") ||
    text.includes("canva") ||
    text.includes("fotoğraf") ||
    text.includes("banner") ||
    text.includes("midjourney") ||
    text.includes("flux")
  ) {
    return ASSISTANT_SPECIALISTS.creative_design;
  }

  // 3. Reklam & Satış anahtar kelimeleri
  if (
    text.includes("reklam") ||
    text.includes("satış") ||
    text.includes("kampanya") ||
    text.includes("bütçe") ||
    text.includes("teklif") ||
    text.includes("dönüşüm") ||
    text.includes("cta") ||
    text.includes("fiyat") ||
    text.includes("lead") ||
    text.includes("müşteri")
  ) {
    return ASSISTANT_SPECIALISTS.paid_growth;
  }

  // Varsayılan: Viral Büyüme & Kanca Koçu
  return ASSISTANT_SPECIALISTS.viral_growth;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      projectId?: string;
      messages?: ChatMessage[];
      message?: string;
      pageContext?: Record<string, unknown>;
      agentSlug?: string;
    };

    const messages = Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
      : body.message
      ? [{ role: "user" as const, content: body.message }]
      : [];

    if (messages.length === 0) {
      return Response.json({ ok: false, message: "Mesaj gönderilmedi." }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const activeSpecialist = detectSpecialist(lastUserMessage, body.agentSlug);

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
[MEVCUT SAYFA BAĞLAMI]:
${JSON.stringify(body.pageContext, null, 2)}
`;
      } catch {}
    }

    const systemPrompt = `${activeSpecialist.rolePrompt}
Sen The Agency & Hermes Agent ekosisteminin bir parçasısın.
Uzmanlık Kimliğin: ${activeSpecialist.name} (${activeSpecialist.badge})

KURALLAR VE FORMAT İLKELERİ:
1. NET, DOĞAL VE TEMİZ YAZIM (KARAKTER VE TİPOGRAFİ TEMİZLİĞİ):
   - Metinleri ve açıklamaları asla kısaltma veya özetleme; fikirleri, B-roll detaylarını, replikleri ve süreleri eksiksiz aktar.
   - Okumayı engelleyen ve görsel karmaşa yaratan sembollerden kesinlikle kaçın:
     * Başlıklarda diyez (#, ##, ###) KULLANMA. Başlıkları sade büyük harfle tek satır olarak yaz (Örn: 1. KONSEPT: ...).
     * İç içe geçmiş çift yıldız yığınlarından (* **Etiket:** * *Değer*) kesinlikle kaçın.
     * Alan adlarını temiz ve doğrudan yaz: Açı: ..., Kanca Tipi: ..., Yorum Tuzağı: ..., CTA: ... şeklinde. Başına madde işareti (*) koyma.
     * Yalnızca alt maddeler ve zaman akışları için tek kademeli temiz madde işareti (•) kullan.
     * Cümlelerin veya repliklerin başına ve sonuna gereksiz çift/tek yıldız (*"..."*) yığma; metinleri doğal, akıcı ve temiz sun.
     * Mantıksal bölümler arasında birer satır boşluk bırak. Tablo veya ASCII kutu çizgileri KULLANMA.
2. İÇERİK KALİTESİ:
   - Cevapların net, vurucu, okunabilir ve doğrudan eyleme dökülebilir olsun. Jenerik AI klişelerinden ve süslü boş laflardan kaçın.
   - Marka bağlamı verilmişse yanıtlarını markanın sektörüne, hedef kitlesine ve ses tonuna göre uyarla.
   - Kanca önerirken Agency kanca tiplerini (Uyarı/Negatif Merak, Ters Köşe, Şok Sonuç) kullan.
4. ÖNEMLİ — SİSTEME AKSİYON TETİKLEME YETKİLERİN:
   A) STRATEJİ PANOSUNA YENİ FİKİR EKLEME:
      Kullanıcı yeni bir fikir beğendiğinde veya "Bunu stratejiye/panoya ekle", "Bu fikri kaydet" derse, yanıtının EN SONUNA mutlaka şu JSON bloğunu ekle:
\`\`\`json
{
  "action": "add_strategy_idea",
  "idea": {
    "columnType": "vertical_video",
    "title": "Kısa Fikir Adı",
    "hook": "İlk 3 saniye kancası",
    "description": "Fikrin 1-2 cümlelik özeti",
    "structure": ["1. Giriş Kancası", "2. Sorun Büyütme", "3. Çözüm", "4. Tartışma Sorusu"],
    "targetChannel": "Reels / TikTok",
    "ideaType": "problem_solution"
  }
}
\`\`\`
   (Not: columnType: "vertical_video" | "carousel" | "single_post" | "engagement" olabilir.)

   B) PAYLAŞIM PLANINI TOPLU GÜNCELLEME:
      Kullanıcı paylaşımları revize etmeni isterse:
\`\`\`json
{
  "action": "update_bulk_items",
  "updates": [
    {
      "index": 0,
      "platform": "instagram",
      "title": "Yeni Başlık",
      "caption": "Yeni Açıklama",
      "hashtags": "#Etiket1 #Etiket2"
    }
  ]
}
\`\`\`

   C) TEKİL COMPOSER METNİ GÜNCELLEME:
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
    const historyText = conversationHistory
      .slice(0, -1)
      .map((m) => `${m.role === "user" ? "Kullanıcı" : "Asistan"}: ${m.content}`)
      .join("\n\n");

    const fullPrompt = historyText
      ? `GEÇMİŞ KONUŞMA:\n${historyText}\n\nKULLANICI: ${lastUserMessage}`
      : lastUserMessage;

    const { content } = await completeText(systemPrompt, fullPrompt, {
      temperature: 0.7,
      maxTokens: 2200,
    });

    // Yanıt içindeki JSON aksiyon bloğunu ayıkla
    let extractedAction: Record<string, unknown> | null = null;
    let cleanContent = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/i);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (
          parsed &&
          (parsed.action === "update_bulk_items" ||
            parsed.action === "update_composer" ||
            parsed.action === "add_strategy_idea")
        ) {
          extractedAction = parsed;
          cleanContent = content.replace(jsonMatch[0], "").trim();

          // Eğer add_strategy_idea ise doğrudan veritabanına da kaydedelim
          if (parsed.action === "add_strategy_idea" && body.projectId && parsed.idea) {
            try {
              const db = getDatabase();
              const targetCol = (parsed.idea.columnType || "vertical_video") as ColumnType;
              const ideaId = crypto.randomUUID();
              const now = new Date().toISOString();
              const skillSrc =
                parsed.idea.skillSource ||
                COLUMN_AGENCY_SPECS[targetCol]?.agentSlug ||
                "marketing-tiktok-strategist";

              db.prepare(`
                INSERT INTO project_strategy_ideas (
                  id, project_id, column_type, title, hook, description, structure_json, target_channel, idea_type, skill_source, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'suggested', ?, ?)
              `).run(
                ideaId,
                body.projectId,
                targetCol,
                (parsed.idea.title || "Yeni İçerik Fikri").trim(),
                parsed.idea.hook || "",
                parsed.idea.description || "",
                JSON.stringify(Array.isArray(parsed.idea.structure) ? parsed.idea.structure : []),
                parsed.idea.targetChannel || "",
                parsed.idea.ideaType || "problem_solution",
                skillSrc,
                now,
                now
              );

              // İstemciye kaydedilen fikrin tam halini dönelim
              if (extractedAction) {
                extractedAction.idea = {
                  ...parsed.idea,
                  id: ideaId,
                  columnType: targetCol,
                  skillSource: skillSrc,
                  status: "suggested",
                  createdAt: now,
                };
                extractedAction.savedToDatabase = true;
              }
            } catch (dbErr) {
              console.error("[Assistant Add Strategy Idea Error]", dbErr);
            }
          }
        }
      } catch {}
    }

    return Response.json({
      ok: true,
      specialist: {
        slug: activeSpecialist.slug,
        name: activeSpecialist.name,
        badge: activeSpecialist.badge,
        agencySource: activeSpecialist.agencySource,
        description: activeSpecialist.description,
      },
      message: {
        role: "assistant",
        content: cleanContent || "İsteğiniz doğrultusunda hazırlandı.",
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
