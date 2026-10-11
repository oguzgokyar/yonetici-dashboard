"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  LoaderCircle,
  Bot,
  User,
  Trash2,
  Lightbulb,
  HelpCircle,
  Flame,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type AiAssistantDrawerProps = {
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function AiAssistantDrawer({ projectId, isOpen, onClose }: AiAssistantDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Oturum hafızası: localStorage'dan yükle
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `hermes_assistant_chat_${projectId || "global"}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: "Merhaba! Ben Hermes AI Sistem Asistanınızım. Sosyal medya stratejiniz, video kurguları, kanca cümleleri, YouTube Shorts fikirleri veya sistem kullanımı hakkında size danışmanlık yapabilirim. Bugün ne üzerine çalışıyoruz?",
            createdAt: Date.now(),
          },
        ]);
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  // Mesaj güncellendikçe kaydet ve aşağı kaydır
  useEffect(() => {
    if (typeof window === "undefined" || messages.length === 0) return;
    const key = `hermes_assistant_chat_${projectId || "global"}`;
    try {
      localStorage.setItem(key, JSON.stringify(messages.slice(-20)));
    } catch {
      // ignore
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, projectId]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Asistan yanıt veremedi.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.message.content,
          createdAt: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ Bir hata oluştu: ${err instanceof Error ? err.message : String(err)}`,
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleClearChat() {
    const defaultWelcome: Message = {
      id: "welcome",
      role: "assistant",
      content: "Sohbet temizlendi. Yeni bir konu veya fikir hakkında konuşmaya hazırız!",
      createdAt: Date.now(),
    };
    setMessages([defaultWelcome]);
    const key = `hermes_assistant_chat_${projectId || "global"}`;
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  const quickPrompts = [
    { label: "Viral Kanca Öner", text: "Bu hafta Reels/Shorts için dikkat çeken 3 farklı soru kancası (hook) önerir misin?" },
    { label: "Format Stratejisi", text: "TikTok ve YouTube Shorts arasındaki algoritma ve açıklama farkları nelerdir?" },
    { label: "Toplu Yayın Taktikleri", text: "Toplu yayın yaparken içerikler arası ideal saat aralığı ne olmalı?" },
  ];

  if (!isOpen) return null;

  return (
    <aside className="ai-assistant-panel" aria-label="AI Sistem Asistanı">
      {/* Header */}
      <div className="ai-assistant-header">
        <div className="ai-assistant-title-group">
          <div className="ai-assistant-icon">
            <Sparkles size={17} />
          </div>
          <div>
            <h3>AI Sistem Asistanı</h3>
            <p>Hermes Strateji &amp; Bilgi Danışmanı</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="icon-button compact"
            onClick={handleClearChat}
            title="Sohbeti Temizle"
            aria-label="Sohbeti Temizle"
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className="icon-button compact"
            onClick={onClose}
            title="Asistanı Kapat"
            aria-label="Asistanı Kapat"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Info Badge */}
      <div className="ai-assistant-info-pill">
        <Lightbulb size={13} style={{ flexShrink: 0 }} />
        <span>Fikir ve rehberlik modu. Doğrudan sistem verisi silmez veya değiştirmez.</span>
      </div>

      {/* Message Stream */}
      <div className="ai-assistant-body" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`ai-assistant-msg ${m.role}`}>
            <div className="ai-assistant-avatar">
              {m.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className="ai-assistant-bubble">
              <div className="ai-assistant-bubble-text">{m.content}</div>
              <small className="ai-assistant-time">
                {new Date(m.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </small>
            </div>
          </div>
        ))}
        {loading && (
          <div className="ai-assistant-msg assistant">
            <div className="ai-assistant-avatar">
              <Bot size={14} />
            </div>
            <div className="ai-assistant-bubble loading">
              <LoaderCircle size={14} className="spin" />
              <span>Hermes düşünüyor...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompt Chips */}
      <div className="ai-assistant-quick-bar">
        {quickPrompts.map((qp) => (
          <button
            key={qp.label}
            type="button"
            className="ai-assistant-chip"
            onClick={() => void handleSend(qp.text)}
            disabled={loading}
          >
            <Flame size={11} />
            <span>{qp.label}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        className="ai-assistant-input-area"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Hermes'e soru sor, strateji veya kanca iste... (Enter ile gönder)"
          className="custom-input ai-assistant-textarea"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="button primary ai-assistant-send-btn"
          aria-label="Gönder"
        >
          {loading ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}
        </button>
      </form>
    </aside>
  );
}
