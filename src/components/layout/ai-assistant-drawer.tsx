"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  X,
  Send,
  LoaderCircle,
  Bot,
  User,
  Trash2,
  Lightbulb,
  Flame,
  Zap,
  Palette,
  Briefcase,
  Layers,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  specialistBadge?: string;
  createdAt: number;
};

type SpecialistOption = "auto" | "viral_growth" | "creative_design" | "paid_growth" | "ops_assistant";

const SPECIALIST_CONFIG: Record<
  SpecialistOption,
  { label: string; badge: string; icon: typeof Zap; color: string }
> = {
  auto: { label: "Otomatik (Akıllı Algılama)", badge: "Agency Router", icon: Sparkles, color: "#7c3aed" },
  viral_growth: { label: "Viral Büyüme & Kanca", badge: "⚡ Agency Viral", icon: Zap, color: "#db2777" },
  creative_design: { label: "Kreatif & Tasarım", badge: "🎨 Agency Design", icon: Palette, color: "#0891b2" },
  paid_growth: { label: "Satış & Reklam", badge: "💼 Agency Paid", icon: Briefcase, color: "#059669" },
  ops_assistant: { label: "Sistem & Yayın Planı", badge: "🤖 Hermes Ops", icon: Layers, color: "#4f46e5" },
};

type PendingAction = {
  action: "update_bulk_items" | "update_composer" | "add_strategy_idea";
  updates?: Array<any>;
  single?: any;
  idea?: any;
  summary?: string;
};

type AiAssistantDrawerProps = {
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function AiAssistantDrawer({ projectId, isOpen, onClose }: AiAssistantDrawerProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [specialistMode, setSpecialistMode] = useState<SpecialistOption>("auto");
  const [currentSpecialist, setCurrentSpecialist] = useState<{ name: string; badge: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sayfa bağlamını oku
  function getPageContext(): Record<string, unknown> | undefined {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = window.sessionStorage.getItem("hermes_assistant_page_context");
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }

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
            specialistBadge: "⚡ Agency Viral Growth",
            content: "Merhaba! Ben The Agency & Hermes Asistanınızım. Sosyal medya stratejiniz, viral kancalar, 6-aşamalı Carousel planları, reklam metinleri veya yayın revizeleri için 267 uzmanlık kütüphanesinden yararlanabilirim. Bugün ne üzerine çalışıyoruz?",
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
      const pageCtx = getPageContext();
      const res = await fetch("/api/ai/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          pageContext: pageCtx,
          agentSlug: specialistMode !== "auto" ? specialistMode : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Asistan yanıt veremedi.");
      }

      if (data.specialist) {
        setCurrentSpecialist(data.specialist);
      }

      const assistantMsg: Message = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: data.message.content,
        specialistBadge: data.specialist?.badge || "Agency Specialist",
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Eğer asistan aksiyon ürettiyse yönet
      if (data.action) {
        setPendingAction(data.action);

        if (data.action.action === "update_bulk_items" || data.action.action === "update_composer") {
          window.dispatchEvent(new CustomEvent("hermes_apply_assistant_action", { detail: data.action }));
        } else if (data.action.action === "add_strategy_idea" && data.action.idea) {
          // Strateji sayfasına anında ekleme sinyali gönder
          window.dispatchEvent(
            new CustomEvent("hermes_strategy_idea_added", {
              detail: { idea: data.action.idea },
            })
          );
        }
      }
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
      specialistBadge: "⚡ Agency Viral Growth",
      content: "Sohbet temizlendi. Yeni bir strateji veya kanca üzerinde çalışmaya hazırız!",
      createdAt: Date.now(),
    };
    setMessages([defaultWelcome]);
    const key = `hermes_assistant_chat_${projectId || "global"}`;
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  const quickPrompts = [
    {
      label: "🔥 Viral Kanca",
      text: "Bu proje için 'Uyarı / Negatif Merak' ve 'Ters Köşe Hilesi' formülleriyle 2 adet viral Reels kancası yaz ve açıkla.",
    },
    {
      label: "📚 6-Adım Carousel",
      text: "Bu markanın hedef kitlesi için 6 slaytlık kaydırmalı Canva Carousel anlatı mimarisi (Hook-Pain-Agitation-Solution-Value-CTA) kur.",
    },
    {
      label: "💡 Stratejiye Ekle",
      text: "Hedef kitlemizin en büyük problemini çözecek harika bir Dikey Video içerik fikri tasarla ve bunu doğrudan Strateji Masası panoma ekle.",
    },
    {
      label: "🔄 Toplu Revize",
      text: "Toplu yayın önizlemesindeki içeriklerin başlıklarını daha merak uyandırıcı ve soru kancalı hale getir.",
    },
  ];

  if (!isOpen) return null;

  return (
    <aside className="ai-assistant-panel" aria-label="AI Sistem Asistanı">
      {/* Header */}
      <div className="ai-assistant-header">
        <div className="ai-assistant-title-group">
          <div className="ai-assistant-icon" style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }}>
            <Sparkles size={17} color="#fff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Agency Danışmanı</h3>
              {currentSpecialist && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "4px",
                    background: "#f3e8ff",
                    color: "#7c3aed",
                    border: "1px solid #d8b4fe",
                  }}
                >
                  {currentSpecialist.badge}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
              {currentSpecialist ? currentSpecialist.name : "The Agency 267 Uzman Ajan Havuzu"}
            </p>
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

      {/* Specialist Selector Bar */}
      <div
        style={{
          padding: "8px 12px",
          background: "#f8fafc",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>
          Uzman Modu:
        </span>
        <select
          value={specialistMode}
          onChange={(e) => setSpecialistMode(e.target.value as SpecialistOption)}
          className="custom-select"
          style={{ height: "26px", fontSize: "10.5px", padding: "0 8px", flex: 1 }}
        >
          {(Object.keys(SPECIALIST_CONFIG) as SpecialistOption[]).map((key) => (
            <option key={key} value={key}>
              {SPECIALIST_CONFIG[key].badge} — {SPECIALIST_CONFIG[key].label}
            </option>
          ))}
        </select>
      </div>

      {/* Info Badge */}
      <div className="ai-assistant-info-pill">
        <Lightbulb size={13} style={{ flexShrink: 0 }} />
        <span>Fikirleri Strateji Panosu&apos;na ekleyebilir, paylaşım planını anında revize edebilir.</span>
      </div>

      {/* Message Stream */}
      <div className="ai-assistant-body" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`ai-assistant-msg ${m.role}`}>
            <div className="ai-assistant-avatar">
              {m.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className="ai-assistant-bubble">
              {m.specialistBadge && m.role === "assistant" && (
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    marginBottom: "4px",
                    color: "#7c3aed",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {m.specialistBadge}
                </div>
              )}
              <div className="ai-assistant-bubble-text" style={{ whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
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
              <span>Agency uzmanı düşünüyor ve kurguluyor...</span>
            </div>
          </div>
        )}

        {/* Aksiyon Bildirim Kartı */}
        {pendingAction && pendingAction.action === "add_strategy_idea" && pendingAction.idea && (
          <div
            style={{
              padding: "10px 12px",
              background: "#ecfdf5",
              border: "1px solid #6ee7b7",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "11px",
              color: "#065f46",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                <CheckCircle2 size={15} color="#059669" />
                <span>Fikir Strateji Panosu&apos;na Eklendi!</span>
              </div>
              {projectId && (
                <button
                  type="button"
                  className="button compact primary"
                  style={{ height: "22px", fontSize: "10px", padding: "0 8px", background: "#059669" }}
                  onClick={() => router.push(`/projects/${projectId}/strategy`)}
                >
                  <span>Stratejiye Git</span>
                  <ArrowRight size={10} />
                </button>
              )}
            </div>
            <div style={{ fontSize: "11.5px", fontWeight: 600 }}>
              &quot;{pendingAction.idea.title}&quot; &rarr;{" "}
              <span style={{ textTransform: "uppercase" }}>{pendingAction.idea.columnType || "Dikey Video"}</span>
            </div>
            {pendingAction.idea.hook && (
              <div style={{ fontSize: "10.5px", fontStyle: "italic", opacity: 0.9 }}>
                Kanca: &quot;{pendingAction.idea.hook}&quot;
              </div>
            )}
          </div>
        )}

        {pendingAction &&
          (pendingAction.action === "update_bulk_items" || pendingAction.action === "update_composer") && (
            <div
              style={{
                padding: "10px 12px",
                background: "#ede9fe",
                border: "1px solid #c4b5fd",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                fontSize: "11px",
                color: "#5b21b6",
                fontWeight: 600,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={14} />
                <span>Değişiklikler yayın planına aktarıldı!</span>
              </div>
              <button
                type="button"
                className="button compact primary"
                style={{ height: "24px", fontSize: "10px", padding: "0 8px" }}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("hermes_apply_assistant_action", { detail: pendingAction })
                  );
                }}
              >
                Yeniden Uygula
              </button>
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
          placeholder="Agency uzmanına danış, strateji veya kanca iste... (Enter ile gönder)"
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
