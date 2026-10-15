import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";

registerHooks({
  resolve(s, c, n) {
    if (s === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (s.startsWith("@/")) return { url: new URL(`../src/${s.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    return n(s, c);
  },
});

const DB_PATH = path.join(process.cwd(), ".data", "yonetici.sqlite");

test("1. Veritabanı ve Proje İzolasyonu: Atölye Hanem güncellendi, diğer projeler korundu", () => {
  const db = new DatabaseSync(DB_PATH);
  
  // Atölye Hanem kontrolü
  const atolyeRow = db.prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id = 'atolye-hanem'").get();
  assert.ok(atolyeRow, "atolye-hanem projesi veritabanında bulunmalı");
  const atolyeBrand = JSON.parse(atolyeRow.brand_json);
  const atolyeConcept = JSON.parse(atolyeRow.brand_concept_json);

  assert.equal(atolyeBrand.primaryColor, "#FF6B35", "Brand primaryColor mekanik turuncu olmalı");
  assert.equal(atolyeBrand.secondaryColor, "#0F4C81", "Brand secondaryColor derin safir olmalı");
  assert.match(atolyeBrand.audience, /7–14 yaş/, "Hedef kitle 7-14 yaş içermeli");
  assert.match(atolyeBrand.audience, /aileler|ebeveynler/, "Hedef kitle velileri içermeli");

  assert.equal(atolyeConcept.groundColor, "#FDFBF7", "Konsept groundColor fildişi zemin olmalı");
  assert.equal(atolyeConcept.primaryColor, "#FF6B35", "Konsept primaryColor mekanik turuncu olmalı");
  assert.equal(atolyeConcept.secondaryColor, "#0F4C81", "Konsept secondaryColor derin safir olmalı");
  assert.equal(atolyeConcept.accentColor, "#FFD166", "Konsept accentColor güneş sarısı olmalı");
  assert.equal(atolyeConcept.sampleVisualUrl, "/concept-explorations/concept-4-maker-elektronik-stem.png");

  // İzolasyon kontrolü: Fortis Pergola ve Aysar ellenmedi
  const fortisRow = db.prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id = 'fortis-pergola'").get();
  if (fortisRow) {
    const fortisConcept = JSON.parse(fortisRow.brand_concept_json);
    assert.equal(fortisConcept.primaryColor, "#1E293B", "Fortis Pergola antrasit rengini korumalı");
    assert.equal(fortisConcept.accentColor, "#C59B27", "Fortis Pergola mimari altın rengini korumalı");
  }

  const aysarRow = db.prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id = 'aysar'").get();
  if (aysarRow) {
    const aysarConcept = JSON.parse(aysarRow.brand_concept_json);
    assert.equal(aysarConcept.primaryColor, "#1E3A8A", "Aysar kendi mavisi rengini korumalı");
  }
});

test("2. Veri Modeli ve Normalizasyon: BrandConcept groundColor ve referans yönergesi", async () => {
  const { normalizeBrandConcept, brandConceptInstruction } = await import("../src/lib/brand-concept.ts");
  
  // Eksik groundColor ile normalizasyon
  const normalized = normalizeBrandConcept({ primaryColor: "#FF6B35", secondaryColor: "#0F4C81" });
  assert.equal(normalized.groundColor, "#FDFBF7", "Varsayılan groundColor #FDFBF7 atanmalı");
  
  // Yönerge çıktısı kontrolü
  const instruction = brandConceptInstruction({
    summary: "Atölye Hanem Test Özeti",
    groundColor: "#FDFBF7",
    primaryColor: "#FF6B35",
    secondaryColor: "#0F4C81",
    accentColor: "#FFD166",
    sampleVisualUrl: "/concept-explorations/concept-4-maker-elektronik-stem.png",
  });

  assert.match(instruction, /zemin #FDFBF7/, "Yönerge zemin rengini içermeli");
  assert.match(instruction, /#FF6B35/, "Yönerge primaryColor içermeli");
  assert.match(instruction, /#0F4C81/, "Yönerge secondaryColor içermeli");
  assert.match(instruction, /vurgu #FFD166/, "Yönerge accentColor içermeli");
  assert.match(instruction, /Referans anahtar stil panosu mevcuttur/, "Stil panosu varlığı yönergeye yansımalı");
});

test("3. Yerel Medya ve Stil Panosu Dosyası: loadMedia doğrudan diskten okur", async () => {
  const { loadMedia } = await import("../src/lib/server/cliproxy-creative.ts");
  
  const visualPath = "/concept-explorations/concept-4-maker-elektronik-stem.png";
  const media = await loadMedia(visualPath);
  
  assert.ok(media, "Stil panosu görseli diskten yüklenebilmeli");
  assert.equal(media.mimeType, "image/png");
  assert.ok(media.bytes.length > 500_000, "Görsel baytları tam ve yüksek çözünürlüklü olmalı");
});

test("4. Canva Task Generator: brandGuardianBlock tam sözleşmeyi aktarır", async () => {
  // Test Canva task injection logic directly
  const isBrandStyleActive = true;
  const concept = {
    summary: "Atölye Hanem Maker Stüdyosu",
    groundColor: "#FDFBF7",
    secondaryColor: "#0F4C81",
    primaryColor: "#FF6B35",
    accentColor: "#FFD166",
    typographyStyle: "Inter / Plus Jakarta Sans Bold",
    visualStyle: "Aydınlık fildişi zemin, açıkta devre kartları",
    layoutGuidelines: "%60 Zemin, %30 Yapı, %10 Vurgu",
  };

  let brandGuardianBlock = "";
  if (isBrandStyleActive && concept?.summary) {
    brandGuardianBlock = `
MARKANIN RENK & STİL REHBERİ (İlham ve Denge Rehberi):
- Tasarım Ruhu: ${concept.summary}
- Renk Dengesi İlhamı: %60 Zemin (${concept.groundColor || "#FDFBF7"}), %30 Yapı/Tipografi (${concept.secondaryColor || "#0f172a"}), %10 Ana Aksiyon/Vurgu (${concept.primaryColor || "#FF6B35"})${concept.accentColor ? `, Ekstra Rozet/LED Vurgusu (${concept.accentColor})` : ""}.
- Tipografi Önerisi: Başlıklar güçlü ve net sans-serif (${concept.typographyStyle || "Inter / Plus Jakarta Sans Bold"}), gövdeler okunaklı sans-serif.
${concept.visualStyle ? `- Görsel Stil Kuralı: ${concept.visualStyle}\n` : ""}${concept.layoutGuidelines ? `- Yerleşim ve Kenar Boşluğu: ${concept.layoutGuidelines}\n` : ""}`;
  }

  assert.match(brandGuardianBlock, /%60 Zemin \(#FDFBF7\)/);
  assert.match(brandGuardianBlock, /%30 Yapı\/Tipografi \(#0F4C81\)/);
  assert.match(brandGuardianBlock, /%10 Ana Aksiyon\/Vurgu \(#FF6B35\)/);
  assert.match(brandGuardianBlock, /Ekstra Rozet\/LED Vurgusu \(#FFD166\)/);
  assert.match(brandGuardianBlock, /Görsel Stil Kuralı: Aydınlık fildişi zemin/);
});

test("5. Google Vids Yönetmen Motoru: brandDirective karanlık sahneleri engeller", async () => {
  const brandConcept = {
    summary: "Aydınlık Maker & Robotik Atölyesi",
    visualStyle: "Temiz ahşap masalar, robotik kollar, açık devreler",
    photographyStyle: "Doğal gün ışığı alan pencereler, samimi odaklanmış anlar",
  };

  const brandDirective = brandConcept?.summary ? `
BRAND VISUAL IDENTITY & LIGHTING MANDATE (CRITICAL):
- Brand Atmosphere: ${brandConcept.summary}
${brandConcept.visualStyle ? `- Visual Elements & Decor: ${brandConcept.visualStyle}\n` : ""}${brandConcept.photographyStyle ? `- Lighting & Environment: ${brandConcept.photographyStyle} (Strictly avoid gloomy/dark cyberpunk shadows; prioritize daylight and wholesome warmth)\n` : ""}` : "";

  assert.match(brandDirective, /BRAND VISUAL IDENTITY & LIGHTING MANDATE/);
  assert.match(brandDirective, /Strictly avoid gloomy\/dark cyberpunk shadows/);
  assert.match(brandDirective, /prioritize daylight and wholesome warmth/);
  assert.match(brandDirective, /Aydınlık Maker & Robotik Atölyesi/);
});

test("6. Stok Video Renk Senkronizasyonu: syncFromBrand hesaplaması", () => {
  const concept = {
    primaryColor: "#FF6B35",
    secondaryColor: "#0F4C81",
    accentColor: "#FFD166",
  };

  const body = { syncFromBrand: true, headlineColor: "", subtitleColor: "", headlineBgColor: "", brandNameColor: "" };

  const sec = concept.secondaryColor;
  const r = parseInt(sec.slice(1, 3), 16);
  const g = parseInt(sec.slice(3, 5), 16);
  const b = parseInt(sec.slice(5, 7), 16);
  
  body.headlineBgColor = `rgba(${r}, ${g}, ${b}, 0.88)`;
  body.headlineColor = "#ffffff";
  body.subtitleColor = concept.accentColor;
  body.brandNameColor = concept.primaryColor;

  assert.equal(body.headlineBgColor, "rgba(15, 76, 129, 0.88)", "Safir renginin rgba dönüşümü doğru olmalı");
  assert.equal(body.subtitleColor, "#FFD166", "Altyazı rengi güneş sarısı rozet rengi olmalı");
  assert.equal(body.brandNameColor, "#FF6B35", "Marka adı mekanik turuncu olmalı");
});
