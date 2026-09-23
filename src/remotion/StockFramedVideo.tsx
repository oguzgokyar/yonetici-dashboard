import React from "react";
import { AbsoluteFill, Audio, Img, spring, useCurrentFrame, useVideoConfig, Video } from "remotion";

export type StockFrameStyle = "blur_padding" | "modern_card" | "split_screen" | "minimal_glow";

export type StockFramedVideoProps = {
  videoSrc: string;
  frameStyle: StockFrameStyle;
  headline?: string;
  subtitle?: string;
  headlineColor?: string;
  accentColor?: string;
  logoSrc?: string;
  logoPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "bottom_center" | "none";
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
  accentColor: "#6d5dfc",
  logoPosition: "top_right",
  originalVolume: 1,
  musicVolume: 0.5,
};

export function StockFramedVideo({
  videoSrc,
  frameStyle = "blur_padding",
  headline = "",
  subtitle = "",
  headlineColor = "#ffffff",
  accentColor = "#6d5dfc",
  logoSrc,
  logoPosition = "top_right",
  musicSrc,
  originalVolume = 1,
  musicVolume = 0.5,
}: StockFramedVideoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for headline
  const headlineSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  // Entrance for logo
  const logoSpring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, stiffness: 110 },
  });

  const titleText = (headline || "").trim();
  const subText = (subtitle || "").trim();

  // Logo position styles
  const getLogoStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      zIndex: 30,
      opacity: logoSpring,
      transform: `scale(${0.85 + logoSpring * 0.15})`,
      maxHeight: 80,
      maxWidth: 160,
      filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.5))",
    };

    switch (logoPosition) {
      case "top_left":
        return { ...base, top: 40, left: 40 };
      case "top_right":
        return { ...base, top: 40, right: 40 };
      case "bottom_left":
        return { ...base, bottom: 50, left: 40 };
      case "bottom_right":
        return { ...base, bottom: 50, right: 40 };
      case "bottom_center":
        return { ...base, bottom: 50, left: "50%", transform: `translateX(-50%) scale(${0.85 + logoSpring * 0.15})` };
      default:
        return { display: "none" };
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#090a10", overflow: "hidden" }}>
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

      {/* Branded Logo Overlay */}
      {logoSrc && logoPosition !== "none" && (
        <div style={getLogoStyle()}>
          <Img src={logoSrc} style={{ maxHeight: 75, maxWidth: 150, objectFit: "contain" }} />
        </div>
      )}

      {/* Branded Headline & Subtitle Card Overlay */}
      {(titleText || subText) && (
        <div
          style={{
            position: "absolute",
            top: frameStyle === "split_screen" ? 70 : 120,
            left: "50%",
            transform: `translateX(-50%) translateY(${(1 - headlineSpring) * -40}px)`,
            opacity: headlineSpring,
            width: "84%",
            maxWidth: 900,
            zIndex: 25,
            padding: "20px 28px",
            borderRadius: 22,
            background: "rgba(10, 12, 20, 0.78)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: `1.5px solid ${accentColor}66`,
            boxShadow: `0 18px 45px rgba(0,0,0,0.55), 0 0 20px ${accentColor}22`,
            textAlign: "center",
          }}
        >
          {titleText && (
            <h1
              style={{
                margin: 0,
                color: headlineColor,
                fontFamily: '"Manrope", "DM Sans", Arial, sans-serif',
                fontSize: 34,
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
                color: "#cbd5e1",
                fontFamily: '"DM Sans", Arial, sans-serif',
                fontSize: 20,
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
    </AbsoluteFill>
  );
}
