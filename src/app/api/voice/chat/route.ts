import { completeText } from "@/lib/server/cliproxy-text";

export const runtime = "nodejs";

const SYSTEM_VOICE_PROMPT = `Sen Hermes'sin. Oğuz ile doğrudan canlı sesli görüşme (telefon araması) yapıyorsun.
Kurallar:
1. Türkçe, akıcı, samimi, zeki ve son derece doğal bir konuşma dili kullan.
2. Cümlelerin kısa, vurucu ve net olsun (en fazla 2-3 kısa cümle kur, monolog yapma).
3. Asla markdown işaretleri (*, _, #, \`, parantezler veya maddeler) kullanma; sadece seslendirilecek sade, pürüzsüz metin üret.
4. Oğuz'un sorduğu sorulara doğrudan ve net cevap ver; gerekiyorsa doğal bir soruyla pas at.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [], voice = "tr-TR-AhmetNeural" } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ ok: false, error: "Mesaj boş olamaz." }, { status: 400 });
    }

    // 1. Zeka motoru (Gemini 3.8 Flash High) ile yanıt üretimi
    const historyText = Array.isArray(history) && history.length > 0
      ? `Son konuşma akışı:\n${history.slice(-6).map((h: { role: string; content: string }) => `${h.role === "user" ? "Oğuz" : "Hermes"}: ${h.content}`).join("\n")}\n\n`
      : "";

    const userPrompt = `${historyText}Oğuz az önce şunu söyledi: "${message.trim()}"\n\nDoğal, canlı ve samimi Türkçe konuşma yanıtın:`;

    const result = await completeText(SYSTEM_VOICE_PROMPT, userPrompt, {
      temperature: 0.7,
      maxTokens: 200,
    });

    const cleanReply = result.content
      .replace(/[*_#`~[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 2. Dahili Edge-TTS servisimizden ses dalgası sentezleme
    let audioBase64 = "";
    try {
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
