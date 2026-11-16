import "server-only";

import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";

export type SeriesEpisode = {
  id: string;
  series_id: string;
  order_index: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  user_notes: string;
  updated_at: string;
};

export type ContentSeries = {
  id: string;
  project_id: string;
  main_topic: string;
  rationale: string;
  episode_count: number;
  current_index: number;
  episodes: SeriesEpisode[];
  created_at: string;
  updated_at: string;
};

export type SeriesSummary = {
  id: string;
  main_topic: string;
  episode_count: number;
  completed_count: number;
  current_index: number;
  updated_at: string;
};

export type StrategicSuggestion = {
  title: string;
  description: string;
};

type AIResearchOutput = {
  rationale: string;
  episodes: Array<{
    order_index: number;
    title: string;
    description: string;
  }>;
};

type AISuggestionOutput = {
  suggestions: StrategicSuggestion[];
};

export async function getProjectSeriesList(projectId: string): Promise<SeriesSummary[]> {
  const db = getDatabase();
  const seriesRows = db
    .prepare(
      "SELECT id, main_topic, episode_count, current_index, updated_at FROM project_content_series WHERE project_id = ? ORDER BY updated_at DESC"
    )
    .all(projectId) as Array<{
    id: string;
    main_topic: string;
    episode_count: number;
    current_index: number;
    updated_at: string;
  }>;

  return seriesRows.map((row) => {
    const compRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM project_series_episodes WHERE series_id = ? AND status = 'completed'"
      )
      .get(row.id) as { count: number } | undefined;

    return {
      id: row.id,
      main_topic: row.main_topic,
      episode_count: row.episode_count,
      completed_count: compRow?.count || 0,
      current_index: row.current_index,
      updated_at: row.updated_at,
    };
  });
}

export async function getProjectSeriesById(seriesId: string): Promise<ContentSeries | null> {
  const db = getDatabase();
  const seriesRow = db
    .prepare("SELECT * FROM project_content_series WHERE id = ?")
    .get(seriesId) as
    | {
        id: string;
        project_id: string;
        main_topic: string;
        rationale: string;
        episode_count: number;
        current_index: number;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!seriesRow) return null;

  const episodeRows = db
    .prepare("SELECT * FROM project_series_episodes WHERE series_id = ? ORDER BY order_index ASC")
    .all(seriesRow.id) as Array<{
    id: string;
    series_id: string;
    order_index: number;
    title: string;
    core_message: string;
    status: string;
    user_notes: string;
    updated_at: string;
  }>;

  const episodes: SeriesEpisode[] = episodeRows.map((row) => ({
    id: row.id,
    series_id: row.series_id,
    order_index: row.order_index,
    title: row.title,
    description: row.core_message || "",
    status: (row.status as "pending" | "in_progress" | "completed") || "pending",
    user_notes: row.user_notes || "",
    updated_at: row.updated_at,
  }));

  return {
    ...seriesRow,
    episodes,
  };
}

export async function getProjectSeries(projectId: string): Promise<ContentSeries | null> {
  const db = getDatabase();
  const latestRow = db
    .prepare("SELECT id FROM project_content_series WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1")
    .get(projectId) as { id: string } | undefined;

  if (!latestRow) return null;
  return getProjectSeriesById(latestRow.id);
}

export async function suggestStrategicSeries(projectId: string): Promise<StrategicSuggestion[]> {
  const db = getDatabase();
  const strategyRow = db
    .prepare(
      "SELECT brand_name, brand_description, brand_identity_json, competitor_analysis_json, audience_voc_json, growth_strategy_json FROM project_brand_strategies WHERE project_id = ?"
    )
    .get(projectId) as Record<string, string> | undefined;

  const projectRow = db.prepare("SELECT name, brand_json FROM projects WHERE id = ?").get(projectId) as
    | { name: string; brand_json: string }
    | undefined;

  let context = "";
  if (strategyRow && strategyRow.brand_name) {
    context = `Marka: ${strategyRow.brand_name}
Açıklama: ${strategyRow.brand_description || ""}
Marka Kimliği: ${strategyRow.brand_identity_json || "{}"}
Rakip Boşlukları: ${strategyRow.competitor_analysis_json || "{}"}
Kitle Acı Noktaları: ${strategyRow.audience_voc_json || "{}"}
Büyüme Stratejisi: ${strategyRow.growth_strategy_json || "{}"}`;
  } else if (projectRow) {
    context = `Marka: ${projectRow.name || ""}, Veriler: ${projectRow.brand_json || "{}"}`;
  }

  const systemPrompt = `Sen kıdemli bir İçerik ve Büyüme Stratejistisin.
Görevin: Verilen marka stratejisini, kitle acı noktalarını ve pazar dinamiklerini analiz ederek, markanın uzmanlık kurmasını ve hedef kitleyi çekecek 3 adet stratejik "Ana Seri Konusu" önermektir.

KURALLAR:
1. Kesinlikle hiçbir içerik formatına (karosel, reels, video, post vb.) atıfta bulunma. Yalnızca konunun ve serinin stratejik özüne odaklan.
2. Her öneri net bir başlık ve bunun stratejik önemini anlatan 1-2 cümlelik kısa bir açıklamadan oluşmalıdır.
3. Yalnızca JSON formatında yanıt ver.

JSON ŞEMASI:
{
  "suggestions": [
    {
      "title": "Stratejik Seri Konu Başlığı",
      "description": "Bu serinin neden üretilmesi gerektiğini ve kitlenin hangi temel sorununu çözdüğünü belirten kısa stratejik açıklama."
    }
  ]
}`;

  const userPrompt = `Marka ve Strateji Bağlamı:\n${context}\n\nLütfen bu marka için en yüksek etkiyi yaratacak 3 stratejik ana seri konusu öner.`;

  const { content } = await completeText(systemPrompt, userPrompt, {
    temperature: 0.75,
    maxTokens: 1200,
  });

  const parsed = parseJsonResponse<AISuggestionOutput>(content);
  return Array.isArray(parsed?.suggestions) ? parsed.suggestions.slice(0, 4) : [];
}

export async function researchAndCreateSeries(projectId: string, mainTopic: string): Promise<ContentSeries> {
  const cleanTopic = mainTopic.trim();
  if (!cleanTopic) {
    throw new Error("Ana konu başlığı boş olamaz.");
  }

  const db = getDatabase();
  const projectRow = db.prepare("SELECT name, brand_json FROM projects WHERE id = ?").get(projectId) as
    | { name: string; brand_json: string }
    | undefined;

  let brandContext = "";
  if (projectRow) {
    try {
      const brand = JSON.parse(projectRow.brand_json || "{}");
      brandContext = `Marka: ${projectRow.name || ""}, Sektör: ${brand.industry || ""}, Hedef Kitle: ${brand.audience || ""}, Ton: ${brand.tone || ""}`;
    } catch {
      brandContext = `Marka: ${projectRow.name || ""}`;
    }
  }

  const systemPrompt = `Sen kıdemli bir İçerik Mimarisi ve Sosyal Medya Seri Planlama Uzmanısın.
Görevin: Kullanıcının verdiği ana konuyu derinlemesine analiz etmek ve konunun gerçek ağırlığına göre en mantıklı alt konulara bölmektir.

KESİN KURALLAR:
1. İÇERİK TİPİ YASAKTIR: Çıktıda karosel, video, reels, post, story veya infografik gibi formatlara ASLA değinme veya tavsiye verme. Sadece konunun kendisine odaklan.
2. YALIN YAPI: Her alt konu sadece bir 'title' (başlık) ve 'description' (kısa ve net açıklama, 1-2 cümle) değerlerinden oluşmalıdır.
3. ARAÇ VE YÖNTEMLERİ AYRIŞTIR: Farklı uygulama, araç, donanım veya yöntemleri (örnek: Micro:bit ile Makey Makey, veya Canva ile Figma) asla tek bir alt başlık altında birleştirme. Her bir aracı/yöntemi müstakil, ayrı birer alt konu olarak oluştur.
4. DİNAMİK BÖLÜM SAYISI: Konuyu sabit bir sayıya sıkıştırma. Konunun derinliğine ve kapsamına göre optimal bölüm sayısını sen belirle.
5. Çıktı kesinlikle saf JSON olmalıdır.

JSON ŞEMASI:
{
  "rationale": "Konunun neden bu sayıda alt konuya ayrıldığını açıklayan 1-2 cümlelik gerekçe.",
  "episodes": [
    {
      "order_index": 1,
      "title": "Alt Konu Başlığı",
      "description": "Bu alt konunun içeriğini anlatan kısa, net açıklama."
    }
  ]
}`;

  const userPrompt = `Bağlam: ${brandContext}
Ana Konu Başlığı: ${cleanTopic}

Lütfen bu konuyu araştır, her aracı/yöntemi ayrı tutarak ardışık alt konuları çıkar.`;

  const { content } = await completeText(systemPrompt, userPrompt, {
    temperature: 0.6,
    maxTokens: 2500,
  });

  const parsed = parseJsonResponse<AIResearchOutput>(content);

  if (!parsed.episodes || !Array.isArray(parsed.episodes) || parsed.episodes.length === 0) {
    throw new Error("AI uygun bölüm listesi üretemedi.");
  }

  const now = new Date().toISOString();
  const seriesId = `series_${crypto.randomUUID()}`;
  const episodeCount = parsed.episodes.length;

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(
      `INSERT INTO project_content_series (id, project_id, main_topic, rationale, episode_count, current_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(seriesId, projectId, cleanTopic, parsed.rationale || "", episodeCount, now, now);

    const insertEp = db.prepare(
      `INSERT INTO project_series_episodes (id, series_id, order_index, title, core_message, key_points_json, status, user_notes, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', ?, '', ?)`
    );

    parsed.episodes.forEach((ep, idx) => {
      const epId = `ep_${crypto.randomUUID()}`;
      const order = ep.order_index || idx + 1;
      const initialStatus = idx === 0 ? "in_progress" : "pending";
      insertEp.run(
        epId,
        seriesId,
        order,
        ep.title || `Bölüm ${order}`,
        ep.description || "",
        initialStatus,
        now
      );
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const created = await getProjectSeriesById(seriesId);
  if (!created) {
    throw new Error("Seri veritabanına kaydedilemedi.");
  }
  return created;
}

export async function updateEpisode(
  episodeId: string,
  updates: {
    status?: "pending" | "in_progress" | "completed";
    title?: string;
    description?: string;
    user_notes?: string;
  }
): Promise<void> {
  const db = getDatabase();
  const ep = db.prepare("SELECT * FROM project_series_episodes WHERE id = ?").get(episodeId) as
    | { series_id: string; order_index: number; status: string }
    | undefined;

  if (!ep) throw new Error("Bölüm bulunamadı.");

  const now = new Date().toISOString();
  const setClauses: string[] = ["updated_at = ?"];
  const params: (string | number | null)[] = [now];

  if (updates.status !== undefined) {
    setClauses.push("status = ?");
    params.push(updates.status);
  }
  if (updates.title !== undefined) {
    setClauses.push("title = ?");
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push("core_message = ?");
    params.push(updates.description);
  }
  if (updates.user_notes !== undefined) {
    setClauses.push("user_notes = ?");
    params.push(updates.user_notes);
  }

  params.push(episodeId);
  db.prepare(`UPDATE project_series_episodes SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);

  // If status changed to completed, advance current_index of the series
  if (updates.status === "completed") {
    const nextEp = db
      .prepare(
        "SELECT order_index FROM project_series_episodes WHERE series_id = ? AND status != 'completed' ORDER BY order_index ASC LIMIT 1"
      )
      .get(ep.series_id) as { order_index: number } | undefined;

    const nextIndex = nextEp ? nextEp.order_index : ep.order_index;
    db.prepare("UPDATE project_content_series SET current_index = ?, updated_at = ? WHERE id = ?").run(
      nextIndex,
      now,
      ep.series_id
    );

    if (nextEp) {
      db.prepare(
        "UPDATE project_series_episodes SET status = 'in_progress', updated_at = ? WHERE series_id = ? AND order_index = ? AND status = 'pending'"
      ).run(now, ep.series_id, nextEp.order_index);
    }
  } else if (updates.status === "in_progress") {
    db.prepare("UPDATE project_content_series SET current_index = ?, updated_at = ? WHERE id = ?").run(
      ep.order_index,
      now,
      ep.series_id
    );
  }
}
