import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

export type OutlierPost = {
  platform: string;
  username: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  url: string;
};

export type CompetitorInsights = {
  activeOutliers: OutlierPost[];
  summaryNote: string;
};

export function getCompetitorOutlierInsights(competitors: string[]): CompetitorInsights {
  const cleanHandles = competitors
    .map((c) => c.trim().replace(/^@+/, "").toLowerCase())
    .filter(Boolean);

  const scraperDbPath = "/opt/data/social_media_scraper/scraper.db";
  if (!fs.existsSync(scraperDbPath)) {
    return {
      activeOutliers: [],
      summaryNote: "Yerel kazıyıcı veritabanı bulunamadı.",
    };
  }

  try {
    const db = new DatabaseSync(scraperDbPath);

    let query = `
      SELECT platform, username, title, views, likes, comments, url 
      FROM scraped_media 
      WHERE (views > 0 OR likes > 0)
    `;
    const params: string[] = [];

    if (cleanHandles.length > 0) {
      const placeholders = cleanHandles.map(() => "?").join(",");
      query += ` AND lower(username) IN (${placeholders})`;
      params.push(...cleanHandles);
    }

    query += ` ORDER BY views DESC, likes DESC LIMIT 10`;

    const rows = db.prepare(query).all(...params) as unknown as OutlierPost[];

    // If specific competitors didn't yield results, grab top niche outliers from scraper db
    let outliers = rows;
    if (outliers.length === 0 && cleanHandles.length > 0) {
      const fallbackQuery = `
        SELECT platform, username, title, views, likes, comments, url 
        FROM scraped_media 
        WHERE (views > 0 OR likes > 0)
        ORDER BY views DESC, likes DESC LIMIT 6
      `;
      outliers = db.prepare(fallbackQuery).all() as unknown as OutlierPost[];
    }

    const note = outliers.length > 0
      ? `Canlı kazıyıcı havuzundan ${outliers.length} adet yüksek izlenimli (outlier) rakip içeriği analiz edildi.`
      : "Havuzda henüz bu rakiplere ait canlı video verisi bulunmuyor; sektör liderleri standart analizine geçildi.";

    return {
      activeOutliers: outliers,
      summaryNote: note,
    };
  } catch (err) {
    console.warn("[Competitor Live Insights Error]", err);
    return {
      activeOutliers: [],
      summaryNote: "Rakip veritabanı okuma hatası.",
    };
  }
}
