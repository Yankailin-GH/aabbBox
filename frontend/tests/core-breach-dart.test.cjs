const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/core-breach-game.html'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const world = source.match(/const MAP_W=1000[^\n]+/)[0];
const motion = source.match(/const DART_MOTION=[^\n]+/)[0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function harness(rate = .46, projectiles = 1, angle = 0) {
  const G = { weapon: 'dart', state:'playing', dartCuts:[], time:0, player: {x:500,y:500,face:0,attack:0},
    stats: {dartVolley:projectiles-1,dartMark:0,dartBlood:0,dartEnergy:0,speed:165,rate,projectiles,damage:14,pierce:1,projectileSize:1,range:350},
    enemies: [{x:500+Math.cos(angle)*100,y:500+Math.sin(angle)*100}], bolts: [] };
  const sounds = [], sparks = [];
  const api = new Function('G','clamp','dist','spark','weaponAttackSound', `
    ${world}
    ${motion}
    ${source.match(/function shotOffset\(i\)[^\n]+/)[0]}
    ${section('function dartRange(s)', 'function shoot()')}
    ${section('function shoot()', 'function spark(')}
    ${section('function getDartPose(', 'function drawDartArm(')}
    ${source.match(/function getPlayerBob\(p\)[^\n]+/)[0]}
    return {shoot,updateDartAttack,getDartPose};
  `)(G,clamp,distance,(...args)=>sparks.push(args),kind=>sounds.push(kind));
  return {G,sounds,sparks,...api};
}

test('windup keeps the blade in hand; release fires exactly once and plays sound at release', () => {
  for (const fps of [30,60,120]) {
    const h=harness();
    assert.equal(h.shoot(),true);
    assert.equal(h.G.bolts.length,0);
    assert.equal(h.sounds.length,0);
    const duration=h.G.player.dartCast.duration, releaseTime=duration*.42;
    let elapsed=0;
    while (h.G.player.dartCast) {
      h.updateDartAttack(1/fps); elapsed+=1/fps;
      assert.equal(h.G.bolts.length,elapsed+1e-12>=releaseTime?1:0);
    }
    assert.deepEqual(h.sounds,['dart']);
    assert.equal(h.sparks.length,1);
    assert.equal(h.G.player.attack,0);
    h.updateDartAttack(1);
    assert.equal(h.G.bolts.length,1);
  }
});

test('fast attacks finish before the next interval without losing or duplicating upgraded blades', () => {
  for (const rate of [.46,.1,.07]) for (const fps of [30,60,120]) {
    const h=harness(rate,4);
    for (let attack=0;attack<8;attack++) {
      assert.equal(h.shoot(),true);
      assert.equal(h.shoot(),false);
      for(let t=0;t<rate;t+=1/fps) h.updateDartAttack(1/fps);
      assert.equal(h.G.player.dartCast,null);
      assert.equal(h.G.bolts.length,(attack+1)*4);
    }
    assert.equal(h.sounds.length,8);
  }
});

test('a committed cast follows the moving hand, keeps its aim and snapshots its upgrades', () => {
  const h=harness(.46,3,Math.PI/2);
  h.shoot();
  h.G.player.x+=20;h.G.player.y+=15;
  h.G.enemies=[];h.G.stats.damage=100;h.G.stats.projectiles=4;
  h.updateDartAttack(.084);
  assert.equal(h.G.bolts.length,3);
  const b=h.G.bolts[1];
  assert.equal(b.damage,14);assert.equal(b.pierce,1);assert.equal(b.size,1);
  assert(Math.abs(b.x-(520-1.2))<1e-9);
  assert(Math.abs(b.y-(515+24+.54))<1e-9);
  assert(Math.abs(b.vx)<1e-9);assert.equal(b.vy,520);
  assert.equal(b.life,350/520+.18);
  assert.equal(h.G.player.face,Math.PI/2);
});

test('idle grip stays at the waist in every direction; released blades leave an empty hand then regrip', () => {
  for(let i=0;i<8;i++) {
    const h=harness(.46,1,i*Math.PI/4);
    h.G.player.face=i*Math.PI/4;
    const idle=h.getDartPose(h.G.player);
    assert.equal(idle.hand.y,10);
    assert.equal(Math.abs(idle.hand.x),24);
    h.shoot();
    const before=h.getDartPose(h.G.player,.28);
    const release=h.getDartPose(h.G.player,.42);
    const recovery=h.getDartPose(h.G.player,.68);
    const regrip=h.getDartPose(h.G.player,1);
    assert.equal(before.weaponAlpha,1);
    assert.equal(release.weaponAlpha,0);
    assert.equal(recovery.weaponAlpha,0);
    assert.equal(regrip.weaponAlpha,1);
    for(const pose of [idle,before,release,recovery,regrip])
      for(const point of [pose.hand,pose.shoulder,pose.elbow,pose.body])
        for(const v of Object.values(point)) assert(Number.isFinite(v));
  }
});
