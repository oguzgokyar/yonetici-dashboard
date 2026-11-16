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

export async function updateSeriesTitle(seriesId: string, mainTopic: string): Promise<void> {
  const clean = mainTopic.trim();
  if (!clean) throw new Error("Seri başlığı boş olamaz.");
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare("UPDATE project_content_series SET main_topic = ?, updated_at = ? WHERE id = ?").run(
    clean,
    now,
    seriesId
  );
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const db = getDatabase();
  db.prepare("DELETE FROM project_content_series WHERE id = ?").run(seriesId);
}

export async function deleteEpisode(episodeId: string): Promise<string> {
  const db = getDatabase();
  const ep = db.prepare("SELECT series_id FROM project_series_episodes WHERE id = ?").get(episodeId) as
    | { series_id: string }
    | undefined;

  if (!ep) throw new Error("Bölüm bulunamadı.");

  const seriesId = ep.series_id;
  const now = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare("DELETE FROM project_series_episodes WHERE id = ?").run(episodeId);

    // Re-index remaining episodes in order
    const remaining = db
      .prepare("SELECT id FROM project_series_episodes WHERE series_id = ? ORDER BY order_index ASC")
      .all(seriesId) as Array<{ id: string }>;

    const updateOrder = db.prepare("UPDATE project_series_episodes SET order_index = ?, updated_at = ? WHERE id = ?");
    remaining.forEach((row, idx) => {
      updateOrder.run(idx + 1, now, row.id);
    });

    db.prepare("UPDATE project_content_series SET episode_count = ?, updated_at = ? WHERE id = ?").run(
      remaining.length,
      now,
      seriesId
    );

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return seriesId;
}

export async function createEpisode(
  seriesId: string,
  title?: string,
  description?: string
): Promise<SeriesEpisode> {
  const db = getDatabase();
  const countRow = db
    .prepare("SELECT COUNT(*) as count FROM project_series_episodes WHERE series_id = ?")
    .get(seriesId) as { count: number };

  const nextOrder = (countRow?.count || 0) + 1;
  const now = new Date().toISOString();
  const epId = `ep_${crypto.randomUUID()}`;
  const epTitle = title?.trim() || `Yeni Konu ${nextOrder}`;
  const epDesc = description?.trim() || "";

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(
      `INSERT INTO project_series_episodes (id, series_id, order_index, title, core_message, key_points_json, status, user_notes, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', 'pending', '', ?)`
    ).run(epId, seriesId, nextOrder, epTitle, epDesc, now);

    db.prepare("UPDATE project_content_series SET episode_count = ?, updated_at = ? WHERE id = ?").run(
      nextOrder,
      now,
      seriesId
    );

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    id: epId,
    series_id: seriesId,
    order_index: nextOrder,
    title: epTitle,
    description: epDesc,
    status: "pending",
    user_notes: "",
    updated_at: now,
  };
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
Görevin: Verilen marka stratejisini analiz ederek, markanın uzmanlık kurmasını sağlayacak 3 adet stratejik "Ana Seri Konusu" önermektir.

KURALLAR:
1. EDEBİ/PAZARLAMA SLOGANLARI YASAKTIR: İki noktalı süslü başlıklar (örn: "Görünmeyen Tehlike: X", "Zirveye Giden Yol: Y") KULLANMA. Başlıklar doğrudan konunun kendisini belirten net ifadeler olmalıdır (örn: "Scratch ile Blok Kodlama Temelleri", "Micro:bit ile Sensör Uygulamaları").
2. Kesinlikle hiçbir içerik formatına (karosel, reels, video, post vb.) atıfta bulunma. Yalnızca konunun özüne odaklan.
3. Her öneri net bir başlık ve 1-2 cümlelik kısa bir stratejik açıklamadan oluşmalıdır.
4. Yalnızca JSON formatında yanıt ver.

JSON ŞEMASI:
{
  "suggestions": [
    {
      "title": "Net ve Doğrudan Seri Konu Başlığı",
      "description": "Bu serinin kitle için neden önemli olduğunu açıklayan 1-2 cümlelik kısa açıklama."
    }
  ]
}`;

  const userPrompt = `Marka ve Strateji Bağlamı:\n${context}\n\nLütfen bu marka için en yüksek etkiyi yaratacak 3 stratejik ana seri konusu öner.`;

  const { content } = await completeText(systemPrompt, userPrompt, {
    temperature: 0.7,
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

  const systemPrompt = `Sen bir İçerik Mimarisi ve Konu Ağacı Uzmanısın.
Görevin: Kullanıcının verdiği ana konuyu mantıksal alt konulara ayırmaktır.

KESİN VE BAĞLAYICI KURALLAR:
1. JENERİK VE EDEBİ BAŞLIKLAR KESİNLİKLE YASAKTIR:
   - İki noktalı edebi/pazarlama başlıkları ASLA üretme! (Örn: "Ekrandaki Renkli Bloklar: Scratch ve Algoritmik Düşünmenin Temeli" YASAKTIR!).
   - Sadece konu alanını doğrudan belirten net, yalın ifadeler kullan: (Örn: "Scratch ve Algoritmik Düşünme Temeli").
   - Başlık doğrudan o bölümün öz konusunu yazmalıdır. Pazarlama jeneriklerini içerik hazırlarken üreteceğiz.

2. FARKLI ARAÇ VE YÖNTEMLERİ ASLA BİRLEŞTİRME:
   - Farklı uygulama, yazılım, araç veya yöntemleri (örnek: Micro:bit ile Makey Makey, veya Figma ile Canva, veya Python ile JavaScript) ASLA tek bir alt başlık altında birleştirme.
   - Her bir aracı veya yöntemi AYRI, müstakil birer alt konu olarak oluştur.

3. İÇERİK TİPLERİNE REFERANS YASAKTIR:
   - Karosel, video, reels, post, story veya infografik gibi kelimeleri ASLA kullanma. Yalnızca konunun özüne odaklan.

4. YALIN YAPI:
   - Her alt konu yalnızca 'title' (saf ve doğrudan konu başlığı) ve 'description' (1-2 cümlelik kısa ve net açıklama) içerecektir.

5. DİNAMİK BÖLÜM SAYISI:
   - Konuyu sabit bir sayıya sıkıştırma. Konunun derinliğine göre en uygun alt konu sayısını sen belirle.

JSON ŞEMASI:
{
  "rationale": "Konunun neden bu sayıda alt konuya ayrıldığını açıklayan 1-2 cümlelik gerekçe.",
  "episodes": [
    {
      "order_index": 1,
      "title": "Doğrudan Konu Başlığı (Pazarlama jeneriği olmadan)",
      "description": "Bu alt konunun neyi işlediğini belirten 1-2 cümlelik net açıklama."
    }
  ]
}`;

  const userPrompt = `Bağlam: ${brandContext}
Ana Konu Başlığı: ${cleanTopic}

Lütfen bu konuyu araştır, her aracı/yöntemi ayrı tutarak ve edebi jenerik başlıklar kullanmadan doğrudan alt konuları çıkar.`;

  const { content } = await completeText(systemPrompt, userPrompt, {
    temperature: 0.5,
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

  export async function expandSeries(seriesId: string): Promise<ContentSeries> {
  const db = getDatabase();
  const seriesRow = db
  .prepare("SELECT * FROM project_content_series WHERE id = ?")
  .get(seriesId) as { project_id: string; main_topic: string } | undefined;
  if (!seriesRow) throw new Error("Seri bulunamadı.");

  const currentEpisodes = db
  .prepare(
    "SELECT order_index, title, core_message FROM project_series_episodes WHERE series_id = ? ORDER BY order_index ASC"
  )
  .all(seriesId) as Array<{ order_index: number; title: string; core_message: string }>;

  const existingTitles = currentEpisodes
  .map((e) => `${e.order_index}. ${e.title} - ${e.core_message}`)
  .join("\n");

  const projectRow = db.prepare("SELECT name, brand_json FROM projects WHERE id = ?").get(seriesRow.project_id) as
  | { name: string; brand_json: string }
  | undefined;

  let brandContext = "";
  if (projectRow) {
  try {
    const b = JSON.parse(projectRow.brand_json || "{}");
    brandContext = `Marka: ${projectRow.name || ""}, Sektör: ${b.industry || ""}, Hedef Kitle: ${b.audience || ""}`;
  } catch {
    brandContext = `Marka: ${projectRow.name || ""}`;
  }
  }

  const systemPrompt = `Sen bir İçerik Mimarisi ve Konu Ağacı Uzmanısın.
  Görevin: Mevcut bir içerik serisini derinlemesine araştırarak, eksik kalan ileri seviye veya tamamlayıcı boyutları için 3-5 adet YENİ alt konu üreterek seriyi mantıksal olarak uzatmaktır.

  KESİN VE BAĞLAYICI KURALLAR:
  1. MEVCUT KONULARI ASLA TEKRARLAMA: Aşağıda verilen mevcut alt konuları incele; aynı ya da benzer başlıklar üretme. Tamamlayıcı, bir sonraki aşama veya farklı araç/yöntem boyutlarını ele al.
  2. JENERİK VE EDEBİ BAŞLIKLAR KESİNLİKLE YASAKTIR: İki noktalı edebi/pazarlama başlıkları ASLA üretme. Sadece konu alanını doğrudan belirten net, yalın ifadeler kullan.
  3. ARAÇ VE YÖNTEMLERİ AYRIŞTIR: Farklı araç/yöntemleri asla tek bir alt başlık altında birleştirme.
  4. İÇERİK TİPLERİNE REFERANS YASAKTIR: Karosel, video, reels, post vb. biçimsel kelimeler kullanma.
  5. Yalnızca 3 ila 5 adet yeni alt konu üret.

  JSON ŞEMASI:
  {
  "new_episodes": [
  {
    "title": "Doğrudan Konu Başlığı (Pazarlama jeneriği olmadan)",
    "description": "Bu alt konunun içeriğini anlatan 1-2 cümlelik kısa ve net açıklama."
  }
  ]
  }`;

  const userPrompt = `Bağlam: ${brandContext}
  Ana Konu: ${seriesRow.main_topic}

  MEVCUT ALT KONULAR (Bunları tekrar etme, devamını ve tamamlayıcılarını üret):
  ${existingTitles}

  Lütfen seriyi mantıksal olarak genişletecek 3-5 yeni alt konu üret.`;

  const { content } = await completeText(systemPrompt, userPrompt, {
  temperature: 0.6,
  maxTokens: 1800,
  });

  const parsed = parseJsonResponse<{ new_episodes: Array<{ title: string; description: string }> }>(content);

  const startOrder = currentEpisodes.length;
  const now = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
  const insertEp = db.prepare(
    `INSERT INTO project_series_episodes (id, series_id, order_index, title, core_message, key_points_json, status, user_notes, updated_at)
     VALUES (?, ?, ?, ?, ?, '[]', 'pending', '', ?)`
  );

  (parsed.new_episodes || []).forEach((ep, idx) => {
    const epId = `ep_${crypto.randomUUID()}`;
    insertEp.run(
      epId,
      seriesId,
      startOrder + idx + 1,
      ep.title || `Konu ${startOrder + idx + 1}`,
      ep.description || "",
      now
    );
  });

  const newTotal = startOrder + (parsed.new_episodes?.length || 0);
  db.prepare("UPDATE project_content_series SET episode_count = ?, updated_at = ? WHERE id = ?").run(
    newTotal,
    now,
    seriesId
  );

  db.exec("COMMIT");
  } catch (err) {
  db.exec("ROLLBACK");
  throw err;
  }

  const updated = await getProjectSeriesById(seriesId);
  if (!updated) throw new Error("Güncellenen seri alınamadı.");
  return updated;
  }
