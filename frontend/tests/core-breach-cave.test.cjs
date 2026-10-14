const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/core-breach-game.html'), 'utf8');
const scenes = source.match(/const SCENES=\{[\s\S]*?\n    \};/)[0];
const palette = source.match(/const CAVE_PALETTE=\{[^\n]+/)[0];
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const campaignCode = section('const CAMPAIGN=', 'const CHARACTERS=');
const sceneConfigs = new Function(`${scenes};return SCENES;`)();
const getStageConfig = new Function(`${scenes}${campaignCode};return getStageConfig;`)();
const spawnCode = section('function spawnEnemy(type)', 'function shotOffset(i)');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const midpoint = (min, max) => (min + max) / 2;

function spawnHarness(time, hpScale = 1, stage = 5) {
  const config = getStageConfig(stage);
  const G = { scene: config.scene,stage,stageHpScale:config.hpScale,time, enemyHpScale: hpScale, enemies: [], camX: 250, camY: 250 };
  const rng = Object.create(Math);
  let roll = 0, calls = 0;
  rng.random = () => calls++ % 2 === 0 ? 0 : roll;
  const spawn = new Function('G', 'Math', 'rand', 'clamp', `
    const MAP_W=1000,MAP_H=1000,WALL=20,width=500,height=500;
    ${scenes}
    ${spawnCode}
    return spawnEnemy;
  `)(G, rng, midpoint, clamp);
  return { G, spawn(type, nextRoll = 0) { roll = nextRoll; calls = 0; spawn(type); } };
}

test('100 stages cycle through five map themes and stop at the campaign boundaries', () => {
  const elements = Object.fromEntries([
    'scene-stage', 'stage-number', 'scene-dots', 'scene-name',
    'region-name', 'start-btn', 'objective', 'selection-status',
    'prev-scene', 'next-scene',
  ].map(id => [id, { textContent: '', innerHTML: '', dataset: {}, attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; }, querySelector() { return {}; } }]));
  const carousel = new Function('ui', 'document', `
    ${scenes}
    ${campaignCode}
    const sceneOrder=Object.keys(SCENES),G={};let selectedScene='greenhouse',selectedStage=1;
    const buildSceneDecor=()=>{},draw=()=>{},animateSelection=()=>{};
    ${section('function selectStage(number', 'function cycleWeapon(direction)')}
    return {selectStage,cycleScene};
  `)(elements, { getElementById: id => elements[id] });
  carousel.selectStage(1);
  assert.equal(elements['prev-scene'].disabled, true);
  carousel.cycleScene(-1);
  assert.equal(elements['stage-number'].textContent, 1);
  for (let i = 0; i < 4; i++) carousel.cycleScene(1);
  assert.equal(elements['scene-name'].textContent, '幽晶洞窟');
  assert.equal(elements['region-name'].textContent, '地下矿场');
  assert.equal(elements['stage-number'].textContent, 5);
  assert.equal((elements['scene-dots'].innerHTML.match(/<i /g) || []).length, 5);
  assert.match(elements['scene-stage'].attributes['aria-label'], /第 5 关，共 100 关/);
  carousel.cycleScene(1);
  assert.equal(elements['scene-stage'].dataset.scene, 'greenhouse');
  assert.equal(elements['stage-number'].textContent, 6);
  assert.match(elements['selection-status'].textContent, /第 6 关，第 2 轮.*120%/);
  carousel.cycleScene(-1);
  assert.equal(elements['scene-stage'].dataset.scene, 'cave');
  carousel.selectStage(100);
  assert.equal(elements['next-scene'].disabled, true);
  assert.match(elements['scene-stage'].attributes['aria-label'], /第 100 关，共 100 关，第 20 轮/);
  carousel.cycleScene(1);
  assert.equal(elements['stage-number'].textContent, 100);
});

test('every group of five repeats the original theme order and compounds health by 20%', () => {
  const themes = ['greenhouse','grassland','desert','district','cave'];
  for (let cycle = 0; cycle < 20; cycle++) {
    const first = getStageConfig(cycle*5+1);
    for (let i = 0; i < 5; i++) {
      const stage = getStageConfig(cycle*5+i+1);
      assert.equal(stage.scene, themes[i]);
      assert.equal(stage.cycle, cycle+1);
      assert.equal(stage.hpScale, first.hpScale);
    }
    if (cycle) assert(Math.abs(first.hpScale/getStageConfig(cycle*5).hpScale-1.2)<1e-12);
  }
  assert.equal(getStageConfig(1).hpScale, 1);
  assert.equal(getStageConfig(6).hpScale, 1.2);
  assert.equal(getStageConfig(11).hpScale, 1.44);
  assert(Math.abs(getStageConfig(100).hpScale-31.94799993706227)<1e-10);
  assert.equal(getStageConfig(0).number,1);
  assert.equal(getStageConfig(101).number,100);
  assert.equal(getStageConfig('').number,1);
});

test('all normal enemies and bosses gain cycle health while manual difficulty, in-run growth, speed and damage remain independent', () => {
  for (const time of [0,60,120]) for (const kind of ['spore','crawler','bulwark','elite']) {
    const first=spawnHarness(time,1,5),second=spawnHarness(time,1,10),third=spawnHarness(time,1,15),hard=spawnHarness(time,2,10);
    for (const h of [first,second,third,hard]) h.spawn(kind);
    const [a,b,c,d]=[first,second,third,hard].map(h=>h.G.enemies[0]);
    assert(Math.abs(b.hp/a.hp-1.2)<1e-12);
    assert(Math.abs(c.hp/a.hp-1.44)<1e-12);
    assert.equal(d.hp,b.hp*2);
    assert.equal(b.speed,a.speed);
    assert.equal(b.damage,a.damage);
    assert.equal(b.r,a.r);
  }
});

test('starting a selected stage resets the run and preserves separate stage and difficulty multipliers', () => {
  const worldCode=source.match(/const MAP_W=1000[^\n]+/)[0];
  const G={enemies:[{}],kills:10,won:true,stage:5,stageHpScale:1};
  const reset = new Function('G','selectedStage','enemyHpPercent','clamp', `
    ${worldCode}
    ${scenes}
    ${campaignCode}
    const selectedWeapon='ak47',selectedCharacter='ranger',width=500,height=500;
    const buildSceneDecor=()=>{},syncSwords=()=>{},updateUi=()=>{};
    ${section('function reset()', 'function toggle(id,on)')}
    return reset;
  `)(G,6,150,clamp);
  reset();
  assert.equal(G.stage,6);
  assert.equal(G.scene,'greenhouse');
  assert.equal(G.stageHpScale,1.2);
  assert.equal(G.enemyHpScale,1.5);
  assert.equal(G.won,false);
  assert.equal(G.time,0);
  assert.equal(G.kills,0);
  assert.equal(G.enemies.length,0);
});

test('win advances one stage, loss retries the current stage, and stage 100 celebrates completion without wrapping', () => {
  for (const [stage,win,next,label] of [[5,true,6,'下一关 · 第 6 关'],[6,false,6,'重试第 6 关'],[100,true,100,'重试第 100 关']]) {
    const G={stage,scene:getStageConfig(stage).scene,time:180,kills:25,level:4};
    const ui=Object.fromEntries(['result-title','result-sub','result-stats'].map(id=>[id,{}]));
    const retry={};let started=0,selected;
    const result = new Function('G','ui','document','start','selectStage', `
      ${scenes}
      ${campaignCode}
      const raf=0,cancelAnimationFrame=()=>{},toggle=()=>{},formatTime=()=> '03:00';
      ${section('function finish(win=false)', 'function formatTime(t)')}
      return {finish,retryOrAdvance};
    `)(G,ui,{getElementById:()=>retry},()=>{started++;},number=>{selected=number;});
    result.finish(win);
    assert.equal(G.won,win);
    assert.equal(retry.textContent,label);
    if (stage===100) assert.equal(ui['result-title'].textContent,'百关完成');
    result.retryOrAdvance();
    assert.equal(selected,next);
    assert.equal(started,1);
  }
});

test('cave starts with bats and spiders, then adds 24% beetles without treating the cumulative threshold as a percentage', () => {
  for (const time of [0, 20, 20.001, 120]) {
    const h = spawnHarness(time);
    for (let i = 0; i < 100; i++) h.spawn(undefined, (i + 0.5) / 100);
    const counts = h.G.enemies.reduce((counts, e) => {
      counts[e.kind] = (counts[e.kind] || 0) + 1;
      return counts;
    }, {});
    assert.deepEqual(counts, time <= 20
      ? { spore: 24, crawler: 76 }
      : { bulwark: 24, spore: 28, crawler: 48 });
  }
});

test('cave enemy names, health difficulty and collision bounds use the shared combat rules', () => {
  const normal = spawnHarness(60), hard = spawnHarness(60, 2);
  for (const kind of ['spore', 'crawler', 'bulwark', 'elite']) {
    normal.spawn(kind); hard.spawn(kind);
    const a = normal.G.enemies.at(-1), b = hard.G.enemies.at(-1);
    assert.equal(a.name, sceneConfigs.cave.enemies[kind]);
    assert.equal(b.hp, a.hp * 2);
    assert.equal(b.speed, a.speed);
    assert.equal(b.damage, a.damage);
    assert(a.x >= 22 && a.x <= 978 && a.y >= 22 && a.y <= 978);
  }
  assert.equal(normal.G.enemies.at(-1).name, '晶脉岩王');
  assert(Math.abs(normal.G.enemies.at(-1).hp - 496.3636363636364) < 1e-9);
});

test('cave survives the whole timeline, spawns one boss and wins at 180 game seconds', () => {
  const G = { scene:'cave',stage:5,stageHpScale:1,time:0, state:'playing', enemyHpScale:1, spawn:0.4, shot:0,
    skill:0, shake:0, weapon:'ak47', camX:250, camY:250, eliteDone:false,
    player:{x:500,y:500,r:9,hit:0,recoil:0,attack:0,step:0},
    stats:{hp:1e6,maxHp:1e6,speed:0,rate:.15,magnet:74},
    enemies:[],bolts:[],drops:[],items:[],particles:[],texts:[],ripples:[],slashes:[],beams:[] };
  const finishes=[], banners=[];
  const update = new Function('G','rand','clamp','finish','banner', `
    const MAP_W=1000,MAP_H=1000,WALL=20,width=500,height=500;
    const input={x:0,y:0},keys={},shoot=()=>true,updateUi=()=>{};
    ${scenes}
    ${spawnCode}
    ${section('function update(dt)', 'function updateSwordFormations(dt)')}
    return update;
  `)(G, midpoint, clamp, win => { finishes.push(win); G.state='result'; }, text => banners.push(text));
  for (let i = 0; i < 59 * 60; i++) update(1/60);
  assert.equal(G.enemies.filter(e => e.kind === 'elite').length, 0);
  for (let i = 0; i < 2 * 60; i++) update(1/60);
  assert.equal(G.enemies.filter(e => e.kind === 'elite').length, 1);
  assert.equal(banners[0], '晶脉岩王苏醒');
  assert.equal(finishes.length, 0);
  while (G.time < 179) update(1/60);
  assert.equal(G.enemies.filter(e => e.kind === 'elite').length, 1);
  assert(G.enemies.length <= 111);
  assert.equal(finishes.length, 0);
  while (G.state === 'playing') update(1/60);
  assert.deepEqual(finishes, [true]);
  assert(G.time >= 180 && G.time < 180.034);
});

test('ground and all four enemy renderers accept every scene with valid drawing values and balanced canvas state', () => {
  let depth=0, draws=0;
  const ctx = new Proxy({}, {
    get(_, method) {
      if (method === 'save') return () => { depth++; };
      if (method === 'restore') return () => { assert(depth > 0); depth--; };
      if (method === 'createRadialGradient') return () => ({addColorStop(){}});
      return (...args) => {
        draws++;
        for (const value of args) if (typeof value === 'number') assert(Number.isFinite(value), method);
        if (method === 'arc' || method === 'ellipse') assert(args[2] >= 0, method);
      };
    },
    set(_, key, value) { assert.notEqual(value, undefined, key); return true; },
  });
  const G={scene:'cave',time:120,player:{x:500,y:500},decor:Array.from({length:100}, (_,i) => ({x:100+i*6,y:100+i*7,r:9,a:.2,variant:i%4,tone:.6}))};
  const render = new Function('ctx','G','clamp', `
    const MAP_W=1000,MAP_H=1000,WALL=20,MODEL_SCALE=.6,selectedScene='greenhouse';
    ${scenes}
    ${palette}
    ${section('function drawGround()', 'function drawPlayer(p)')}
    ${section('function enemyTone(e,color)', 'function drawBeam(b)')}
    return {drawGround,drawArenaWalls,drawEnemy};
  `)(ctx,G,clamp);
  for (const scene of Object.keys(sceneConfigs)) {
    G.scene=scene;
    render.drawGround(); render.drawArenaWalls();
    for (const kind of ['spore','crawler','bulwark','elite']) for (const hit of [0,.1]) {
      render.drawEnemy({kind,hit,x:500,y:500,face:.6,phase:2,seed:1,variant:1,hp:10,maxHp:20,r:21});
    }
    assert.equal(depth,0,scene);
  }
  assert(draws > 1000);
});
