"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Mic, MicOff, PhoneOff, Volume2, ArrowLeft, Sparkles, Radio } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

// Base64'ten Blob'a dönüştürücü (iOS Safari için data-uri yerine Blob URL çok daha kararlıdır)
function base64ToBlob(base64: string, mimeType = "audio/mpeg"): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type: mimeType });
}

export default function LiveCallPage() {
  const [isCalling, setIsCalling] = useState(false);
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("tr-TR-AhmetNeural");
  const [interimText, setInterimText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const isSpeakingRef = useRef(false);
  const isCallingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  // Çağrı süresi sayacı
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCalling) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isCalling]);

  // Screen WakeLock (iPhone ekranının kapanmasını önleme)
  useEffect(() => {
    async function requestWakeLock() {
      if (isCalling && "wakeLock" in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        } catch (e) {
          console.warn("WakeLock request failed:", e);
        }
      } else if (!isCalling && wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch {}
      }
    }
    requestWakeLock();
    return () => {
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release(); } catch {}
      }
    };
  }, [isCalling]);

  // Ses oynatıcıyı durdurma (Barge-in / araya girme)
  function stopCurrentAudio() {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    isSpeakingRef.current = false;
  }

  // Apple iOS Native SpeechSynthesis yedeği
  function playNativeVoiceFallback(text: string) {
    if (!("speechSynthesis" in window) || !isCallingRef.current) {
      onSpeechEnded();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "tr-TR";
      utterance.rate = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const trVoice = voices.find((v) => v.lang.startsWith("tr"));
      if (trVoice) utterance.voice = trVoice;

      utterance.onend = () => onSpeechEnded();
      utterance.onerror = () => onSpeechEnded();

      setStatus("speaking");
      isSpeakingRef.current = true;
      window.speechSynthesis.speak(utterance);
    } catch {
      onSpeechEnded();
    }
  }

  // Hermes'in konuşması bittiğinde tetiklenir
  function onSpeechEnded() {
    isSpeakingRef.current = false;
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    if (isCallingRef.current) {
      setStatus("listening");
      startSpeechRecognitionSafe();
    }
  }

  // Hermes'e mesaj gönderme ve ses çalma
  async function sendToHermes(userUtterance: string) {
    if (!userUtterance.trim() || !isCallingRef.current) return;

    setStatus("thinking");
    const updatedHistory: Message[] = [...messages, { role: "user", content: userUtterance.trim() }];
    setMessages(updatedHistory);
    setInterimText("");

    try {
      const resp = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userUtterance.trim(),
          history: updatedHistory.slice(-6),
          voice: selectedVoice,
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        throw new Error(data.error || "Yanıt alınamadı");
      }

      const replyText = data.text;
      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);

      // 1. Önce ses dosyasıyla (Edge-TTS) çalmayı dene
      if (data.audioBase64 && isCallingRef.current && audioElRef.current) {
        try {
          setStatus("speaking");
          isSpeakingRef.current = true;

          const blob = base64ToBlob(data.audioBase64, "audio/mpeg");
          const blobUrl = URL.createObjectURL(blob);
          activeBlobUrlRef.current = blobUrl;

          const audio = audioElRef.current;
          audio.src = blobUrl;
          await audio.play();
        } catch (playErr) {
          console.warn("[Call] HTML5 audio.play engellendi, iOS yerel ses sentezine geçiliyor:", playErr);
          // 2. iOS Safari engellerse anında yerel iOS Türkçe ses motorunu devreye sok
          playNativeVoiceFallback(replyText);
        }
      } else {
        // Ses gelmediyse yerel ses senteziyle oku
        playNativeVoiceFallback(replyText);
      }
    } catch (err: any) {
      console.error("[Call] Gönderim hatası:", err);
      setErrorMsg(err.message || "İletişim hatası oluştu.");
      setStatus("listening");
      startSpeechRecognitionSafe();
    }
  }

  // Güvenli SpeechRecognition başlatıcı
  function startSpeechRecognitionSafe() {
    if (!recognitionRef.current || !isCallingRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      // Zaten çalışıyorsa sessizce geç
    }
  }

  // Aramayı başlat
  function startCall() {
    setErrorMsg(null);
    setIsCalling(true);
    isCallingRef.current = true;
    setStatus("listening");

    // 🔥 KRİTİK iOS SAFARI OPTİMİZASYONU:
    // Kullanıcı butona dokunduğu an (User Interaction) ses motorunu kilitsiz hale getir (Prime / Unlock)
    if (audioElRef.current) {
      audioElRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      audioElRef.current.play().then(() => {
        if (audioElRef.current) {
          audioElRef.current.pause();
          audioElRef.current.currentTime = 0;
        }
      }).catch((e) => console.log("Audio unlock:", e));
    }

    if ("speechSynthesis" in window) {
      try {
        const dummy = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(dummy);
      } catch {}
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg("Tarayıcınız ses tanımayı desteklemiyor. Lütfen iPhone Safari kullanın.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let pendingFinalTranscript = "";

    recognition.onstart = () => {
      if (!isSpeakingRef.current) {
        setStatus("listening");
      }
    };

    recognition.onresult = (event: any) => {
      // Kullanıcı konuşmaya başladıysa ve Hermes o sırada konuşuyorsa: Araya girme (Barge-in)!
      if (isSpeakingRef.current) {
        stopCurrentAudio();
        setStatus("listening");
      }

      let currentInterim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          pendingFinalTranscript += " " + event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      setInterimText(currentInterim || pendingFinalTranscript);

      // Sessizlik kontrolü: Kullanıcı 900ms duraksadığında cümleyi Hermes'e gönder
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      silenceTimerRef.current = setTimeout(() => {
        const fullSentence = (pendingFinalTranscript + " " + currentInterim).trim();
        if (fullSentence.length > 1) {
          try {
            recognition.stop();
          } catch {}
          pendingFinalTranscript = "";
          setInterimText("");
          sendToHermes(fullSentence);
        }
      }, 950);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        setErrorMsg("Mikrofon izni verilmedi. Lütfen mikrofon erişimine izin verin.");
        endCall();
      }
    };

    recognition.onend = () => {
      // Çağrı devam ediyorsa ve Hermes konuşmuyorsa dinlemeyi sürdür
      if (isCallingRef.current && !isSpeakingRef.current) {
        startSpeechRecognitionSafe();
      }
    };

    recognitionRef.current = recognition;
    startSpeechRecognitionSafe();
  }

  // Aramayı sonlandır
  function endCall() {
    isCallingRef.current = false;
    setIsCalling(false);
    setStatus("idle");
    stopCurrentAudio();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#090a0f",
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "24px 20px 40px",
      fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Gizli ve Hazır HTML5 Ses Elementi (iOS Kilitsiz Oynatma İçin) */}
      <audio
        ref={audioElRef}
        playsInline
        preload="auto"
        onEnded={onSpeechEnded}
        onError={onSpeechEnded}
        style={{ display: "none" }}
      />

      {/* Üst Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        <Link href="/" style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "#94a3b8",
          textDecoration: "none",
          fontSize: "13px",
          background: "rgba(255, 255, 255, 0.06)",
          padding: "6px 12px",
          borderRadius: "20px",
          backdropFilter: "blur(10px)",
        }}>
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </Link>

        {isCalling && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            padding: "4px 12px",
            borderRadius: "16px",
            fontSize: "12px",
            color: "#4ade80",
            fontWeight: 600,
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 1.5s infinite" }} />
            <span>{formatTime(callDuration)}</span>
          </div>
        )}

        {/* Ses Seçici */}
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          disabled={isCalling}
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#cbd5e1",
            padding: "6px 10px",
            borderRadius: "14px",
            fontSize: "11px",
            outline: "none",
          }}
        >
          <option value="tr-TR-AhmetNeural" style={{ background: "#111" }}>Ahmet (Erkek)</option>
          <option value="tr-TR-EmelNeural" style={{ background: "#111" }}>Emel (Kadın)</option>
        </select>
      </div>

      {/* Orta Görsel & Dalga Alanı */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        textAlign: "center",
        margin: "30px 0",
        position: "relative",
      }}>
        {/* Arka Plan Glow */}
        <div style={{
          position: "absolute",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          background: status === "speaking"
            ? "radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(99, 102, 241, 0) 70%)"
            : status === "listening"
            ? "radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, rgba(34, 197, 94, 0) 70%)"
            : status === "thinking"
            ? "radial-gradient(circle, rgba(234, 179, 8, 0.25) 0%, rgba(234, 179, 8, 0) 70%)"
            : "radial-gradient(circle, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0) 70%)",
          filter: "blur(20px)",
          transition: "all 0.6s ease",
          zIndex: 1,
        }} />

        {/* Ana Ses Küresi */}
        <div style={{
          width: "140px",
          height: "140px",
          borderRadius: "50%",
          background: status === "speaking"
            ? "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)"
            : status === "listening"
            ? "linear-gradient(135deg, #22c55e 0%, #10b981 100%)"
            : status === "thinking"
            ? "linear-gradient(135deg, #eab308 0%, #f97316 100%)"
            : "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isCalling
            ? "0 0 50px rgba(99, 102, 241, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.3)"
            : "0 10px 30px rgba(0, 0, 0, 0.5)",
          transform: status === "speaking" || status === "listening" ? "scale(1.08)" : "scale(1)",
          transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          zIndex: 2,
        }}>
          {status === "speaking" ? (
            <Volume2 size={48} color="#ffffff" />
          ) : status === "thinking" ? (
            <Sparkles size={44} color="#ffffff" />
          ) : (
            <Mic size={44} color="#ffffff" />
          )}
        </div>

        {/* Durum Başlığı */}
        <h2 style={{ fontSize: "24px", fontWeight: 700, margin: "24px 0 6px", letterSpacing: "-0.5px" }}>
          Hermes Canlı Asistan
        </h2>

        <p style={{
          fontSize: "14px",
          color: status === "speaking" ? "#a5b4fc" : status === "listening" ? "#86efac" : status === "thinking" ? "#fde047" : "#94a3b8",
          margin: 0,
          fontWeight: 500,
          transition: "color 0.3s ease",
        }}>
          {status === "speaking"
            ? "Hermes konuşuyor..."
            : status === "thinking"
            ? "Düşünüyor..."
            : status === "listening"
            ? "Sizi dinliyor (doğrudan konuşun)..."
            : "Görüşmeyi başlatmak için aşağıdaki butona dokunun"}
        </p>

        {/* Canlı Altyazı / Duyulan Metin */}
        {interimText && (
          <div style={{
            marginTop: "16px",
            padding: "8px 16px",
            background: "rgba(255, 255, 255, 0.06)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#e2e8f0",
            maxWidth: "320px",
            backdropFilter: "blur(8px)",
          }}>
            <em>&quot;{interimText}&quot;</em>
          </div>
        )}

        {/* Son Cevap Balonu */}
        {messages.length > 0 && !interimText && (
          <div style={{
            marginTop: "20px",
            maxHeight: "110px",
            overflowY: "auto",
            padding: "10px 14px",
            background: "rgba(30, 41, 59, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            fontSize: "12.5px",
            lineHeight: 1.5,
            color: "#cbd5e1",
            maxWidth: "340px",
            textAlign: "center",
          }}>
            {messages[messages.length - 1].content}
          </div>
        )}

        {errorMsg && (
          <div style={{
            marginTop: "14px",
            color: "#f87171",
            fontSize: "12px",
            background: "rgba(239, 68, 68, 0.1)",
            padding: "6px 12px",
            borderRadius: "8px",
          }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* Alt Kontrol Butonları */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "24px",
        zIndex: 10,
      }}>
        {!isCalling ? (
          <button
            onClick={startCall}
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "50px",
              padding: "18px 42px",
              fontSize: "16px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "0 10px 25px rgba(34, 197, 94, 0.4)",
              cursor: "pointer",
              transition: "transform 0.1s ease",
            }}
          >
            <Radio size={20} />
            <span>Aramayı Başlat</span>
          </button>
        ) : (
          <>
            {/* Sessize Al */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: isMuted ? "#f87171" : "rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              title={isMuted ? "Sesi Aç" : "Sessize Al"}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {/* Aramayı Sonlandır (Kırmızı Buton) */}
            <button
              onClick={endCall}
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                background: "#ef4444",
                color: "#ffffff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(239, 68, 68, 0.45)",
                cursor: "pointer",
              }}
              title="Aramayı Kapat"
            >
              <PhoneOff size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
