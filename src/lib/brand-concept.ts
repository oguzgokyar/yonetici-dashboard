export type BrandConcept = {
  summary: string;
  personality: string;
  visualStyle: string;
  photographyStyle: string;
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
    `Renk sistemi: ${concept.primaryColor || "belirtilmedi"}, ${concept.secondaryColor || "belirtilmedi"}, vurgu ${concept.accentColor || "belirtilmedi"}`,
  ].filter(Boolean).join("\n");
}
