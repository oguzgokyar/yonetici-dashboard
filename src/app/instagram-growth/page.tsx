import { EmbeddedToolView } from "@/features/developer-tools/embedded-tool-view";

export default function InstagramGrowthPage() {
  return (
    <EmbeddedToolView
      title="Instagram Growth & Takipçi Masası"
      eyebrow="Geliştirici Araçları"
      iframeSrc="http://43.131.47.253:8090/"
      externalUrl="http://43.131.47.253:8090/"
      description="Headless Instagram büyüme botu, otopilot seansları, beyaz liste ve takipçi çıkarma havuzu (:8090)."
    />
  );
}
