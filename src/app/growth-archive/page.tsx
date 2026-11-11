import { EmbeddedToolView } from "@/features/developer-tools/embedded-tool-view";

export default function GrowthArchivePage() {
  return (
    <EmbeddedToolView
      title="Büyüme & Strateji Arşivi"
      eyebrow="Geliştirici Araçları"
      iframeSrc="http://43.131.47.253:8080/library/"
      externalUrl="http://43.131.47.253:8080/library/"
      description="Pazarlama dökümanları, büyüme stratejisi rehberleri ve referans PDF kitaplığı."
    />
  );
}
