const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/core-breach-game.html'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
function harness(levels={}){
  const G={weapon:'dart',state:'playing',time:0,player:{x:500,y:500,face:0,step:0,moving:false,r:9,attack:0},
    stats:{damage:14,rate:.46,range:350,speed:165,projectiles:1,pierce:1,projectileSize:1,crit:0,dartVolley:0,dartMark:0,dartBlood:0,dartEnergy:0,dartAwakened:false,...levels},
    enemies:[],bolts:[],dartCuts:[],ripples:[]};
  G.stats.projectiles=1+G.stats.dartVolley;
  const hits=[],sounds=[];
  const api=new Function('G','clamp','dist','spark','weaponAttackSound','weaponHitSound','hurtEnemy',`
    ${source.match(/const MAP_W=1000[^\n]+/)[0]}
    ${source.match(/const DART_MOTION=[^\n]+/)[0]}
    ${source.match(/function shotOffset\(i\)[^\n]+/)[0]}
    ${section('function dartRange(s)','function spark(')}
    ${section('function getDartPose(','function drawDartArm(')}
    ${source.match(/function getPlayerBob\(p\)[^\n]+/)[0]}
    return {shoot,updateDartAttack,dartGrip,updateDartProjectiles,updateDartBolt,hitDartEnemy,catchDart,dartUpgrades,dartAwakeningReady,dartEnergyThreshold,clearDartCombat,dartRange};
  `)(G,(x,a,b)=>Math.max(a,Math.min(b,x)),(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),()=>{},kind=>sounds.push(kind),()=>{},(e,damage)=>{hits.push({e,damage});e.hp-=damage;return e.hp<=0;});
  function enemy(x=620,y=506,r=10,hp=1e5){const e={x,y,r,hp};G.enemies.push(e);return e;}
  function cast(){assert.equal(api.shoot(),true);api.updateDartAttack(.2);return G.bolts;}
  function tick(dt){G.time+=dt;api.updateDartProjectiles(dt);}
  function run(fps=60){for(let t=0;t<5&&G.bolts.length;t+=1/fps)tick(1/fps);assert.equal(G.bolts.length,0);}
  function single(){const b=G.bolts[0];G.bolts=[b];const grip=api.dartGrip();b.x=grip.x;b.y=grip.y;b.vx=b.speed;b.vy=0;return b;}
  return {G,hits,sounds,...api,enemy,cast,tick,run,single};
}

test('new pool has prerequisites, exact +1 volley growth and three-level caps',()=>{
 const h=harness(),s=h.G.stats;
 assert.deepEqual(h.dartUpgrades(s).map(o=>o.name),['幽刃齐发']);
 for(let level=1;level<=3;level++){
  h.dartUpgrades(s).find(o=>o.name==='幽刃齐发').apply();assert.equal(s.projectiles,level+1);assert.equal(s.dartVolley,level);
 }
 assert(!h.dartUpgrades(s).some(o=>o.name==='幽刃齐发'));
 for(let i=0;i<3;i++){h.dartUpgrades(s).find(o=>o.name==='幽月刻印').apply();h.dartUpgrades(s).find(o=>o.name==='血玉蓄锋').apply();}
 assert.equal(h.dartUpgrades(s).length,0);assert(h.dartAwakeningReady(s));
});

test('volley fans are centered, emit once and keep their committed level and damage',()=>{
 for(let level=0;level<=3;level++){
  const h=harness({dartVolley:level});h.enemy(600,500);h.shoot();h.G.stats.dartVolley=3;h.G.stats.projectiles=4;h.G.stats.damage=100;h.updateDartAttack(.2);
  assert.equal(h.G.bolts.length,level+1);assert.deepEqual(h.sounds,['dart']);
  const angles=h.G.bolts.map(b=>Math.atan2(b.vy,b.vx));assert(Math.abs(angles.reduce((a,b)=>a+b,0))<1e-9);
  for(const b of h.G.bolts){assert.equal(b.damage,14);assert.equal(b.foldLevel,level);}
 }
});

test('swept flight hits thin targets once per phase and computes the documented single-blade chain at 30/60/120fps',()=>{
 for(const fps of [30,60,120]){
  const h=harness({dartVolley:3,dartMark:1,dartBlood:1});const e=h.enemy(620,506,1);h.cast();h.single();h.run(fps);
  assert.equal(h.hits.filter(x=>x.e===e).length,2);assert(Math.abs(h.hits.reduce((n,x)=>n+x.damage,0)-32.2)<1e-9);assert.equal(h.G.stats.dartEnergy,1);assert.equal(e.dartMark,undefined);
 }
});

test('each blade has two outbound and two return targets, even with a large timestep',()=>{
 const h=harness({dartVolley:1});for(let i=0;i<4;i++)h.enemy(560+i*40,506,2);h.cast();const b=h.single();h.tick(.3);
 assert.equal(b.phase,'return');h.run();assert.equal(b.outHits.size,2);assert.equal(b.returnHits.size,2);assert.equal(h.hits.length,4);
});

test('return follows the moving grip, catches a swept segment and times out without a cut',()=>{
 const h=harness({dartVolley:3,dartAwakened:true,dartBlood:2,dartEnergy:6});h.enemy();h.cast();const b=h.single();h.tick(.7);assert.equal(b.phase,'return');
 h.G.player.x=650;h.G.player.y=600;h.run();assert.equal(h.G.dartCuts.length,1);assert.equal(h.G.dartCuts[0].x2,h.dartGrip().x);
 const expired=harness({dartVolley:3,dartAwakened:true,dartBlood:2,dartEnergy:6});expired.enemy();expired.cast();const c=expired.single();c.phase='return';c.turn={x:c.x,y:c.y};c.returnTime=3;assert(expired.updateDartBolt(c,1/60));assert.equal(expired.G.dartCuts.length,0);
});

test('wall and distance turnbacks retain a single fold point; no upgrade keeps straight-flight expiry',()=>{
 const h=harness({dartVolley:1});h.G.player.x=900;h.enemy(960,500);h.cast();const b=h.single();h.G.enemies=[];h.tick(.2);assert.equal(b.phase,'return');assert.equal(b.turn.x,980);h.run();
 const plain=harness();plain.enemy();plain.cast();const p=plain.single();plain.run();assert.equal(p.phase,'out');assert.equal(plain.G.dartCuts.length,0);
 const far=harness({dartVolley:1,range:2000});assert.equal(far.dartRange(far.G.stats),624);
});

test('shared marks are consumed once in a simultaneous four-blade volley and each blade has a three-mark budget',()=>{
 const h=harness({dartVolley:3,dartMark:3,dartBlood:1});const e=h.enemy(620,506,35);h.cast();h.run();assert.equal(h.hits.length,8);assert.equal(h.G.stats.dartEnergy,3);assert.equal(e.dartMark,undefined);
 const expected=4*14+4*13.3+3*4.9;assert(Math.abs(h.hits.reduce((n,x)=>n+x.damage,0)-expected)<1e-9);
 const budget=harness({dartVolley:3,dartMark:3});const target=budget.enemy();budget.cast();const b=budget.single();target.dartMark={layers:3,expires:100};budget.hitDartEnemy(b,target,'return');target.dartMark={layers:3,expires:100};budget.hitDartEnemy(b,target,'cut');assert.equal(target.dartMark.layers,3);assert.equal(b.consumed.get(target),3);
});

test('energy caps, lower thresholds and one charge per volley; charged hits and ultimate cannot recharge',()=>{
 const h=harness({dartVolley:3,dartMark:3,dartBlood:1,dartEnergy:8});h.enemy();h.cast();assert.equal(h.G.stats.dartEnergy,0);assert.equal(h.G.bolts.length,4);
 for(const b of h.G.bolts){assert.equal(b.damage,22.400000000000002);assert.equal(b.size,1.35);assert(b.charged);}
 h.run();assert.equal(h.G.stats.dartEnergy,0);
 const lower=harness({dartVolley:1,dartMark:1,dartBlood:1,dartEnergy:7});lower.dartUpgrades(lower.G.stats).find(o=>o.name==='血玉蓄锋').apply();assert.equal(lower.G.stats.dartEnergy,6);
 lower.enemy();lower.shoot();assert(lower.G.player.dartCast.charged);assert.equal(lower.G.stats.dartEnergy,0);lower.updateDartAttack(.2);assert(lower.G.bolts.every(b=>b.charged));
});

test('kill compensation awards only the newly added mark, expiry and empty catches yield no energy',()=>{
 const h=harness({dartVolley:1,dartMark:1,dartBlood:1});const e=h.enemy(570,506,1,1);e.dartMark={layers:2,expires:100};h.cast();h.single();h.run();assert.equal(h.G.stats.dartEnergy,1);
 const expired=harness({dartVolley:1,dartMark:1,dartBlood:1});const target=expired.enemy();expired.cast();const b=expired.single();target.dartMark={layers:3,expires:0};expired.hitDartEnemy(b,target,'return');assert.equal(expired.G.stats.dartEnergy,0);assert.equal(target.dartMark,undefined);
});

test('awakening cuts once per returned charged blade, clamps line length and resets all run state',()=>{
 const h=harness({dartVolley:3,dartMark:2,dartBlood:2,dartEnergy:6,dartAwakened:true});const e=h.enemy();h.cast();assert(h.G.bolts.every(b=>b.size===1.75));const b=h.single();h.run();assert.equal(h.G.dartCuts.length,1);assert(Math.abs(h.hits.reduce((n,x)=>n+x.damage,0)-73.92)<1e-9);h.catchDart(b,h.dartGrip());assert.equal(h.G.dartCuts.length,1);assert.equal(h.G.stats.dartEnergy,0);
 const c={...b,caught:false,turn:{x:0,y:0},consumed:new Map()};h.catchDart(c,{x:1000,y:1000});const cut=h.G.dartCuts.at(-1);assert(Math.abs(Math.hypot(cut.x2-cut.x1,cut.y2-cut.y1)-600)<1e-9);
 e.dartMark={layers:3,expires:100};h.G.stats.dartEnergy=6;h.G.player.dartCast={};h.G.bolts.push(c);h.clearDartCombat();assert.equal(h.G.bolts.length,0);assert.equal(h.G.dartCuts.length,0);assert.equal(e.dartMark,undefined);assert.equal(h.G.player.dartCast,null);assert.equal(h.G.stats.dartEnergy,0);
});

test('paused and upgrade states freeze flight and mark expiry until gameplay resumes',()=>{
 const h=harness({dartVolley:1,dartMark:1});const e=h.enemy();h.cast();const b=h.single();e.dartMark={layers:2,expires:3};
 const before={x:b.x,y:b.y,spin:b.spin,life:b.life};
 for(const state of ['paused','upgrade']){h.G.state=state;h.updateDartProjectiles(10);assert.deepEqual({x:b.x,y:b.y,spin:b.spin,life:b.life},before);assert.equal(e.dartMark.layers,2);assert.equal(h.G.bolts.length,1);}
 h.G.state='playing';h.G.time=4;h.updateDartProjectiles(1/60);assert.equal(e.dartMark,undefined);assert(b.x>before.x);
});

test('an exhausted return budget still catches and cuts; ordinary or unawakened catches do not cut',()=>{
 const h=harness({dartVolley:3,dartMark:2,dartBlood:2,dartEnergy:6,dartAwakened:true});h.enemy();h.cast();const b=h.single();b.phase='return';b.turn={x:700,y:b.y};b.x=700;b.returnBudget=0;h.run();assert.equal(h.G.dartCuts.length,1);assert.equal(h.hits.length,1);
 for(const levels of [{dartVolley:3,dartAwakened:true},{dartVolley:3,dartBlood:2,dartEnergy:6}]){const normal=harness(levels);normal.enemy();normal.cast();normal.single();normal.run();assert.equal(normal.G.dartCuts.length,0);}
});
