export type MotionStyle = "minimal" | "premium" | "energetic";
export type LayerEffect = "parallax" | "float" | "scale" | "glow" | "reveal" | "fade" | "ambient";
export type TextLayerKind = "headline" | "body" | "cta" | "brand" | "contact";

export type LayerBox = { x: number; y: number; width: number; height: number };
export type VisualLayer = { id: string; name: string; src: string; effect: LayerEffect; delay: number };
export type TextLayer = { id: string; kind: TextLayerKind; text: string; box: LayerBox; color: string; fontSize: number; fontWeight: number; align: "left" | "center" | "right" };

export type AnimatedCreativeProps = {
  imageSrc: string;
  backgroundSrc?: string;
  visualLayers?: VisualLayer[];
  contentGradient?: string;
  logoSrc?: string;
  logoBox?: LayerBox;
  textLayers?: TextLayer[];
  designAspectRatio?: number;
  durationSeconds: 6 | 8 | 10;
  motionStyle: MotionStyle;
  accentColor: string;
};

export const defaultAnimatedCreativeProps: AnimatedCreativeProps = {
  imageSrc: "",
  durationSeconds: 8,
  motionStyle: "premium",
  accentColor: "#6d5dfc",
  visualLayers: [],
  textLayers: [],
};
