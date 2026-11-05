import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { parseRssFeedXml, scrapeArticleFromUrl } from "@/lib/server/rss-feed-research";
import type { RssFeedArticle, RssSourceItem } from "@/features/generation/rss-video/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

const DEFAULT_RSS_SOURCES = [
  {
    name: "BBC Türkçe Gündem",
    url: "https://feeds.bbci.co.uk/turkce/rss.xml",
    category: "haber",
  },
  {
    name: "DonanımHaber Teknoloji",
    url: "https://www.donanimhaber.com/rss/tum/",
    category: "teknoloji",
  },
  {
    name: "BilimFili Bilim & Keşif",
    url: "https://bilimfili.com/feed",
    category: "bilim",
  },
];

function ensureDefaultSources(projectId: string): RssSourceItem[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM project_rss_sources WHERE project_id = ? ORDER BY created_at ASC")
    .all(projectId) as Array<{
    id: string;
    project_id: string;
    name: string;
    url: string;
    category: string;
    enabled: number;
    last_checked_at: string | null;
    created_at: string;
  }>;

  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      url: r.url,
      category: r.category,
      enabled: Boolean(r.enabled),
      lastCheckedAt: r.last_checked_at,
      createdAt: r.created_at,
    }));
  }

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO project_rss_sources (id, project_id, name, url, category, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  );

  for (const src of DEFAULT_RSS_SOURCES) {
    insert.run(crypto.randomUUID(), projectId, src.name, src.url, src.category, now);
  }

  const seeded = db
    .prepare("SELECT * FROM project_rss_sources WHERE project_id = ? ORDER BY created_at ASC")
    .all(projectId) as Array<{
    id: string;
    project_id: string;
    name: string;
    url: string;
    category: string;
    enabled: number;
    last_checked_at: string | null;
    created_at: string;
  }>;

  return seeded.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    url: r.url,
    category: r.category,
    enabled: Boolean(r.enabled),
    lastCheckedAt: r.last_checked_at,
    createdAt: r.created_at,
  }));
}

export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const db = getDatabase();
    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    const sources = ensureDefaultSources(projectId);
    const url = new URL(request.url);
    const shouldFetch = url.searchParams.get("fetch") === "1";
    const sourceId = url.searchParams.get("sourceId") || "";

    if (!shouldFetch) {
      return Response.json({ ok: true, sources, articles: [] });
    }

    const activeSources = sourceId
      ? sources.filter((s) => s.id === sourceId)
      : sources.filter((s) => s.enabled);

    const allArticles: RssFeedArticle[] = [];
    const now = new Date().toISOString();

    await Promise.allSettled(
      activeSources.map(async (src) => {
        const res = await fetch(src.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; MarkaMotoruRSS/1.0)",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        const parsed = parseRssFeedXml(xml, src.name, 12);
        allArticles.push(...parsed);
        db.prepare("UPDATE project_rss_sources SET last_checked_at = ? WHERE id = ?").run(now, src.id);
      })
    );

    allArticles.sort((a, b) => b.score - a.score);
    return Response.json({
      ok: true,
      sources,
      articles: allArticles.slice(0, 30),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "RSS kaynakları okunamadı.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: "add_source" | "scrape_url";
      name?: string;
      url?: string;
      category?: string;
    };

    const db = getDatabase();
    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    if (body.action === "scrape_url") {
      if (!body.url?.trim()) {
        return Response.json({ ok: false, message: "Makale URL'si gerekli." }, { status: 400 });
      }
      const article = await scrapeArticleFromUrl(body.url.trim());
      return Response.json({ ok: true, article });
    }

    const name = (body.name || "").trim();
    const feedUrl = (body.url || "").trim();
    const category = (body.category || "genel").trim();

    if (!name || !feedUrl || !/^https?:\/\//i.test(feedUrl)) {
      return Response.json(
        { ok: false, message: "Geçerli bir RSS kaynak adı ve HTTP/HTTPS adresi girin." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO project_rss_sources (id, project_id, name, url, category, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(project_id, url) DO UPDATE SET name = excluded.name, category = excluded.category, enabled = 1`
    ).run(id, projectId, name, feedUrl, category, now);

    const sources = ensureDefaultSources(projectId);
    return Response.json({ ok: true, sources });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "İstek işlenemedi.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ ok: false, message: "Kaynak ID gerekli." }, { status: 400 });
    }
    const db = getDatabase();
    db.prepare("DELETE FROM project_rss_sources WHERE id = ? AND project_id = ?").run(id, projectId);
    const sources = ensureDefaultSources(projectId);
    return Response.json({ ok: true, sources });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kaynak silinemedi.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
