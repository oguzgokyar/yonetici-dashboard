import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/opt/data/yonetici-dashboard";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

test("1. micro_zoom_jitter is completely purged across all files", () => {
  const typesCode = read("src/features/generation/rss-video/types.ts");
  const composerCode = read("src/lib/server/rss-video-composer.ts");
  const researchCode = read("src/lib/server/rss-feed-research.ts");

  assert.doesNotMatch(typesCode, /micro_zoom_jitter/);
  assert.doesNotMatch(composerCode, /micro_zoom_jitter/);
  assert.doesNotMatch(researchCode, /micro_zoom_jitter/);
});

test("2. Storyboard reset & pollActiveJobs non-resurrection guarantees", () => {
  const studioCode = read("src/features/generation/rss-video-studio.tsx");

  // pollActiveJobs: both activeJob and latestJob must return null if !prev
  assert.match(studioCode, /if \(!prev\) return null;\s*\/\/ Ekranda farklı bir senaryo varsa/);
  assert.match(studioCode, /if \(!prev\) return null;\s*if \(prev\.title !== latestSb\.title/);

  // handleGenerateStoryboard must clear storyboard when isRevision is false
  assert.match(studioCode, /setPlanning\(true\);\s*setStoryboard\(null\);\s*setGeneratingSceneImages\(\{\}\);/);

  // handleClearStoryboard clears topic, url, and storyboard
  assert.match(studioCode, /setStoryboard\(null\);\s*setTopicOrText\(""\);\s*setSourceUrl\(""\);/);
});

test("3. RssStoryboardDeck prompt mode cleanup, activeSceneTab reset, and planning banner", () => {
  const deckCode = read("src/features/generation/rss-video/components/rss-storyboard-deck.tsx");

  // Prompt mode clears sourceUrl
  assert.match(deckCode, /setSourceMode\("prompt"\);\s*setSourceUrl\(""\);/);

  // activeSceneTabIdx resets to 0 when storyboard title changes
  assert.match(deckCode, /useEffect\(\(\) => \{\s*setActiveSceneTabIdx\(0\);\s*\}, \[storyboard\?\.title\]\);/);

  // Planning loading banner appears when planning && !storyboard
  assert.match(deckCode, /planning \?\s*\(\s*<div[^>]*>[\s\S]*?Yeni Video Konusu Araştırılıyor &amp; Senaryo Kurgulanıyor\.\.\./);
});

test("4. API routes protect user topic from unwanted URL re-scraping", () => {
  const storyboardRoute = read("src/app/api/projects/[projectId]/rss-videos/storyboard/route.ts");
  const rssVideoRoute = read("src/app/api/projects/[projectId]/rss-videos/route.ts");

  assert.match(storyboardRoute, /sourceMode === "prompt" \? undefined : \(body\.sourceUrl \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(storyboardRoute, /\(sourceMode === "url" \|\| sourceMode === "rss"\) &&\s*sourceUrl &&\s*!topicOrText/);

  assert.match(rssVideoRoute, /sourceMode === "prompt" \? undefined : \(body\.sourceUrl \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(rssVideoRoute, /\(sourceMode === "url" \|\| sourceMode === "rss"\) &&\s*sourceUrl &&\s*!topicOrText/);
});
