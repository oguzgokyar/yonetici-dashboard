"use client";

import { useState } from "react";
import { Bot, Settings2, Server } from "lucide-react";
import { AiProviders } from "@/features/settings/ai-providers";
import { MusicProviderSettings } from "@/features/settings/music-provider-settings";
import { SystemUpdates } from "@/features/settings/system-updates";

import { ServerMonitor } from "@/features/settings/server-monitor";

type SettingsTab = "api" | "system" | "server";

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api");

  return <div className="system-settings">
    <div className="settings-tabs" role="tablist" aria-label="Sistem ayarları bölümleri">
      <button type="button" role="tab" aria-selected={activeTab === "api"} className={activeTab === "api" ? "active" : ""} onClick={() => setActiveTab("api")}><Bot size={17} /><span><strong>API Yönetimi</strong><small>AI ve Sosyal Medya (Postiz) servisleri</small></span></button>
      <button type="button" role="tab" aria-selected={activeTab === "system"} className={activeTab === "system" ? "active" : ""} onClick={() => setActiveTab("system")}><Settings2 size={17} /><span><strong>Sistem</strong><small>Uygulama ve güncellemeler</small></span></button>
      <button type="button" role="tab" aria-selected={activeTab === "server"} className={activeTab === "server" ? "active" : ""} onClick={() => setActiveTab("server")}><Server size={17} /><span><strong>Sunucu</strong><small>Kaynaklar ve üretim işleri</small></span></button>
    </div>

    <div role="tabpanel" aria-label={activeTab === "api" ? "API Yönetimi" : activeTab === "server" ? "Sunucu" : "Sistem"}>
      {activeTab === "api" ? <><AiProviders /><MusicProviderSettings /></> : activeTab === "server" ? <ServerMonitor /> : <SystemUpdates />}
    </div>
  </div>;
}
