import assert from "node:assert/strict";
import test from "node:test";
import {
  extractStockPublishingMetadata,
  mergeHashtagText,
} from "./stock-publishing-metadata.ts";

test("extracts and deduplicates stock hashtags and keywords", () => {
  const result = extractStockPublishingMetadata({
    title: "Robotik Proje",
    description: "Kodlama ve tasarım",
    hashtags: ["#Arduino", "#RobotikKodlama"],
    keywords: ["arduino", "3B tasarım", "robotikkodlama"],
  });

  assert.equal(result.title, "Robotik Proje");
  assert.equal(result.description, "Kodlama ve tasarım");
  assert.equal(result.hashtags, "#Arduino #RobotikKodlama #3Btasarım");
});

test("merges generated hashtags without dropping source hashtags", () => {
  assert.equal(
    mergeHashtagText("#Arduino #RobotikKodlama", "#keşfet #arduino"),
    "#Arduino #RobotikKodlama #keşfet",
  );
});

test("supports rendered stock metadata fields", () => {
  const result = extractStockPublishingMetadata({
    headline: "Üret ve Keşfet",
    subtitle: "Çocuklar için teknoloji",
    sourceHashtags: ["stem", "#kodlama"],
  });

  assert.equal(result.title, "Üret ve Keşfet");
  assert.equal(result.description, "Çocuklar için teknoloji");
  assert.equal(result.hashtags, "#stem #kodlama");
});
