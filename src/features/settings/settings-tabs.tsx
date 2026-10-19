"use client";

import { useState } from "react";
import { Bot, Settings2, Server, Palette, Music2, Video } from "lucide-react";
import { AiProviders } from "@/features/settings/ai-providers";
import { CanvaAccountSettings } from "@/features/settings/canva-account-settings";
import { GoogleVidsAccountSettings } from "@/features/settings/google-vids-account-settings";
import { MusicProviderSettings } from "@/features/settings/music-provider-settings";
import { SystemUpdates } from "@/features/settings/system-updates";

import { ServerMonitor } from "@/features/settings/server-monitor";

type SettingsTab = "api" | "system" | "server";
type ApiSubTab = "ai_postiz" | "canva" | "google_vids" | "music";

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api");
  const [apiSubTab, setApiSubTab] = useState<ApiSubTab>("ai_postiz");

  return (
    <div className="system-settings">
      <div className="settings-tabs" role="tablist" aria-label="Sistem ayarları bölümleri">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "api"}
          className={activeTab === "api" ? "active" : ""}
          onClick={() => setActiveTab("api")}
        >
          <Bot size={18} className="tab-icon" />
          <span>
            <strong>API Yönetimi</strong>
            <small>AI ve Sosyal Medya (Postiz)</small>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "server"}
          className={activeTab === "server" ? "active" : ""}
          onClick={() => setActiveTab("server")}
        >
          <Server size={18} className="tab-icon" />
          <span>
            <strong>Sunucu</strong>
            <small>Kaynaklar ve üretim işleri</small>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "system"}
          className={activeTab === "system" ? "active" : ""}
          onClick={() => setActiveTab("system")}
        >
          <Settings2 size={18} className="tab-icon" />
          <span>
            <strong>Sistem</strong>
            <small>Uygulama ve güncellemeler</small>
          </span>
        </button>
      </div>

      <div role="tabpanel" aria-label={activeTab === "api" ? "API Yönetimi" : activeTab === "server" ? "Sunucu" : "Sistem"}>
        {activeTab === "api" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* API Yönetimi Alt Sekmeler */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "12px",
                overflowX: "auto",
              }}
              role="tablist"
              aria-label="API Yönetimi Alt Bölümleri"
            >
              <button
                type="button"
                role="tab"
                aria-selected={apiSubTab === "ai_postiz"}
                onClick={() => setApiSubTab("ai_postiz")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  border: apiSubTab === "ai_postiz" ? "1px solid #6366f1" : "1px solid #e2e8f0",
                  background: apiSubTab === "ai_postiz" ? "#eef2ff" : "white",
                  color: apiSubTab === "ai_postiz" ? "#4338ca" : "#64748b",
                }}
              >
                <Bot size={15} />
                AI Modelleri &amp; Postiz
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={apiSubTab === "canva"}
                onClick={() => setApiSubTab("canva")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  border: apiSubTab === "canva" ? "1px solid #0284c7" : "1px solid #e2e8f0",
                  background: apiSubTab === "canva" ? "linear-gradient(135deg, #f0fdfa, #faf5ff)" : "white",
                  color: apiSubTab === "canva" ? "#0369a1" : "#64748b",
                }}
              >
                <Palette size={15} color={apiSubTab === "canva" ? "#0284c7" : "#64748b"} />
                Canva Hesap Havuzu
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={apiSubTab === "google_vids"}
                onClick={() => setApiSubTab("google_vids")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  border: apiSubTab === "google_vids" ? "1px solid #2563eb" : "1px solid #e2e8f0",
                  background: apiSubTab === "google_vids" ? "#eff6ff" : "white",
                  color: apiSubTab === "google_vids" ? "#1e40af" : "#64748b",
                }}
              >
                <Video size={15} color={apiSubTab === "google_vids" ? "#2563eb" : "#64748b"} />
                Google Vids Havuzu
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={apiSubTab === "music"}
                onClick={() => setApiSubTab("music")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  border: apiSubTab === "music" ? "1px solid #a855f7" : "1px solid #e2e8f0",
                  background: apiSubTab === "music" ? "#faf5ff" : "white",
                  color: apiSubTab === "music" ? "#7e22ce" : "#64748b",
                }}
              >
                <Music2 size={15} />
                Müzik Kaynakları
              </button>
            </div>

            {/* Alt Sekme İçeriği */}
            {apiSubTab === "ai_postiz" && <AiProviders />}
            {apiSubTab === "canva" && <CanvaAccountSettings />}
            {apiSubTab === "google_vids" && <GoogleVidsAccountSettings />}
            {apiSubTab === "music" && <MusicProviderSettings />}
          </div>
        ) : activeTab === "server" ? (
          <ServerMonitor />
        ) : (
          <SystemUpdates />
        )}
      </div>
    </div>
  );
}
