import { completeText } from "@/lib/server/cliproxy-text";

export const runtime = "nodejs";

const SYSTEM_VOICE_PROMPT = `Sen Jarvis'sin (Hermes akıllı asistan). Oğuz Bey ile doğrudan canlı sesli görüşme (telefon araması) yapıyorsun.
Kurallar:
1. Türkçe, akıcı, zeki, saygılı, karizmatik ve son derece doğal bir Jarvis konuşma dili kullan ("Emredersiniz Oğuz Bey", "Sizi dinliyorum", vb.).
2. Cümlelerin kısa, vurucu ve net olsun (en fazla 2-3 kısa cümle kur, asla monolog yapma).
3. Asla markdown işaretleri (*, _, #, \`, parantezler veya maddeler) kullanma; sadece seslendirilecek sade, pürüzsüz metin üret.
4. Oğuz Bey'in sorularına doğrudan ve net cevap ver; gerekiyorsa doğal bir soruyla pas at.`;

function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM format
  wavHeader.writeUInt16LE(1, 22); // mono
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * 2, 28); // byte rate (24000 * 2)
  wavHeader.writeUInt16LE(2, 32); // block align
  wavHeader.writeUInt16LE(16, 34); // bits per sample
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([wavHeader, pcmBuffer]);
}

async function synthesizeGeminiSpeech(text: string, voiceName = "Charon"): Promise<string | null> {
  let apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const keyPath = path.join(process.cwd(), ".data", "google_api_key.txt");
      if (fs.existsSync(keyPath)) {
        apiKey = fs.readFileSync(keyPath, "utf-8").trim();
      }
    } catch {}
  }
  if (!apiKey) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: `Read the following text aloud: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rawBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!rawBase64) return null;
    const pcmBuf = Buffer.from(rawBase64, "base64");
    const wavBuf = pcmToWav(pcmBuf, 24000);
    return wavBuf.toString("base64");
  } catch (err) {
    console.warn("[Voice Chat API] Gemini TTS hatası, yedeğe geçiliyor:", err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [], voice = "tr-TR-AhmetNeural", model } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ ok: false, error: "Mesaj boş olamaz." }, { status: 400 });
    }

    // 1. Zeka motoru ile yanıt üretimi
    const historyText = Array.isArray(history) && history.length > 0
      ? `Son konuşma akışı:\n${history.slice(-6).map((h: { role: string; content: string }) => `${h.role === "user" ? "Oğuz" : "Hermes"}: ${h.content}`).join("\n")}\n\n`
      : "";

    const userPrompt = `${historyText}Oğuz az önce şunu söyledi: "${message.trim()}"\n\nDoğal, canlı ve samimi Türkçe konuşma yanıtın:`;

    const result = await completeText(SYSTEM_VOICE_PROMPT, userPrompt, {
      temperature: 0.7,
      maxTokens: 200,
      model: model || undefined,
    });

    const cleanReply = result.content
      .replace(/[*_#`~[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 2. Ses sentezleme (Öncelik: Google Gemini Studio TTS -> Yedek: Edge-TTS)
    let audioBase64 = "";
    try {
      const geminiAudio = await synthesizeGeminiSpeech(cleanReply, "Charon");
      if (geminiAudio) {
        audioBase64 = geminiAudio;
      } else {
        const encText = encodeURIComponent(cleanReply);
        const encVoice = encodeURIComponent(voice);
        const ttsUrl = `http://10.0.1.1:8080/api/internal/tts?text=${encText}&voice=${encVoice}`;
        const fallbackUrl = `http://127.0.0.1:8080/api/internal/tts?text=${encText}&voice=${encVoice}`;

        let ttsRes = await fetch(ttsUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
        if (!ttsRes || !ttsRes.ok) {
          ttsRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
        }

        if (ttsRes && ttsRes.ok) {
          const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
          audioBase64 = audioBuffer.toString("base64");
        }
      }
    } catch (ttsErr) {
      console.warn("[Voice Chat API] TTS üretimi atlandı:", ttsErr);
    }

    return Response.json({
      ok: true,
      text: cleanReply,
      audioBase64,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Voice Chat API] Hata:", errorMsg);
    return Response.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
