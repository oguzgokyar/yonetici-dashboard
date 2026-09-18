import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimatedCreativeProps, LayerBox, MotionStyle, TextLayer, VisualLayer } from "./types";

function boxStyle(box: LayerBox): React.CSSProperties {
  return { position: "absolute", left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` };
}

function styleFactor(style: MotionStyle) { return style === "energetic" ? 1.35 : style === "minimal" ? .7 : 1; }

function VisualObject({ layer, style }: { layer: VisualLayer; style: MotionStyle }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const force = styleFactor(style);
  const p = spring({ frame: frame - layer.delay, fps, config: { damping: style === "energetic" ? 10 : 16, stiffness: 110 * force, mass: .9 } });
  const drift = Math.sin((frame + layer.delay) / (fps * 1.6)) * 7 * force;
  const pulse = .5 + Math.sin((frame + layer.delay) / (fps * 1.25)) * .5;
  const transforms: Record<VisualLayer["effect"], string> = {
    parallax: `translate3d(${(1 - p) * -75 * force}px, ${drift}px, 0) scale(${1.025 + (1 - p) * .05})`,
    float: `translate3d(0, ${(1 - p) * 85 + drift}px, 0) scale(${.97 + p * .03})`,
    scale: `scale(${.82 + p * .18})`,
    glow: `translate3d(0, ${(1 - p) * 28}px, 0) scale(${.94 + p * .06})`,
    reveal: "none",
    fade: "none",
    ambient: "none",
  };
  const isAmbient = layer.effect === "ambient";
  const clipPath = layer.effect === "reveal" ? `inset(0 ${(1 - p) * 100}% 0 0)` : undefined;
  const filter = isAmbient
    ? `brightness(${1.02 + pulse * .13}) saturate(${1.01 + pulse * .09}) drop-shadow(0 0 ${8 + pulse * 18}px rgba(255,255,255,.16))`
    : `blur(${(1 - p) * (layer.effect === "fade" ? 5 : 10)}px) drop-shadow(0 18px 34px rgba(0,0,0,.2))`;
  return <AbsoluteFill style={{ opacity: isAmbient ? .035 + pulse * .045 : p, transform: transforms[layer.effect], filter, clipPath }}><Img src={layer.src} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></AbsoluteFill>;
}

function AnimatedText({ layer, style, index, accentColor }: { layer: TextLayer; style: MotionStyle; index: number; accentColor: string }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const force = styleFactor(style); const delay = 25 + index * 13;
  const p = spring({ frame: frame - delay, fps, config: { damping: layer.kind === "cta" ? 11 : 17, stiffness: (layer.kind === "headline" ? 135 : 105) * force, mass: .82 } });
  const isCta = layer.kind === "cta"; const words = layer.kind === "headline" ? layer.text.split(/\s+/) : [layer.text];
  return <div style={{ ...boxStyle(layer.box), display: "flex", alignItems: "center", justifyContent: layer.align === "center" ? "center" : layer.align === "right" ? "flex-end" : "flex-start", textAlign: layer.align, color: layer.color, fontFamily: '"Manrope", Arial, sans-serif', fontSize: layer.fontSize, fontWeight: layer.fontWeight, lineHeight: 1.12, opacity: p, transform: isCta ? `scale(${.72 + p * .28})` : `translate3d(0, ${(1 - p) * 46 * force}px, 0)`, filter: `blur(${(1 - p) * 8}px)`, padding: isCta ? "0 34px" : 0, borderRadius: isCta ? 999 : 0, background: isCta ? accentColor : "transparent", boxShadow: isCta ? `0 14px 45px ${accentColor}55` : "none", overflow: isCta ? "hidden" : "visible" }}>
    {layer.kind === "headline" ? <span>{words.map((word, wordIndex) => { const wp = interpolate(frame, [delay + wordIndex * 3, delay + 12 + wordIndex * 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); return <span key={`${word}-${wordIndex}`} style={{ display: "inline-block", marginRight: ".24em", opacity: wp, transform: `translateY(${(1 - wp) * 28}px)` }}>{word}</span>; })}</span> : <span>{layer.text}</span>}
    {isCta && <span style={{ position: "absolute", inset: 0, transform: `translateX(${interpolate(frame, [delay, delay + 40], [-120, 140], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%) skewX(-18deg)`, background: "linear-gradient(90deg,transparent,#ffffff55,transparent)", width: "38%" }} />}
  </div>;
}

export function AnimatedCreative(props: AnimatedCreativeProps) {
  const { imageSrc, backgroundSrc, visualLayers = [], contentGradient, logoSrc, logoBox, textLayers = [], motionStyle, accentColor, designAspectRatio = 9 / 16 } = props;
  const frame = useCurrentFrame(); const { fps, durationInFrames, width, height } = useVideoConfig();
  const intro = interpolate(frame, [0, fps * .65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outro = interpolate(frame, [durationInFrames - fps * .7, durationInFrames - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgZoom = 1;
  const logoP = spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 115 } });
  const layered = Boolean(backgroundSrc && (visualLayers.length || textLayers.length || logoSrc));
  if (!imageSrc && !backgroundSrc) return <AbsoluteFill style={{ background: "#11131b" }} />;
  if (!layered) return <AbsoluteFill style={{ background: "#0c0e15" }}><Img src={imageSrc} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></AbsoluteFill>;

  const stageWidth = Math.min(width, height * designAspectRatio); const stageHeight = stageWidth / designAspectRatio;
  return <AbsoluteFill style={{ background: "#080a10", overflow: "hidden", opacity: outro }}>
    <AbsoluteFill style={{ opacity: .42 * intro, filter: "blur(32px) brightness(.52)" }}><Img src={backgroundSrc!} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></AbsoluteFill>
    <div style={{ position: "absolute", width: stageWidth, height: stageHeight, left: (width - stageWidth) / 2, top: (height - stageHeight) / 2, overflow: "hidden", boxShadow: "0 28px 90px rgba(0,0,0,.34)" }}>
      <AbsoluteFill style={{ transform: `scale(${bgZoom})`, opacity: intro }}><Img src={backgroundSrc!} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.04) contrast(1.02)" }} /></AbsoluteFill>
      {visualLayers.filter((layer) => layer.effect === "ambient").map((layer) => <VisualObject key={layer.id} layer={layer} style={motionStyle} />)}
      {contentGradient && <AbsoluteFill style={{ background: contentGradient, opacity: intro }} />}
      {visualLayers.filter((layer) => layer.effect !== "ambient").map((layer) => <VisualObject key={layer.id} layer={layer} style={motionStyle} />)}
      {logoSrc && logoBox && <div style={{ ...boxStyle(logoBox), opacity: logoP, transform: `translateY(${(1 - logoP) * -45}px) scale(${.9 + logoP * .1})`, filter: `blur(${(1 - logoP) * 8}px)` }}><Img src={logoSrc} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>}
      {textLayers.map((layer, index) => <AnimatedText key={layer.id} layer={layer} style={motionStyle} index={index} accentColor={accentColor} />)}
    </div>
  </AbsoluteFill>;
}
