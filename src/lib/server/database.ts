import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".data");
fs.mkdirSync(dataDir, { recursive: true });

const globalDatabase = globalThis as typeof globalThis & { __yoneticiDb?: DatabaseSync };

function runMigrations(database: DatabaseSync) {
  const projectColumns = database.prepare("PRAGMA table_info(projects)").all() as unknown as { name: string }[];
  if (projectColumns.length && !projectColumns.some((column) => column.name === "brand_concept_json")) {
    database.exec("ALTER TABLE projects ADD COLUMN brand_concept_json TEXT NOT NULL DEFAULT '{}'");
  }
  const providerColumns = database.prepare("PRAGMA table_info(ai_provider_configs)").all() as unknown as { name: string }[];
  if (providerColumns.length && !providerColumns.some((column) => column.name === "vision_model")) database.exec("ALTER TABLE ai_provider_configs ADD COLUMN vision_model TEXT NOT NULL DEFAULT ''");
  if (providerColumns.length && !providerColumns.some((column) => column.name === "edit_model")) database.exec("ALTER TABLE ai_provider_configs ADD COLUMN edit_model TEXT NOT NULL DEFAULT ''");
  const jobColumns = database.prepare("PRAGMA table_info(generation_jobs)").all() as unknown as { name: string }[];
  if (jobColumns.length && !jobColumns.some((column) => column.name === "progress_json")) database.exec("ALTER TABLE generation_jobs ADD COLUMN progress_json TEXT NOT NULL DEFAULT '{}'");
  database.exec(`
    CREATE TABLE IF NOT EXISTS content_ideas (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_prompt TEXT NOT NULL,
      title TEXT NOT NULL,
      concept TEXT NOT NULL,
      visual_direction TEXT NOT NULL,
      suggested_prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'suggested',
      created_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_content_ideas_project_created ON content_ideas(project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS integration_configs (
      service TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      base_url TEXT NOT NULL DEFAULT '',
      encrypted_api_key TEXT,
      settings_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_social_accounts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      service TEXT NOT NULL DEFAULT 'postiz',
      integration_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      identifier TEXT NOT NULL DEFAULT '',
      profile TEXT NOT NULL DEFAULT '',
      picture TEXT NOT NULL DEFAULT '',
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, integration_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_social_accounts_project ON project_social_accounts(project_id);
    CREATE TABLE IF NOT EXISTS content_posts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      content_type TEXT NOT NULL,
      media_url TEXT NOT NULL DEFAULT '',
      local_path TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      hashtags TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      schedule_type TEXT NOT NULL DEFAULT 'now',
      scheduled_at TEXT,
      integration_id TEXT NOT NULL DEFAULT '',
      post_type TEXT NOT NULL DEFAULT 'post',
      postiz_post_id TEXT,
      postiz_media_id TEXT,
      release_url TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_content_posts_project_created ON content_posts(project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS stock_videos (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      drive_file_id TEXT NOT NULL,
      name TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'video/mp4',
      thumbnail_url TEXT,
      duration_seconds REAL DEFAULT 0,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      local_path TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, drive_file_id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_videos_project_created ON stock_videos(project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS stock_drive_configs (
      project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL DEFAULT '',
      folder_id TEXT NOT NULL DEFAULT '',
      folder_name TEXT NOT NULL DEFAULT '',
      root_folder_id TEXT NOT NULL DEFAULT '',
      root_folder_name TEXT NOT NULL DEFAULT '',
      include_subfolders INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'idle',
      error_message TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_drive_accounts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL DEFAULT '',
      photo_link TEXT NOT NULL DEFAULT '',
      encrypted_token_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_drive_accounts_project ON project_drive_accounts(project_id, is_active);
    CREATE TABLE IF NOT EXISTS stock_project_settings (
      project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      frame_style TEXT NOT NULL DEFAULT 'blur_padding',
      headline_color TEXT NOT NULL DEFAULT '#ffffff',
      subtitle_color TEXT NOT NULL DEFAULT '#cbd5e1',
      headline_bg_color TEXT NOT NULL DEFAULT 'rgba(10, 12, 20, 0.82)',
      logo_position TEXT NOT NULL DEFAULT 'top_right',
      logo_size INTEGER NOT NULL DEFAULT 130,
      music_track TEXT NOT NULL DEFAULT '/audio/ambient_track.mp3',
      original_volume REAL NOT NULL DEFAULT 1.0,
      music_volume REAL NOT NULL DEFAULT 0.4,
      selected_outro_id TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_outro_videos (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      video_url TEXT NOT NULL,
      local_path TEXT NOT NULL DEFAULT '',
      duration_seconds REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_outros_project ON project_outro_videos(project_id);
  `);
}

export function getDatabase() {
  if (globalDatabase.__yoneticiDb) {
    runMigrations(globalDatabase.__yoneticiDb);
    return globalDatabase.__yoneticiDb;
  }
  const database = new DatabaseSync(path.join(dataDir, "yonetici.sqlite"));
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_provider_configs (
      provider TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      base_url TEXT NOT NULL DEFAULT '',
      encrypted_api_key TEXT,
      text_model TEXT NOT NULL DEFAULT '',
      image_model TEXT NOT NULL DEFAULT '',
      vision_model TEXT NOT NULL DEFAULT '',
      edit_model TEXT NOT NULL DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      brand_json TEXT NOT NULL,
      brand_concept_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      prompt TEXT NOT NULL,
      request_json TEXT NOT NULL DEFAULT '{}',
      response_json TEXT NOT NULL DEFAULT '{}',
      progress_json TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_created ON generation_jobs(project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS content_ideas (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_prompt TEXT NOT NULL,
      title TEXT NOT NULL,
      concept TEXT NOT NULL,
      visual_direction TEXT NOT NULL,
      suggested_prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'suggested',
      created_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_content_ideas_project_created ON content_ideas(project_id, created_at DESC);
  `);
  // Dynamic migrations for stock_drive_configs
  try {
    database.exec("ALTER TABLE stock_drive_configs ADD COLUMN account_id TEXT NOT NULL DEFAULT '';");
  } catch {}
  try {
    database.exec("ALTER TABLE stock_drive_configs ADD COLUMN root_folder_id TEXT NOT NULL DEFAULT '';");
  } catch {}
  try {
    database.exec("ALTER TABLE stock_drive_configs ADD COLUMN root_folder_name TEXT NOT NULL DEFAULT '';");
  } catch {}
  try {
    database.exec("ALTER TABLE stock_drive_configs ADD COLUMN include_subfolders INTEGER NOT NULL DEFAULT 1;");
  } catch {}
  database.exec(`
    CREATE TABLE IF NOT EXISTS project_drive_accounts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL DEFAULT '',
      photo_link TEXT NOT NULL DEFAULT '',
      encrypted_token_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_drive_accounts_project ON project_drive_accounts(project_id, is_active);
  `);
  runMigrations(database);
  database.exec("PRAGMA optimize;");
  globalDatabase.__yoneticiDb = database;
  return database;
}
