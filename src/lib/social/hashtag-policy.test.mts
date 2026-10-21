import assert from "node:assert/strict";
import test from "node:test";
import {
  mergePlatformHashtags,
  normalizeHashtagList,
  platformVisibleHashtagLimit,
  sampleHashtags,
  type SocialPlatform,
} from "./hashtag-policy.ts";

test("normalizes and deduplicates hashtag values case-insensitively", () => {
  assert.deepEqual(
    normalizeHashtagList(["Arduino", "#Robotik Kodlama", "#arduino", "  #STEM  "]),
    ["#Arduino", "#RobotikKodlama", "#STEM"],
  );
});

test("removes foreign and temporary hashtags from YouTube", () => {
  const result = mergePlatformHashtags({
    platform: "youtube",
    aiHashtags: ["#Shorts", "#RobotikKodlama", "#instagram", "#dd3koleqljh"],
    setHashtags: ["#AtolyeHanem", "#studiotoylab"],
    includeSets: true,
  });

  assert.deepEqual(result.visible, ["#Shorts", "#RobotikKodlama", "#AtolyeHanem"]);
  assert.deepEqual(result.tags, ["Shorts", "RobotikKodlama", "AtolyeHanem"]);
  assert.equal(result.removedInvalid, 3);
});

test("excludes saved sets when toggle is disabled", () => {
  const result = mergePlatformHashtags({
    platform: "instagram",
    aiHashtags: ["#RobotikKodlama", "#STEM"],
    setHashtags: ["#AtolyeHanem", "#Maker"],
    includeSets: false,
  });

  assert.deepEqual(result.visible, ["#RobotikKodlama", "#STEM"]);
  assert.equal(result.setAdded, 0);
});

test("deduplicates AI and saved-set hashtags while reporting counts", () => {
  const result = mergePlatformHashtags({
    platform: "instagram",
    aiHashtags: ["#STEM", "#RobotikKodlama"],
    setHashtags: ["#stem", "#AtolyeHanem"],
    includeSets: true,
  });

  assert.deepEqual(result.visible, ["#STEM", "#RobotikKodlama", "#AtolyeHanem"]);
  assert.equal(result.aiAdded, 2);
  assert.equal(result.setAdded, 1);
  assert.equal(result.removedDuplicates, 1);
});

test("applies platform visible hashtag limits", () => {
  const platforms: Array<[SocialPlatform, number]> = [
    ["youtube", 3],
    ["instagram", 15],
    ["tiktok", 8],
    ["facebook", 3],
    ["twitter", 2],
  ];

  for (const [platform, limit] of platforms) {
    assert.equal(platformVisibleHashtagLimit(platform), limit);
  }
});

test("moves excess YouTube keywords into backend tags", () => {
  const result = mergePlatformHashtags({
    platform: "youtube",
    aiHashtags: ["#Shorts", "#RobotikKodlama", "#AtolyeHanem", "#Arduino", "#Maker"],
    setHashtags: [],
    includeSets: true,
  });

  assert.deepEqual(result.visible, ["#Shorts", "#RobotikKodlama", "#AtolyeHanem"]);
  assert.deepEqual(result.tags, ["Shorts", "RobotikKodlama", "AtolyeHanem", "Arduino", "Maker"]);
});

test("samples random or deterministic subset of hashtags", () => {
  const tags = ["#T1", "#T2", "#T3", "#T4", "#T5"];
  const sampled = sampleHashtags(tags, 3, 42);
  assert.equal(sampled.length, 3);
  for (const tag of sampled) {
    assert.ok(tags.includes(tag));
  }
  // When count >= length, returns full copy
  assert.deepEqual(sampleHashtags(tags, 10), tags);
  // When count <= 0, returns full copy
  assert.deepEqual(sampleHashtags(tags, 0), tags);
});

test("categorized sets prioritize brand tags before AI and topic tags", () => {
  const result = mergePlatformHashtags({
    platform: "instagram",
    brandHashtags: ["#AtolyeHanem"],
    aiHashtags: ["#RobotikKodlama", "#Arduino"],
    topicHashtags: ["#StemEgitimi"],
    trendHashtags: ["#ViralReels"],
    includeSets: true,
  });

  assert.equal(result.visible[0], "#AtolyeHanem");
  assert.ok(result.visible.includes("#RobotikKodlama"));
  assert.ok(result.visible.includes("#StemEgitimi"));
  assert.ok(result.visible.includes("#ViralReels"));
  assert.equal(result.setAdded, 3);
  assert.equal(result.aiAdded, 2);
});
