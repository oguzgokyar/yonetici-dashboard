export type ColumnType = "vertical_video" | "carousel" | "single_post" | "engagement";

export type IdeaType =
  | "benefit"
  | "problem_solution"
  | "brand_awareness"
  | "service_promo"
  | "campaign_discount";

export const IDEA_TYPE_LABELS: Record<
  IdeaType,
  { label: string; badge: string; icon: string; color: string; bg: string }
> = {
  benefit: {
    label: "Fayda Odaklı",
    badge: "Fayda",
    icon: "💡",
    color: "#0284c7",
    bg: "#f0f9ff",
  },
  problem_solution: {
    label: "Problem & Çözüm",
    badge: "Problem Çözüm",
    icon: "🎯",
    color: "#7c3aed",
    bg: "#faf5ff",
  },
  brand_awareness: {
    label: "Marka Bilinirliği",
    badge: "Bilinirlik",
    icon: "🌟",
    color: "#d97706",
    bg: "#fffbeb",
  },
  service_promo: {
    label: "Hizmet / Ürün Tanıtımı",
    badge: "Hizmet Tanıtımı",
    icon: "🚀",
    color: "#059669",
    bg: "#ecfdf5",
  },
  campaign_discount: {
    label: "Kampanya & İndirim",
    badge: "Kampanya & Fırsat",
    icon: "🏷️",
    color: "#e11d48",
    bg: "#fff1f2",
  },
};
