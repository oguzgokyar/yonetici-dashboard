import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".data");
fs.mkdirSync(dataDir, { recursive: true });

const globalDatabase = globalThis as typeof globalThis & { __yoneticiDb?: DatabaseSync };

function runMigrations(database: DatabaseSync) {
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
      priority INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      brand_json TEXT NOT NULL
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
  runMigrations(database);
  database.exec("PRAGMA optimize;");
  globalDatabase.__yoneticiDb = database;
  return database;
}
