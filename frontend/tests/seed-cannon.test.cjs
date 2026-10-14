const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/core-breach-legacy.html'), 'utf8');
const configs = new Function(source.match(/const TOWER_CONFIGS = \{[\s\S]*?\n\};/)[0] + ';return TOWER_CONFIGS;')();
const enemyConfigs = new Function(source.match(/const ENEMY_TYPES = \{[\s\S]*?\n\};/)[0] + ';return ENEMY_TYPES;')();
const art = { reducedMotion: false, drawEffect() { return true; } };
let shots = 0, impacts = 0;
const sounds = { playSeedShot() { shots++; }, playSeedImpact() { impacts++; } };
const classes = source.slice(source.indexOf('class DefensiveTower {'), source.indexOf('class IcePatch {'))
  + source.slice(source.indexOf('class Projectile {'), source.indexOf('// ==================== 13.'));
const { DefensiveTower: Tower, CreepEnemy: Enemy, Projectile, SeedImpact } = new Function(
  'TOWER_CONFIGS', 'ENEMY_TYPES', 'COMBAT_SPEED_MULTIPLIER', 'SEED_CANNON_ART', 'sounds',
  classes + ';return {DefensiveTower, CreepEnemy, Projectile, SeedImpact};'
)(configs, enemyConfigs, 0.7, art, sounds);
const world = () => ({ offsetX: 0, offsetY: 0, cellSize: 48, scaleRatio: 1,
  enemies: [], towers: [], projectiles: [], particles: [], floatTexts: [], totalDamage: 0,
  createFloatingText(...args) { this.floatTexts.push(args); },
  createParticleBurst() { throw Error('seed hit must have a single material-aware effect'); } });
const target = (x = 120) => ({ x, y: 24, hp: 1000, radius: 12, distanceTraveled: 10, shield: 0,
  takeDamage(damage) { this.hp -= damage; this.hits = (this.hits || 0) + 1; } });

test('seed release waits for compression, then fires exactly once', () => {
  shots = 0;
  const game = world(), tower = new Tower(0, 0, 'pulse', game);
  game.enemies = [target()];
  tower.update(0.01, game);
  assert.equal(game.projectiles.length, 0);
  tower.update(0.04, game);
  assert.equal(game.projectiles.length, 0);
  tower.update(0.025, game);
  assert.equal(game.projectiles.length, 1);
  assert.equal(shots, 1);
  for (let i = 0; i < 20; i++) tower.update(0.01, game);
  assert.equal(game.projectiles.length, 1);
  assert.equal(tower.pulseShotPending, false);
});

test('level three fires its second seed after exactly 300ms with 80% damage', () => {
  shots = 0;
  const game = world(), tower = new Tower(0, 0, 'pulse', game);
  tower.level = 3;
  const main = target(100), other = target(140);
  game.enemies = [main, other]; tower.targetEnemy = main;
  tower.fire(game);
  assert.equal(game.projectiles.length, 1); assert.equal(shots, 1);
  tower.updatePulseBurst(0.299, game);
  assert.equal(game.projectiles.length, 1);
  tower.updatePulseBurst(0.001, game);
  assert.equal(game.projectiles.length, 2); assert.equal(shots, 2);
  const [a, b] = game.projectiles;
  assert.equal(a.target, main); assert.equal(b.target, main);
  assert.equal(b.damage, Math.ceil(a.damage * 0.8)); assert.equal(b.speed, Math.ceil(a.speed * 0.92));
  assert.equal(a.secondary, false); assert.equal(b.secondary, true);
  assert.equal(tower.pulseBursts.length, 0);
  tower.updatePulseBurst(1, game); assert.equal(game.projectiles.length, 2);
});

test('second shot keeps the dead first target and shows impact without additional damage', () => {
  const game = world(), tower = new Tower(0, 0, 'pulse', game);
  tower.level = 3;
  const main = target(100), replacement = target(140);
  game.enemies = [main, replacement]; tower.targetEnemy = main; tower.fire(game);
  game.projectiles[0].hit(game);
  main.dead = true; main.seedDeathPosition = { x: 102, y: 26 };
  game.enemies = [replacement];
  const hp = main.hp, damage = tower.totalDamageDealt;
  tower.updatePulseBurst(0.3, game);
  assert.equal(game.projectiles.length, 2);
  const second = game.projectiles[1]; assert.equal(second.target, main);
  second.update(1, game); second.hit(game);
  assert.equal(main.hp, hp); assert.equal(main.hits, 1);
  assert.equal(replacement.hp, 1000); assert.equal(replacement.hits, undefined);
  assert.equal(tower.totalDamageDealt, damage); assert.equal(game.totalDamage, 0);
  assert.equal(game.particles.length, 2); assert(second.destroyed);
  assert.equal(second.x, 102); assert.equal(second.y, 26);
});

test('second shot stays locked when first target moves outside range or becomes hidden', () => {
  const game = world(), tower = new Tower(0, 0, 'pulse', game);
  tower.level = 3; const main = target(100), other = target(140);
  game.enemies = [main, other]; tower.targetEnemy = main; tower.fire(game);
  main.x = 900; main.stealth = true;
  tower.updatePulseBurst(0.3, game);
  assert.equal(game.projectiles[1].target, main);
});

test('burst delay begins at first release and remains 300ms under overdrive', () => {
  const game = world(), tower = new Tower(0, 0, 'pulse', game);
  tower.level = 3; game.enemies = [target()];
  tower.update(0.01, game); tower.update(0.06, game);
  assert.equal(game.projectiles.length, 1); assert.equal(tower.pulseBursts[0].timer, 0.3);
  tower.updatePulseBurst(0.299, game); assert.equal(game.projectiles.length, 1);
  tower.updatePulseBurst(0.001, game); assert.equal(game.projectiles.length, 2);
  tower.overdriveTimer = 100; tower.targetEnemy = game.enemies[0]; tower.fire(game);
  assert.equal(tower.pulseBursts[0].timer, 0.3);
  tower.updatePulseBurst(0.3, game); assert.equal(game.projectiles.length, 4);
});

test('overlapping attack cycles queue every delayed shot without overwriting or duplicating', () => {
  const game = world(), tower = new Tower(0, 0, 'pulse', game);
  tower.level = 3; tower.overdriveTimer = 100; tower.targetEnemy = target();
  game.enemies = [tower.targetEnemy];
  tower.fire(game); tower.updatePulseBurst(0.1, game); tower.fire(game);
  assert.equal(game.projectiles.length, 2); assert.equal(tower.pulseBursts.length, 2);
  tower.updatePulseBurst(0.199, game); assert.equal(game.projectiles.length, 2);
  tower.updatePulseBurst(0.001, game); assert.equal(game.projectiles.length, 3);
  tower.updatePulseBurst(0.1, game); assert.equal(game.projectiles.length, 4);
  assert.equal(tower.pulseBursts.length, 0);
  tower.updatePulseBurst(1, game); assert.equal(game.projectiles.length, 4);
});

test('compression reselects a dead target and never fires at a departed target', () => {
  const game = world(), tower = new Tower(0, 0, 'pulse', game);
  const dead = target(), live = target(140); game.enemies = [dead, live];
  tower.update(0.01, game); dead.dead = true;
  tower.update(0.065, game);
  assert.equal(game.projectiles[0].target, live);
  const abandoned = new Tower(0, 0, 'pulse', game);
  game.enemies = [live]; abandoned.update(0.01, game); live.reachedEnd = true;
  abandoned.update(0.065, game);
  assert.equal(game.projectiles.length, 1);
});

test('rate and recovery stay bounded at 30/60/120Hz and under overdrive', () => {
  for (const overdrive of [false, true]) {
    const counts = [];
    for (const hz of [30, 60, 120]) {
      const game = world(), tower = new Tower(0, 0, 'pulse', game);
      tower.level = 3; tower.overdriveTimer = overdrive ? 100 : 0;
      game.enemies = [target()];
      for (let frame = 0; frame < hz * 10; frame++) tower.update(1 / hz, game);
      counts.push(game.projectiles.length);
      assert(tower.pulseAttackDuration <= 0.85 / tower.getEffectiveFireRate() + 1e-9);
      assert(tower.pulseSpriteElapsed <= 320);
    }
    assert(Math.max(...counts) - Math.min(...counts) <= 2, counts.join(','));
  }
});

test('a seed hits the rendered body edge once and creates one contact effect', () => {
  impacts = 0;
  const game = world(), enemy = target(), tower = new Tower(0, 0, 'pulse', game);
  enemy.getRenderPosition = () => ({ x: 120, y: 32 });
  const seed = new Projectile(40, 32, enemy, 'pulse', 39, 680, '#e2ab4a', tower, false, 48);
  seed.update(0.2, game); seed.update(0.2, game); seed.hit(game);
  assert.equal(enemy.hits, 1); assert.equal(enemy.hp, 961);
  assert.equal(tower.totalDamageDealt, 39); assert.equal(game.particles.length, 1);
  assert(game.particles[0] instanceof SeedImpact);
  assert(seed.x < 120); assert.equal(seed.y, 32); assert.equal(impacts, 1);
});

test('dead or exited targets show visual impact without damage', () => {
  for (const flag of ['dead', 'reachedEnd']) {
    const game = world(), enemy = target(), tower = new Tower(0, 0, 'pulse', game);
    const seed = new Projectile(40, 24, enemy, 'pulse', 39, 680, '#e2ab4a', tower);
    enemy[flag] = true; seed.update(0.3, game);
    assert(seed.destroyed); assert.equal(enemy.hp, 1000); assert.equal(game.particles.length, 1); assert.equal(tower.totalDamageDealt, 0);
  }
});

test('shield contacts suppress body flash; breakthrough damage still applies', () => {
  const game = world(), tower = new Tower(0, 0, 'pulse', game);
  const enemy = new Enemy('crawler', 1, [{ x: 120, y: 24 }, { x: 300, y: 24 }], game);
  enemy.shield = 60; enemy.hp = 1000;
  const first = new Projectile(110, 24, enemy, 'pulse', 39, 680, '#e2ab4a', tower);
  first.hit(game);
  assert.equal(enemy.hp, 1000); assert.equal(enemy.shield, 21);
  assert.equal(enemy.seedHitFlash, 0); assert.equal(game.floatTexts.length, 0);
  assert.equal(game.particles[0].shield, true); assert.equal(game.particles[0].shieldBroken, false);
  const second = new Projectile(110, 24, enemy, 'pulse', 39, 680, '#e2ab4a', tower);
  second.hit(game);
  assert.equal(enemy.hp, 982); assert.equal(enemy.shield, 0);
  assert.equal(game.totalDamage, 18); assert.equal(game.floatTexts.length, 1);
  assert(enemy.seedHitFlash > 0); assert.equal(game.particles[1].shieldBroken, true);
  assert.equal(enemy.x, 120); assert.equal(enemy.y, 24);
});

test('trail distance stays consistent across refresh rates', () => {
  for (const hz of [30, 60, 120]) {
    const game = world(), enemy = target(2000);
    const seed = new Projectile(0, 24, enemy, 'pulse', 39, 680, '#e2ab4a', null, false, 48);
    for (let i = 0; i < hz; i++) seed.update(1 / hz, game);
    assert(Math.abs(seed.travelledDistance - 680) < 1e-8);
    assert(seed.trail.length <= 12); assert(seed.trail.every(point => point.age < 0.09));
  }
});

test('body and shield hits draw the actual seed-shell and leaf materials, including reduced motion', () => {
  const originalDraw = art.drawEffect;
  try {
    for (const shield of [false, true]) for (const reduced of [false, true]) {
      const materials = [];
      art.reducedMotion = reduced;
      art.drawEffect = (_, name, x, y, width) => { materials.push({ name, width }); return true; };
      const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
      const effect = new SeedImpact(100, 24, 0, 48, false, shield);
      effect.update(0.15); effect.draw(ctx);
      for (const name of ['shellA', 'shellB', 'leafA', 'leafB']) {
        assert(materials.some(material => material.name === name && material.width >= 48 * 0.12));
      }
      assert(effect.life >= 0.25);
      effect.update(1); materials.length = 0; effect.draw(ctx); assert.equal(materials.length, 0);
    }
  } finally { art.drawEffect = originalDraw; art.reducedMotion = false; }
});

test('all 15 cannon poses and effect rectangles lie within shipped transparent PNGs', () => {
  const script = fs.readFileSync(path.join(__dirname, '../src/arcade/seed-cannon-art.js'), 'utf8');
  const images = [];
  class Image { constructor() { images.push(this); } addEventListener() {} }
  const window = { addEventListener() {}, matchMedia: () => ({ matches: false }) };
  vm.runInNewContext(script, { window, Image });
  const runtime = window.SeedCannonArt;
  const check = (file, rectangles) => {
    const png = fs.readFileSync(path.join(__dirname, '../src/assets/garden/seed-cannon', file));
    assert.equal(png[25], 6, 'RGBA PNG required');
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    for (const [x, y, w, h] of rectangles) assert(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height);
  };
  assert.equal(runtime.towerFrames.length, 3); assert(runtime.towerFrames.every(row => row.length === 5));
  check('cannons-v1.png', runtime.towerFrames.flat());
  check('effects-v1.png', Object.values(runtime.effectFrames));
  assert(images.every(image => fs.existsSync(path.join(__dirname, '../src', image.src))));
});
