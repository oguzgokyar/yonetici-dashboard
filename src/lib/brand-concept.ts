export type BrandConcept = {
  summary: string;
  personality: string;
  visualStyle: string;
  photographyStyle: string;
  typographyStyle?: string;
  layoutGuidelines?: string;
  sampleVisualUrl?: string;
  sampleVisualPrompt?: string;
  groundColor?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  updatedAt: string;
};

export const emptyBrandConcept: BrandConcept = {
  summary: "",
  personality: "",
  visualStyle: "",
  photographyStyle: "",
  typographyStyle: "Başlık: Montserrat / Poppins (Bold/Black), Gövde: Inter / Plus Jakarta Sans (Regular/Medium)",
  layoutGuidelines: "%60 Ferah zemin, %30 Koyu tipografik yapı, %10 Marka vurgu rengi (60-30-10 Kuralı). 120px güvenli marjin.",
  sampleVisualUrl: "",
  sampleVisualPrompt: "",
  groundColor: "#FDFBF7",
  primaryColor: "#6d5dfc",
  secondaryColor: "#171826",
  accentColor: "#ffffff",
  updatedAt: "",
};

export function normalizeBrandConcept(value?: Partial<BrandConcept> | null): BrandConcept {
  return { ...emptyBrandConcept, ...(value || {}) };
}

export function brandConceptInstruction(concept: Partial<BrandConcept> | null | undefined) {
  if (!concept?.summary) return "Marka konsepti henüz tanımlı değil; marka bilgilerine uygun, temiz ve güvenilir bir görsel dil kullan.";
  return [
    `Marka konsepti: ${concept.summary}`,
    concept.personality && `Marka karakteri: ${concept.personality}`,
    concept.visualStyle && `Görsel dil: ${concept.visualStyle}`,
    concept.photographyStyle && `Fotoğraf yaklaşımı: ${concept.photographyStyle}`,
    concept.typographyStyle && `Tipografi kuralı: ${concept.typographyStyle}`,
    concept.layoutGuidelines && `Yerleşim ve renk dengesi: ${concept.layoutGuidelines}`,
    `Renk sistemi: ${concept.groundColor ? `zemin ${concept.groundColor}, ` : ""}${concept.primaryColor || "belirtilmedi"}, ${concept.secondaryColor || "belirtilmedi"}, vurgu ${concept.accentColor || "belirtilmedi"}`,
    concept.sampleVisualUrl && `Referans anahtar stil panosu mevcuttur; renk, aydınlatma ve atmosfer bütünlüğünü bu stile sadık tut.`,
  ].filter(Boolean).join("\n");
}
