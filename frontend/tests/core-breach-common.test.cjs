const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {test}=require('node:test'),B=require('../src/core-breach-blaster.js');
const source=fs.readFileSync(path.join(__dirname,'../src/core-breach-game.html'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
const upgrades=new Function(section('function universalUpgrades(s)','function weaponUpgrades(s)')+';return universalUpgrades;')();
const approx=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const stats=()=>({speed:165,damage:24,rate:1,crit:.08,critDamage:2});

test('four common cards expose percentage gains and compound their advertised speed, damage and attack frequency',()=>{
 const s=stats(),pool=upgrades(s);assert.deepEqual(pool.map(c=>c.icon),['speed','damage','crit','rate']);assert(pool.every(c=>c.desc.includes('%')&&c.tag==='通用'));
 for(let i=0;i<2;i++){upgrades(s).find(c=>c.icon==='speed').apply();upgrades(s).find(c=>c.icon==='damage').apply();upgrades(s).find(c=>c.icon==='rate').apply();}
 approx(s.speed,165*1.18**2);approx(s.damage,24*1.3**2);approx(1/s.rate,1.16**2);
});

test('one critical card raises both chance and critical multiplier; the chance cap displays the actual remaining percentage',()=>{
 const s=stats();upgrades(s).find(c=>c.icon==='crit').apply();approx(s.crit,.18);approx(s.critDamage,2.25);
 s.crit=.65;assert.match(upgrades(s).find(c=>c.icon==='crit').desc,/暴击率 \+3%/);upgrades(s).find(c=>c.icon==='crit').apply();approx(s.crit,.68);approx(s.critDamage,2.5);
 assert.match(upgrades(s).find(c=>c.icon==='crit').desc,/暴击率 \+0%/);upgrades(s).find(c=>c.icon==='crit').apply();approx(s.crit,.68);approx(s.critDamage,2.75);
});

test('attack speed floor never overstates the final card gain or offers an ineffective card',()=>{
 const s={...stats(),rate:.075};assert.match(upgrades(s).find(c=>c.icon==='rate').desc,/7.14%/);upgrades(s).find(c=>c.icon==='rate').apply();approx(s.rate,.07);assert(!upgrades(s).some(c=>c.icon==='rate'));
});

test('critical damage applies to ordinary and guaranteed extra criticals but not damage over time',()=>{
 approx(B.resolveHit(24,true,.18,()=>.1,2.25).amount,54);approx(B.resolveHit(144,{guaranteed:true},.18,()=>.2,2.25).amount,324);
 approx(B.resolveHit(144,{guaranteed:true},.18,()=>.1,2.25).amount,729);approx(B.resolveHit(24,false,1,()=>0,2.25).amount,24);
});

function harness(){
 const G={state:'playing',scene:'greenhouse',stageHpScale:1,enemyHpScale:1,time:0,spawn:1000,shot:1000,skill:0,timeStop:0,shake:0,eliteDone:true,weapon:'ak47',camX:250,camY:250,
 player:{x:500,y:500,r:9,hit:0,recoil:0,attack:0,step:0},stats:{...stats(),hp:100,maxHp:100,magnet:74},
 enemies:[],bolts:[],drops:[],items:[],particles:[],texts:[],ripples:[],slashes:[],beams:[]};
 const input={x:0,y:0},ui={calls:0};
 const update=new Function('G','input',`
 const MAP_W=1000,MAP_H=1000,WALL=20,width=500,height=500,keys={};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>(a+b)/2;
 const shoot=()=>true,updateUi=()=>{},finish=()=>{},banner=()=>{},spawnEnemy=()=>{};
 ${section('function update(dt)','function updateSwordFormations(dt)')}
 return update;`)(G,input);
 const useSkill=new Function('G','updateUi',`const MAP_W=1000,MAP_H=1000,sound=()=>{};${section('function useSkill()','function banner(text)')}return useSkill;`)(G,()=>ui.calls++);
 const enemy=(extra={})=>{const e={x:650,y:500,r:10,hp:1e6,maxHp:1e6,speed:60,damage:10,phase:1,seed:0,face:0,hit:0,kind:'crawler',...extra};G.enemies.push(e);return e;};
 return{G,input,update,useSkill,enemy};
}

test('time stop starts ready, activates once for two seconds and a 60s cooldown, and rejects paused/cooldown presses',()=>{
 const h=harness(),e=h.enemy();h.useSkill();assert.equal(h.G.skill,60);assert.equal(h.G.timeStop,2);assert.equal(e.hp,1e6);h.G.timeStop=1;h.useSkill();assert.equal(h.G.timeStop,1);
 h.G.skill=0;h.G.state='upgrade';h.useSkill();assert.equal(h.G.timeStop,1);h.G.state='playing';h.G.timeStop=0;h.update(.1);h.useSkill();assert.equal(h.G.timeStop,2);
});

test('all monsters and new arrivals stop moving, animating and dealing contact damage for exactly 2s at all frame rates',()=>{
 for(const fps of [30,60,120]){
  const h=harness();for(const kind of ['spore','crawler','bulwark','elite'])h.enemy({kind,x:kind==='crawler'?500:650});const initial=h.G.enemies.map(e=>({x:e.x,y:e.y,phase:e.phase,face:e.face}));
  h.useSkill();h.input.x=1;for(let i=0;i<fps;i++)h.update(1/fps);const newcomer=h.enemy({x:900});for(let i=0;i<fps;i++)h.update(1/fps);
  h.G.enemies.slice(0,4).forEach((e,i)=>assert.deepEqual({x:e.x,y:e.y,phase:e.phase,face:e.face},initial[i]));approx(newcomer.x,900);approx(h.G.stats.hp,100);approx(h.G.timeStop,0);approx(h.G.skill,58);assert(h.G.player.x>500);
  h.input.x=0;const before=newcomer.x;h.update(1/fps);assert(newcomer.x<before);
 }
});

test('a frame crossing the freeze end advances enemies only for the unfrozen portion',()=>{
 const h=harness(),e=h.enemy();h.G.timeStop=.1;h.update(.25);approx(e.x,641);approx(e.phase,1+.15*5);approx(h.G.timeStop,0);
});

test('magnetic pulls respect time stop while player attacks and delayed damage continue',()=>{
 let remaining=2;const e={x:650,y:500,r:10,hp:1000},hits=[];
 const c=new B.Combat({enemies:()=>[e],freezeRemaining:()=>remaining,damage:(target,amount)=>{hits.push(amount);target.hp-=amount;}});
 c.cores.push({x:620,y:500,radius:64,damage:24,split:0,plasma:0,state:'magnet',armedAt:0,detonateAt:.45,trail:[]});
 for(let i=0;i<120;i++){c.update(1/60);remaining=Math.max(0,remaining-1/60);approx(e.x,650);}
 assert.deepEqual(hits,[24]);assert(!c.isControlled(e));
});
