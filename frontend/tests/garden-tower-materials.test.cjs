const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/core-breach-legacy.html'),'utf8');
const configs=new Function(source.match(/const TOWER_CONFIGS = \{[\s\S]*?\n\};/)[0]+';return TOWER_CONFIGS;')();
const enemyConfigs=new Function(source.match(/const ENEMY_TYPES = \{[\s\S]*?\n\};/)[0]+';return ENEMY_TYPES;')();
const calls=[];const art={reducedMotion:false,hasType:type=>['tesla','plasma','buffer'].includes(type),getMuzzleOffset:()=>24,
 drawTower(ctx,...args){calls.push(['tower',...args]);return true;},drawEffect(ctx,...args){calls.push(args);return true;}};
const sounds={playLaser(){},playElectricCurrent(){}};
const {DefensiveTower:Tower,CreepEnemy:Enemy,GardenImpact,SolarFlameWave,LightningArc}=new Function('TOWER_CONFIGS','ENEMY_TYPES','COMBAT_SPEED_MULTIPLIER','GARDEN_TOWER_ART','sounds','drawUnitShadow','traceRoundRect',source.slice(source.indexOf('class DefensiveTower {'),source.indexOf('// ==================== 14.'))+';return {DefensiveTower,CreepEnemy,GardenImpact,SolarFlameWave,LightningArc};')(configs,enemyConfigs,.7,art,sounds,()=>{},()=>{});
const world=()=>({offsetX:0,offsetY:0,cellSize:50,scaleRatio:1,towers:[],enemies:[],particles:[],totalDamage:0,energy:10000,createParticleBurst(){throw Error('use real material fragments');},createFloatingText(){}});
const enemy=(x,y=25)=>({x,y,hp:10000,radius:12,distanceTraveled:100-x,shield:0,getRenderPosition(){return{x:this.x,y:this.y-5};},takeDamage(amount){this.hp-=amount;this.hits=(this.hits||0)+1;}});
const context=()=>new Proxy({}, {get:(_,key)=>key==='measureText'?()=>({width:20}):key.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:()=>true});

test('all three new tower families use all level/pose frames with quiet reduced-motion presentation',()=>{
 const game=world(),ctx=context();
 for(const type of ['tesla','plasma','buffer']) for(const level of [1,2,3]) {
  const tower=new Tower(0,0,type,game);tower.level=level;tower.targetEnemy=enemy(120);
  if(type==='plasma'){tower.lockDuration=1;tower.idleTimer=0;}
  for(const elapsed of [0,100,220,320]){tower.gardenSpriteElapsed=elapsed;calls.length=0;tower.drawGardenTower(ctx,50,configs[type].color);assert(calls.some(c=>c[0]==='tower'&&c[1]===type&&c[2]===level));}
  art.reducedMotion=true;calls.length=0;tower.drawGardenTower(ctx,50,configs[type].color);assert.equal(calls.find(c=>c[0]==='tower')[3],'idle');art.reducedMotion=false;
 }
});

test('every hit draws actual family fragments, leaves, sparks and afterglow without ghost damage',()=>{
 for(const type of ['tesla','plasma','buffer']) for(const reduced of [false,true]) {
  art.reducedMotion=reduced;const effect=new GardenImpact(type,150,25,0,50);effect.update(.13);calls.length=0;effect.draw(context());
  for(const name of ['impact','fragmentA','fragmentB','leaf','spark','dust','afterglow'])assert(calls.some(c=>c[0]===type&&c[1]===name),`${type} ${name}`);
  effect.update(1);calls.length=0;effect.draw(context());assert.equal(calls.length,0);
 }art.reducedMotion=false;
});

test('crystal chains respect logical range despite rendered body bounce, level cap and single hits',()=>{
 for(const level of [1,2,3]) {
  const game=world(),tower=new Tower(0,0,'tesla',game);tower.level=level;
  game.enemies=[enemy(100),enemy(160),enemy(220),enemy(280),enemy(340)];tower.targetEnemy=game.enemies[0];
  tower.fireTesla(game,63,false);assert.equal(game.enemies.filter(e=>e.hits).length,level+1);
  assert(game.enemies.every(e=>(e.hits||0)<=1));assert.equal(tower.totalDamageDealt,63*(level+1));
  assert.equal(game.particles.filter(p=>p instanceof LightningArc).length,level+1);
  assert.equal(game.particles.filter(p=>p instanceof GardenImpact).length,level+1);
 }
 const game=world(),tower=new Tower(0,0,'tesla',game);tower.targetEnemy=enemy(100);
 const far=enemy(201);game.enemies=[tower.targetEnemy,far];tower.fireTesla(game,63,false);assert.equal(far.hits,undefined);
});

test('crystal neighbor buff keeps original percentage and adjacency requirements',()=>{
 const game=world(),crystal=new Tower(0,0,'tesla',game),near=new Tower(1,0,'pulse',game),far=new Tower(3,0,'pulse',game);
 game.towers=[crystal,near,far];for(const level of [1,2,3]){crystal.level=level;assert.equal(near.getEffectiveDamage(game),Math.ceil(39*(1+.18*1.3**(level-1))));assert.equal(far.getEffectiveDamage(game),39);}
});

test('continuous fire preserves the integrated three-second ramp across 30/60/120Hz and target changes',()=>{
 const totals=[];for(const fps of [30,60,120]) {
  const game=world(),tower=new Tower(0,0,'plasma',game);tower.targetEnemy=enemy(150);
  for(let i=0;i<fps*4;i++){tower.cooldown-=1/fps;tower.updateFlameBeam(1/fps,game);}
  const base=tower.getEffectiveDamage()*tower.getEffectiveFireRate();
  const expected=base*(4+1.26*(1.5+1));assert.equal(tower.totalDamageDealt,Math.ceil(expected));totals.push(tower.totalDamageDealt);
  assert.equal(tower.lockDuration,3);tower.targetEnemy=enemy(140);tower.updateFlameBeam(.1,game);assert.equal(tower.lockDuration,.1);
  assert(game.particles.every(p=>p instanceof GardenImpact));
 }assert(Math.max(...totals)-Math.min(...totals)<1e-8);
});

test('fire beam texture stays aligned with bottle neck and disappears after the target dies',()=>{
 const game=world(),tower=new Tower(0,0,'plasma',game);tower.targetEnemy=enemy(150);tower.lockDuration=3;
 calls.length=0;tower.drawFlameBeam(context(),game);assert(calls.some(c=>c[0]==='plasma'&&c[1]==='beam'));
 tower.targetEnemy.dead=true;calls.length=0;tower.drawFlameBeam(context(),game);assert.equal(calls.length,0);
});

test('solar pulse still damages every target inside its exact radius once and wave only renders',()=>{
 for(const level of [1,2,3]) {
  const game=world(),tower=new Tower(0,0,'buffer',game);tower.level=level;const radius=tower.getEffectiveRange(game);
  const a=enemy(tower.x+radius-.1),b=enemy(tower.x+radius),far=enemy(tower.x+radius+.1),dead=enemy(tower.x+40);dead.dead=true;
  game.enemies=[a,b,far,dead];tower.fireSunPulse(game,51,false);assert.equal(a.hits,1);assert.equal(b.hits,1);assert.equal(far.hits,undefined);assert.equal(dead.hits,undefined);
  assert.equal(tower.totalDamageDealt,102);const wave=game.particles.find(p=>p instanceof SolarFlameWave);assert.equal(wave.radius,radius);
  calls.length=0;wave.draw(context());assert(calls.some(c=>c[0]==='buffer'&&c[1]==='beam'));assert(calls.some(c=>c[0]==='buffer'&&c[1]==='ray'));
  wave.update(.7);calls.length=0;wave.draw(context());assert.equal(calls.length,0);assert.equal(a.hits,1);
 }
});

test('crystal arcs use the real material; dead visual effects expire and never change health',()=>{
 const arc=new LightningArc(10,20,150,60,1);calls.length=0;arc.draw(context());assert(calls.some(c=>c[0]==='tesla'&&c[1]==='beam'));
 arc.update(.3);calls.length=0;arc.draw(context());assert.equal(calls.length,0);
});

test('new material hits suppress generic particles and only flash bodies after shield breakthrough',()=>{
 for(const type of ['tesla','plasma','buffer']){
  const game=world(),tower=new Tower(0,0,type,game),e=new Enemy('shielder',1,[{x:150,y:25},{x:200,y:25}],game);
  e.shield=120;const hp=e.hp;e.takeDamage(10,type==='buffer'?'pulse':type==='plasma'?'fire':'tesla',game,false,tower);
  assert.equal(e.hp,hp);assert.equal(e.gardenHitFlash,0);assert.equal(e.hitFlash,0);
  e.shield=1;e.takeDamage(10,type==='buffer'?'pulse':type==='plasma'?'fire':'tesla',game,false,tower);assert(e.gardenHitFlash>0);assert(e.hp<hp);
 }
});

test('six shipped transparent atlases, 45 frames, source rectangles and muzzle coordinates are valid',()=>{
 const window={addEventListener(){},matchMedia:()=>({matches:false})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/arcade/garden-tower-art.js'),'utf8'),{window,document:{currentScript:null},Image:class{constructor(){this.complete=true;this.naturalWidth=1536;}addEventListener(){}},URL});
 const api=window.GardenTowerArt;assert.equal(Object.keys(api.layout).length,3);
 for(const [type,data] of Object.entries(api.layout)) {
  assert.equal(data.towerFrames.flat().length,15);
  for(const f of [...data.towerFrames.flat(),...Object.values(data.effectFrames)]){const[x,y,w,h]=f;assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=1536&&y+h<=1024);}
  for(const kind of ['towers','effects']){const filename=data[kind==='towers'?'towerFile':'effectFile']||kind+'-v1.png';const png=fs.readFileSync(path.join(__dirname,'../src/assets/garden',data.folder,filename));assert.equal(png[25],6);assert.equal(png.readUInt32BE(16),1536);assert.equal(png.readUInt32BE(20),1024);}
  calls.length=0;api.drawTower({drawImage(...args){calls.push(args);}},type,3,'release',50);assert.equal(calls.length,1);
 }
 assert.equal(api.layout.tesla.towerFile,'towers-v2.png');assert.equal(api.layout.tesla.effectFile,'effects-v2.png');
 for(const level of [1,2,3])for(const pose of ['idle','charge','release','recoil','recover']){const offset=api.getMuzzleOffset(level,pose,50);assert(offset>15&&offset<30);}
});
