import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from '../node_modules/typescript/lib/typescript.js';

test('quick-ideas-drawer handleSendToCanva sets localStorage, dispatches canva-prefill event and navigates to canva studio', async () => {
  const file = 'src/components/layout/quick-ideas-drawer.tsx';
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  
  let handlerText = '';
  function walk(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'handleSendToCanva') {
      handlerText = 'const ' + n.getText(ast) + ';';
    }
    ts.forEachChild(n, walk);
  }
  walk(ast);
  assert.ok(handlerText, 'handleSendToCanva declaration must be found');

  const transpiled = ts.transpile(handlerText, { target: ts.ScriptTarget.ES2022 });

  const storage = {};
  const dispatchedEvents = [];
  const pushedRoutes = [];
  let hiddenIdeaId = null;

  const mockWindow = {
    alert: () => {},
    confirm: () => true,
    dispatchEvent: (evt) => {
      dispatchedEvents.push(evt);
    },
  };

  const mockLocalStorage = {
    setItem: (key, val) => {
      storage[key] = val;
    },
    getItem: (key) => storage[key] ?? null,
    removeItem: (key) => {
      delete storage[key];
    },
  };

  const mockRouter = {
    push: (route) => {
      pushedRoutes.push(route);
    },
  };

  const fn = new Function(
    'window',
    'projectId',
    'selectedStoryIndex',
    'handleToggleHide',
    'localStorage',
    'router',
    'CustomEvent',
    'onClose',
    "const activeCategory = 'carousel';" +
      transpiled +
      '; return handleSendToCanva;'
  )(
    mockWindow,
    'test-project',
    {},
    (id) => {
      hiddenIdeaId = id;
    },
    mockLocalStorage,
    mockRouter,
    class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    () => {}
  );

  const sampleIdea = {
    id: 'idea-123',
    title: '5 Adımda Mini ATM Yapımı',
    hook: 'Karton koliyle 30 dakikada ATM yapın!',
    description: 'Ebeveyn ve çocuklar için karton ATM rehberi.',
    structure: ['Kapak', 'Malzemeler', 'Adım 1', 'Adım 2', 'Adım 3', 'Sonuç'],
    columnType: 'carousel',
    targetChannel: 'Instagram',
  };

  await fn(sampleIdea);

  // 1. Verify localStorage
  assert.ok(storage['canva_form_test-project'], 'canva_form_test-project must be stored');
  assert.ok(storage['canva_prefill_test-project'], 'canva_prefill_test-project must be stored');

  const payload = JSON.parse(storage['canva_prefill_test-project']);
  assert.match(payload.prompt, /5 Adımda Mini ATM Yapımı/);
  assert.match(payload.prompt, /Karton koliyle 30 dakikada ATM yapın!/);
  assert.equal(payload.contentType, 'instagram_carousel');
  assert.equal(payload.slideCount, 6);
  assert.equal(payload.isPrefilledFromIdea, true);

  // 2. Verify CustomEvent dispatch
  assert.equal(dispatchedEvents.length, 1, 'Exactly one custom event must be dispatched');
  assert.equal(dispatchedEvents[0].type, 'canva-prefill');
  assert.equal(dispatchedEvents[0].detail.contentType, 'instagram_carousel');

  // 3. Verify route push
  assert.equal(pushedRoutes.length, 1);
  assert.equal(pushedRoutes[0], '/projects/test-project/image-generation?studio=canva');

  // 4. Verify toggle hide was triggered in background
  assert.equal(hiddenIdeaId, 'idea-123');
});
