"use client";

import { useState } from "react";
import { Bot, Settings2 } from "lucide-react";
import { AiProviders } from "@/features/settings/ai-providers";
import { SystemUpdates } from "@/features/settings/system-updates";

type SettingsTab = "api" | "system";

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api");

  return <div className="system-settings">
    <div className="settings-tabs" role="tablist" aria-label="Sistem ayarları bölümleri">
      <button type="button" role="tab" aria-selected={activeTab === "api"} className={activeTab === "api" ? "active" : ""} onClick={() => setActiveTab("api")}><Bot size={17} /><span><strong>API Yönetimi</strong><small>AI sağlayıcıları ve modeller</small></span></button>
      <button type="button" role="tab" aria-selected={activeTab === "system"} className={activeTab === "system" ? "active" : ""} onClick={() => setActiveTab("system")}><Settings2 size={17} /><span><strong>Sistem</strong><small>Uygulama ve güncellemeler</small></span></button>
    </div>

    <div role="tabpanel" aria-label={activeTab === "api" ? "API Yönetimi" : "Sistem"}>
      {activeTab === "api" ? <AiProviders /> : <SystemUpdates />}
    </div>
  </div>;
}
