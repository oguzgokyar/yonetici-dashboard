import "server-only";

import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";

export type SeriesEpisode = {
  id: string;
  series_id: string;
  order_index: number;
  title: string;
  core_message: string;
  key_points: string[];
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

type AIResearchOutput = {
  rationale: string;
  episodes: Array<{
    order_index: number;
    title: string;
    core_message: string;
    key_points: string[];
  }>;
};

export async function getProjectSeries(projectId: string): Promise<ContentSeries | null> {
  const db = getDatabase();
  const seriesRow = db
    .prepare("SELECT * FROM project_content_series WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1")
    .get(projectId) as
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
    key_points_json: string;
    status: string;
    user_notes: string;
    updated_at: string;
  }>;

  const episodes: SeriesEpisode[] = episodeRows.map((row) => {
    let keyPoints: string[] = [];
    try {
      keyPoints = JSON.parse(row.key_points_json || "[]");
    } catch {
      keyPoints = [];
    }
    return {
      id: row.id,
      series_id: row.series_id,
      order_index: row.order_index,
      title: row.title,
      core_message: row.core_message,
      key_points: keyPoints,
      status: (row.status as "pending" | "in_progress" | "completed") || "pending",
      user_notes: row.user_notes || "",
      updated_at: row.updated_at,
    };
  });

  return {
    ...seriesRow,
    episodes,
  };
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
Görevin: Kullanıcının verdiği ana konuyu derinlemesine analiz etmek, kitleye aktarılacak en mantıklı anlatı akışını (narrative arc) kurmak ve konunun gerçek ağırlığına göre en uygun alt konu (bölüm) sayısını belirlemektir.

KURALLAR:
1. Sabit bir bölüm sayısına bağlı kalma (3, 5 gibi kısıtlamalar yok). Konunun derinliğine, hedef kitlenin öğrenme adımlarına ve konunun sindirilebilirliğine göre ideal bölüm sayısını sen belirle (genellikle 4 ila 8 bölüm arası).
2. Her bölüm birbirini besleyen mantıklı bir zincir olmalıdır.
3. Çıktı kesinlikle saf JSON formatında olmalıdır.

JSON ŞEMASI:
{
  "rationale": "Konunun neden bu sayıda bölüme ayrıldığını açıklayan 1-2 cümlelik net, yalın Türkçe stratejik gerekçe.",
  "episodes": [
    {
      "order_index": 1,
      "title": "Net ve vurucu alt konu başlığı",
      "core_message": "Bu paylaşımın vermek istediği tek cümlelik ana fikir",
      "key_points": [
        "İşlenecek 1. odak noktası",
        "İşlenecek 2. odak noktası"
      ]
    }
  ]
}`;

  const userPrompt = `Bağlam: ${brandContext}
Ana Konu Başlığı: ${cleanTopic}

Lütfen bu konuyu derinlemesine araştır, ideal bölüm sayısına karar ver ve ardışık alt konuları çıkar.`;

  const { content } = await completeText(systemPrompt, userPrompt, {
    temperature: 0.65,
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
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?)`
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
        ep.core_message || "",
        JSON.stringify(ep.key_points || []),
        initialStatus,
        now
      );
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const created = await getProjectSeries(projectId);
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
    core_message?: string;
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
  if (updates.core_message !== undefined) {
    setClauses.push("core_message = ?");
    params.push(updates.core_message);
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
      .prepare("SELECT order_index FROM project_series_episodes WHERE series_id = ? AND status != 'completed' ORDER BY order_index ASC LIMIT 1")
      .get(ep.series_id) as { order_index: number } | undefined;

    const nextIndex = nextEp ? nextEp.order_index : ep.order_index;
    db.prepare("UPDATE project_content_series SET current_index = ?, updated_at = ? WHERE id = ?").run(
      nextIndex,
      now,
      ep.series_id
    );

    // Automatically set the next incomplete episode to in_progress if currently pending
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
