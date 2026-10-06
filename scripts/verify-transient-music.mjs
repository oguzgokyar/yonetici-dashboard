import { registerHooks } from 'node:module';
import { mkdtemp, rm, writeFile, access, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

// Isolated test video/DB records; music is fetched from the actual external source.
const root = resolve('.');
const workspace = await mkdtemp(join(tmpdir(), 'stock-music-live-'));
const originalCwd = process.cwd();
const videoPath = join(workspace, 'source.mp4');
const fixtureUrl = new URL('./fixture-state.mjs', `file://${workspace}/`).href;
await writeFile(join(workspace, 'fixture-state.mjs'), `export function getDatabase() { return { prepare(sql) { return { get(...args) { if(sql.includes('stock_videos')) return {id:'test-stock',name:'Isolated smoke test',drive_file_id:'test-drive',duration_seconds:2.4,metadata_json:'{}'}; if(sql.includes('projects')) return {id:'test-project',brand_json:'{}'}; return undefined; }, run() {}, all(){return [];} }; } }; } export async function ensureCachedVideo() {return {localPath:${JSON.stringify(videoPath)}};}`);
registerHooks({resolve(specifier, context, nextResolve) {
  if(specifier === 'server-only') return {url:'data:text/javascript,export {};',shortCircuit:true};
  if(specifier === '@/lib/server/database' || specifier === '@/lib/server/google-drive') return {url:fixtureUrl,shortCircuit:true};
  if(specifier.startsWith('@/')) return {url:new URL(`file://${root}/src/${specifier.slice(2)}.ts`).href,shortCircuit:true};
  if(specifier.startsWith('.') && context.parentURL?.includes('/src/') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier+'.ts',context);
  return nextResolve(specifier,context);
}});
try {
  execFileSync('/usr/bin/ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=navy:s=180x320:r=30:d=2.4','-c:v','libx264','-pix_fmt','yuv420p',videoPath]);
  const { searchMusic } = await import('../src/lib/server/music-discovery.ts');
  const result = await searchMusic({projectId:'test-project',provider:'youtube',query:'piano'});
  const track = result.items.find(item=>item.canEmbed);
  if(!track) throw new Error('No live licensed selectable result: '+result.message);
  console.log(JSON.stringify({title:track.title,source:track.sourceUrl,canEmbed:track.canEmbed,isTrending:track.isTrending,attribution:track.attribution}));
  const before = (await readdir(tmpdir())).filter(n=>n.startsWith('transient-music-')).sort();
  process.chdir(workspace);
  const {renderFramedStockVideo} = await import('../src/lib/server/stock-video-renderer.ts');
  const output = await renderFramedStockVideo({projectId:'test-project',stockVideoId:'test-stock',frameStyle:'none',logoPosition:'none',musicSelection:{track,offsetSeconds:1},originalVolume:0,musicVolume:0.4});
  const outputPath=join(workspace,'.data','video-renders',output.id+'.mp4');
  await access(outputPath);
  const probe=JSON.parse(execFileSync('/usr/bin/ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,duration:format=duration','-of','json',outputPath],{encoding:'utf8'}));
  if(!probe.streams.some(s=>s.codec_type==='audio'))throw new Error('Missing output audio');
  if(Math.abs(Number(probe.format.duration)-2.4)>0.1)throw new Error('Output duration mismatch');
  const after=(await readdir(tmpdir())).filter(n=>n.startsWith('transient-music-')).sort();
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Temporary music cleanup failed');
  console.log(JSON.stringify({outputDuration:output.durationSeconds,streams:probe.streams,temporaryAudioRemoved:true,metadataCredit:output.metadata.music?.attribution}));
} finally {process.chdir(originalCwd);await rm(workspace,{recursive:true,force:true});}
