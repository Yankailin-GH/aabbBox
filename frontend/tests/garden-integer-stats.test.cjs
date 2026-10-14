const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/core-breach-legacy.html'),'utf8');
const config=name=>new Function(source.match(new RegExp('const '+name+' = \\{[\\s\\S]*?\\n\\};'))[0]+';return '+name+';')();
const configs=config('TOWER_CONFIGS'),enemies=config('ENEMY_TYPES');
const art={reducedMotion:false},sounds={playLaser(){},playElectricCurrent(){},playSeedShot(){},playFreeze(){}};
const {Tower,Enemy}=new Function('TOWER_CONFIGS','ENEMY_TYPES','COMBAT_SPEED_MULTIPLIER','GARDEN_TOWER_ART','SEED_CANNON_ART','sounds',source.slice(source.indexOf('class DefensiveTower {'),source.indexOf('// ==================== 14.'))+';return {Tower:DefensiveTower,Enemy:CreepEnemy};')(configs,enemies,.7,art,art,sounds);
const world=()=>({cellSize:50,scaleRatio:1,offsetX:0,offsetY:0,wave:1,currentMapIndex:0,totalDamage:0,particles:[],projectiles:[],floatTexts:[],towers:[],getStageBaseHp:()=>100,createParticleBurst(){},createFloatingText(){}});
const creep=(game,type='crawler')=>{const e=new Enemy(type,1,[{x:150,y:25},{x:300,y:25}],game);e.hp=e.maxHp=10000;return e;};

test('default upward rounding covers buffed damage, critical damage, second seeds, refund and scaled reference range',()=>{
 const game=world(),tower=new Tower(0,0,'pulse',game),flower=new Tower(1,0,'tesla',game);tower.level=2;game.towers=[tower,flower];
 assert.equal(tower.getEffectiveDamage(game),75);assert.equal(tower.getEffectiveRange({scaleRatio:.75}),215*.75);
 tower.investedEnergy=101;assert.equal(tower.getRefundValue(),76);
 tower.level=3;tower.targetEnemy=creep(game);game.enemies=[tower.targetEnemy];
 const original=Math.random;try{Math.random=()=>0;tower.fire(game);}finally{Math.random=original;}
 assert.equal(game.projectiles[0].damage,213);assert.equal(tower.pulseBursts[0].damage,171);assert.equal(tower.pulseBursts[0].timer,.3);
});

test('fractional armor damage and fractional spawned HP round upward; shield and HP stay integer',()=>{
 const game=world(),e=creep(game,'phantom');e.shield=1;
 e.takeDamage(10,'tesla',game,false,{type:'tesla'});assert.equal(e.hp,9992);assert.equal(e.shield,0);assert.equal(game.totalDamage,8);
 game.getStageBaseHp=()=>101;const spawned=new Enemy('crawler',1,[{x:0,y:0},{x:10,y:0}],game);
 assert.equal(spawned.maxHp,86);assert.equal(spawned.speed,46);
});

test('continuous flame integer HP and totals agree at 30/60/120Hz at every level and with armor/shields',()=>{
 for(const level of [1,2,3])for(const type of ['crawler','shielder','titan']) {
  const results=[];
  for(const fps of [30,60,120]) {
   const game=world(),tower=new Tower(0,0,'plasma',game);tower.level=level;tower.targetEnemy=creep(game,type);
   const e=tower.targetEnemy,shield=e.shield,base=tower.getEffectiveDamage()*tower.getEffectiveFireRate(),bonus=1.26*1.3**(level-1);
   for(let i=0;i<fps*4;i++){tower.cooldown-=1/fps;tower.updateFlameBeam(1/fps,game);assert(Number.isInteger(e.hp)&&Number.isInteger(e.shield)&&Number.isInteger(tower.totalDamageDealt)&&Number.isInteger(game.totalDamage));}
   const expected=Math.ceil(base*(4+bonus*2.5)*(1-e.defense)-1e-9);
   assert.equal(10000-e.hp,Math.max(0,expected-shield));assert.equal(tower.totalDamageDealt,Math.ceil(base*(4+bonus*2.5)-1e-9));results.push(e.hp);
  }assert.equal(new Set(results).size,1);
 }
});

test('independent fire sources preserve their own fractional credit and never emit negative damage',()=>{
 const game=world(),e=creep(game),a={type:'plasma'},b={type:'plasma'};
 for(let i=0;i<10;i++){e.takeDamage(.21,'fire',game,false,a);e.takeDamage(.21,'fire',game,false,b);}
 assert.equal(e.hp,9994);assert.equal(game.totalDamage,6);assert.equal(e.damageRemainders.size,2);
});

test('third-level chain distance is 169, without an extra point from floating-point growth noise',()=>{
 const game=world(),tower=new Tower(0,0,'tesla',game);tower.level=3;
 const a=creep(game),b=creep(game);a.x=100;b.x=269.5;tower.targetEnemy=a;game.enemies=[a,b];tower.fireTesla(game,162,false);
 assert.equal(b.hp,10000);b.x=269;tower.fireTesla(game,162,false);assert.equal(b.hp,9838);
});
