import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { AnimatedCreativeProps } from "@/remotion/types";

const execFileAsync = promisify(execFile);

export async function renderAnimatedCreative(id: string, props: AnimatedCreativeProps) {
  const projectDir = process.cwd();
  const outputDir = path.join(projectDir, ".data", "video-renders");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputLocation = path.join(outputDir, `${id}.mp4`);
  const propsLocation = path.join(outputDir, `${id}.props.json`);
  const cliLocation = path.join(projectDir, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const entryPoint = path.join(projectDir, "src", "remotion", "index.ts");

  fs.writeFileSync(propsLocation, JSON.stringify(props));

  try {
    await execFileAsync(
      process.execPath,
      [
        cliLocation,
        "render",
        entryPoint,
        "AnimatedCreative",
        outputLocation,
        `--props=${propsLocation}`,
        "--codec=h264",
        "--overwrite",
        "--log=error",
      ],
      {
        cwd: projectDir,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  } finally {
    fs.rmSync(propsLocation, { force: true });
  }

  return outputLocation;
}
