import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {};', shortCircuit: true };
  if (specifier === './licensed-music') return { url: new URL('../src/lib/server/licensed-music.ts', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { parseLicensedTrack } = await import('../src/lib/server/licensed-music.ts');
// Reduced real Home Was You HTML shape inspected over network; not live music evidence.
const page = (slug = 'home-was-you', title = 'Home Was You') => `<link rel="canonical" href="https://www.scottbuckley.com.au/library/${slug}/"><article><h1 class="post-title pad">${title}</a></h1><div class="entry"><a href="https://www.scottbuckley.com.au/library/wp-content/uploads/2026/07/HomeWasYou.mp3" download="HomeWasYou.mp3">MP3 (Full Mix)</a><a href="http://creativecommons.org/licenses/by/4.0/" rel="license">CC</a>This work is licensed under a Creative Commons Attribution 4.0 International License<h5>Attribution format:</h5><pre>'${title}' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au</pre></div></article>`;
test('track page verifies specific CC BY 4 download and preserves full official attribution', () => {
  const item = parseLicensedTrack(page(), 'home-was-you', 'instagram');
  assert.equal(item.id, 'sb:home-was-you');
  assert.equal(item.title, 'Home Was You');
  assert.equal(item.provider, 'instagram');
  assert.equal(item.artist, 'Scott Buckley');
  assert.equal(item.previewUrl, 'https://www.scottbuckley.com.au/library/wp-content/uploads/2026/07/HomeWasYou.mp3');
  assert.equal(item.canEmbed, true);
  assert.equal(item.isTrending, false);
  assert.equal(item.sourceKind, 'licensed-alternative');
  assert.match(item.attribution, /'Home Was You' by Scott Buckley - released under CC-BY 4.0\. www.scottbuckley.com.au/);
  assert.match(item.attribution, /https:\/\/creativecommons.org\/licenses\/by\/4.0\//);
  assert.match(item.attribution, /Uyarlama/);
});
test('both provider tabs fall back to licensed audio; native results stay blocked; resolver ignores all client rights', async () => {
  const { createMusicDiscovery } = await import('../src/lib/server/music-discovery.ts');
  const fetch = async url => {
    const u = new URL(url);
    if (u.hostname === 'www.googleapis.com') return Response.json({ items: [{ id: { videoId: 'abcdefghijk' }, snippet: { title: 'Native music' } }] });
    if (u.pathname.includes('wp-json')) return Response.json([{ slug: 'home-was-you', status: 'publish', type: 'post', link: 'https://www.scottbuckley.com.au/library/home-was-you/', title: { rendered: 'Home Was You' }, content: { rendered: page().match(/<div class="entry">([\s\S]*?)<\/div>/)[1], protected: false } }]);
    return new Response(page());
  };
  const service = key => createMusicDiscovery({ projectExists: async () => true, getInstagramCredentials: () => null, getYouTubeKey: () => key, fetch });
  for (const provider of ['instagram', 'youtube']) {
    const result = await service('').searchMusic({ projectId: 'p', provider, query: 'sakin' });
    assert.equal(result.status, 'ok'); assert.equal(result.items[0].id, 'sb:home-was-you');
    assert.match(result.message, /alternatif/);
    const verified = await service('').resolveEmbeddableMusic('p', { offsetSeconds: 0, track: { ...result.items[0], title: 'LIE', previewUrl: 'https://evil.example/x.mp3', sourceUrl: 'https://evil.example/', canEmbed: false } });
    assert.equal(verified.title, 'Home Was You'); assert.equal(verified.downloadUrl, result.items[0].previewUrl);
  }
  const combined = await service('key').searchMusic({ projectId: 'p', provider: 'youtube', query: 'sakin' });
  assert.equal(combined.items.length, 2); assert.equal(combined.items[0].canEmbed, false); assert.equal(combined.items[1].canEmbed, true);
});
test('rejects foreign downloads, missing track license, mismatched canonical ids, remixes and sidebar-only rights', () => {
  for (const html of [page().replace('creativecommons.org/licenses/by/4.0/', 'creativecommons.org/licenses/by-nc/4.0/'), page().replace('/uploads/2026/07/HomeWasYou.mp3', '/uploads/2026/07/HomeWasYou.mp3?token=x'), page().replace('href="https://www.scottbuckley.com.au/library/wp-content', 'href="https://evil.example/library/wp-content'), page('other'), page('home-was-you', 'Remix'), page().replace('<article>', '<section>').replace('</article>', '</section>')]) assert.equal(parseLicensedTrack(html, 'home-was-you', 'youtube'), null);
});
test('canonical WordPress slug endpoint revalidates rights when track HTML is blocked', async () => {
  const { createLicensedMusic } = await import('../src/lib/server/licensed-music.ts');
  const service = createLicensedMusic(async url => {
    if (!new URL(url).pathname.includes('wp-json')) return new Response('blocked', { status: 406 });
    assert.equal(new URL(url).searchParams.get('slug'), 'home-was-you');
    return Response.json([{ slug: 'home-was-you', status: 'publish', type: 'post', link: 'https://www.scottbuckley.com.au/library/home-was-you/', title: { rendered: 'Home Was You' }, content: { rendered: page().match(/<div class="entry">([\s\S]*?)<\/div>/)[1], protected: false } }]);
  });
  assert.equal((await service.resolve('youtube', 'sb:home-was-you')).title, 'Home Was You');
});
test('conflicting restricted license on a track never grants embedding', () => {
  const restricted = page().replace('</article>', '<a href="https://creativecommons.org/licenses/by-nc/4.0/" rel="license">NC</a></article>');
  assert.equal(parseLicensedTrack(restricted, 'home-was-you', 'instagram'), null);
});
test('per-request Turkish mood query searches real API and verifies each canonical page, resolver ignores client metadata', async () => {
  const { createLicensedMusic } = await import('../src/lib/server/licensed-music.ts');
  const calls = [];
  const service = createLicensedMusic(async (url, init) => {
    calls.push(new URL(url)); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert.ok(init.signal);
    if (new URL(url).pathname.includes('wp-json')) return Response.json([{ slug: 'home-was-you', status: 'publish', type: 'post', link: 'https://www.scottbuckley.com.au/library/home-was-you/', title: { rendered: 'Home Was You' }, content: { rendered: page().match(/<div class="entry">([\s\S]*?)<\/div>/)[1], protected: false } }]);
    return new Response(page());
  });
  const items = await service.search('youtube', 'sakin');
  assert.equal(calls[0].searchParams.get('search'), 'peaceful');
  assert.equal(calls[0].searchParams.get('per_page'), '8');
  assert.equal(items.length, 1);
  assert.equal(items[0].provider, 'youtube');
  const verified = await service.resolve('instagram', 'sb:home-was-you');
  assert.equal(verified.title, 'Home Was You');
  assert.equal(verified.downloadUrl, items[0].previewUrl);
  assert.equal(calls.length, 3);
  await assert.rejects(service.resolve('instagram', 'sb:../licensing'), /Geçersiz/);
  assert.equal(calls.length, 3);
});
