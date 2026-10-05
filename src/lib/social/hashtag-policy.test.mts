import assert from "node:assert/strict";
import test from "node:test";
import {
  mergePlatformHashtags,
  normalizeHashtagList,
  platformVisibleHashtagLimit,
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
