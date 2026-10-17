import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

type Audio = { label: string; clipId: string; phantom?: boolean; scene: number; startSeconds: number; durationMs: number };
type Layer = { scene: number; sceneDurations: number[]; audio: Audio[]; captions: {label: string; linked: string}[] };
export type NativeVidsMetadata = {jobId: string; exportSource: string; downloadState: string; downloadGuid: string; frameId: string; documentFrameId: string; googleVidsUrl: string; sha256: string; sizeBytes: number; layers: Layer[]};
type NativeRequest = {aspectRatio?: string; durationSeconds?: number; scenes?: {voiceoverTr?: string; durationSeconds?: number}[]; musicSpec?: {musicPromptEn?: string}};
export function validateGoogleVidsNativeArtifact(file: string, raw: unknown, jobId: string, request: NativeRequest) {
 const m = raw as NativeVidsMetadata;
 if (!m || m.jobId !== jobId || m.exportSource !== "google-vids-native" || m.downloadState !== "completed" || !m.downloadGuid || !m.frameId || !m.documentFrameId || !/^https:\/\/docs\.google\.com\/videos\/d\/[^/]+\/edit/.test(m.googleVidsUrl || "")) throw Error("Native download evidence missing");
 const bytes = readFileSync(file); const sha256 = createHash("sha256").update(bytes).digest("hex");
 if (m.sha256 !== sha256 || m.sizeBytes !== bytes.length) throw Error("Native artifact hash/size mismatch");
 const scenes = request.scenes || [];
 if (!scenes.length || !Array.isArray(m.layers)) throw Error("Native layer evidence missing");
 let start = 0;
 for (const [idx, scene] of scenes.entries()) {
  const layer = m.layers.find(l => l.scene === idx+1);
  const duration = scene.durationSeconds || 10;
  if (!layer || JSON.stringify(layer.sceneDurations) !== JSON.stringify(scenes.map(s=>s.durationSeconds || 10))) throw Error("Native scene duration mismatch");
  const prefix = (scene.voiceoverTr || "").replace(/[^\p{L}\p{N}\s]+/gu, "").trim().split(/\s+/).slice(0,3).join(" ").toLocaleLowerCase();
  if (prefix && (!layer.audio.some(a=>!a.phantom && a.clipId && a.scene === idx+1 && a.startSeconds === start && a.durationMs > 0 && a.durationMs <= duration*1000+100 && a.label.replace(/[^\p{L}\p{N}\s]+/gu, "").toLocaleLowerCase().includes(prefix)) || !layer.captions.some(c=>c.linked?.replace(/[^\p{L}\p{N}\s]+/gu, "").toLocaleLowerCase().includes(prefix)))) throw Error("Native narrator/caption evidence missing");
  start += duration;
 }
 if (request.musicSpec?.musicPromptEn && !m.layers[0].audio.some(a=>!a.phantom && a.clipId && a.scene === 1 && a.startSeconds <= 1.5 && a.durationMs >= (start - 3)*1000 && !a.label.toLowerCase().includes("nyla"))) throw Error("Native music coverage missing");
 const probe = JSON.parse(execFileSync("ffprobe", ["-v","error","-show_entries","stream=codec_type,width,height:format=duration","-of","json",file], {timeout:15000,encoding:"utf8"}));
 const video = probe.streams.find((s: {codec_type: string})=>s.codec_type === "video");
 const ratio = request.aspectRatio || "9:16"; const dimensions = ratio === "9:16" ? [1080,1920] : ratio === "1:1" ? [1080,1080] : [1920,1080];
 if (!video || video.width !== dimensions[0] || video.height !== dimensions[1] || Math.abs(Number(probe.format.duration)-start)>0.3 || !probe.streams.some((s: {codec_type: string})=>s.codec_type === "audio")) throw Error("Native media probe mismatch");
 const captions = execFileSync("ffmpeg", ["-v","error","-i",file,"-map","0:s:0","-f","srt","-"], {timeout:15000,encoding:"utf8"});
 const normalize = (text:string)=>text.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu," ").trim();
 const transcript = normalize(captions.replace(/^\d+\s*$|^.*-->.*$/gm,""));
 for (const scene of scenes) {
  const firstSentence = normalize((scene.voiceoverTr || "").split(/[.!?]/)[0]);
  const prefix = (scene.voiceoverTr || "").replace(/[^\p{L}\p{N}\s]+/gu, "").trim().split(/\s+/).slice(0,3).join(" ").toLocaleLowerCase();
  if (scene.voiceoverTr && !transcript.includes(firstSentence) && !transcript.includes(prefix)) throw Error("Native caption transcript incomplete");
 }
 return {...m,sha256};
}
