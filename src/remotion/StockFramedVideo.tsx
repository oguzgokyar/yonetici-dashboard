import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, spring, useCurrentFrame, useVideoConfig, Video } from "remotion";

export type StockFrameStyle = "blur_padding" | "modern_card" | "split_screen" | "minimal_glow";

export type StockFramedVideoProps = {
  videoSrc?: string;
  frameStyle?: StockFrameStyle;
  headline?: string;
  subtitle?: string;
  headlineColor?: string;
  subtitleColor?: string;
  headlineFontSize?: number;
  subtitleFontSize?: number;
  headlineBgColor?: string;
  accentColor?: string;
  logoSrc?: string;
  logoPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "bottom_center" | "none";
  logoSize?: number;
  showBrandName?: boolean;
  brandNameText?: string;
  brandNameLayout?: "row" | "stack";
  brandNameColor?: string;
  customOverlaySrc?: string;
  outroSrc?: string;
  musicSrc?: string;
  originalVolume?: number;
  musicVolume?: number;
};

export const defaultStockFramedProps: StockFramedVideoProps = {
  videoSrc: "",
  frameStyle: "blur_padding",
  headline: "Öne Çıkan Başlık",
  subtitle: "Doğal ve etkileyici anlar",
  headlineColor: "#ffffff",
  subtitleColor: "#cbd5e1",
  headlineFontSize: 34,
  subtitleFontSize: 20,
  headlineBgColor: "rgba(10, 12, 20, 0.78)",
  accentColor: "#6d5dfc",
  logoPosition: "top_right",
  logoSize: 130,
  showBrandName: false,
  brandNameText: "",
  brandNameLayout: "row",
  brandNameColor: "#ffffff",
  originalVolume: 1,
  musicVolume: 0.5,
};

export function StockFramedVideo({
  videoSrc,
  frameStyle = "blur_padding",
  headline = "",
  subtitle = "",
  headlineColor = "#ffffff",
  subtitleColor = "#cbd5e1",
  headlineFontSize = 34,
  subtitleFontSize = 20,
  headlineBgColor = "rgba(10, 12, 20, 0.78)",
  accentColor = "#6d5dfc",
  logoSrc,
  logoPosition = "top_right",
  logoSize = 130,
  showBrandName = false,
  brandNameText = "",
  brandNameLayout = "row",
  brandNameColor = "#ffffff",
  customOverlaySrc,
  outroSrc,
  musicSrc,
  originalVolume = 1,
  musicVolume = 0.5,
}: StockFramedVideoProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const outroDurationFrames = outroSrc ? 90 : 0;
  const mainDuration = Math.max(30, durationInFrames - outroDurationFrames);

  // Entrance spring for headline
  const headlineSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  // Entrance for logo & brand
  const logoSpring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, stiffness: 110 },
  });

  const titleText = (headline || "").trim();
  const subText = (subtitle || "").trim();
  const brandText = (brandNameText || "").trim();
  const hasTopBrand = (logoPosition === "top_left" || logoPosition === "top_right") &&
    Boolean(logoSrc || (showBrandName && brandText));

  // Logo position container styles
  const getLogoContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      zIndex: 35,
      opacity: logoSpring,
      transform: `scale(${0.85 + logoSpring * 0.15})`,
      display: "flex",
      alignItems: "center",
      filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.6))",
      flexDirection: brandNameLayout === "stack" ? "column" : "row",
      gap: brandNameLayout === "stack" ? 6 : 12,
    };

    switch (logoPosition) {
      case "top_left":
        return { ...base, top: 40, left: 40 };
      case "top_right":
        return {
          ...base,
          top: 40,
          right: 40,
          flexDirection: brandNameLayout === "stack" ? "column" : "row-reverse",
        };
      case "bottom_left":
        return { ...base, bottom: 50, left: 40 };
      case "bottom_right":
        return {
          ...base,
          bottom: 50,
          right: 40,
          flexDirection: brandNameLayout === "stack" ? "column" : "row-reverse",
        };
      case "bottom_center":
        return {
          ...base,
          bottom: 50,
          left: "50%",
          transform: `translateX(-50%) scale(${0.85 + logoSpring * 0.15})`,
          flexDirection: "column",
          alignItems: "center",
        };
      default:
        return { display: "none" };
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#090a10", overflow: "hidden" }}>
      <Sequence from={0} durationInFrames={mainDuration}>
        {/* Background blurred video */}
        {videoSrc && (
          <AbsoluteFill
            style={{
              filter: "blur(32px) brightness(0.48) saturate(1.2)",
              transform: "scale(1.15)",
            }}
          >
            <Video
              src={videoSrc}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        )}

        {/* Foreground container according to frame style */}
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {frameStyle === "blur_padding" && (
            <div
              style={{
                width: "92%",
                height: "88%",
                borderRadius: 24,
                overflow: "hidden",
                border: `2px solid ${accentColor}55`,
                boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
                position: "relative",
              }}
            >
              {videoSrc && (
                <Video
                  src={videoSrc}
                  volume={originalVolume}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
          )}

          {frameStyle === "modern_card" && (
            <div
              style={{
                width: "88%",
                height: "82%",
                borderRadius: 32,
                overflow: "hidden",
                border: `3px solid ${accentColor}88`,
                boxShadow: `0 30px 90px rgba(0,0,0,0.7), 0 0 40px ${accentColor}33`,
                position: "relative",
              }}
            >
              {videoSrc && (
                <Video
                  src={videoSrc}
                  volume={originalVolume}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
          )}

          {frameStyle === "split_screen" && (
            <div
              style={{
                width: "94%",
                height: "68%",
                borderRadius: 20,
                overflow: "hidden",
                border: `2px solid ${accentColor}44`,
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                position: "relative",
              }}
            >
              {videoSrc && (
                <Video
                  src={videoSrc}
                  volume={originalVolume}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
          )}

          {frameStyle === "minimal_glow" && (
            <div
              style={{
                width: "96%",
                height: "94%",
                borderRadius: 16,
                overflow: "hidden",
                border: `1.5px solid ${accentColor}`,
                boxShadow: `0 0 25px ${accentColor}55`,
                position: "relative",
              }}
            >
              {videoSrc && (
                <Video
                  src={videoSrc}
                  volume={originalVolume}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
          )}
        </AbsoluteFill>

        {/* Custom PNG Overlay Frame (If chosen) */}
        {customOverlaySrc && (
          <AbsoluteFill style={{ zIndex: 25, pointerEvents: "none" }}>
            <Img
              src={customOverlaySrc}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        )}

        {/* Brand Logo & Brand Name Badge */}
        {logoPosition !== "none" && (logoSrc || (showBrandName && brandText)) && (
          <div style={getLogoContainerStyle()}>
            {logoSrc && (
              <Img
                src={logoSrc}
                style={{
                  maxWidth: logoSize,
                  maxHeight: Math.round(logoSize * 0.75),
                  objectFit: "contain",
                }}
              />
            )}
            {showBrandName && brandText && (
              <span
                style={{
                  color: brandNameColor,
                  fontFamily: '"DejaVu Sans", Arial, sans-serif',
                  fontWeight: 800,
                  fontSize: Math.max(16, Math.min(Math.round(logoSize * 0.22), 30)),
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                  whiteSpace: "nowrap",
                }}
              >
                {brandText}
              </span>
            )}
          </div>
        )}

        {/* Headline & Subtitle Banner Card */}
        {(titleText || subText) && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: hasTopBrand ? 250 : frameStyle === "split_screen" ? 70 : 120,
              transform: `translateX(-50%) translateY(${(1 - headlineSpring) * -30}px) scale(${0.9 + headlineSpring * 0.1})`,
              opacity: headlineSpring,
              zIndex: 20,
              width: "86%",
              maxWidth: 920,
              backgroundColor: headlineBgColor,
              borderRadius: 22,
              padding: "18px 28px",
              boxShadow: "0 18px 50px rgba(0,0,0,0.65), 0 0 20px rgba(0,0,0,0.3)",
              border: `1.5px solid ${accentColor}66`,
              textAlign: "center",
              backdropFilter: "blur(12px)",
            }}
          >
            {titleText && (
              <h1
                style={{
                  margin: 0,
                  color: headlineColor,
                  fontFamily: '"DejaVu Sans", Arial, sans-serif',
                  fontSize: headlineFontSize || 34,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                }}
              >
                {titleText}
              </h1>
            )}
            {subText && (
              <p
                style={{
                  margin: "8px 0 0",
                  color: subtitleColor,
                  fontFamily: '"DejaVu Sans", Arial, sans-serif',
                  fontSize: subtitleFontSize || 20,
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {subText}
              </p>
            )}
          </div>
        )}

        {/* Background Music Audio track */}
        {musicSrc && (
          <Audio src={musicSrc} volume={musicVolume} loop />
        )}
      </Sequence>

      {/* Outro Video Sequence at the end */}
      {outroSrc && (
        <Sequence from={mainDuration} durationInFrames={outroDurationFrames}>
          <AbsoluteFill style={{ backgroundColor: "#000000" }}>
            <Video
              src={outroSrc}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </AbsoluteFill>
        </Sequence>
      )}
    </AbsoluteFill>
  );
}
