const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
const vueSource = fs.readFileSync(path.join(__dirname, '../src/vendor/vue/vue.global.prod.js'), 'utf8');
const key = 'aabb-toolbox-open-counts';
const tools = [
  { id: 'a', name: '工具甲', desc: '编辑', category: '开发', url: '#/tools/a', enabled: true, component: {} },
  { id: 'b', name: '工具乙', desc: '编辑', category: '开发', url: '#/tools/b', enabled: true, component: {}, badge: 'New' },
  { id: 'c', name: '工具丙', desc: '记录', category: '效率', url: '#/tools/c', enabled: true, component: {} },
  { id: 'disabled', name: '未上线', desc: '', category: '效率', url: '#/tools/disabled', enabled: false },
];

function setup({ store = new Map(), hash = '#/', blocked = false, toolList = tools } = {}) {
  const mounted = [];
  const unmounted = [];
  const events = new Map();
  let state;
  const storage = {
    getItem(k) { if (blocked) throw new Error('Storage blocked'); return store.get(k) ?? null; },
    setItem(k, value) { if (blocked) throw new Error('Storage blocked'); store.set(k, value); },
    removeItem(k) { if (blocked) throw new Error('Storage blocked'); store.delete(k); },
    clear() { if (blocked) throw new Error('Storage blocked'); store.clear(); },
  };
  const window = {
    ToolboxTools: toolList,
    location: { hash },
    addEventListener: (type, fn) => events.set(type, fn),
    removeEventListener: type => events.delete(type),
    setTimeout: () => 1,
    clearTimeout() {},
  };
  const context = vm.createContext({ window, localStorage: storage, sessionStorage: storage });
  // Use the project's real Vue reactivity; replace only DOM mounting and lifecycle registration.
  vm.runInContext(vueSource, context);
  window.Vue = {
    ...context.Vue,
    onMounted: fn => mounted.push(fn),
    onBeforeUnmount: fn => unmounted.push(fn),
    createApp: options => ({ mount() { state = options.setup(); mounted.forEach(fn => fn()); } }),
  };
  vm.runInContext(source, context);
  function navigate(nextHash) {
    window.location.hash = nextHash;
    events.get('hashchange')();
  }
  return { state, store, storage, window, events, navigate, unmount: () => unmounted.forEach(fn => fn()) };
}

const ids = state => Array.from(state.filteredTools.value, tool => tool.id);

test('opening from cards and frequent shortcuts persists counts without duplicate hash counting', () => {
  const app = setup();
  assert.deepEqual(ids(app.state), ['a', 'b', 'c', 'disabled']);
  app.state.openTool(tools[2]);
  app.events.get('hashchange')();
  assert.equal(app.state.getOpenCount('c'), 1);
  app.state.goHome();
  app.events.get('hashchange')();
  app.state.openTool(app.state.frequentTools.value[0]);
  assert.equal(app.state.getOpenCount('c'), 2);
  app.state.goHome();
  app.state.openTool(tools[1]);
  assert.equal(app.state.getOpenCount('b'), 1);
  assert.deepEqual(ids(app.state), ['c', 'b', 'a', 'disabled']);
  assert.deepEqual(JSON.parse(app.store.get(key)), { c: 2, b: 1 });
  const reloaded = setup({ store: app.store });
  assert.equal(reloaded.state.getOpenCount('c'), 2);
  assert.deepEqual(ids(reloaded.state), ['c', 'b', 'a', 'disabled']);
});

test('sorting preserves original order on ties and works with search and categories', () => {
  const app = setup({ store: new Map([[key, JSON.stringify({ a: 3, b: 3, c: 7 })]]) });
  assert.deepEqual(ids(app.state), ['c', 'a', 'b', 'disabled']);
  app.state.setCategory('开发');
  assert.deepEqual(ids(app.state), ['a', 'b']);
  app.state.openTool(tools[1]);
  assert.deepEqual(ids(app.state), ['b', 'a']);
  app.state.setCategory('全部');
  app.state.keyword.value = '编辑';
  assert.deepEqual(ids(app.state), ['b', 'a']);
  assert.deepEqual(tools.map(tool => tool.id), ['a', 'b', 'c', 'disabled']);
});

test('direct tool links, refreshes and history entries count once; unknown or disabled routes do not count', () => {
  const app = setup({ hash: '#/tools/a' });
  assert.equal(app.state.getOpenCount('a'), 1);
  app.events.get('hashchange')();
  assert.equal(app.state.getOpenCount('a'), 1);
  app.navigate('#/');
  app.navigate('#/tools/a');
  assert.equal(app.state.getOpenCount('a'), 2);
  const refreshed = setup({ store: app.store, hash: '#/tools/a' });
  assert.equal(refreshed.state.getOpenCount('a'), 3);
  refreshed.navigate('#/tools/unknown');
  refreshed.navigate('#/tools/disabled');
  refreshed.state.openTool(tools[3]);
  assert.equal(refreshed.state.getOpenCount('disabled'), 0);
  assert.equal(refreshed.state.getOpenCount('unknown'), 0);
});

test('clearing all cache resets counts and sorting only after confirmation', () => {
  const { state, store } = setup();
  state.openTool(tools[1]);
  state.goHome();
  assert.equal(state.getOpenCount('b'), 1);
  assert.equal(JSON.parse(store.get(key)).b, 1);
  state.clearAllCache();
  assert.equal(state.getOpenCount('b'), 1);
  state.clearAllCache();
  assert.equal(state.getOpenCount('b'), 0);
  assert.equal(store.has(key), false);
  assert.deepEqual(ids(state), ['a', 'b', 'c', 'disabled']);
});

test('malformed storage is ignored, and only nonnegative safe integer counts are restored', () => {
  for (const value of ['invalid', 'null', '[]', '3', '"text"']) {
    const { state } = setup({ store: new Map([[key, value]]) });
    assert.equal(state.getOpenCount('a'), 0);
    state.openTool(tools[0]);
    assert.equal(state.getOpenCount('a'), 1);
  }
  const { state } = setup({ store: new Map([[key, JSON.stringify({ a: -1, b: '9', c: 2.5, unknown: 100 })]]) });
  assert.deepEqual(ids(state), ['a', 'b', 'c', 'disabled']);
});

test('blocked browser storage does not prevent opening tools or counting within the session', () => {
  const { state, window } = setup({ blocked: true });
  state.openTool(tools[1]);
  assert.equal(window.location.hash, tools[1].url);
  assert.equal(state.getOpenCount('b'), 1);
  assert.equal(ids(state)[0], 'b');
});

test('frequent shortcuts select the top four enabled tools independently of search and categories', () => {
  const extra = [
    { ...tools[0], id: 'd', name: '工具丁', url: '#/tools/d' },
    { ...tools[0], id: 'e', name: '工具戊', url: '#/tools/e' },
  ];
  const app = setup({
    toolList: [...tools, ...extra],
    store: new Map([[key, JSON.stringify({ a: 2, b: 5, c: 9, d: 1, e: 3, disabled: 99 })]]),
  });
  const frequentIds = () => Array.from(app.state.frequentTools.value, tool => tool.id);
  assert.deepEqual(frequentIds(), ['c', 'b', 'e', 'a']);
  app.state.setCategory('开发');
  app.state.keyword.value = '没有匹配';
  assert.equal(app.state.filteredTools.value.length, 0);
  assert.deepEqual(frequentIds(), ['c', 'b', 'e', 'a']);
  app.state.openTool(extra[0]);
  assert.deepEqual(frequentIds(), ['c', 'b', 'e', 'a']);
  app.state.goHome();
  app.state.openTool(extra[0]);
  assert.deepEqual(frequentIds(), ['c', 'b', 'd', 'e']);
});

test('frequent shortcuts use original order before first use and support fewer than four enabled tools', () => {
  const toolList = [...tools, { ...tools[0], id: 'd' }, { ...tools[0], id: 'e' }];
  assert.deepEqual(Array.from(setup({ toolList }).state.frequentTools.value, tool => tool.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(Array.from(setup().state.frequentTools.value, tool => tool.id), ['a', 'b', 'c']);
  assert.equal(setup({ toolList: [tools[3]] }).state.frequentTools.value.length, 0);
});

test('another tab updates displayed counts and sorting; unmount removes event listeners', () => {
  const app = setup();
  app.store.set(key, JSON.stringify({ b: 8 }));
  app.events.get('storage')({ storageArea: app.storage, key });
  assert.equal(app.state.getOpenCount('b'), 8);
  assert.equal(ids(app.state)[0], 'b');
  app.store.clear();
  app.events.get('storage')({ storageArea: app.storage, key: null });
  assert.equal(app.state.getOpenCount('b'), 0);
  app.unmount();
  assert.equal(app.events.size, 0);
});
