import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import type {
  GeminiTtsVoice,
  RssVoiceEmotion,
  RssVoiceSpeed,
} from "@/features/generation/rss-video/types";

const execFileAsync = promisify(execFile);

function resolveFfmpegBin(): string {
  for (const p of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) return p;
  }
  return "ffmpeg";
}

function resolveFfprobeBin(): string {
  for (const p of ["/usr/bin/ffprobe", "/usr/local/bin/ffprobe"]) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) return p;
  }
  return "ffprobe";
}

type ProviderRow = {
  provider: string;
  enabled: number;
  base_url: string;
  encrypted_api_key: string | null;
  text_model: string;
};

const EMOTION_DELIVERY_DIRECTIVES: Record<RssVoiceEmotion, string> = {
  urgent:
    "Acil, dinamik ve dikkat çekici bir sıcak haber spikeri tonuyla, net ve vurgulu şekilde Türkçe seslendir",
  serious:
    "Ciddi, otoriter ve güven veren bir analist tonuyla Türkçe seslendir",
  calm:
    "Sakin, berrak ve merak uyandıran bir belgesel anlatıcısı tonuyla Türkçe seslendir",
  warm_storyteller:
    "Sıcak, samimi ve büyüleyici bir masal/hikâye anlatıcısı tonuyla, duygusal duraklamalarla Türkçe seslendir",
  dramatic:
    "Derin, sinematik ve duygusal yoğunluğu yüksek bir film anlatıcısı tonuyla Türkçe seslendir",
  mysterious:
    "Gizemli, merak tırmandıran ve odaklayıcı bir tonla Türkçe seslendir",
  excited:
    "Enerjik, heyecanlı ve ilham veren bir tonla Türkçe seslendir",
};

function extractAudioFromGeminiResponse(body: unknown): {
  bytes: Buffer;
  mimeType: string;
} | null {
  const candidates = (body as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
  })?.candidates;

  const parts = candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline =
      part.inlineData ||
      (part.inline_data
        ? { data: part.inline_data.data, mimeType: part.inline_data.mime_type }
        : undefined);
    if (inline?.data && inline.data.length > 64) {
      return {
        bytes: Buffer.from(inline.data, "base64"),
        mimeType: (inline.mimeType || "audio/pcm;rate=24000").toLowerCase(),
      };
    }
  }
  return null;
}

export async function probeAudioDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync(resolveFfprobeBin(), [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const parsed = parseFloat(stdout.trim());
  if (!Number.isFinite(parsed) || parsed <= 0.1) {
    throw new Error(`Ses dosyası süresi doğrulanamadı (${filePath}).`);
  }
  return parsed;
}

/**
 * Gemini 2.0 / 2.5 TTS ile sahne seslendirmesi üretir.
 * KESİN KURAL: Edge-TTS veya başka bir servise sessiz yedekleme (fallback) YAPILMAZ.
 * Herhangi bir hata durumunda gerçek hata nedeni doğrudan fırlatılır.
 */
export async function synthesizeGeminiTtsSegment(options: {
  text: string;
  outputPath: string;
  voice: GeminiTtsVoice;
  emotion: RssVoiceEmotion;
  speed: RssVoiceSpeed;
}): Promise<{ durationSeconds: number; modelUsed: string }> {
  const cleanText = options.text.replace(/\s+/g, " ").trim();
  if (!cleanText) {
    throw new Error("Seslendirilecek sahne metni boş olamaz.");
  }

  const db = getDatabase();
  const rows = db
    .prepare(
      "SELECT provider, enabled, base_url, encrypted_api_key, text_model FROM ai_provider_configs WHERE provider IN ('gemini', 'cliproxy') ORDER BY CASE WHEN provider = 'gemini' THEN 0 ELSE 1 END"
    )
    .all() as unknown as ProviderRow[];

  const candidates: Array<{
    provider: string;
    origin: string;
    apiKey: string;
    useQueryKey: boolean;
    models: string[];
  }> = [];

  for (const row of rows) {
    if (!row.encrypted_api_key) continue;
    let apiKey = "";
    try {
      apiKey = decryptSecret(row.encrypted_api_key).trim();
    } catch {
      continue;
    }
    if (!apiKey) continue;

    if (row.provider === "gemini") {
      const base = (row.base_url || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
      const origin = new URL(base).origin;
      const models = Array.from(
        new Set(
          [
            row.text_model?.includes("tts") ? row.text_model : "",
            "gemini-2.5-flash-preview-tts",
            "gemini-2.0-flash-exp",
            "gemini-2.0-flash",
          ].filter(Boolean)
        )
      );
      candidates.push({
        provider: "gemini",
        origin,
        apiKey,
        useQueryKey: true,
        models,
      });
    } else if (row.provider === "cliproxy" && row.enabled) {
      const origin = new URL(row.base_url).origin;
      const models = Array.from(
        new Set(
          [
            "gemini-2.5-flash-preview-tts",
            "gemini-2.0-flash-exp",
            "gemini-2.0-flash",
            row.text_model && /gemini/i.test(row.text_model) ? row.text_model : "gemini-3-flash",
          ].filter(Boolean)
        )
      );
      candidates.push({
        provider: "cliproxy",
        origin,
        apiKey,
        useQueryKey: false,
        models,
      });
    }
  }

  if (!candidates.length) {
    throw new Error(
      "Gemini 2.0 TTS için yapılandırılmış API anahtarı bulunamadı. Lütfen Sistem Ayarları > API Yönetimi bölümünden Gemini veya CliProxyAPI bağlantısını kontrol edin."
    );
  }

  const deliveryDirective =
    EMOTION_DELIVERY_DIRECTIVES[options.emotion] || EMOTION_DELIVERY_DIRECTIVES.calm;
  const ttsPrompt = `${deliveryDirective}:\n"${cleanText}"`;

  const errors: string[] = [];
  let extractedAudio: { bytes: Buffer; mimeType: string; modelUsed: string } | null = null;

  for (const candidate of candidates) {
    for (const model of candidate.models) {
      const endpoint = candidate.useQueryKey
        ? `${candidate.origin}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(candidate.apiKey)}`
        : `${candidate.origin}/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (!candidate.useQueryKey) {
        headers.Authorization = `Bearer ${candidate.apiKey}`;
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: ttsPrompt }],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: options.voice || "Kore",
                  },
                },
              },
            },
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          const msg = errBody?.error?.message || `HTTP ${response.status}`;
          errors.push(`[${candidate.provider}/${model}]: ${msg}`);
          continue;
        }

        const body = await response.json();
        const audio = extractAudioFromGeminiResponse(body);
        if (!audio) {
          errors.push(
            `[${candidate.provider}/${model}]: Model yanıt döndürdü ancak içinde AUDIO (inlineData) ses akışı bulunamadı (yalnızca metin döndü).`
          );
          continue;
        }

        extractedAudio = {
          bytes: audio.bytes,
          mimeType: audio.mimeType,
          modelUsed: model,
        };
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${candidate.provider}/${model}]: ${msg}`);
      }
    }
    if (extractedAudio) break;
  }

  if (!extractedAudio) {
    throw new Error(
      `Gemini 2.0 TTS ses üretimi başarısız oldu (Edge-TTS yedeği kapalıdır). Denenen modeller ses verisi döndürmedi: ${errors.join(" | ")}. Lütfen Sistem Ayarları > API Yönetimi > Gemini sekmesinden doğrudan Google AI Studio (Gemini) API anahtarının girili olduğundan veya CliProxyAPI üzerinde Gemini TTS destekli anahtar bulunduğundan emin olun.`
    );
  }

  const rawTempPath = `${options.outputPath}.raw`;
  fs.writeFileSync(rawTempPath, extractedAudio.bytes);

  try {
    const isRawPcm =
      extractedAudio.mimeType.includes("pcm") ||
      extractedAudio.mimeType.includes("l16") ||
      (!extractedAudio.mimeType.includes("wav") &&
        !extractedAudio.mimeType.includes("mp3") &&
        !extractedAudio.mimeType.includes("mpeg") &&
        !extractedAudio.mimeType.includes("ogg"));

    const rateMatch = extractedAudio.mimeType.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    const speedVal =
      typeof options.speed === "number" && options.speed >= 0.5 && options.speed <= 2.0
        ? options.speed
        : 1.0;

    const afFilters = [
      ...(Math.abs(speedVal - 1.0) > 0.01 ? [`atempo=${speedVal.toFixed(2)}`] : []),
      "aresample=48000",
    ].join(",");

    const ffmpegArgs = isRawPcm
      ? [
          "-y",
          "-f",
          "s16le",
          "-ar",
          String(sampleRate),
          "-ac",
          "1",
          "-i",
          rawTempPath,
          "-af",
          afFilters,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "192k",
          options.outputPath,
        ]
      : [
          "-y",
          "-i",
          rawTempPath,
          "-af",
          afFilters,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "192k",
          options.outputPath,
        ];

    await execFileAsync(resolveFfmpegBin(), ffmpegArgs, { timeout: 30_000 });
  } finally {
    fs.rmSync(rawTempPath, { force: true });
  }

  const durationSeconds = await probeAudioDurationSeconds(options.outputPath);
  return {
    durationSeconds,
    modelUsed: extractedAudio.modelUsed,
  };
}
