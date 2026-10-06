import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlatformSettings,
  buildCaption,
  formatYouTubeTags,
  isYouTubeShorts,
} from "./postiz-settings.ts";

test("formatYouTubeTags converts strings to { value, label } objects and strips #", () => {
  const input = ["#robotik", "kodlama", " #teknofest ", "ROBOTİK"];
  const formatted = formatYouTubeTags(input);

  assert.deepEqual(formatted, [
    { value: "robotik", label: "robotik" },
    { value: "kodlama", label: "kodlama" },
    { value: "teknofest", label: "teknofest" },
  ]);
});

test("formatYouTubeTags preserves existing object tags and bounds at 15", () => {
  const input = [
    { value: "one", label: "One Label" },
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
  ];
  const formatted = formatYouTubeTags(input);
  assert.equal(formatted.length, 15);
  assert.deepEqual(formatted[0], { value: "one", label: "One Label" });
  assert.deepEqual(formatted[1], { value: "two", label: "two" });
});

test("isYouTubeShorts detects reel postType or 9:16 duration <= 60s", () => {
  assert.equal(
    isYouTubeShorts({ postType: "reel" }),
    true,
    "reel postType should be recognized as Shorts"
  );
  assert.equal(
    isYouTubeShorts({ postType: "post", videoAspectRatio: "9:16", videoDurationSeconds: 45 }),
    true,
    "9:16 under 60s should be recognized as Shorts"
  );
  assert.equal(
    isYouTubeShorts({ postType: "post", videoAspectRatio: "16:9", videoDurationSeconds: 45 }),
    false,
    "16:9 should not be Shorts"
  );
  assert.equal(
    isYouTubeShorts({ postType: "post", videoAspectRatio: "9:16", videoDurationSeconds: 90 }),
    false,
    "9:16 over 60s should not be Shorts"
  );
});

test("buildPlatformSettings creates Postiz-compliant YouTube settings with __type and object tags", () => {
  const settings = buildPlatformSettings({
    platformIdentifier: "youtube-standalone",
    caption: "Açıklama metni",
    postType: "reel",
    youtubeSettings: {
      title: "Harika Proje",
      type: "public",
      selfDeclaredMadeForKids: "no",
      tags: ["#Shorts", "#AtolyeHanem", "Robotik"],
    },
  });

  assert.equal(settings.__type, "youtube");
  assert.equal(settings.title, "Harika Proje");
  assert.equal(settings.type, "public");
  assert.equal(settings.selfDeclaredMadeForKids, "no");
  assert.equal(settings.shorts, true);
  assert.deepEqual(settings.tags, [
    { value: "Shorts", label: "Shorts" },
    { value: "AtolyeHanem", label: "AtolyeHanem" },
    { value: "Robotik", label: "Robotik" },
  ]);
});

test("buildPlatformSettings handles TikTok settings with __type", () => {
  const settings = buildPlatformSettings({
    platformIdentifier: "tiktok",
    caption: "TikTok açıklaması",
    tiktokSettings: {
      title: "TikTok Başlık",
      content_posting_method: "DIRECT_POST",
      privacy_level: "SELF_ONLY",
    },
  });

  assert.equal(settings.__type, "tiktok");
  assert.equal(settings.title, "TikTok Başlık");
  assert.equal(settings.content_posting_method, "DIRECT_POST");
  assert.equal(settings.privacy_level, "SELF_ONLY");
});

test("buildCaption automatically adds #Shorts for YouTube Shorts if missing", () => {
  const withShorts = buildCaption({
    platformIdentifier: "youtube",
    postType: "reel",
    caption: "Harika bir teknoloji videosu",
  });
  assert.ok(withShorts.includes("#Shorts"));

  const alreadyHas = buildCaption({
    platformIdentifier: "youtube",
    postType: "reel",
    caption: "Harika video #shorts izle",
  });
  assert.equal(alreadyHas, "Harika video #shorts izle");
});
