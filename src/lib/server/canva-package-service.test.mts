import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import {
  deletePackageWithAssets,
  recordPackageCompletionTransaction,
  resolvePackageItemsForPublishing,
  saveSinglePackageAsset,
  validateCompletionManifest,
} from "./canva-package-service.ts";

function createTestDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE generation_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      type TEXT,
      provider TEXT,
      model TEXT,
      status TEXT,
      prompt TEXT,
      request_json TEXT,
      response_json TEXT,
      progress_json TEXT,
      error TEXT,
      created_at TEXT,
      completed_at TEXT
    );
    CREATE TABLE media_packages (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      generation_job_id TEXT,
      source TEXT,
      package_type TEXT,
      title TEXT,
      cover_asset_id TEXT,
      item_count INTEGER,
      canva_design_id TEXT,
      canva_edit_url TEXT,
      metadata_json TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE media_package_items (
      id TEXT PRIMARY KEY,
      package_id TEXT,
      asset_id TEXT,
      position INTEGER,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      metadata_json TEXT,
      created_at TEXT,
      UNIQUE(package_id, position)
    );
  `);
  return db;
}

test("validateCompletionManifest validates schema and exports count", () => {
  assert.throws(() => validateCompletionManifest(null), /Geçersiz manifest/);
  assert.throws(
    () =>
      validateCompletionManifest({
        designId: "",
        editUrl: "https://canva.com/design/123",
      }),
    /Eksik veya geçersiz designId/
  );

  const validRaw = {
    designId: "D123456",
    editUrl: "https://canva.com/design/D123456",
    contentType: "instagram_carousel",
    width: 1080,
    height: 1350,
    pageCount: 3,
    exports: [
      { position: 1, name: "slide-01" },
      { position: 2, name: "slide-02" },
      { position: 3, name: "slide-03" },
    ],
  };

  const manifest = validateCompletionManifest(validRaw);
  assert.equal(manifest.designId, "D123456");
  assert.equal(manifest.pageCount, 3);
  assert.equal(manifest.exports.length, 3);

  // Mismatched exports count
  assert.throws(
    () =>
      validateCompletionManifest({
        ...validRaw,
        pageCount: 4,
      }),
    /Sayfa sayısı ile export sayısı uyuşmuyor/
  );
  assert.throws(
    () => validateCompletionManifest({
      ...validRaw,
      exports: [
        { position: 1, name: "slide-01" },
        { position: 1, name: "slide-02" },
        { position: 3, name: "slide-03" },
      ],
    }),
    /benzersiz/,
  );
});

test("saveSinglePackageAsset atomically saves image and json metadata", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "canva-asset-test-"));
  try {
    const pngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const assetId = "test-asset-uuid-1";
    const saved = await saveSinglePackageAsset({
      buffer: pngBuffer,
      assetId,
      assetsDir: tmpDir,
    });

    assert.equal(saved.assetId, assetId);
    assert.equal(saved.width, 100);
    assert.equal(saved.height, 100);
    assert.equal(saved.mimeType, "image/png");

    assert.ok(fs.existsSync(path.join(tmpDir, `${assetId}.png`)));
    assert.ok(fs.existsSync(path.join(tmpDir, `${assetId}.json`)));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("recordPackageCompletionTransaction creates media_packages and media_package_items", async () => {
  const db = createTestDatabase();
  const projectId = "proj-1";
  const jobId = "job-1";

  db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(projectId, "Test Proje");
  db.prepare(
    "INSERT INTO generation_jobs (id, project_id, type, provider, status, prompt, created_at) VALUES (?, ?, 'canva', 'hermes-agent', 'running', 'Prompt', ?)"
  ).run(jobId, projectId, new Date().toISOString());

  const manifest = {
    designId: "D-TEST",
    editUrl: "https://canva.com/design/D-TEST",
    contentType: "instagram_carousel" as const,
    width: 1080,
    height: 1350,
    pageCount: 2,
    exports: [
      { position: 1, name: "slide-01" },
      { position: 2, name: "slide-02" },
    ],
  };

  const assets = [
    { assetId: "asset-1", position: 1, mimeType: "image/png", width: 1080, height: 1350, extension: "png" },
    { assetId: "asset-2", position: 2, mimeType: "image/png", width: 1080, height: 1350, extension: "png" },
  ];

  const result = recordPackageCompletionTransaction({
    database: db,
    jobId,
    projectId,
    manifest,
    assets,
  });

  assert.ok(result.packageId);

  const pkg = db.prepare("SELECT * FROM media_packages WHERE id=?").get(result.packageId) as {
    cover_asset_id: string;
    item_count: number;
    canva_design_id: string;
  };
  assert.equal(pkg.cover_asset_id, "asset-1");
  assert.equal(pkg.item_count, 2);
  assert.equal(pkg.canva_design_id, "D-TEST");

  const items = db
    .prepare("SELECT * FROM media_package_items WHERE package_id=? ORDER BY position ASC")
    .all(result.packageId) as Array<{ asset_id: string; position: number }>;
  assert.equal(items.length, 2);
  assert.equal(items[0].asset_id, "asset-1");
  assert.equal(items[1].asset_id, "asset-2");

  const job = db.prepare("SELECT status FROM generation_jobs WHERE id=?").get(jobId) as { status: string };
  assert.equal(job.status, "complete");
});

test("resolvePackageItemsForPublishing returns ordered buffers and filenames", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "canva-pub-test-"));
  const db = createTestDatabase();
  const projectId = "proj-pub";
  const jobId = "job-pub";
  const packageId = "pkg-pub";

  db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(projectId, "Test Proje");
  db.prepare(
    "INSERT INTO generation_jobs (id, project_id, type, provider, status, prompt, created_at) VALUES (?, ?, 'canva', 'hermes-agent', 'complete', 'Prompt', ?)"
  ).run(jobId, projectId, new Date().toISOString());

  db.prepare(`
    INSERT INTO media_packages (id, project_id, generation_job_id, source, package_type, title, cover_asset_id, item_count, canva_design_id, canva_edit_url, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, 'canva', 'carousel', 'Test Paket', 'asset-p1', 2, 'D-P', 'https://canva.com', '{}', ?, ?)
  `).run(packageId, projectId, jobId, new Date().toISOString(), new Date().toISOString());

  // Create fake files in assetsDir
  fs.writeFileSync(path.join(tmpDir, "asset-p1.png"), Buffer.from("slide 1 bytes"));
  fs.writeFileSync(path.join(tmpDir, "asset-p1.json"), JSON.stringify({ mimeType: "image/png", extension: "png" }));
  fs.writeFileSync(path.join(tmpDir, "asset-p2.png"), Buffer.from("slide 2 bytes"));
  fs.writeFileSync(path.join(tmpDir, "asset-p2.json"), JSON.stringify({ mimeType: "image/png", extension: "png" }));

  db.prepare(`
    INSERT INTO media_package_items (id, package_id, asset_id, position, mime_type, width, height, metadata_json, created_at)
    VALUES ('item-2', ?, 'asset-p2', 2, 'image/png', 1080, 1350, '{}', ?),
           ('item-1', ?, 'asset-p1', 1, 'image/png', 1080, 1350, '{}', ?)
  `).run(packageId, new Date().toISOString(), packageId, new Date().toISOString());

  try {
    const publishingItems = resolvePackageItemsForPublishing({
      database: db,
      packageId,
      projectId,
      assetsDir: tmpDir,
    });

    assert.equal(publishingItems.length, 2);
    assert.equal(publishingItems[0].position, 1);
    assert.equal(publishingItems[0].assetId, "asset-p1");
    assert.equal(publishingItems[0].buffer.toString(), "slide 1 bytes");

    assert.equal(publishingItems[1].position, 2);
    assert.equal(publishingItems[1].assetId, "asset-p2");
    assert.equal(publishingItems[1].buffer.toString(), "slide 2 bytes");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("deletePackageWithAssets removes database rows and asset files", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "canva-del-test-"));
  const db = createTestDatabase();
  const projectId = "proj-del";
  const jobId = "job-del";
  const packageId = "pkg-del";

  db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(projectId, "Test Proje");
  db.prepare(
    "INSERT INTO generation_jobs (id, project_id, type, provider, status, prompt, created_at) VALUES (?, ?, 'canva', 'hermes-agent', 'complete', 'Prompt', ?)"
  ).run(jobId, projectId, new Date().toISOString());

  db.prepare(`
    INSERT INTO media_packages (id, project_id, generation_job_id, source, package_type, title, cover_asset_id, item_count, canva_design_id, canva_edit_url, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, 'canva', 'single', 'Test Paket', 'asset-d1', 1, 'D-D', 'https://canva.com', '{}', ?, ?)
  `).run(packageId, projectId, jobId, new Date().toISOString(), new Date().toISOString());

  fs.writeFileSync(path.join(tmpDir, "asset-d1.png"), Buffer.from("slide 1 bytes"));
  fs.writeFileSync(path.join(tmpDir, "asset-d1.json"), JSON.stringify({ mimeType: "image/png", extension: "png" }));
  fs.writeFileSync(path.join(tmpDir, "asset-d1_thumb.webp"), Buffer.from("thumb bytes"));

  db.prepare(`
    INSERT INTO media_package_items (id, package_id, asset_id, position, mime_type, width, height, metadata_json, created_at)
    VALUES ('item-d1', ?, 'asset-d1', 1, 'image/png', 1080, 1350, '{}', ?)
  `).run(packageId, new Date().toISOString());

  try {
    const deleted = deletePackageWithAssets({
      database: db,
      packageId,
      projectId,
      assetsDir: tmpDir,
    });
    assert.equal(deleted, true);

    const checkPkg = db.prepare("SELECT COUNT(*) as c FROM media_packages WHERE id=?").get(packageId) as { c: number };
    assert.equal(checkPkg.c, 0);

    const checkItems = db.prepare("SELECT COUNT(*) as c FROM media_package_items WHERE package_id=?").get(packageId) as { c: number };
    assert.equal(checkItems.c, 0);

    assert.equal(fs.existsSync(path.join(tmpDir, "asset-d1.png")), false);
    assert.equal(fs.existsSync(path.join(tmpDir, "asset-d1.json")), false);
    assert.equal(fs.existsSync(path.join(tmpDir, "asset-d1_thumb.webp")), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
