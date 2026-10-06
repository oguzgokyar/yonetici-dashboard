import { openBrowser } from '@remotion/renderer';
const base = process.env.UI_SMOKE_BASE || 'http://127.0.0.1:3199';
const executable = process.env.UI_SMOKE_BROWSER || '/opt/data/browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await openBrowser('chrome', { browserExecutable: executable });
try {
 const page = await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
 const errors=[]; page.on('error',e=>errors.push(e.message));
 const waitFor=async fn=>{const end=Date.now()+30000;while(Date.now()<end){if(await page.evaluate(fn))return;await new Promise(r=>setTimeout(r,150));}throw Error('DOM condition timeout');};
 await page.setViewport({width:1280,height:900,deviceScaleFactor:1});
 await page.goto({url:base+'/settings',timeout:45000});
 await waitFor(()=>document.body.innerText.includes('Müzik Kaynakları'));
 if(process.env.UI_SMOKE_ADMIN_TOKEN){
  await page.evaluate(async token=>{const r=await fetch('/api/settings/music/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!r.ok)throw Error('Synthetic administrator unlock failed');},process.env.UI_SMOKE_ADMIN_TOKEN);
  await page.goto({url:base+'/settings',timeout:45000});
  await waitFor(()=>document.querySelectorAll('.music-provider-card').length===2);
 }
 if(await page.evaluate(()=>Boolean(document.querySelector('.music-provider-unlock')))){
  const guard=await fetch(base+'/api/settings/music/youtube');
  if(guard.status!==401 && guard.status!==503)throw Error('Locked settings API must reject access');
  console.log('admin gate visible, provider GET protected',guard.status);
  console.log('Read-only UI smoke passed for locked management; credential forms require administrator consent.');
 } else {
 const desktop=await page.evaluate(()=>({musicCards:document.querySelectorAll('.music-provider-card').length,secrets:[...document.querySelectorAll('.music-provider-card input[type=password]')].every(e=>e.value===''),hasGoogle:document.body.innerText.includes('Google ile bağlan'),hasMeta:document.body.innerText.includes('Meta ile bağlan')}));
 if(desktop.musicCards!==2 || !desktop.secrets || !desktop.hasGoogle || !desktop.hasMeta) throw Error('Settings cards contract failed: '+JSON.stringify(desktop));
 for(const width of [390,375]){
  await page.setViewport({width,height:844,deviceScaleFactor:1});
  const geometry=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,cards:[...document.querySelectorAll('.music-provider-card')].map(e=>({width:e.getBoundingClientRect().width,scroll:e.scrollWidth}))}));
  if(geometry.overflow)throw Error('Mobile settings overflow: '+JSON.stringify(geometry));
  console.log('mobile settings',geometry);
 }
 if(errors.length)throw Error('Browser errors '+errors.join(';'));
 console.log('settings desktop',desktop);
 }
 console.log('Read-only UI smoke passed; no credentials saved, consent initiated, or external posts created.');
} finally { await browser.close({silent:true}); }
