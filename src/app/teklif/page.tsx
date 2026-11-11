import { EmbeddedToolView } from "@/features/developer-tools/embedded-tool-view";

export default function TeklifPage() {
  return (
    <EmbeddedToolView
      title="Teklif Hazırlama Aracı"
      eyebrow="Geliştirici Araçları"
      iframeSrc="https://teklif.43.131.47.253.sslip.io/teklif/"
      externalUrl="https://teklif.43.131.47.253.sslip.io/teklif/"
      description="Kurumsal müşteri teklif hazırlama, dinamik maliyet hesaplama ve PDF teklif motoru."
    />
  );
}
