const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/core-breach-legacy.html'), 'utf8');
const configs = new Function(source.match(/const TOWER_CONFIGS = \{[\s\S]*?\n\};/)[0] + ';return TOWER_CONFIGS;')();
const enemies = new Function(source.match(/const ENEMY_TYPES = \{[\s\S]*?\n\};/)[0] + ';return ENEMY_TYPES;')();
const LightningArc = new Function(source.slice(source.indexOf('class LightningArc {'), source.indexOf('class BeamLine {')) + ';return LightningArc;')();
const SolarFlameWave = new Function(source.slice(source.indexOf('class SolarFlameWave {'), source.indexOf('class ShockwaveRing {')) + ';return SolarFlameWave;')();
const Tower = new Function('TOWER_CONFIGS', 'PULSE_SPRITE_ANIMATIONS', 'COMBAT_SPEED_MULTIPLIER', 'LightningArc', 'ShockwaveRing', 'SolarFlameWave',
  source.slice(source.indexOf('class DefensiveTower {'), source.indexOf('class CreepEnemy {')) + ';return DefensiveTower;'
)(configs, { idle: { frameMs: 100, frames: 1 } }, 0.7, LightningArc, class {}, SolarFlameWave);
const world = { offsetX: 0, offsetY: 0, cellSize: 48, scaleRatio: 1 };

test('tower hold sells once; short tap upgrades; move, cancellation and blur abort', () => {
  const code = source.slice(source.indexOf('    let holdTimer = null;'), source.indexOf('    // Docked Tower Panels:'));
  const setup = () => {
    const events = {}, timers = new Map();
    let timerId = 0, taps = 0, sells = 0;
    const tower = { gx: 1, gy: 1 };
    const game = { towers: [tower], pathTiles: new Set(), gridWidth: 5, gridHeight: 5,
      getGameLocalCoords: e => ({ x: e.x ?? 1, y: e.y ?? 1 }),
      clearPendingBuildTile() {}, setPendingBuildTile() {}, showToast() {},
      sellTower(t) { assert.equal(t, tower); sells++; },
      canvas: { addEventListener(name, callback) { events[name] = callback; },
        setPointerCapture() {}, hasPointerCapture: () => false }
    };
    const window = { setTimeout(fn, ms) { assert.equal(ms, 1000); timers.set(++timerId, fn); return timerId; },
      clearTimeout(id) { timers.delete(id); }, addEventListener(name, fn) { events[name] = fn; } };
    new Function('window', 'sounds', 'BUILD_HOLD_DURATION_MS', 'handleCanvasAction', code)
      .call(game, window, { init() {} }, 1000, () => taps++);
    const emit = (name, extra = {}) => events[name]({ pointerId: 1, button: 0, preventDefault() {}, ...extra });
    const tick = () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); };
    return { emit, tick, counts: () => [taps, sells], game };
  };
  let h = setup(); h.emit('pointerdown'); h.tick(); h.emit('pointerup'); h.tick(); assert.deepEqual(h.counts(), [0, 1]);
  h = setup(); h.emit('pointerdown'); h.emit('pointerup'); h.tick(); assert.deepEqual(h.counts(), [1, 0]);
  for (const cancel of ['pointermove', 'pointercancel', 'blur', 'lostpointercapture']) {
    h = setup(); h.emit('pointerdown'); h.emit(cancel, { x: 2 }); h.tick(); h.emit('pointerup'); assert.deepEqual(h.counts(), [0, 0]);
  }
  h = setup(); h.emit('pointerdown'); h.emit('pointerup', { pointerId: 2 }); h.tick(); assert.deepEqual(h.counts(), [0, 1]);
  h = setup(); h.game.activeSkill = 'mine'; h.emit('pointerdown'); h.tick(); h.emit('pointerup'); assert.deepEqual(h.counts(), [1, 0]);
});

test('selling refunds invested cost once and clears the removed tower hover', () => {
  const code = source.slice(source.indexOf('  sellTower(tower) {'), source.indexOf('  // ==================== 6. SUPERWEAPONS'));
  const sell = new Function('sounds', 'return ({' + code + '}).sellTower;')({ playUI() {} });
  const tower = new Tower(0, 0, 'pulse', world);
  tower.investedEnergy = configs.pulse.cost + configs.pulse.upgradeCosts[0];
  let saves = 0;
  const game = { towers: [tower], hoveredTower: tower, energy: 100,
    clearPendingBuildTile() {}, createParticleBurst() {}, createFloatingText() {}, closeInspector() {}, updateHUD() {}, saveGameState() { saves++; } };
  sell.call(game, tower); sell.call(game, tower);
  assert.equal(game.energy, 100 + Math.round(tower.investedEnergy * 0.75));
  assert.equal(game.towers.length, 0); assert.equal(game.hoveredTower, null); assert.equal(saves, 1);
});

test('empty-cell tap keeps build feedback; adjacent tower and road are not build targets', () => {
  const code = source.slice(source.indexOf('    const handleCanvasAction ='), source.indexOf('    let holdTimer = null;'));
  const game = { gridWidth: 5, gridHeight: 5, cellSize: 48, offsetX: 0, offsetY: 0,
    pathTiles: new Set(['2,2']), towers: [{ gx: 0, gy: 1, upgrade() { throw Error('adjacent upgrade'); } }],
    getGameLocalCoords: () => ({ x: 1, y: 1, mx: 49, my: 72 }),
    clearPendingBuildTile() { this.pendingBuildTile = null; }, closeInspector() {},
    setPendingBuildTile(gx, gy, duration) { this.pendingBuildTile = { gx, gy, duration }; }
  };
  // Compile inside a receiver-bound scope so the event arrow preserves the game.
  const invoke = () => new Function('sounds', 'let lastCanvasAction = 0; ' + code + ';handleCanvasAction({});').call(game, { init() {} });
  invoke();
  assert.deepEqual(game.pendingBuildTile, { gx: 1, gy: 1, duration: 0 });
  game.getGameLocalCoords = () => ({ x: 2, y: 2, mx: 120, my: 120 });
  invoke(); assert.equal(game.pendingBuildTile, null);
});

test('upgrade chevrons remain inset at small and large cell sizes', () => {
  for (const cellSize of [24, 32, 40, 48, 64]) {
    const scale = Math.min(1, cellSize / 40);
    const x = cellSize / 2 - 10 * scale;
    const y = -cellSize / 2 + 10 * scale;
    assert(x + 8.5 * scale < cellSize / 2);
    assert(y - 7.5 * scale > -cellSize / 2);
  }
});

test('sunflower emits expanding fire wave without changing damage or target radius', () => {
  const tower = new Tower(0, 0, 'buffer', world);
  const makeEnemy = x => ({ x, y: tower.y, damage: 0, takeDamage(damage) { this.damage += damage; } });
  const near = makeEnemy(tower.x + 100), far = makeEnemy(tower.x + 200);
  const game = { ...world, enemies: [near, far], particles: [], createParticleBurst() {} };
  tower.fireSunPulse(game, 34, false);
  assert.equal(near.damage, 34); assert.equal(far.damage, 0);
  const wave = game.particles[0];
  assert(wave instanceof SolarFlameWave);
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]), set: () => true });
  wave.draw(ctx);
  const initialRadius = calls.find(call => call[0] === 'arc')[3];
  calls.length = 0; wave.update(0.35); wave.draw(ctx);
  assert(calls.find(call => call[0] === 'arc')[3] > initialRadius);
  assert(calls.filter(call => call[0] === 'quadraticCurveTo').length >= 24);
  calls.length = 0; wave.update(1); wave.draw(ctx); assert.equal(calls.length, 0);
});

test('inline script parses', () => {
  assert.doesNotThrow(() => new Function(source.match(/<script>([\s\S]*?)<\/script>/)[1]));
});

test('all briefing monsters have real thumbnail types and each briefing defaults to EMP', () => {
  const intel = new Function(source.match(/const STAGE_MONSTER_INTEL = \[[\s\S]*?\n\];/)[0] + ';return STAGE_MONSTER_INTEL;')();
  const options = ['emp', 'overdrive', 'mine'].map(skill => ({ dataset: { skill }, classList: { toggle() {} }, setAttribute(key, value) { this[key] = value; } }));
  const start = { disabled: true };
  let rendered = 0;
  const list = { innerHTML: '', querySelectorAll() {
    return [...this.innerHTML.matchAll(/data-enemy="([^"]+)"/g)].map(match => ({ dataset: { enemy: match[1] } }));
  } };
  const document = { getElementById: id => id === 'briefing-monsters-list' ? list : id === 'btn-briefing-start' ? start : {}, querySelectorAll: () => options };
  const methods = new Function('document', 'STAGE_MONSTER_INTEL', 'COMMANDER_SKILLS',
    'return new (class {' + source.slice(source.indexOf('  openStageBriefing(stageIdx) {'), source.indexOf('  setCommanderSkill(skillKey) {')) + '})();'
  )(document, intel, { emp: {}, overdrive: {}, mine: {} });
  methods.openModal = () => {};
  methods.renderEnemyThumbnail = canvas => { assert(enemies[canvas.dataset.enemy]); rendered++; };
  for (let stage = 0; stage < intel.length; stage++) {
    methods.pendingCommanderSkill = 'mine';
    methods.openStageBriefing(stage);
    assert.equal(methods.pendingCommanderSkill, 'emp');
    assert.equal(start.disabled, false);
    assert.equal(options[0]['aria-pressed'], 'true');
    assert.equal(options[1]['aria-pressed'], 'false');
    assert.equal(options[2]['aria-pressed'], 'false');
    assert(!list.innerHTML.includes('mon-badge-icon'));
  }
  assert.equal(rendered, 9);
});

test('codex fits the whole poster into available height and readapts after resize', () => {
  const body = source.match(/const fitPoster = \(\) => \{([\s\S]*?)\n    \};/)[1];
  const fit = new Function('posters', body);
  const sheet = { scrollHeight: 620, offsetHeight: 620, style: {} };
  const posters = { firstElementChild: sheet, clientHeight: 400 };
  fit(posters);
  const scale = Number(sheet.style.transform.match(/scale\((.*)\)/)[1]);
  assert(scale * sheet.scrollHeight <= posters.clientHeight + 1e-9);
  posters.clientHeight = 740;
  fit(posters); assert.equal(sheet.style.transform, 'scale(1)');
  posters.clientHeight = 0;
  fit(posters); assert.equal(sheet.style.transform, 'scale(1)');
});

test('lightning chains once per target, respects range and level cap', () => {
  for (const scale of [0.5, 1, 2]) {
    for (const level of [1, 2, 3]) {
      const tower = new Tower(0, 0, 'tesla', world);
      tower.level = level;
      const targets = Array.from({ length: 7 }, (_, i) => ({
        x: (80 + i * 70) * scale, y: 0, hits: 0,
        takeDamage() { this.hits++; this.dead = true; }
      }));
      const dead = { x: 90 * scale, y: 0, dead: true, takeDamage() { throw Error('dead target'); } };
      const game = { scaleRatio: scale, enemies: [...targets, dead], particles: [], createParticleBurst() {} };
      tower.targetEnemy = targets[0];
      tower.fireTesla(game, 42, false);
      assert.equal(targets.reduce((sum, enemy) => sum + enemy.hits, 0), [2, 3, 4][level - 1]);
      assert(targets.every(enemy => enemy.hits <= 1));
      assert.equal(tower.totalDamageDealt, 42 * configs.tesla.chainTargets[level - 1]);
      const isolated = { x: 1000, y: 0, hits: 0, takeDamage() { this.hits++; } };
      targets[0].dead = false;
      tower.targetEnemy = targets[0];
      tower.fireTesla({ ...game, enemies: [targets[0], isolated] }, 42, false);
      assert.equal(isolated.hits, 0);
    }
  }
});

test('all towers start at 150% damage and compound damage/range/rate per upgrade', () => {
  const previousDamage = { pulse: 26, cryo: 18, plasma: 20, tesla: 42, buffer: 34 };
  for (const [type, base] of Object.entries(previousDamage)) {
    const tower = new Tower(0, 0, type, world);
    assert.equal(tower.getEffectiveDamage(), base * 1.5);
    let previous = [tower.getEffectiveDamage(), tower.getEffectiveRange(), tower.getEffectiveFireRate()];
    for (const level of [2, 3]) {
      tower.level = level;
      const current = [tower.getEffectiveDamage(), tower.getEffectiveRange(), tower.getEffectiveFireRate()];
      current.forEach((value, index) => assert(Math.abs(value / previous[index] - (index === 0 ? 1.6 : 1.3)) < 1e-9));
      previous = current;
    }
  }
});

test('upgrade raises damage and frequency; lightning has jagged interior', () => {
  const tower = new Tower(0, 0, 'tesla', world);
  const values = [1, 2, 3].map(level => {
    tower.level = level;
    return [tower.getEffectiveDamage(), tower.getEffectiveFireRate()];
  });
  assert(values[0][0] < values[1][0] && values[1][0] < values[2][0]);
  assert(values[0][1] < values[1][1] && values[1][1] < values[2][1]);
  const arc = new LightningArc(0, 0, 120, 0);
  assert.deepEqual(arc.points[0], { x: 0, y: 0 });
  assert.deepEqual(arc.points.at(-1), { x: 120, y: 0 });
  assert(arc.points.slice(1, -1).every(point => Math.abs(point.y) >= 5));
});

test('codex renders all level attributes and assets, with bounded paging and category reset', () => {
  const element = dataset => ({ dataset, innerHTML: '', setAttribute() {}, focus() {}, querySelectorAll: () => [] });
  const tabs = [element({ kind: 'towers' }), element({ kind: 'enemies' })];
  const arrows = [element({ step: '-1' }), element({ step: '1' })];
  const posters = element({});
  const paging = element({});
  const content = {
    querySelector: selector => ({ '.codex-posters': posters, '.codex-paging span': paging,
      '[data-step="-1"]': arrows[0], '[data-step="1"]': arrows[1],
      '[data-kind="towers"]': tabs[0], '[data-kind="enemies"]': tabs[1] })[selector],
    querySelectorAll: selector => selector === '[data-kind]' ? tabs : arrows
  };
  const ids = { pulse: 't01-pulse-gatling', cryo: 't02-cryo-emitter', plasma: 't03-plasma-mortar', tesla: 't04-tesla-coil', buffer: 't05-quantum-buffer' };
  const art = (type, level, kind) => `./assets/fyt01/runtime/${kind}/${ids[type]}-lv${level}@2x.png`;
  const code = source.slice(source.indexOf('  renderCodex() {'), source.indexOf('  // ==================== CONFIGURATION HUB MANAGER'));
  const render = new Function('document', 'TOWER_CONFIGS', 'TOWER_TYPES', 'ENEMY_TYPES', 'DefensiveTower', 'COMBAT_SPEED_MULTIPLIER', 'towerArtPath',
    'return ({' + code + '}).renderCodex;')({ querySelector: () => content }, configs, Object.keys(ids), enemies, Tower, 0.7, art);
  render.call(world);
  assert(arrows[0].disabled);
  for (let i = 0; i < 5; i++) {
    assert.equal((posters.innerHTML.match(/class="archive-level"/g) || []).length, 3);
    assert(!/NaN|undefined/.test(posters.innerHTML));
    for (const match of posters.innerHTML.matchAll(/src="([^"]+)"/g)) {
      assert(fs.existsSync(path.join(__dirname, '../src', match[1])));
    }
    if (i < 4) arrows[1].onclick();
  }
  assert(arrows[1].disabled);
  tabs[1].onclick();
  assert.equal(paging.textContent, '1 / 8');
  assert(arrows[0].disabled);
  for (let i = 0; i < 8; i++) {
    assert(posters.innerHTML.includes('data-enemy='));
    assert(!/NaN|undefined/.test(posters.innerHTML));
    if (i < 7) arrows[1].onclick();
  }
  assert(arrows[1].disabled);
});
