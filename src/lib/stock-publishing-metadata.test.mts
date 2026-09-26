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

test("extracts hashtags embedded in description and headline text", () => {
  const result = extractStockPublishingMetadata({
    title: "Yeni Proje #arduino",
    description: "Robotik kodlama dersleri #maker #stem",
  });

  assert.equal(result.hashtags, "#maker #stem #arduino");
});

test("derives fallback hashtags when metadata has no tags", () => {
  const result = extractStockPublishingMetadata(
    {
      title: "Öğren, Tasarla, Üret",
      description: "Çocuklar için robotik kodlama ve 3B tasarım",
    },
    { brandName: "Atölye Hanem" }
  );

  assert.ok(result.hashtags.includes("#AtölyeHanem"));
  assert.ok(result.hashtags.includes("#robotik"));
  assert.ok(result.hashtags.includes("#kodlama"));
});
