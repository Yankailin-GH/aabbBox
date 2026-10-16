const assert=require('node:assert/strict');
const {test}=require('node:test');
const B=require('../src/core-breach-blaster.js');
function harness(stats={}){
 const enemies=[],hits=[],cues=[],player={x:500,y:500};
 const s={damage:24,crit:0,rate:1,range:330,projectiles:1,blasterField:0,blasterSplit:0,blasterPlasma:0,blasterAwakened:false,...stats};
 const combat=new B.Combat({enemies:()=>enemies,player:()=>player,stats:()=>s,damage(e,amount,crit){amount=B.resolveHit(amount,crit,s.crit,()=>0.5).amount;hits.push({e,amount,crit});e.hp-=amount;if(e.hp<=0)enemies.splice(enemies.indexOf(e),1);},cue:kind=>cues.push(kind)});
 function enemy(x=620,y=500,kind='crawler',hp=1e6,r=10){const e={x,y,kind,hp,r};enemies.push(e);return e;}
 function run(seconds,fps=60){for(let t=0;t<seconds-1e-8;t+=1/fps)combat.update(Math.min(1/fps,seconds-t));}
 function total(e){return hits.filter(h=>!e||h.e===e).reduce((n,h)=>n+h.amount,0);}
 function core(extra={}){return{x:620,y:500,radius:64,damage:24,field:0,split:0,plasma:0,strong:false,...extra};}
 return {s,combat,player,enemies,hits,cues,enemy,run,total,core};
}
function approx(a,b){assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);}

test('three branches repeat an identical gain at every level, rotate fairly and cap at nine upgrades',()=>{
 const h=harness(),s=h.s;assert.equal(new Set(Array.from({length:3},()=>B.chooseUpgrade(s,()=>0).name)).size,3);
 for(const key of ['blasterField','blasterSplit','blasterPlasma']){
  const descriptions=[];
  for(let n=1;n<=3;n++){const card=B.upgrades(s).find(o=>o.key===key);descriptions.push(card.desc.split(' · ')[1]);card.apply();assert.equal(s[key],n);}
  assert.equal(new Set(descriptions).size,1);
 }
 assert.equal(B.upgrades(s).length,0);assert.equal(B.chooseUpgrade(s),null);assert.equal(s.projectiles,1);approx(B.interval(s),1);assert(B.ready(s));assert(!B.ready({...s,blasterPlasma:1}));
});

test('field upgrades are exactly +16 radius and split upgrades never change primary count, damage or interval',()=>{
 for(let level=0;level<=3;level++){
  const h=harness({blasterField:level,blasterSplit:level,blasterPlasma:level});h.enemy();h.combat.fire(h.player,h.s);
  assert.equal(h.combat.cores.length,1);approx(h.combat.cores[0].radius,64+16*level);approx(h.combat.cores[0].damage,24);approx(B.interval(h.s),1);assert(!h.combat.cores[0].strong);
 }
});

test('a fired core snapshots all three levels, range and damage',()=>{
 const h=harness();h.enemy();h.combat.fire(h.player,h.s);Object.assign(h.s,{damage:200,range:1000,blasterField:3,blasterSplit:3,blasterPlasma:3});
 const c=h.combat.cores[0];assert.equal(c.radius,64);assert.equal(c.damage,24);assert.equal(c.range,330);assert.equal(c.split,0);h.run(2);approx(h.total(),30);assert.equal(h.combat.fields.length,0);
});

test('visible swept core hits a thin target once and explodes once at 30/60/120fps',()=>{
 for(const fps of [30,60,120]){const h=harness(),e=h.enemy(620,500,'boss',1e6,1);h.combat.fire(h.player,h.s);assert.equal(h.hits.length,0);h.run(1.5,fps);approx(h.total(e),30);assert.equal(h.hits.length,2);}
});

test('impact target death preserves the fixed magnet and its delayed area damage',()=>{
 const h=harness();h.enemy(600,500,'crawler',1);h.combat.fire(h.player,h.s);h.run(.15);assert.equal(h.enemies.length,0);const c=h.combat.cores[0],e=h.enemy(c.x+20,c.y);h.run(.6);approx(h.total(e),24);
});

test('misses and wall shots arm at legal endpoints and cannot lose the explosion',()=>{
 for(const wall of [false,true]){const h=harness();h.player.x=wall?950:500;h.enemy(wall?970:620);h.combat.fire(h.player,h.s);h.enemies.splice(0);h.run(wall?.1:.56);const c=h.combat.cores[0];assert.equal(c.state,'magnet');assert(c.x<=980&&c.x>=20);h.run(.8);assert.equal(h.combat.cores.length,0);assert(h.cues.includes('explode'));}
});

test('all enemy types reach the center with frame-independent capture and no stacked pull',()=>{
 for(const fps of [30,60,120])for(const count of [1,2]){
  const h=harness(),targets=[h.enemy(670,500),h.enemy(620,550,'elite'),h.enemy(570,500,'boss')];
  for(let i=0;i<count;i++)h.combat.cores.push({...h.core(),state:'magnet',armedAt:0,detonateAt:.45,trail:[]});
  h.run(.2,fps);for(const e of targets){approx(e.x,620);approx(e.y,500);assert(h.combat.isControlled(e));}
 }
});

test('capture prevents walking away and releases original movement when the source ends',()=>{
 for(const fps of [30,60,120]){
  const h=harness(),e=h.enemy(670,500);h.combat.cores.push({...h.core(),state:'magnet',armedAt:0,detonateAt:.45,trail:[]});
  const tick=dt=>{if(!h.combat.isControlled(e))e.x+=900*dt;h.combat.update(dt);};
  for(let t=0;t<.4-1e-9;t+=1/fps)tick(Math.min(1/fps,.4-t));approx(e.x,620);h.combat.update(.05);assert(!h.combat.isControlled(e));tick(.05);assert(e.x>620);
 }
});

test('split gains exactly one 30% microcore per level without a hidden primary penalty or recursive split',()=>{
 for(const fps of [30,60,120])for(let level=0;level<=3;level++){
  const h=harness({blasterSplit:level}),e=h.enemy(620,500,'boss');h.combat.fire(h.player,h.s);h.run(2,fps);
  approx(h.total(e),(1.25+.3*level)*24);assert.equal(h.hits.length,2+level);assert.equal(h.combat.micros.length,0);assert.equal(h.combat.microFields.length,0);
 }
});

test('microcores pursue their selected outside target and produce a 28px/0.45s control field only on impact',()=>{
 const h=harness(),cluster=h.enemy(625,500),target=h.enemy(750,500,'boss');h.combat.explode(h.core({split:1}),0);assert.equal(h.combat.micros[0].target,target);
 h.run(.02);assert.equal(h.combat.micros.length,1);assert.equal(h.combat.microFields.length,0);h.run(.2);const f=h.combat.microFields[0];assert(f);approx(f.radius,28);approx(f.end-f.born,.45);assert(h.combat.isControlled(target));assert(!h.combat.isControlled(cluster));h.run(.7);assert(!h.combat.isControlled(target));approx(h.total(target),7.2);
 const miss=harness();miss.enemy(750,500);miss.combat.explode(miss.core({split:1}),0);miss.enemies.splice(0);miss.run(.1);assert.equal(miss.combat.microFields.length,0);
});

test('plasma gains +12%D per second each level for a fixed 2.5s, without crit or an ending attack',()=>{
 for(const fps of [30,60,120])for(let level=1;level<=3;level++){
  const h=harness(),e=h.enemy(620,500,'boss');h.combat.explode(h.core({plasma:level}),0);const f=h.combat.fields[0];approx(f.duration,2.5);approx(f.rate,.12*level);h.hits.splice(0);h.run(3,fps);
  approx(h.total(e),2.5*.12*level*24);assert(h.hits.every(hit=>!hit.crit));const n=h.hits.length;h.run(1);assert.equal(h.hits.length,n);
 }
});

test('overlapping plasma uses its strongest rate and never adds two complete damage streams',()=>{
 const h=harness();h.enemy(620,500,'boss');h.combat.explode(h.core({plasma:1}),0);h.combat.explode(h.core({plasma:3,damage:12}),0);h.hits.splice(0);h.run(3);approx(h.total(),2.5*12*.36);
});

test('brief plasma entries flush fractional exposure without granting a free full tick',()=>{
 const h=harness(),e=h.enemy(620,500,'boss');h.combat.explode(h.core({plasma:2}),0);h.hits.splice(0);
 for(let i=0;i<6;i++){e.x=620;h.run(.1);e.x=800;h.run(.01);}approx(h.total(e),.6*24*.24);
});

test('aurora independently targets a boss, snapshots damage, uses separate beam/ground radii and waits for descent plus expansion before guaranteed crit',()=>{
 for(const fps of [30,60,120]){
  const h=harness({blasterField:2,blasterAwakened:true});h.enemy(550,500);const boss=h.enemy(650,500,'boss');h.run(.01,fps);const a=h.combat.auroras[0];assert(a);approx(a.x,650);approx(a.radius,144);approx(a.beamRadius,30);approx(a.landAt-a.born,.3);assert.equal(h.combat.cores.length,0);
  h.s.damage=100;h.s.blasterField=3;h.run(1.28,fps);assert.equal(h.hits.length,0);approx(h.combat.movementFactor(boss),1);h.run(.04,fps);approx(h.total(boss),288);assert(!h.combat.isControlled(boss));approx(h.combat.movementFactor(boss),.4);
  h.run(3.1,fps);approx(h.total(boss),360);assert.equal(h.combat.auroras.length,0);assert.equal(h.combat.auroraExposure.size,0);
 }
});

test('ten-second cooldown is independent of firing, banks only one strike and does not replace ordinary cores',()=>{
 const h=harness({rate:.07,blasterField:3,blasterSplit:3,blasterAwakened:true});h.enemy();h.run(.01);assert.equal(h.combat.auroras.length,1);h.combat.fire(h.player,h.s);h.combat.fire(h.player,h.s);assert.equal(h.combat.cores.length,2);assert(h.combat.cores.every(c=>!c.strong&&c.damage===24));approx(B.interval(h.s),.07);
 h.enemies.splice(0);h.run(9);assert(h.combat.cooldown>.9);h.run(2);approx(h.combat.cooldown,0);assert.equal(h.combat.auroras.length,0);h.enemy();h.run(.01);assert.equal(h.combat.auroras.length,1);h.run(.1);assert.equal(h.combat.auroras.length,1);assert(h.combat.cooldown>9.8);
 const timed=harness({blasterAwakened:true});timed.enemy();timed.run(9.99);assert.equal(timed.cues.filter(c=>c==='aurora').length,1);timed.run(.03);assert.equal(timed.cues.filter(c=>c==='aurora').length,2);
});

test('collapse lasts three seconds, slows by 60% without attraction and ends without bonus damage',()=>{
 const h=harness({blasterAwakened:true}),e=h.enemy(620,500,'boss');h.run(.01);const a=h.combat.auroras[0];approx(a.detonateAt-a.impactAt,3);e.x+=20;h.run(1.5);approx(e.x,640);assert(!h.combat.isControlled(e));approx(h.combat.movementFactor(e),.4);
 // An enemy can walk out; fractional DOT is settled without a free full tick.
 h.hits.splice(0);h.combat.auroraExposure.clear();h.run(.1);e.x+=100;h.run(.01);approx(h.total(e),2.4);approx(h.combat.movementFactor(e),1);assert(!h.combat.isControlled(e));
 h.run(3);assert.equal(h.combat.auroras.length,0);assert.equal(h.combat.micros.length,0);assert.equal(h.combat.fields.length,0);approx(h.total(e),2.4);
});

test('guaranteed 600% burst stacks exactly one additional ordinary critical and DOT never crits',()=>{
 approx(B.resolveHit(144,{guaranteed:true},0,()=>0).amount,288);
 const extra=B.resolveHit(144,{guaranteed:true},.18,()=>.1);approx(extra.amount,576);assert(extra.crit&&extra.extraCrit);
 approx(B.resolveHit(144,{guaranteed:true},.18,()=>.2).amount,288);
 approx(B.resolveHit(24,true,.18,()=>.1).amount,48);approx(B.resolveHit(24,false,1,()=>0).amount,24);
 const h=harness({crit:1,blasterAwakened:true});h.enemy();h.run(4.6);approx(h.total(),576+72);assert(h.hits.slice(1).every(hit=>hit.crit===false));
});

test('collapse DOT stacks with plasma independently and integrates exposure equally at 30/60/120fps',()=>{
 for(const fps of [30,60,120]){
  const h=harness({blasterAwakened:true});h.enemy();h.run(.01,fps);const a=h.combat.auroras[0];
  h.combat.fields.push({x:620,y:500,r:30,damage:24,rate:.36,born:a.impactAt,end:a.impactAt+2.5});
  h.run(4.6,fps);approx(h.total(),288+72+2.5*24*.36);
 }
});

test('pause freezes descending aurora, core flight, control and exposure; clear cancels all pending attacks',()=>{
 const h=harness({blasterAwakened:true});const e=h.enemy();h.combat.fire(h.player,h.s);h.run(.01);h.combat.explode(h.core({plasma:3}),0);h.combat.microFields.push({x:e.x,y:e.y,radius:28,born:0,end:.45,micro:true});assert(h.combat.isControlled(e));
 const time=h.combat.time,x=h.combat.cores[0].x,count=h.hits.length;h.combat.update(10,false);assert.equal(h.combat.time,time);assert.equal(h.combat.cores[0].x,x);assert.equal(h.combat.auroras[0].state,'descending');
 h.combat.clear();h.s.blasterAwakened=false;h.run(4);assert.equal(h.hits.length,count);for(const key of ['cores','micros','auroras','fields','microFields'])assert.equal(h.combat[key].length,0);assert.equal(h.combat.controls.size,0);assert.equal(h.combat.exposure.size,0);assert.equal(h.combat.auroraExposure.size,0);
});

test('ordinary control can overlap collapse but expiration releases movement into only a slow',()=>{
 const h=harness({blasterAwakened:true}),e=h.enemy();h.run(1.4);h.combat.cores.push({...h.core(),state:'magnet',armedAt:h.combat.time,detonateAt:h.combat.time+.2,trail:[]});
 h.run(.15);assert(h.combat.isControlled(e));h.run(.1);assert(!h.combat.isControlled(e));approx(h.combat.movementFactor(e),.4);
});

test('production sprite rectangles and hash still match the reused atlas metadata',()=>{
 const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'../素材库/弹壳打工/effects/blaster-magnetic-atlas');const meta=JSON.parse(fs.readFileSync(file+'.json','utf8')),png=fs.readFileSync(file+'.png');assert.equal(png.readUInt32BE(16),meta.width);assert.equal(png.readUInt32BE(20),meta.height);
 for(const [key,rect]of Object.entries(B.sprites)){const m=meta.sprites[key];assert.deepEqual(rect,[m.x,m.y,m.width,m.height]);}
 assert.equal(require('node:crypto').createHash('sha256').update(png).digest('hex'),meta.sha256);
});

test('staggered plasma lifetimes switch strongest sources without duplicate ticks or lost fractions',()=>{
 for(const fps of [30,60,120]){const h=harness();h.enemy(620,500,'boss');h.combat.explode(h.core({plasma:2}),0);h.run(.75,fps);h.combat.explode(h.core({plasma:2,damage:12}),h.combat.time);h.run(3,fps);approx(h.hits.filter(hit=>!hit.crit).reduce((sum,hit)=>sum+hit.amount,0),2.5*24*.24+.75*12*.24);}
});


test('aurora descends for .3s at radius 5, expands for 1s to radius 30 and fades over 1s',()=>{
 const h=harness({blasterAwakened:true});h.enemy();h.run(.01);const a=h.combat.auroras[0];
 const visual=t=>B.auroraVisual(a,a.born+t);
 approx(visual(.15).radius,5);approx(visual(.15).head,a.y-380);approx(visual(.3).head,a.y);approx(visual(.3).radius,5);
 approx(visual(.8).radius,17.5);approx(visual(1.3).radius,30);approx(visual(1.8).alpha,visual(1.3).alpha*.5);approx(visual(2.3).alpha,0);
});

test('instant burst touches exactly the beam edge; DOT and slow touch exactly the separate 1.5R ground edge',()=>{
 for(let level=0;level<=3;level++){
  const h=harness({blasterAwakened:true,blasterField:level}),center=h.enemy(620,500,'boss'),beamInside=h.enemy(659.9),beamOutside=h.enemy(660.1),r=B.radius(h.s)*1.5,groundInside=h.enemy(620+r+9.9),groundOutside=h.enemy(620+r+10.1);
  h.run(.01);const a=h.combat.auroras[0];approx(a.radius,r);approx(a.beamRadius,30);h.run(a.impactAt-h.combat.time);
  approx(h.total(center),288);approx(h.total(beamInside),288);approx(h.total(beamOutside),0);approx(h.total(groundInside),0);
  approx(h.combat.movementFactor(groundInside),.4);approx(h.combat.movementFactor(groundOutside),1);
  h.run(.5);approx(h.total(beamOutside),12);approx(h.total(groundInside),12);approx(h.total(groundOutside),0);
 }
});

test('straight yellow beam uses radius 30 at 60% opacity and ground uses clipped art without solid range rings',()=>{
 const calls=[];const ctx=new Proxy({globalAlpha:1,createLinearGradient:()=>({addColorStop:(...args)=>calls.push(['color',...args])}),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:(...args)=>calls.push([key,...args]),set:(target,key,value)=>{target[key]=value;return true;}});
 const h=harness({blasterAwakened:true});h.enemy();h.run(.01);const a=h.combat.auroras[0];h.combat.time=a.impactAt;h.combat.drawAurora(ctx,a);
 const rectangle=calls.find(c=>c[0]==='rect');approx(rectangle[1],a.x-30);approx(rectangle[3],60);
 const moves=calls.filter(c=>c[0]==='moveTo'),lines=calls.filter(c=>c[0]==='lineTo');assert.equal(moves.length,2);assert.equal(lines.length,2);lines.forEach((line,i)=>approx(line[1],moves[i][1]));assert(calls.some(c=>c[0]==='color'&&c[2]==='#f4fdff'));assert.equal(ctx.shadowColor,'#ffcd42');
 approx(B.auroraVisual(a,a.impactAt).alpha,.6);approx(B.auroraVisual(a,a.born+.15).alpha,.6);
 calls.length=0;ctx.globalAlpha=1;h.combat.drawCollapse(ctx,{complete:true,naturalWidth:1024},a);approx(ctx.globalAlpha,.4);const sprite=calls.find(c=>c[0]==='drawImage');approx(sprite[8],a.radius*2);assert(calls.some(c=>c[0]==='clip'));assert(!calls.some(c=>c[0]==='stroke'));
 calls.length=0;h.combat.drawVortex(ctx,null,620,500,64,0,false);assert(calls.some(c=>c[0]==='arc'&&c[3]===64));assert(calls.some(c=>c[0]==='clip'));
});


test('ruined-ground texture matches its runtime frame, dimensions and source hash',()=>{
 const fs=require('node:fs'),path=require('node:path'),base=path.join(__dirname,'../素材库/弹壳打工/effects/blaster-collapse-ruined-ground');
 const png=fs.readFileSync(base+'.png'),meta=JSON.parse(fs.readFileSync(base+'.json','utf8'));assert.equal(png.readUInt32BE(16),meta.width);assert.equal(png.readUInt32BE(20),meta.height);assert.deepEqual(B.collapseFrame,meta.frame);assert.equal(require('node:crypto').createHash('sha256').update(png).digest('hex'),meta.sha256);
});
