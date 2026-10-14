const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/core-breach-legacy.html'), 'utf8');
const extract = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));
const configs = new Function(source.match(/const TOWER_CONFIGS = \{[\s\S]*?\n\};/)[0] + ';return TOWER_CONFIGS;')();
const enemies = new Function(source.match(/const ENEMY_TYPES = \{[\s\S]*?\n\};/)[0] + ';return ENEMY_TYPES;')();
const maps = new Function(extract('const MAP_DEFINITIONS = [', 'const BASE_GAME_SPEED') + ';return MAP_DEFINITIONS;')();
const types = ['pulse', 'cryo', 'tesla', 'plasma', 'buffer'];
const sounds = { playUI() {}, playExplosion() {} };
const store = new Map([['quantum_td_active_session_portrait_v1', 'existing-session'], ['quantum_td_stars', '[3,1,0]']]);
const writes = [];
const storage = { getItem: key => store.get(key), setItem(key, value) { writes.push(key); store.set(key, value); }, removeItem(key) { writes.push(key); store.delete(key); } };
const elements = new Map();
const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, { style: {}, textContent: '', classList: { add() {}, remove() {} } }); return elements.get(id); } };
const Tower = new Function('TOWER_CONFIGS', 'PULSE_SPRITE_ANIMATIONS', 'COMBAT_SPEED_MULTIPLIER', 'sounds', extract('class DefensiveTower {', 'class CreepEnemy {') + ';return DefensiveTower;')(configs, {}, 0.7, sounds);
const Enemy = new Function('ENEMY_TYPES', 'COMBAT_SPEED_MULTIPLIER', 'SEED_CANNON_ART', 'sounds', extract('class CreepEnemy {', 'class IcePatch {') + ';return CreepEnemy;')(enemies, 0.7, { reducedMotion: false }, sounds);
const Game = new Function('MAP_DEFINITIONS', 'TEST_MAP_INDEX', 'TOWER_TYPES', 'TOWER_CONFIGS', 'ENEMY_TYPES', 'DefensiveTower', 'CreepEnemy', 'document', 'localStorage', 'sounds', 'COMBAT_SPEED_MULTIPLIER', extract('class QuantumTDGame {', 'function traceUnitPolygon') + ';return QuantumTDGame;')(maps, maps.length - 1, types, configs, enemies, Tower, Enemy, document, storage, sounds, 0.7);
function makeGame(setup = {}) {
  const game = Object.create(Game.prototype);
  Object.assign(game, { currentMapIndex: 0, testSetup: game.normalizeTestSetup(setup), cellSize: 50, offsetX: 0, offsetY: 0, viewWidth: 350, viewHeight: 600, pathTiles: new Set(), skills: { overdrive: { timer: 0 } }, time: 0, screenShake: 0, speedMult: 1,
    initCanvasSize() {}, closeModal() {}, openModal() {}, hideHomeScreen() { this.isInBattle = true; }, setCommanderSkill() {}, cancelScheduledClose() {}, clearPendingBuildTile() {}, closeInspector() {}, updateHUD() {}, showToast() {}, createBuildSummonEffect() {}, createFloatingText() {}, createParticleBurst() {} });
  game.startTestStage(game.testSetup);
  return game;
}

test('test map is appended; three normal map indices remain unchanged', () => {
  assert.equal(maps.length, 4);
  assert(maps.slice(0, 3).every(map => !map.testStage));
  assert.deepEqual(maps.map(map => map.maxTowers), [10, 14, 18, 1]);
  assert.deepEqual(maps[3].paths, [[{ x: 3, y: 0 }, { x: 3, y: 11 }]]);
});

test('all 40 monster/tower combinations start with exactly one chosen entity and custom HP', () => {
  for (const enemy of Object.keys(enemies)) for (const tower of types) {
    const game = makeGame({ enemy, tower, hp: 1234, level: 2 });
    assert.equal(game.enemies.length, 1); assert.equal(game.towers.length, 1);
    assert.equal(game.enemies[0].typeKey, enemy); assert.equal(game.towers[0].type, tower);
    assert.equal(game.enemies[0].hp, 1234); assert.equal(game.enemies[0].maxHp, 1234);
    assert.equal(game.towers[0].level, 2); assert.equal(game.enemies[0].speed, 0);
    assert.equal(game.enemies[0].config.splits, 0);
    assert.notEqual(game.enemies[0].config, enemies[enemy]);
    assert.equal(game.spawnTestEnemy(), false);
    assert.equal(game.waveInProgress, false); assert.equal(game.isWaveCountdownActive, false);
  }
  assert.equal(enemies.replicator.splits, 3);
});

test('dead replicator never splits/rewards; replacement waits and does not damage the core on exit', () => {
  const game = makeGame({ enemy: 'replicator', moving: true });
  game.towers = [];
  const first = game.enemies[0];
  first.die(game);
  assert.equal(game.enemies.length, 1); assert.equal(game.flyingCoins.length, 0); assert.equal(game.score, 0);
  game.update(0.01); assert.equal(game.enemies.length, 0);
  game.update(0.7); assert.equal(game.enemies.length, 0);
  game.update(0.11); assert.equal(game.enemies.length, 1);
  const next = game.enemies[0]; assert.notEqual(next, first);
  next.reachedEnd = true;
  const hp = game.hp;
  game.update(0.01); assert.equal(game.enemies.length, 0); assert.equal(game.hp, hp); assert.equal(game.gameOver, false);
  game.update(0.81); assert.equal(game.enemies.length, 1);
});

test('manual respawn cancels old bursts, effects and target locks while preserving the one tower', () => {
  const game = makeGame(); const tower = game.towers[0];
  tower.pulseBursts = [{ target: game.enemies[0] }]; tower.pulseShotPending = true;
  game.projectiles.push({}); game.particles.push({}); game.groundZones.push({});
  game.respawnTestEnemy();
  assert.equal(game.enemies.length, 1); assert.equal(game.towers[0], tower);
  assert.deepEqual(tower.pulseBursts, []); assert.equal(tower.pulseShotPending, false);
  assert.equal(game.projectiles.length + game.particles.length + game.groundZones.length, 0);
});

test('test builds selected tower at selected level for free and prevents a second tower', () => {
  const game = makeGame({ tower: 'cryo', level: 2 });
  game.towers = []; game.energy = 0;
  assert.equal(game.tryBuildRandomTower(1, 3), true);
  assert.equal(game.towers[0].type, 'cryo'); assert.equal(game.towers[0].level, 2); assert.equal(game.energy, 0);
  assert.equal(game.tryBuildRandomTower(2, 3), false); assert.equal(game.towers.length, 1);
  game.towers[0].upgrade(game);
  assert.equal(game.towers[0].level, 3); assert.equal(game.testSetup.level, 3); assert.equal(game.energy, 0);
});

test('test start/save/restart/victory never overwrite formal session or stars', () => {
  const session = store.get('quantum_td_active_session_portrait_v1'), stars = store.get('quantum_td_stars');
  writes.length = 0;
  const game = makeGame(); game.saveGameState(); game.restartLevel(); game.handleVictory(); game.handleDefeat();
  assert(writes.every(key => key === 'garden_test_stage_setup_v1'));
  assert.equal(store.get('quantum_td_active_session_portrait_v1'), session); assert.equal(store.get('quantum_td_stars'), stars);
  assert.equal(game.gameOver, false);
});

test('resize preserves static targets and movement speed/position; hidden monsters stay visible', () => {
  for (const moving of [false, true]) {
    const game = makeGame({ enemy: 'phantom', moving }); const enemy = game.enemies[0];
    game.initCanvasSize = () => { game.cellSize = 30; game.offsetX = 10; game.offsetY = 20; };
    game.handleResize();
    assert.equal(enemy.x, 115); assert.equal(enemy.y, 185);
    assert.equal(enemy.speed, moving ? enemies.phantom.speed * 0.6 * 0.7 : 0);
    enemy.stealthRevealed = 0; enemy.update(0.01, game); assert(enemy.stealthRevealed > 0);
  }
});

test('invalid test settings fall back or clamp to supported ranges', () => {
  const game = Object.create(Game.prototype);
  assert.deepEqual(game.normalizeTestSetup({}), { enemy: 'crawler', tower: 'pulse', level: 3, hp: 300, moving: false });
  assert.deepEqual(game.normalizeTestSetup({ enemy: 'unknown', tower: 'unknown', level: 99, hp: -3, moving: 'yes' }), { enemy: 'crawler', tower: 'pulse', level: 3, hp: 1, moving: false });
  assert.equal(game.normalizeTestSetup({ hp: Infinity }).hp, 300);
});

test('configuration pauses combat and cancel restores its previous pause state', () => {
  const game = makeGame(); game.renderTestSelection = () => {};
  for (const paused of [false, true]) {
    game.isPaused = paused;
    game.openTestStageSetup(); assert.equal(game.isPaused, true);
    game.closeTestStageSetup(); assert.equal(game.isPaused, paused);
  }
});

test('restoring a saved test index is rejected while a formal save uses its original key', () => {
  const game = makeGame();
  store.set('quantum_td_active_session_portrait_v1', JSON.stringify({ mapIndex: 3 }));
  assert.equal(game.restoreGameState(), false);
  game.currentMapIndex = 0; game.saveGameState();
  assert.equal(JSON.parse(store.get('quantum_td_active_session_portrait_v1')).mapIndex, 0);
  assert.equal(JSON.parse(store.get('quantum_td_active_session_portrait_v1')).towers.length, 1);
});
