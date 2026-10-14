const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const assert=require('node:assert/strict'); const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/core-breach-legacy.html'),'utf8');
const configs=new Function(source.match(/const TOWER_CONFIGS = \{[\s\S]*?\n\};/)[0]+';return TOWER_CONFIGS;')();
const enemyConfigs=new Function(source.match(/const ENEMY_TYPES = \{[\s\S]*?\n\};/)[0]+';return ENEMY_TYPES;')();
const calls=[]; const art={reducedMotion:false,drawEffect(ctx,name,...args){calls.push([name,...args]);return true;},drawTower(ctx,level,pose,size){calls.push(['tower',level,pose,size]);return true;}};
let shots=0;const sounds={playFreeze(){shots++;}};
const classes=source.slice(source.indexOf('class DefensiveTower {'),source.indexOf('// ==================== 13.'));
const {DefensiveTower:Tower,CreepEnemy:Enemy,Projectile,IceImpact,IcePatch}=new Function('TOWER_CONFIGS','ENEMY_TYPES','COMBAT_SPEED_MULTIPLIER','ICE_STAR_ART','SEED_CANNON_ART','sounds','drawUnitShadow',classes+';return {DefensiveTower,CreepEnemy,Projectile,IceImpact,IcePatch};')(configs,enemyConfigs,0.7,art,{reducedMotion:false},sounds,()=>{});
const world=()=>({offsetX:0,offsetY:0,cellSize:50,scaleRatio:1,energy:100000,enemies:[],towers:[],projectiles:[],particles:[],icePatches:[],totalDamage:0,floatTexts:[],createFloatingText(){},createParticleBurst(){throw Error('ice must use material fragments');}});
const target=(x=150)=>({x,y:25,hp:10000,radius:12,distanceTraveled:1,shield:0,getRenderPosition(){return{x:this.x,y:this.y};},takeDamage(amount){this.hp-=amount;this.hits=(this.hits||0)+1;}});
const ctx=()=>new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});

test('ice star charges for 100ms and releases only one projectile with original damage/speed',()=>{
  const game=world(),tower=new Tower(0,0,'cryo',game);game.enemies=[target()];
  tower.playCryoAttack(2.5);tower.updateCryoSprite(0.099,game);
  assert.equal(game.projectiles.length,0);tower.updateCryoSprite(0.001,game);
  assert.equal(game.projectiles.length,1);assert.equal(tower.cryoShotPending,false);
  const ball=game.projectiles[0];assert.equal(ball.speed,300);assert.equal(ball.cellSize,50);
  assert([27,48.6].some(value=>Math.abs(value-ball.damage)<1e-8));
  assert.equal(ball.x,tower.x+20);
  tower.updateCryoSprite(0.5,game);assert.equal(game.projectiles.length,1);assert.equal(tower.cryoSpriteState,'idle');
});

test('charging reselects a dead target and cancels when all targets leave',()=>{
  const game=world(),tower=new Tower(0,0,'cryo',game),first=target(130),second=target(160);
  game.enemies=[first,second];tower.playCryoAttack(2.5);first.dead=true;
  tower.updateCryoSprite(0.1,game);assert.equal(game.projectiles[0].target,second);
  tower.playCryoAttack(2.5);second.reachedEnd=true;tower.updateCryoSprite(0.1,game);
  assert.equal(game.projectiles.length,1);assert.equal(tower.cryoShotPending,false);
});

test('all levels preserve intended firing frequency at 30/60/120Hz and overdrive',()=>{
  for(const fps of [30,60,120]) for(const level of [1,2,3]) for(const boost of [false,true]) {
    const game=world(),tower=new Tower(0,0,'cryo',game);tower.level=level;tower.overdriveTimer=boost?100:0;
    game.enemies=[target()];const frequency=tower.getEffectiveFireRate();
    for(let i=0;i<fps*10;i++)tower.update(1/fps,game);
    assert(Math.abs(game.projectiles.length-10*frequency)<=1.2,`${fps}Hz Lv${level} boost=${boost}`);
    assert(tower.cryoAttackDuration<=0.42);
  }
});

test('snowball lands at body edge once; frost patch retains target center and original range/lifetime',()=>{
  const game=world(),tower=new Tower(0,0,'cryo',game),enemy=target();game.enemies=[enemy];
  const ball=new Projectile(45,25,enemy,'cryo',27,300,'#fff',tower,false,50);
  for(let i=0;i<50;i++)ball.update(1/60,game);
  assert.equal(enemy.hits,1);assert.equal(enemy.hp,9973);assert.equal(tower.totalDamageDealt,27);
  assert.equal(game.particles.length,1);assert(game.particles[0] instanceof IceImpact);
  const patch=game.icePatches[0];assert.equal(patch.x,enemy.x);assert.equal(patch.y,enemy.y);
  assert.equal(patch.radius,45);assert.equal(patch.life,2.5);assert.equal(patch.slowFactor,0.64);
  assert(patch.contains(enemy.x+44,enemy.y));assert(!patch.contains(enemy.x+46,enemy.y));
  assert(ball.x<enemy.x);assert.equal(ball.getSnowballPosition().y,ball.y);
});

test('dead or exited targets get one material effect without ghost damage',()=>{
  for(const state of ['dead','reachedEnd']) {
    const game=world(),tower=new Tower(0,0,'cryo',game),enemy=target();enemy[state]=true;
    enemy.seedDeathPosition={x:170,y:30};enemy.takeDamage=()=>{throw Error('ghost damage');};
    const ball=new Projectile(45,25,enemy,'cryo',27,300,'#fff',tower,false,50);
    ball.update(1,game);ball.update(1,game);
    assert.equal(ball.x,170);assert.equal(game.particles.length,1);assert.equal(tower.totalDamageDealt,0);
  }
});

test('flight height and trail length agree across frame rates and hit position remains grounded',()=>{
  const positions=[];
  for(const fps of [30,60,120]) {
    const game=world(),tower=new Tower(0,0,'cryo',game),enemy=target(300);
    const ball=new Projectile(45,25,enemy,'cryo',27,300,'#fff',tower,false,50);
    for(let i=0;i<fps/5;i++)ball.update(1/fps,game);
    positions.push(ball.getSnowballPosition());calls.length=0;ball.draw(ctx());
    assert(calls.some(call=>call[0]==='trail'));assert(calls.some(call=>call[0]==='snowball'));
  }
  positions.forEach(pos=>{assert(Math.abs(pos.x-positions[0].x)<1e-8);assert(Math.abs(pos.y-positions[0].y)<1e-8);});
});

test('ice and shield impacts really draw ice shards, frosted leaves and snow, also in reduced motion',()=>{
  for(const reduced of [false,true]) for(const shield of [false,true]) {
    art.reducedMotion=reduced;const effect=new IceImpact(150,25,0,50,false,shield);effect.update(0.12);
    calls.length=0;effect.draw(ctx());
    assert(calls.some(call=>call[0]==='impact'));
    for(const name of ['iceA','iceB','leafA','leafB','snowA','snowB','snowC','snowD','snowE']) assert(calls.some(call=>call[0]===name),name);
    effect.update(1);calls.length=0;effect.draw(ctx());assert.equal(calls.length,0);
  }art.reducedMotion=false;
});

test('shielded hits leave slow patch without a false body flash or duplicated generic particles',()=>{
  const game=world(),tower=new Tower(0,0,'cryo',game),enemy=new Enemy('shielder',1,[{x:150,y:25},{x:300,y:25}],game);
  const hp=enemy.hp;enemy.shield=120;enemy.takeDamage(27,'cryo',game,false,tower);
  assert.equal(enemy.hp,hp);assert.equal(enemy.iceHitFlash,0);assert.equal(enemy.hitFlash,0);
  enemy.shield=5;enemy.takeDamage(27,'cryo',game,false,tower);assert(enemy.iceHitFlash>0);assert(enemy.hp<hp);
});

test('ice patch uses all three texture phases, fades and retains its footprint in reduced motion',()=>{
  const game=world(),tower=new Tower(0,0,'cryo',game),patch=new IcePatch(150,25,tower,game);
  for(const [age,life,name] of [[0.1,2.4,'patchBirth'],[0.5,2,'patchActive'],[2.2,0.3,'patchFade']]) {
    patch.age=age;patch.life=life;calls.length=0;patch.draw(ctx());assert(calls.some(call=>call[0]===name));
  }
  art.reducedMotion=true;patch.age=0;patch.life=2.5;calls.length=0;patch.draw(ctx());
  assert.equal(calls[0][0],'patchActive');assert.equal(calls[0][3],90);art.reducedMotion=false;
  game.icePatches=[patch];const newer=new IcePatch(150,25,tower,game);assert.equal(newer.birthDuration,0);
});

test('fifteen tower poses, preview canvases and effect source rectangles use shipped assets safely',()=>{
  const sandbox={Image:class {constructor(){this.complete=true;this.naturalWidth=1536;} addEventListener(){}},document:{currentScript:null},URL,window:{addEventListener(){},matchMedia:()=>({matches:false})}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/arcade/ice-star-art.js'),'utf8'),sandbox);
  const asset=sandbox.window.IceStarArt;assert.equal(asset.towerFrames.flat().length,15);
  for(const frame of [...asset.towerFrames.flat(),...Object.values(asset.effectFrames)]) {
    const[x,y,w,h]=frame;assert(x>=0&&y>=0&&x+w<=1536&&y+h<=1024);
  }
  const draws=[];const canvas={width:128,height:128,dataset:{iceLevel:'3'},getContext:()=>({...ctx(),clearRect(){},save(){},translate(){},restore(){},drawImage(...args){draws.push(args);}})};
  asset.paintPreview(canvas);assert.equal(draws.length,1);assert.equal(draws[0][1],asset.towerFrames[2][0][0]);
  for(const name of ['towers-v1.png','effects-v1.png']) {
    const png=fs.readFileSync(path.join(__dirname,'../素材库/花园防线/ice-star',name));
    assert.equal(png.readUInt32BE(16),1536);assert.equal(png.readUInt32BE(20),1024);assert.equal(png[25],6);
  }
});
