import assert from "node:assert/strict";
import test from "node:test";
import {
  HERMES_CANVA_PIPELINE_VERSION,
  buildHermesCanvaTaskPrompt,
  resolveContentTypeMeta,
  validateCanvaJobInput,
  validateManifestAgainstJob,
} from "./hermes-canva-task.ts";

test("resolveContentTypeMeta returns valid metadata for supported content types", () => {
  const carouselMeta = resolveContentTypeMeta("instagram_carousel");
  assert.equal(carouselMeta.width, 1080);
  assert.equal(carouselMeta.height, 1350);
  assert.equal(carouselMeta.packageType, "carousel");
  assert.equal(carouselMeta.minSlides, 3);
  assert.equal(carouselMeta.maxSlides, 10);

  const postMeta = resolveContentTypeMeta("instagram_post");
  assert.equal(postMeta.width, 1080);
  assert.equal(postMeta.height, 1350);
  assert.equal(postMeta.packageType, "single");
  assert.equal(postMeta.minSlides, 1);
  assert.equal(postMeta.maxSlides, 1);

  const storyMeta = resolveContentTypeMeta("instagram_story");
  assert.equal(storyMeta.width, 1080);
  assert.equal(storyMeta.height, 1920);

  const squareMeta = resolveContentTypeMeta("square_post");
  assert.equal(squareMeta.width, 1080);
  assert.equal(squareMeta.height, 1080);

  const pinMeta = resolveContentTypeMeta("pinterest_pin");
  assert.equal(pinMeta.width, 1000);
  assert.equal(pinMeta.height, 1500);

  assert.throws(() => resolveContentTypeMeta("unknown_type"), /Geçersiz içerik türü/);
});

test("validateCanvaJobInput validates prompt, content type and slide count", () => {
  // Missing prompt
  assert.throws(() => validateCanvaJobInput({ prompt: "" }), /Prompt zorunludur/);

  // Missing content type
  assert.throws(
    () => validateCanvaJobInput({ prompt: "Harika bir kampanya" }),
    /İçerik türü zorunludur/
  );

  // Invalid slide count for carousel
  assert.throws(
    () =>
      validateCanvaJobInput({
        prompt: "Harika bir kampanya",
        contentType: "instagram_carousel",
        slideCount: 2,
      }),
    /Carousel için sayfa sayısı 3 ile 10 arasında olmalıdır/
  );

  assert.throws(
    () =>
      validateCanvaJobInput({
        prompt: "Harika bir kampanya",
        contentType: "instagram_carousel",
        slideCount: 11,
      }),
    /Carousel için sayfa sayısı 3 ile 10 arasında olmalıdır/
  );

  // Valid carousel input
  const validCarousel = validateCanvaJobInput({
    prompt: "  Yapay zeka ile pazarlama rehberi  ",
    contentType: "instagram_carousel",
    slideCount: 5,
    style: "minimalist",
  });
  assert.equal(validCarousel.prompt, "Yapay zeka ile pazarlama rehberi");
  assert.equal(validCarousel.contentType, "instagram_carousel");
  assert.equal(validCarousel.slideCount, 5);
  assert.equal(validCarousel.packageType, "carousel");

  // Valid single post forces slideCount = 1
  const validSingle = validateCanvaJobInput({
    prompt: "Günün kahvesi kampanyası",
    contentType: "instagram_post",
    slideCount: 6, // Should be normalized to 1 for single
  });
  assert.equal(validSingle.slideCount, 1);
  assert.equal(validSingle.packageType, "single");
});

test("buildHermesCanvaTaskPrompt generates versioned prompt with strict constraints", () => {
  const payload = {
    jobId: "job-12345",
    projectId: "proj-abc",
    prompt: "Yapay zeka dönüşüm adımları",
    contentType: "instagram_carousel" as const,
    slideCount: 6,
    style: "modern",
    brandSnapshot: {
      name: "Fortis Medya",
      website: "https://fortis.com",
    },
    callbackBaseUrl: "http://127.0.0.1:3000",
    callbackToken: "token-secret-999",
  };

  const taskPrompt = buildHermesCanvaTaskPrompt(payload);

  assert.ok(taskPrompt.includes(HERMES_CANVA_PIPELINE_VERSION));
  assert.ok(taskPrompt.includes("job-12345"));
  assert.ok(taskPrompt.includes("canva-carousel-director"));
  assert.ok(taskPrompt.includes("canva-mcp"));
  assert.ok(taskPrompt.includes("mcp__canva__create_design"));
  assert.ok(taskPrompt.includes("Telegram"));
  assert.ok(taskPrompt.includes("clarification"));
  assert.ok(taskPrompt.includes("1080x1350"));
  assert.ok(taskPrompt.includes("6"));
  assert.ok(taskPrompt.includes("USER_BRIEF"));
  assert.ok(taskPrompt.includes("/api/internal/hermes-canva/jobs/job-12345/progress"));
  assert.ok(taskPrompt.includes("/api/internal/hermes-canva/jobs/job-12345/complete"));
  assert.ok(taskPrompt.includes("/api/internal/hermes-canva/jobs/job-12345/fail"));
  assert.ok(taskPrompt.includes("Bearer token-secret-999"));
});

test("validateManifestAgainstJob rejects mismatched completion metadata", () => {
  const expected = {
    contentType: "instagram_carousel" as const,
    slideCount: 6,
    width: 1080,
    height: 1350,
  };

  assert.doesNotThrow(() =>
    validateManifestAgainstJob(
      { contentType: "instagram_carousel", pageCount: 6, width: 1080, height: 1350 },
      expected,
    ),
  );
  assert.throws(
    () => validateManifestAgainstJob(
      { contentType: "instagram_post", pageCount: 1, width: 1080, height: 1350 },
      expected,
    ),
    /eşleşmiyor/,
  );
});
