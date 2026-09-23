import React from "react";
import { Composition } from "remotion";
import { AnimatedCreative } from "./AnimatedCreative";
import { defaultAnimatedCreativeProps, type AnimatedCreativeProps } from "./types";
import { StockFramedVideo, defaultStockFramedProps } from "./StockFramedVideo";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="AnimatedCreative"
        component={AnimatedCreative}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={240}
        defaultProps={defaultAnimatedCreativeProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: (props as AnimatedCreativeProps).durationSeconds * 30,
        })}
      />
      <Composition
        id="StockFramedVideo"
        component={StockFramedVideo}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={450}
        defaultProps={defaultStockFramedProps}
      />
    </>
  );
}
